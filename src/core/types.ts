/**
 * Core domain types. Pure TypeScript — no DOM, no React, no Electron.
 * Every other layer (UI, audio, a11y) speaks this vocabulary.
 */

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Place {
  id: string;
  name: string;
  state: string;
  coord: LatLon;
  isHome?: boolean;
  isFavorite?: boolean;
  /** NWS gridpoint cache, populated lazily. */
  nwsGrid?: NwsGridpoint;
}

export interface NwsGridpoint {
  office: string;
  gridX: number;
  gridY: number;
  forecastUrl: string;
  forecastHourlyUrl: string;
  observationStationsUrl: string;
}

export type TemperatureUnit = "F" | "C";
export type SpeedUnit = "mph" | "kmh";
export type LengthUnit = "in" | "mm";

export interface Observation {
  placeId: string;
  observedAt: Date;
  temperatureF: number | null;
  feelsLikeF: number | null;
  dewpointF: number | null;
  humidityPct: number | null;
  windDirDeg: number | null;
  windSpeedMph: number | null;
  windGustMph: number | null;
  pressureInHg: number | null;
  visibilityMi: number | null;
  conditionText: string | null;
  conditionIcon: string | null;
  /**
   * Cloud ceiling in feet, or null when there is no ceiling at all.
   *
   * Aviation definition, which is what the WeatherStar showed: the base of
   * the lowest BROKEN or OVERCAST layer. Scattered and few layers do not make
   * a ceiling, so a sky with SCT030 and nothing above it is "Unlimited" —
   * null here, not zero. The v2 Current Conditions screen prints exactly that
   * word (`docs/reference/ws4000/WS4000_Simulator_v2_-_Current_Conditions.jpg`).
   */
  ceilingFt: number | null;
  /**
   * Which way the barometer is going, or null until two readings exist.
   *
   * Not an NWS field — derived by comparing successive observations, so it is
   * absent on the first fetch after a cold start and appears once a second
   * reading lands. See `PressureHistory`.
   */
  pressureTrend: PressureTrend | null;
}

/** Barometer direction, as the WeatherStar's arrow glyph showed it. */
export type PressureTrend = "rising" | "falling" | "steady";

export interface ForecastPeriod {
  startTime: Date;
  endTime: Date;
  name: string;
  isDaytime: boolean;
  temperatureF: number;
  windDirText: string;
  windSpeedText: string;
  precipProbabilityPct: number | null;
  shortForecast: string;
  detailedForecast: string;
}

export interface HourlyForecastPoint {
  time: Date;
  temperatureF: number;
  precipProbabilityPct: number;
  windSpeedMph: number;
  windDirDeg: number;
  shortForecast: string;
}

export type AlertSeverity = "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
export type AlertCertainty = "Observed" | "Likely" | "Possible" | "Unlikely" | "Unknown";
export type AlertUrgency = "Immediate" | "Expected" | "Future" | "Past" | "Unknown";

export interface WeatherAlert {
  id: string;
  event: string;
  headline: string;
  description: string;
  instruction: string | null;
  severity: AlertSeverity;
  certainty: AlertCertainty;
  urgency: AlertUrgency;
  sent: Date;
  effective: Date;
  expires: Date;
  /** GeoJSON polygon (lon/lat). NWS sometimes omits this — use affectedZones as a fallback. */
  polygon: number[][] | null;
  affectedZones: string[];
  affectedAreaDescription: string;
}

/**
 * Reverse-geocoded location info from the NWS /points endpoint.
 * Used by the grid explorer to tell the user where the cursor is.
 */
export interface LocationInfo {
  city: string;
  state: string;
  /** County name, e.g. "Washington". Null if NWS doesn't return it. */
  county: string | null;
  /** Distance in miles from the named city. */
  distanceMi: number;
  /** Bearing from the named city in degrees. */
  bearingDeg: number;
}

/**
 * A radar frame as a navigable model — not pixels. The grid is sparse:
 * cells with no precipitation are absent. Each cell carries an intensity in
 * dBZ and a derived rate in mm/h, plus a plain-language band so the a11y
 * layer can speak it without re-deriving.
 */
export interface RadarFrame {
  capturedAt: Date;
  source: "rainviewer" | "mrms";
  /** Bounding box of the frame in lon/lat. */
  bounds: { west: number; south: number; east: number; north: number };
  cells: RadarCell[];
}

export interface RadarCell {
  lat: number;
  lon: number;
  /** Reflectivity in dBZ if known. */
  dbz: number | null;
  /** Estimated precipitation rate in millimeters per hour. */
  mmPerHour: number;
  /** Plain-language band, e.g. "light rain", "heavy rain", "extreme rain". */
  band: PrecipBand;
  /** Color name a sighted user would see, e.g. "green", "yellow", "red". */
  colorName: string;
}

export type PrecipBand =
  | "none"
  | "trace"
  | "light"
  | "moderate"
  | "heavy"
  | "very-heavy"
  | "extreme";

/** A storm cell identified as a discrete object (for StormCells nav mode). */
export interface StormCell {
  id: string;
  centroid: LatLon;
  peakDbz: number;
  peakMmPerHour: number;
  band: PrecipBand;
  /** Bearing in degrees the cell is moving toward, 0 = north. */
  movementDeg: number | null;
  movementMph: number | null;
  radiusMi: number;
}
