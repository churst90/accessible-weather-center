import type {
  ForecastPeriod,
  HourlyForecastPoint,
  LatLon,
  LocationInfo,
  NwsGridpoint,
  Observation,
  WeatherAlert,
  AlertSeverity,
  AlertCertainty,
  AlertUrgency
} from "../types";

/**
 * Thin client for api.weather.gov. No keys required, but the User-Agent
 * header is mandatory per NWS terms — set it via the constructor.
 *
 * Single responsibility: HTTP + decode. No caching, no scheduling, no
 * normalization beyond mapping JSON to our domain types.
 *
 * Resilience: 10s request timeout, retry with exponential backoff,
 * 429 rate-limit handling with Retry-After awareness.
 */
export class NwsClient {
  private readonly base = "https://api.weather.gov";
  private readonly userAgent: string;

  /** Max retries for transient failures (5xx, 429, network errors). */
  private readonly maxRetries = 3;
  /** Request timeout in ms. */
  private readonly timeoutMs = 10_000;
  /** Base delay for exponential backoff in ms. */
  private readonly baseDelayMs = 1_000;

  constructor(userAgent: string) {
    this.userAgent = userAgent;
  }

  private async get<T>(url: string): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = this.baseDelayMs * Math.pow(2, attempt - 1);
        await sleep(delay);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": this.userAgent,
            Accept: "application/geo+json"
          },
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (res.status === 429) {
          // NWS rate limit — respect Retry-After header or back off
          const retryAfter = res.headers.get("Retry-After");
          const waitMs = retryAfter ? Math.min(Number(retryAfter) * 1000, 30_000) : this.baseDelayMs * Math.pow(2, attempt);
          lastError = new Error(`NWS 429 rate limited for ${url}`);
          await sleep(waitMs);
          continue;
        }

        if (res.status >= 500) {
          // Server error — retry
          lastError = new Error(`NWS ${res.status} for ${url}`);
          continue;
        }

        if (!res.ok) {
          // Client error (4xx except 429) — don't retry
          throw new Error(`NWS ${res.status} for ${url}`);
        }

        return (await res.json()) as T;
      } catch (err) {
        clearTimeout(timeout);
        if (err instanceof DOMException && err.name === "AbortError") {
          lastError = new Error(`NWS request timeout (${this.timeoutMs}ms) for ${url}`);
          continue; // retry on timeout
        }
        if (err instanceof TypeError) {
          // Network error (offline, DNS failure, etc.) — retry
          lastError = err;
          continue;
        }
        throw err; // Re-throw non-transient errors (4xx, programming errors)
      }
    }

    throw lastError ?? new Error(`NWS request failed after ${this.maxRetries + 1} attempts for ${url}`);
  }

  async resolveGridpoint(coord: LatLon): Promise<NwsGridpoint> {
    const url = `${this.base}/points/${coord.lat.toFixed(4)},${coord.lon.toFixed(4)}`;
    const json = await this.get<NwsPointsResponse>(url);
    const p = json.properties;
    return {
      office: p.gridId,
      gridX: p.gridX,
      gridY: p.gridY,
      forecastUrl: p.forecast,
      forecastHourlyUrl: p.forecastHourly,
      observationStationsUrl: p.observationStations
    };
  }

  async reverseGeocode(coord: LatLon): Promise<LocationInfo> {
    const url = `${this.base}/points/${coord.lat.toFixed(4)},${coord.lon.toFixed(4)}`;
    const json = await this.get<NwsPointsResponse>(url);
    const p = json.properties;
    const rel = p.relativeLocation?.properties;

    // Try to fetch the county name from the zone endpoint.
    let county: string | null = null;
    if (p.county) {
      try {
        const zone = await this.get<{ properties: { name: string } }>(p.county);
        county = zone.properties.name;
      } catch {
        county = parseCountyName(p.county);
      }
    }

    return {
      city: rel?.city ?? "Unknown",
      state: rel?.state ?? "Unknown",
      county,
      distanceMi: rel?.distance?.value != null
        ? Math.round(rel.distance.value * 0.000621371)
        : 0,
      bearingDeg: rel?.bearing?.value ?? 0
    };
  }

  async getForecast(grid: NwsGridpoint): Promise<ForecastPeriod[]> {
    const json = await this.get<NwsForecastResponse>(grid.forecastUrl);
    return json.properties.periods.map((p) => ({
      startTime: new Date(p.startTime),
      endTime: new Date(p.endTime),
      name: p.name,
      isDaytime: p.isDaytime,
      temperatureF: p.temperature,
      windDirText: p.windDirection,
      windSpeedText: p.windSpeed,
      precipProbabilityPct: p.probabilityOfPrecipitation?.value ?? null,
      shortForecast: p.shortForecast,
      detailedForecast: p.detailedForecast
    }));
  }

  async getHourlyForecast(grid: NwsGridpoint): Promise<HourlyForecastPoint[]> {
    const json = await this.get<NwsForecastResponse>(grid.forecastHourlyUrl);
    return json.properties.periods.map((p) => ({
      time: new Date(p.startTime),
      temperatureF: p.temperature,
      precipProbabilityPct: p.probabilityOfPrecipitation?.value ?? 0,
      windSpeedMph: parseSpeedMph(p.windSpeed),
      windDirDeg: bearingFromText(p.windDirection),
      shortForecast: p.shortForecast
    }));
  }

  async getLatestObservation(grid: NwsGridpoint, placeId: string): Promise<Observation | null> {
    const stations = await this.get<NwsStationListResponse>(grid.observationStationsUrl);
    const first = stations.features[0];
    if (!first) return null;
    const obsUrl = `${first.id}/observations/latest`;
    const obs = await this.get<NwsObservationResponse>(obsUrl);
    const p = obs.properties;
    return {
      placeId,
      observedAt: new Date(p.timestamp),
      temperatureF: cToF(p.temperature?.value),
      feelsLikeF: cToF(p.heatIndex?.value ?? p.windChill?.value),
      dewpointF: cToF(p.dewpoint?.value),
      humidityPct: p.relativeHumidity?.value != null ? Math.round(p.relativeHumidity.value) : null,
      windDirDeg: p.windDirection?.value ?? null,
      windSpeedMph: kmhToMph(p.windSpeed?.value),
      windGustMph: kmhToMph(p.windGust?.value),
      pressureInHg: paToInHg(p.barometricPressure?.value),
      visibilityMi: metersToMi(p.visibility?.value),
      conditionText: p.textDescription ?? null,
      conditionIcon: p.icon ?? null,
      ceilingFt: ceilingFrom(p.cloudLayers),
      // Filled in by WeatherService, which is the only layer that sees more
      // than one observation. The client is stateless by design.
      pressureTrend: null
    };
  }

  async getActiveAlerts(coord: LatLon): Promise<WeatherAlert[]> {
    const url = `${this.base}/alerts/active?point=${coord.lat.toFixed(4)},${coord.lon.toFixed(4)}`;
    const json = await this.get<NwsAlertsResponse>(url);
    return json.features.map((f) => {
      const p = f.properties;
      const polygon = extractPolygon(f.geometry);
      return {
        id: p.id,
        event: p.event,
        headline: p.headline ?? p.event,
        description: p.description ?? "",
        instruction: p.instruction ?? null,
        severity: (p.severity ?? "Unknown") as AlertSeverity,
        certainty: (p.certainty ?? "Unknown") as AlertCertainty,
        urgency: (p.urgency ?? "Unknown") as AlertUrgency,
        sent: new Date(p.sent),
        effective: new Date(p.effective),
        expires: new Date(p.expires),
        polygon,
        affectedZones: p.affectedZones ?? [],
        affectedAreaDescription: p.areaDesc ?? ""
      };
    });
  }
}

// --- helpers ---

function cToF(c: number | null | undefined): number | null {
  return c == null ? null : Math.round((c * 9) / 5 + 32);
}

function kmhToMph(kmh: number | null | undefined): number | null {
  return kmh == null ? null : Math.round(kmh * 0.621371);
}

function paToInHg(pa: number | null | undefined): number | null {
  return pa == null ? null : Math.round((pa * 0.0002953) * 100) / 100;
}

function metersToMi(m: number | null | undefined): number | null {
  return m == null ? null : Math.round((m * 0.000621371) * 10) / 10;
}

/**
 * Cloud ceiling, in feet, from the METAR sky-cover layers.
 *
 * The aviation definition: the base of the lowest BROKEN or OVERCAST layer.
 * FEW and SCT are not a ceiling however low they sit, which is why a sky can
 * read "Unlimited" with cloud plainly in it. VV (vertical visibility) counts
 * — that is an obscured sky, and its "base" is how far up you can see.
 *
 * Returns null for no ceiling, which the view renders as "Unlimited". Null is
 * also what a missing or malformed layer list gives, and those two cases are
 * deliberately not distinguished: NWS omits `cloudLayers` at stations that do
 * not report it, and printing "Unknown" at every such station would be worse
 * than printing the far more common truth.
 */
function ceilingFrom(
  layers: Array<{ base: { value: number | null } | null; amount: string | null }> | null | undefined
): number | null {
  if (!Array.isArray(layers)) return null;
  let lowest: number | null = null;
  for (const layer of layers) {
    const amount = layer?.amount?.toUpperCase();
    if (amount !== "BKN" && amount !== "OVC" && amount !== "VV") continue;
    const metres = layer.base?.value;
    if (metres == null) continue;
    const feet = Math.round((metres * 3.28084) / 100) * 100; // reported to 100ft
    if (lowest === null || feet < lowest) lowest = feet;
  }
  return lowest;
}

/** Exposed for tests. The rule is fiddly enough to be worth pinning directly
 *  rather than through a whole mocked observation response. */
export { ceilingFrom as __test_ceilingFrom };

/** Extract county name from NWS county zone URL, e.g.
 *  "https://api.weather.gov/zones/county/TNC059" → fetch the zone and grab the name.
 *  To avoid an extra fetch, we just return the zone code — the full overhaul
 *  can fetch zone names if needed. */
function parseCountyName(countyUrl: string): string | null {
  // County URL looks like: https://api.weather.gov/zones/county/TNC059
  // We'll extract the zone code as a fallback.
  const match = countyUrl.match(/\/([A-Z]{2}[CZ]\d{3})$/);
  return match ? match[1] : null;
}

function parseSpeedMph(text: string): number {
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function bearingFromText(text: string): number {
  const map: Record<string, number> = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
    E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
    W: 270, WNW: 292.5, NW: 315, NNW: 337.5
  };
  return map[text.toUpperCase()] ?? 0;
}

function extractPolygon(geom: { type: string; coordinates: unknown } | null): number[][] | null {
  if (!geom) return null;
  if (geom.type === "Polygon") {
    const coords = geom.coordinates as number[][][];
    return coords[0] ?? null;
  }
  if (geom.type === "MultiPolygon") {
    const coords = geom.coordinates as number[][][][];
    return coords[0]?.[0] ?? null;
  }
  return null;
}

// --- raw NWS response shapes (only the fields we use) ---

interface NwsPointsResponse {
  properties: {
    gridId: string;
    gridX: number;
    gridY: number;
    forecast: string;
    forecastHourly: string;
    observationStations: string;
    county?: string;
    relativeLocation?: {
      properties: {
        city: string;
        state: string;
        distance: { value: number } | null;
        bearing: { value: number } | null;
      };
    };
  };
}

interface NwsForecastResponse {
  properties: {
    periods: Array<{
      startTime: string;
      endTime: string;
      name: string;
      isDaytime: boolean;
      temperature: number;
      windDirection: string;
      windSpeed: string;
      probabilityOfPrecipitation: { value: number | null } | null;
      shortForecast: string;
      detailedForecast: string;
    }>;
  };
}

interface NwsStationListResponse {
  features: Array<{ id: string }>;
}

interface NwsObservationResponse {
  properties: {
    timestamp: string;
    textDescription: string | null;
    icon: string | null;
    temperature: { value: number | null } | null;
    dewpoint: { value: number | null } | null;
    windDirection: { value: number | null } | null;
    windSpeed: { value: number | null } | null;
    windGust: { value: number | null } | null;
    barometricPressure: { value: number | null } | null;
    visibility: { value: number | null } | null;
    relativeHumidity: { value: number | null } | null;
    heatIndex: { value: number | null } | null;
    windChill: { value: number | null } | null;
    /**
     * Sky cover layers, lowest first. `amount` is the METAR octa code:
     * CLR / SKC (clear), FEW, SCT (scattered), BKN (broken), OVC (overcast),
     * VV (vertical visibility, i.e. obscured). `base` is in metres.
     */
    cloudLayers?: Array<{
      base: { value: number | null } | null;
      amount: string | null;
    }> | null;
  };
}

interface NwsAlertsResponse {
  features: Array<{
    geometry: { type: string; coordinates: unknown } | null;
    properties: {
      id: string;
      event: string;
      headline: string | null;
      description: string | null;
      instruction: string | null;
      severity: string | null;
      certainty: string | null;
      urgency: string | null;
      sent: string;
      effective: string;
      expires: string;
      affectedZones: string[] | null;
      areaDesc: string | null;
    };
  }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
