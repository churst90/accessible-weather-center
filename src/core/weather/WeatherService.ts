import type {
  ForecastPeriod,
  HourlyForecastPoint,
  LatLon,
  LocationInfo,
  NearbyObservation,
  Observation,
  Place,
  PressureTrend,
  WeatherAlert
} from "../types";
import { NwsClient } from "./NwsClient";

/**
 * Facade over the weather data clients with simple in-memory caching.
 * This is the only thing the scene system should call — it hides which
 * upstream answered, applies TTLs, and gives the rest of the app a single
 * stable API per question.
 *
 * Caches are intentionally tiny and process-local. Persistent caching can be
 * added later behind the same interface without changing callers.
 */
export class WeatherService {
  constructor(private readonly nws: NwsClient) {}

  private gridCache = new Map<string, Promise<Place>>();
  private obsCache = new Map<string, { at: number; value: Observation | null }>();
  private forecastCache = new Map<string, { at: number; value: ForecastPeriod[] }>();
  private hourlyCache = new Map<string, { at: number; value: HourlyForecastPoint[] }>();
  private alertCache = new Map<string, { at: number; value: WeatherAlert[] }>();
  private nearbyCache = new Map<string, { at: number; value: NearbyObservation[] }>();
  private geoCache = new Map<string, { at: number; value: LocationInfo }>();

  /**
   * Cache TTLs — how long a value may be reused before the next request
   * goes back upstream.
   *
   * The observation TTL must sit BELOW the 60-second background refresh
   * interval in App.tsx, not at or above it. It used to be five minutes
   * against a five-minute refresh, which meant the poll kept landing a hair
   * inside its own window and being answered from memory — the temperature
   * on screen could be the better part of ten minutes old while everything
   * looked live. At 45 seconds every poll is a real fetch, so what's
   * displayed is never more than about a minute behind the wire.
   *
   * Forecast and hourly stay longer because NWS only regenerates them every
   * hour or so; polling those faster would spend requests to receive the
   * same bytes.
   *
   * The cost is bounded: the background refresh is the only thing on a
   * timer and concurrent misses are collapsed, so this is one observation
   * request per minute, well inside the NWS API's published limits.
   */
  private static readonly OBS_TTL_MS = 45_000;
  private static readonly FORECAST_TTL_MS = 10 * 60_000;
  private static readonly HOURLY_TTL_MS = 5 * 60_000;
  private static readonly ALERT_TTL_MS = 45_000;
  private static readonly GEO_TTL_MS = 60 * 60_000; // 1 hour — locations don't change
  /**
   * The city ticker's stations, held for ten minutes.
   *
   * Long, because this is the one call that costs more than one request:
   * `getNearbyObservations(n)` makes n of them. A crawl that takes two
   * minutes to cycle does not benefit from fresher data than that, and the
   * observations behind it are hourly anyway.
   */
  private static readonly NEARBY_TTL_MS = 10 * 60_000;
  /** How many markets the ticker carries. Also the per-refresh request cost. */
  private static readonly NEARBY_COUNT = 6;

  /**
   * In-flight fetches, keyed the same way as the caches. Without this, the
   * 60-second refresh timer and a scene entering at the same moment each
   * start their own request for the same product. Collapsing them means a
   * faster poll costs no extra network traffic.
   */
  private inflight = new Map<string, Promise<unknown>>();

  async ensureGrid(place: Place): Promise<Place> {
    if (place.nwsGrid) return place;
    const key = place.id;
    let inflight = this.gridCache.get(key);
    if (!inflight) {
      inflight = this.nws.resolveGridpoint(place.coord).then((grid) => ({ ...place, nwsGrid: grid }));
      // Evict on failure. Caching the rejected promise means one bad launch
      // (offline start, NWS blip outlasting the client's retries) poisons
      // every future request for this place until app restart.
      inflight.catch(() => {
        if (this.gridCache.get(key) === inflight) this.gridCache.delete(key);
      });
      this.gridCache.set(key, inflight);
    }
    return inflight;
  }

  /**
   * Barometer readings kept per place so the pressure trend can be derived.
   *
   * NWS does not publish a tendency field, and the WeatherStar 4000 v2 drew a
   * trend arrow beside the pressure, so the only way to have one is to
   * remember. This is the layer that sees more than one observation —
   * NwsClient is stateless by design — so it lives here.
   */
  private readonly pressureLog = new Map<string, Array<{ at: number; inHg: number }>>();

  /** Ignore anything under this: 0.02 inHg is inside station noise. */
  private static readonly PRESSURE_STEADY_INHG = 0.02;
  /** Compare against a reading at least this old. Obs update roughly hourly. */
  private static readonly PRESSURE_MIN_SPAN_MS = 40 * 60_000;
  /** ...and no older than this, or the "trend" is yesterday's weather. */
  private static readonly PRESSURE_MAX_SPAN_MS = 6 * 60 * 60_000;

  async getObservation(place: Place): Promise<Observation | null> {
    const ready = await this.ensureGrid(place);
    const obs = await this.cached(this.obsCache, ready.id, WeatherService.OBS_TTL_MS, "obs", () =>
      this.nws.getLatestObservation(ready.nwsGrid!, ready.id)
    );
    return obs ? { ...obs, pressureTrend: this.trackPressure(ready.id, obs) } : obs;
  }

  /**
   * Record this reading and report the direction, or null if it cannot be
   * known yet.
   *
   * Keyed on the observation's own timestamp rather than arrival time, so the
   * 60-second poll re-reading the same hourly observation does not stack
   * duplicates and flatten the trend to "steady".
   */
  private trackPressure(placeId: string, obs: Observation): PressureTrend | null {
    if (obs.pressureInHg === null) return null;
    const at = obs.observedAt.getTime();
    const log = this.pressureLog.get(placeId) ?? [];

    if (!log.some((e) => e.at === at)) {
      log.push({ at, inHg: obs.pressureInHg });
      log.sort((a, b) => a.at - b.at);
      // A day of hourly readings is plenty; anything older cannot inform a
      // trend and would grow without bound over a long session.
      while (log.length > 24) log.shift();
      this.pressureLog.set(placeId, log);
    }

    // Newest reading at or beyond the minimum span, so a run of closely
    // spaced observations does not report a trend off two minutes' drift.
    const earlier = [...log]
      .reverse()
      .find((e) => at - e.at >= WeatherService.PRESSURE_MIN_SPAN_MS
                && at - e.at <= WeatherService.PRESSURE_MAX_SPAN_MS);
    if (!earlier) return null;

    const delta = obs.pressureInHg - earlier.inHg;
    if (Math.abs(delta) < WeatherService.PRESSURE_STEADY_INHG) return "steady";
    return delta > 0 ? "rising" : "falling";
  }

  /** Nearby markets' conditions, for the Weatherscan city ticker. */
  async getNearbyObservations(place: Place): Promise<NearbyObservation[]> {
    const ready = await this.ensureGrid(place);
    return this.cached(
      this.nearbyCache, ready.id, WeatherService.NEARBY_TTL_MS, "nearby",
      () => this.nws.getNearbyObservations(ready.nwsGrid!, WeatherService.NEARBY_COUNT)
    );
  }

  async getForecast(place: Place): Promise<ForecastPeriod[]> {
    const ready = await this.ensureGrid(place);
    return this.cached(this.forecastCache, ready.id, WeatherService.FORECAST_TTL_MS, "forecast", () =>
      this.nws.getForecast(ready.nwsGrid!)
    );
  }

  async getHourly(place: Place): Promise<HourlyForecastPoint[]> {
    const ready = await this.ensureGrid(place);
    return this.cached(this.hourlyCache, ready.id, WeatherService.HOURLY_TTL_MS, "hourly", () =>
      this.nws.getHourlyForecast(ready.nwsGrid!)
    );
  }

  async getActiveAlerts(place: Place): Promise<WeatherAlert[]> {
    return this.cached(this.alertCache, place.id, WeatherService.ALERT_TTL_MS, "alerts", () =>
      this.nws.getActiveAlerts(place.coord)
    );
  }

  /**
   * Reverse geocode a lat/lon to the nearest city, state, and county.
   * Results are cached for 1 hour and keyed by rounded coordinates
   * (0.01° ≈ 0.7 miles) to collapse nearby lookups.
   */
  async reverseGeocode(coord: LatLon): Promise<LocationInfo> {
    const key = `${coord.lat.toFixed(2)},${coord.lon.toFixed(2)}`;
    return this.cached(this.geoCache, key, WeatherService.GEO_TTL_MS, "geo", () =>
      this.nws.reverseGeocode(coord)
    );
  }

  /**
   * When did we last successfully fetch this kind of data for this place?
   * Lets scenes qualify what they show ("as of 12 minutes ago") when a
   * refresh fails and stale data is served instead.
   */
  lastFetchedAt(kind: "observation" | "forecast" | "hourly" | "alerts", key: string): Date | null {
    const map =
      kind === "observation" ? this.obsCache :
      kind === "forecast" ? this.forecastCache :
      kind === "hourly" ? this.hourlyCache :
      this.alertCache;
    const hit = map.get(key);
    return hit ? new Date(hit.at) : null;
  }

  private async cached<T>(
    map: Map<string, { at: number; value: T }>,
    key: string,
    ttlMs: number,
    kind: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const hit = map.get(key);
    const now = Date.now();
    if (hit && now - hit.at < ttlMs) return hit.value;

    // Collapse concurrent misses onto one request.
    const flightKey = `${kind}:${key}`;
    const existing = this.inflight.get(flightKey) as Promise<T> | undefined;
    if (existing) return existing;

    const attempt = async (): Promise<T> => {
      try {
        const value = await fetcher();
        // Stamp with completion time, not request time: on a slow response
        // the entry would otherwise look older than it is and expire early.
        map.set(key, { at: Date.now(), value });
        return value;
      } catch (err) {
        // Stale-while-error: minutes-old data beats "unavailable" for a
        // weather display. The expired entry stays in the map (we never
        // delete on expiry), so serve it and let the next cycle retry.
        // The entry's timestamp is NOT refreshed — lastFetchedAt() stays
        // honest about the age of what's shown.
        if (hit) return hit.value;
        throw err;
      }
    };

    const run = attempt();
    this.inflight.set(flightKey, run);
    // Always release the slot, however it settled — a rejected request that
    // stayed registered would be handed to every later caller forever.
    void run.catch(() => undefined).then(() => {
      if (this.inflight.get(flightKey) === run) this.inflight.delete(flightKey);
    });
    return run;
  }
}
