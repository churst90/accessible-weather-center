import type { LatLon } from "../types";

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
  /** Day length in minutes */
  dayLengthMin: number;
  /** Solar noon */
  solarNoon: Date;
}

export interface MoonInfo {
  /** 0 = new moon, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter */
  phase: number;
  phaseName: string;
  illuminationPct: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Convert a JS Date to Julian Day Number. */
function toJulianDay(d: Date): number {
  return d.getTime() / 86_400_000 + 2_440_587.5;
}

/** Julian century from J2000.0. */
function julianCentury(jd: number): number {
  return (jd - 2_451_545) / 36_525;
}

/** Geometric mean longitude of the sun (degrees). */
function sunGeomMeanLon(t: number): number {
  let l0 = 280.46646 + t * (36_000.76983 + 0.0003032 * t);
  l0 = l0 % 360;
  if (l0 < 0) l0 += 360;
  return l0;
}

/** Geometric mean anomaly of the sun (degrees). */
function sunGeomMeanAnomaly(t: number): number {
  return 357.52911 + t * (35_999.05029 - 0.0001537 * t);
}

/** Eccentricity of Earth's orbit. */
function eccentricity(t: number): number {
  return 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
}

/** Sun equation of center (degrees). */
function sunEqOfCenter(t: number): number {
  const m = sunGeomMeanAnomaly(t) * RAD;
  return (
    Math.sin(m) * (1.9146 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m) * 0.00029
  );
}

/** Sun true longitude (degrees). */
function sunTrueLon(t: number): number {
  return sunGeomMeanLon(t) + sunEqOfCenter(t);
}

/** Sun apparent longitude (degrees). */
function sunApparentLon(t: number): number {
  const omega = 125.04 - 1934.136 * t;
  return sunTrueLon(t) - 0.00569 - 0.00478 * Math.sin(omega * RAD);
}

/** Mean obliquity of the ecliptic (degrees). */
function meanObliquity(t: number): number {
  const seconds =
    21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  return 23 + (26 + seconds / 60) / 60;
}

/** Corrected obliquity of the ecliptic (degrees). */
function obliquityCorr(t: number): number {
  const omega = 125.04 - 1934.136 * t;
  return meanObliquity(t) + 0.00256 * Math.cos(omega * RAD);
}

/** Solar declination (degrees). */
function sunDeclination(t: number): number {
  const e = obliquityCorr(t) * RAD;
  const lambda = sunApparentLon(t) * RAD;
  return Math.asin(Math.sin(e) * Math.sin(lambda)) * DEG;
}

/** Equation of time (minutes). */
function equationOfTime(t: number): number {
  const e = eccentricity(t);
  const l0 = sunGeomMeanLon(t) * RAD;
  const m = sunGeomMeanAnomaly(t) * RAD;
  let y = Math.tan((obliquityCorr(t) * RAD) / 2);
  y *= y;

  const eot =
    y * Math.sin(2 * l0) -
    2 * e * Math.sin(m) +
    4 * e * y * Math.sin(m) * Math.cos(2 * l0) -
    0.5 * y * y * Math.sin(4 * l0) -
    1.25 * e * e * Math.sin(2 * m);

  return eot * 4 * DEG; // radians -> minutes
}

/**
 * Hour angle for sunrise / sunset (degrees).
 * Zenith = 90.833 accounts for atmospheric refraction and solar disc radius.
 */
function hourAngleSunrise(lat: number, decl: number): number {
  const zenith = 90.833;
  const latRad = lat * RAD;
  const declRad = decl * RAD;
  const cosHA =
    (Math.cos(zenith * RAD) - Math.sin(latRad) * Math.sin(declRad)) /
    (Math.cos(latRad) * Math.cos(declRad));

  // Clamp for polar day / polar night
  if (cosHA > 1) return 0; // sun never rises
  if (cosHA < -1) return 180; // sun never sets
  return Math.acos(cosHA) * DEG;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate sunrise, sunset, day length, and solar noon for a given
 * coordinate and date using the NOAA simplified solar position equations.
 */
export function getSunTimes(coord: LatLon, date: Date): SunTimes {
  // Work with the calendar date in UTC
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  // Julian day at noon UTC for the calendar date
  const jd = toJulianDay(new Date(Date.UTC(year, month, day, 12, 0, 0)));
  const t = julianCentury(jd);

  const eot = equationOfTime(t);
  const decl = sunDeclination(t);
  const ha = hourAngleSunrise(coord.lat, decl);

  // Solar noon in minutes from midnight UTC
  const solarNoonMinUTC = 720 - 4 * coord.lon - eot;

  // Sunrise / sunset in minutes from midnight UTC
  const sunriseMinUTC = solarNoonMinUTC - ha * 4;
  const sunsetMinUTC = solarNoonMinUTC + ha * 4;

  // Convert minutes-from-midnight-UTC to Date objects in local time
  const baseMs = Date.UTC(year, month, day);

  const sunrise = new Date(baseMs + sunriseMinUTC * 60_000);
  const sunset = new Date(baseMs + sunsetMinUTC * 60_000);
  const solarNoon = new Date(baseMs + solarNoonMinUTC * 60_000);

  const dayLengthMin = sunsetMinUTC - sunriseMinUTC;

  return { sunrise, sunset, dayLengthMin, solarNoon };
}

/**
 * Calculate moon phase information for a given date using the
 * synodic month method.
 */
export function getMoonInfo(date: Date): MoonInfo {
  // Known new moon reference: January 6, 2000 at 18:14 UTC
  const knownNewMoonMs = Date.UTC(2000, 0, 6, 18, 14, 0);
  const synodicMonth = 29.53058770576; // days

  const daysSinceRef = (date.getTime() - knownNewMoonMs) / 86_400_000;
  let phase = (daysSinceRef % synodicMonth) / synodicMonth;
  if (phase < 0) phase += 1; // handle dates before reference

  // Phase names based on 8 segments
  const phaseNames: string[] = [
    "New Moon",
    "Waxing Crescent",
    "First Quarter",
    "Waxing Gibbous",
    "Full Moon",
    "Waning Gibbous",
    "Last Quarter",
    "Waning Crescent",
  ];

  const segment = Math.floor(phase * 8) % 8;
  const phaseName = phaseNames[segment];

  // Illumination: 0 at new moon, 1 at full moon
  const illuminationPct =
    Math.round(((1 - Math.cos(phase * 2 * Math.PI)) / 2) * 1000) / 10;

  return { phase: Math.round(phase * 10000) / 10000, phaseName, illuminationPct };
}
