import type {
  ForecastPeriod,
  HourlyForecastPoint,
  LatLon,
  LocationInfo,
  NwsGridpoint,
  NearbyObservation,
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
      stationId: first.properties?.stationIdentifier ?? null,
      // Filled in by WeatherService, which is the only layer that sees more
      // than one observation. The client is stateless by design.
      pressureTrend: null
    };
  }

  /**
   * Conditions at the nearest reporting stations — the Weatherscan city
   * ticker, and the WeatherStar's Latest Observations page.
   *
   * The gridpoint's station list is already ordered by proximity, so "nearby
   * markets" is just the first few entries. Stations that fail or have no
   * temperature are dropped rather than shown blank: the ticker is a crawl,
   * so a missing city is one fewer stop, where an empty one is a claim that
   * somewhere reported nothing.
   *
   * `limit` is a request budget as much as a length — this is `limit` HTTP
   * calls, so callers should cache hard. WeatherService gives it ten minutes.
   */
  async getNearbyObservations(
    grid: NwsGridpoint,
    limit: number
  ): Promise<NearbyObservation[]> {
    if (limit <= 0) return [];
    const stations = await this.get<NwsStationListResponse>(grid.observationStationsUrl);
    const wanted = stations.features.slice(0, limit);

    const settled = await Promise.allSettled(
      wanted.map(async (station) => {
        const obs = await this.get<NwsObservationResponse>(`${station.id}/observations/latest`);
        const p = obs.properties;
        return {
          name: cityName(station.properties?.name) ?? station.properties?.stationIdentifier ?? null,
          temperatureF: cToF(p.temperature?.value),
          conditionText: p.textDescription ?? null,
          windSpeedMph: kmhToMph(p.windSpeed?.value),
          windDirDeg: p.windDirection?.value ?? null
        };
      })
    );

    return settled
      .filter((r): r is PromiseFulfilledResult<NearbyObservation> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((o) => o.name !== null && o.temperatureF !== null);
  }

  /**
   * Month-to-date precipitation, in inches, from the NWS Climatological
   * Report — or null when the station does not issue one.
   *
   * This exists for one string on the WeatherStar 4000 v2 footer bar:
   * "May Precipitation: 1.20 in", one of the four confirmed rotation stops.
   * It was left unrendered rather than faked, because no observation or
   * forecast product carries a month-to-date total. The CLI does.
   *
   * CLI is a plain-text product, issued daily, and the precipitation block
   * looks like this (Seattle, and note the column count varies by office):
   *
   *     PRECIPITATION (IN)
   *       TODAY            0.00          0.68 2019     0.00
   *       MONTH TO DATE    0.02                        0.39
   *       SINCE OCT 1     33.00                       30.96
   *
   *     SNOWFALL (IN)
   *       TODAY           MM                           0.0
   *       MONTH TO DATE    0.0                         0.0
   *
   * The first number after the label is the observed value; the rest are
   * records and normals. SNOWFALL has its own MONTH TO DATE line, which is
   * why the scan is bounded to the precipitation block rather than grepping
   * the whole product — the naive version returns the snow total, and in
   * August it returns 0.0 and looks perfectly reasonable.
   *
   * `T` means a trace (measurable but under 0.01in) and becomes 0. `MM`
   * means missing and becomes null, not zero: "no data" and "no rain" are
   * different claims, and this is a rain gauge.
   *
   * Locations are station codes with the leading K dropped — KSEA -> SEA. Of
   * the 629 CLI locations most are airports; plenty of stations have none,
   * and that is a null, not an error.
   */
  async getMonthToDatePrecipIn(stationIdentifier: string): Promise<number | null> {
    const loc = cliLocationFor(stationIdentifier);
    if (!loc) return null;

    let list: NwsProductListResponse;
    try {
      list = await this.get<NwsProductListResponse>(
        `${this.base}/products/types/CLI/locations/${loc}`
      );
    } catch {
      return null; // no CLI for this station — common, not exceptional
    }
    const newest = list["@graph"]?.[0];
    if (!newest?.id) return null;

    const product = await this.get<{ productText: string }>(`${this.base}/products/${newest.id}`);
    return parseMonthToDatePrecip(product.productText);
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

/**
 * Turn an NWS station name into something a ticker can show.
 *
 * Station names are facility names — "Bellingham International Airport",
 * "Olympia, Olympia Regional Airport", "Seattle, Seattle-Tacoma
 * International Airport". A city ticker wants the city. Strip the common
 * facility tails and take what is left; if that empties the string, keep the
 * original rather than showing a blank tab.
 */
export function cityName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // "Olympia, Olympia Regional Airport" -> the part before the comma is
  // already the city, and NWS uses it consistently when it is present.
  const beforeComma = raw.split(",")[0].trim();
  const candidate = beforeComma || raw;
  const trimmed = candidate
    .replace(/\b(international|regional|municipal|county|memorial|field|airport|airpark|air\s+park|air\s+force\s+base|afb|naval\s+air\s+station|nas|heliport)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s/-]+$/, "")
    .trim();
  return trimmed || candidate || null;
}

export { cityName as __test_cityName };

/**
 * Station identifier to CLI location code. KSEA -> SEA.
 *
 * Only the contiguous four-letter K form is converted; anything else is
 * passed through uppercased, which covers the Alaska and Hawaii prefixes
 * (PA-, PH-) that CLI lists verbatim.
 */
export function cliLocationFor(stationIdentifier: string | null | undefined): string | null {
  if (!stationIdentifier) return null;
  const id = stationIdentifier.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,4}$/.test(id)) return null;
  return id.length === 4 && id.startsWith("K") ? id.slice(1) : id;
}

/**
 * Pull the observed month-to-date precipitation out of a CLI product.
 *
 * Bounded to the PRECIPITATION block: SNOWFALL carries its own MONTH TO DATE
 * and would otherwise win or lose depending on line order.
 */
export function parseMonthToDatePrecip(text: string): number | null {
  let inPrecip = false;
  for (const line of text.split("\n")) {
    const upper = line.toUpperCase();
    if (/^\s*PRECIPITATION\b/.test(upper)) { inPrecip = true; continue; }
    if (!inPrecip) continue;
    // Any other all-caps section header ends the block.
    if (/^\s*(SNOWFALL|DEGREE\s+DAYS|WIND|TEMPERATURE|HEAT|RELATIVE|SKY)\b/.test(upper)) break;
    const m = upper.match(/^\s*MONTH\s+TO\s+DATE\s+(\S+)/);
    if (!m) continue;
    const raw = m[1];
    if (raw === "T") return 0;          // trace: real, but under 0.01in
    if (raw === "MM" || raw === "M") return null;  // missing != zero
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

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

interface NwsProductListResponse {
  "@graph"?: Array<{ id?: string; issuanceTime?: string }>;
}

interface NwsStationListResponse {
  features: Array<{
    id: string;
    properties?: {
      /** Human name, e.g. "Bellingham International Airport". */
      name?: string | null;
      /** ICAO-ish code, e.g. "KBLI". */
      stationIdentifier?: string | null;
    } | null;
  }>;
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
