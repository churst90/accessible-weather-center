import type { Device } from "../types";

/**
 * WeatherStar 4000 v2 — approx 2005-2009. The application default.
 *
 * Late-era redesign on the same hardware: skewed parallelogram orange header
 * over a narrow dark-blue band, floating cyan-glow content box with drop
 * shadow on an orange-to-purple vertical gradient, and an always-on footer
 * bar carrying contextual data ("Conditions at <city>", "<Month>
 * Precipitation: n.nn in").
 *
 * Radar switched to a pink/purple header with a 7-step PRECIP legend plus an
 * Incomplete Data swatch, and the basemap changed from dark navy to a light
 * off-white map with red state borders. Current Conditions gained a pressure
 * trend arrow and a Ceiling field.
 *
 * Post-rename, so "Local Forecast" and "Daypart Forecast".
 */
export const WS4000_V2: Device = {
  id: "ws4000-v2",
  label: "WeatherStar 4000 v2 (2005-2009)",
  years: "2005-2009",
  era: "post-2004",
  voice: "allan-jackson",
  musicTags: ["trammell-starks"],
  extendedDays: 5,
  capabilities: { ldl: false, footer: true, icons: true, radar: true, narration: true, sponsorSlot: false },
  rundown: ["current", "localforecast", "extended", "radar", "almanac", "travel"],
  products: {
    current:       { availability: "core", name: "Current Conditions" },
    localforecast: { availability: "core", name: "Local Forecast" },
    extended:      { availability: "core", name: "Extended Forecast" },
    radar:         { availability: "core", name: "Local Doppler Radar" },
    almanac:       { availability: "core" },
    travel:        { availability: "core", name: "Travel Cities Forecast" },
    alerts:        { availability: "core" },
    hourly:        { availability: "optional", name: "Daypart Forecast" },
    detailed:      { availability: "optional" },
    feelslike:     { availability: "optional" },
    airport:       { availability: "absent", absentNote: "Airport delays were not a WeatherStar 4000 product." }
  },
  gaps: [
    "Always-on footer bar component is not built — this is the defining v2 chrome element.",
    "Radar needs the pink/purple header, 7-step PRECIP legend with Incomplete Data swatch, and the light basemap with red state borders.",
    "Current Conditions is missing the pressure-trend arrow and Ceiling field."
  ]
};
