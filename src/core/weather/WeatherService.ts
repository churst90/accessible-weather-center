import type {
  ForecastPeriod,
  HourlyForecastPoint,
  LatLon,
  LocationInfo,
  Observation,
  Place,
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
  private geoCache = new Map<string, { at: number; value: LocationInfo }>();

  private static readonly OBS_TTL_MS = 5 * 60_000;
  private static readonly FORECAST_TTL_MS = 30 * 60_000;
  private static readonly HOURLY_TTL_MS = 15 * 60_000;
  private static readonly ALERT_TTL_MS = 60_000;
  private static readonly GEO_TTL_MS = 60 * 60_000; // 1 hour — locations don't change

  async ensureGrid(place: Place): Promise<Place> {
    if (place.nwsGrid) return place;
    const key = place.id;
    let inflight = this.gridCache.get(key);
    if (!inflight) {
      inflight = this.nws.resolveGridpoint(place.coord).then((grid) => ({ ...place, nwsGrid: grid }));
      this.gridCache.set(key, inflight);
    }
    return inflight;
  }

  async getObservation(place: Place): Promise<Observation | null> {
    const ready = await this.ensureGrid(place);
    return this.cached(this.obsCache, ready.id, WeatherService.OBS_TTL_MS, () =>
      this.nws.getLatestObservation(ready.nwsGrid!, ready.id)
    );
  }

  async getForecast(place: Place): Promise<ForecastPeriod[]> {
    const ready = await this.ensureGrid(place);
    return this.cached(this.forecastCache, ready.id, WeatherService.FORECAST_TTL_MS, () =>
      this.nws.getForecast(ready.nwsGrid!)
    );
  }

  async getHourly(place: Place): Promise<HourlyForecastPoint[]> {
    const ready = await this.ensureGrid(place);
    return this.cached(this.hourlyCache, ready.id, WeatherService.HOURLY_TTL_MS, () =>
      this.nws.getHourlyForecast(ready.nwsGrid!)
    );
  }

  async getActiveAlerts(place: Place): Promise<WeatherAlert[]> {
    return this.cached(this.alertCache, place.id, WeatherService.ALERT_TTL_MS, () =>
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
    return this.cached(this.geoCache, key, WeatherService.GEO_TTL_MS, () =>
      this.nws.reverseGeocode(coord)
    );
  }

  private async cached<T>(
    map: Map<string, { at: number; value: T }>,
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const hit = map.get(key);
    const now = Date.now();
    if (hit && now - hit.at < ttlMs) return hit.value;
    const value = await fetcher();
    map.set(key, { at: now, value });
    return value;
  }
}
