/**
 * Weather icons — uses animated GIFs from the WeatherStar 4000 community
 * asset library (MIT licensed). 41 condition icons with authentic period-
 * correct animations.
 *
 * The icon base path can be overridden per theme (IntelliStar uses /large,
 * 1990s Classic uses /legacy/1990-regional, etc.). The default is the
 * WS4000 GIF set at /assets/shared/icons.
 *
 * Under prefers-reduced-motion: reduce, swaps animated GIFs for static
 * PNGs from /assets/shared/icons/stills/ when a still exists for the condition;
 * unmapped conditions fall back to the GIF. Coverage gap is tracked in
 * TODO — a full STILLS_MAP from /stills/mv/ and /stills/wxl/ closes it.
 *
 * Icons are decorative and aria-hidden by default; scene views provide
 * semantic labels separately.
 */

import { useEffect, useState } from "react";

let _iconBase = "/assets/shared/icons";
let _iconResolution: 28 | 42 | 68 | null = null;

/** Set the icon base path. Called when the theme changes. */
export function setIconBase(base: string): void {
  _iconBase = base;
}

/**
 * Opt a theme into the higher-resolution WEBP icon pools at /assets/shared/icons/
 * {28x28,42x42,68x68}/. WEBP coverage is narrower than the GIF set —
 * unmapped conditions transparently fall back to the GIF pool.
 */
export function setIconResolution(res: 28 | 42 | 68 | null): void {
  _iconResolution = res;
}

const STILLS_BASE = "/assets/shared/icons/stills";

/** Map of condition key → WEBP filename stem (no extension).
 *  Same stem works in 28x28/, 42x42/, 68x68/. */
const WEBP_MAP: Record<string, string> = {
  "sunny":                      "sunnyday",
  "clear":                      "clearnight",
  "mostly-clear":               "sunnyday",
  "partly-cloudy":              "partlycloudyday",
  "partly-clear":               "partlycloudynight",
  "mostly-cloudy":              "cloudy",
  "cloudy":                     "cloudy",
  "rain":                       "rain",
  "showers":                    "showers",
  "shower":                     "showers",
  "scattered-showers":          "sctdshowers",
  "thunderstorm":               "tstorm",
  "thunderstorms":              "tstorm",
  "scattered-thunderstorms":    "tstorm",
  "isolated-tstorms":           "tstorm",
  "thunder":                    "tstorm",
  "snow":                       "snow",
  "light-snow":                 "flurries",
  "heavy-snow":                 "heavysnow",
  "scattered-snow-showers":     "snowshowers",
  "blowing-snow":               "blowingsnow",
  "thundersnow":                "snowthunder",
  "rain-snow":                  "rainsnow",
  "snow-to-rain":               "rainsnow",
  "ice-snow":                   "snowice",
  "fog":                        "fog",
  "smoke":                      "smoke",
  "windy":                      "windy",
  "no-data":                    "na",
};

/** Map of condition key → still PNG filename (for prefers-reduced-motion).
 *  Keys missing from this map fall back to the animated GIF. */
const STILLS_MAP: Record<string, string> = {
  "sunny":                      "sun.png",
  "clear":                      "Clear.png",
  "mostly-clear":               "Fair day.png",
  "partly-cloudy":              "partlyCloudy Day.png",
  "partly-clear":               "Partly Cloudy night.png",
  "mostly-cloudy":              "Mostly cloudy day.png",
  "cloudy":                     "cldy.png",
  "rain":                       "rain.png",
  "showers":                    "showers.png",
  "shower":                     "showers.png",
  "scattered-showers":          "showers.png",
  "thunderstorm":               "Thunder.png",
  "thunderstorms":              "Thunder.png",
  "scattered-thunderstorms":    "Thunder.png",
  "isolated-tstorms":           "Strongtstorm.png",
  "thunder":                    "Thunder.png",
  "snow":                       "snow.png",
  "light-snow":                 "Flurries.png",
  "heavy-snow":                 "snow.png",
  "scattered-snow-showers":     "Snowshowers.png",
  "fog":                        "fog.png",
  "smoke":                      "smoke.png",
};

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Map of condition key → GIF filename (without path). */
const GIF_MAP: Record<string, string> = {
  "sunny":                      "Sunny.gif",
  "clear":                      "Clear.gif",
  "mostly-clear":               "Mostly-Clear.gif",
  "partly-cloudy":              "Partly-Cloudy.gif",
  "partly-clear":               "Partly-Clear.gif",
  "mostly-cloudy":              "Mostly-Cloudy.gif",
  "cloudy":                     "Cloudy.gif",
  "rain":                       "Rain.gif",
  "showers":                    "Showers.gif",
  "shower":                     "Shower.gif",
  "scattered-showers":          "Scattered-Showers.gif",
  "thunderstorm":               "Thunderstorm.gif",
  "thunderstorms":              "Thunderstorms.gif",
  "scattered-thunderstorms":    "Scattered-Tstorms.gif",
  "isolated-tstorms":           "Isolated-Tstorms.gif",
  "thunder":                    "Thunder.gif",
  "snow":                       "Heavy-Snow.gif",
  "light-snow":                 "Light-Snow.gif",
  "heavy-snow":                 "Heavy-Snow.gif",
  "scattered-snow-showers":     "Scattered-Snow-Showers.gif",
  "blowing-snow":               "Blowing-Snow.gif",
  "thundersnow":                "ThunderSnow.gif",
  "sleet":                      "Sleet.gif",
  "freezing-rain":              "Freezing-Rain.gif",
  "freezing-rain-sleet":        "Freezing-Rain-Sleet.gif",
  "freezing-rain-snow":         "Freezing-Rain-Snow.gif",
  "rain-sleet":                 "Rain-Sleet.gif",
  "rain-snow":                  "Rain-Snow.gif",
  "snow-sleet":                 "Snow-Sleet.gif",
  "snow-to-rain":               "Snow-to-Rain.gif",
  "ice-snow":                   "Ice-Snow.gif",
  "wintry-mix":                 "Wintry-Mix.gif",
  "fog":                        "Fog.gif",
  "smoke":                      "Smoke.gif",
  "windy":                      "Windy.gif",
  "no-data":                    "No-Data.gif",
};

export type IconName = string;

interface Props {
  name: IconName;
  size?: number;
  title?: string;
}

export function WeatherIcon({ name, size = 64, title }: Props) {
  const reduced = useReducedMotion();
  // Ordered fallback chain: still (reduced motion) → resolution WEBP →
  // GIF pool. A candidate that 404s advances to the next at runtime via
  // onError; when everything fails, render nothing — a broken-image
  // placeholder is worse than no icon (and some theme icon dirs don't
  // cover every condition).
  const candidates: string[] = [];
  if (reduced && STILLS_MAP[name]) {
    candidates.push(`${STILLS_BASE}/${encodeURIComponent(STILLS_MAP[name])}`);
  }
  if (_iconResolution && WEBP_MAP[name]) {
    candidates.push(`/assets/shared/icons/${_iconResolution}x${_iconResolution}/${WEBP_MAP[name]}.webp`);
  }
  candidates.push(`${_iconBase}/${GIF_MAP[name] ?? "No-Data.gif"}`);

  const [failed, setFailed] = useState(0);
  useEffect(() => setFailed(0), [name, reduced]);

  if (failed >= candidates.length) return null;
  return (
    <img
      src={candidates[failed]}
      onError={() => setFailed((n) => n + 1)}
      alt={title ?? ""}
      width={size}
      height={size}
      aria-hidden={!title}
      style={{ objectFit: "contain" }}
    />
  );
}

/**
 * Map an NWS condition text (or a PrecipBand for radar) to an icon name.
 */
export function chooseIcon(conditionText: string | null, isDay = true): IconName {
  if (!conditionText) return "no-data";
  const t = conditionText.toLowerCase();

  // Thunderstorm variants
  if (/thunder.*snow/.test(t))                           return "thundersnow";
  if (/scattered.*thunder/.test(t) || /isolated.*thunder/.test(t))
                                                          return "scattered-thunderstorms";
  if (/thunderstorm/.test(t))                            return "thunderstorms";
  if (/thunder/.test(t))                                 return "thunder";

  // Freezing / ice / wintry
  if (/freezing rain.*snow|snow.*freezing rain/.test(t)) return "freezing-rain-snow";
  if (/freezing rain.*sleet|sleet.*freezing rain/.test(t)) return "freezing-rain-sleet";
  if (/freezing rain/.test(t))                           return "freezing-rain";
  if (/ice.*snow/.test(t))                               return "ice-snow";
  if (/wintry mix/.test(t))                              return "wintry-mix";
  if (/snow.*sleet/.test(t))                             return "snow-sleet";
  if (/rain.*sleet/.test(t))                             return "rain-sleet";
  if (/snow.*rain|rain.*snow/.test(t))                   return "rain-snow";
  if (/sleet/.test(t))                                   return "sleet";

  // Snow
  if (/blowing snow/.test(t))                            return "blowing-snow";
  if (/scattered.*snow/.test(t))                         return "scattered-snow-showers";
  if (/heavy snow/.test(t))                              return "heavy-snow";
  if (/light snow|flurr/.test(t))                        return "light-snow";
  if (/snow/.test(t))                                    return "snow";

  // Rain / showers
  if (/scattered.*shower/.test(t))                       return "scattered-showers";
  if (/shower/.test(t))                                  return "showers";
  if (/rain|drizzle/.test(t))                            return "rain";

  // Visibility
  if (/fog|mist/.test(t))                                return "fog";
  if (/haze|smoke/.test(t))                              return "smoke";
  if (/wind|breezy/.test(t))                             return "windy";

  // Sky conditions
  if (/partly cloudy|partly sunny/.test(t))              return isDay ? "partly-cloudy" : "partly-clear";
  if (/mostly cloudy/.test(t))                           return "mostly-cloudy";
  if (/mostly clear|mostly sunny/.test(t))               return "mostly-clear";
  if (/cloud|overcast/.test(t))                          return "cloudy";
  if (/clear/.test(t))                                   return isDay ? "sunny" : "clear";
  if (/sunny/.test(t))                                   return "sunny";
  if (/fair/.test(t))                                    return isDay ? "sunny" : "clear";

  // Radar bands
  if (/extreme|very.heavy|heavy/.test(t))                return "rain";
  if (/moderate|light/.test(t))                          return "showers";
  if (/trace|drizzle/.test(t))                           return "shower";

  return "no-data";
}
