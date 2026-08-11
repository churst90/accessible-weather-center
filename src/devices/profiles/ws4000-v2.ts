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
  // 3-day, not 5. The WeatherStar 4000 Extended became a 3-day graphical
  // format in the February 1991 redesign and stayed that way; v2 is the same
  // hardware with new chrome. (Narration still uses the 5-day phrase pool —
  // see the reconciliation note in docs/legacy-eras.md.)
  extendedDays: 3,
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
  visuals: {
    iconSet: "/assets/shared/icons",
    backgroundImage: "",
    extendedTitle: "Extended Forecast",
    vars: {
      // Orange-to-purple gradient stops (darker deep, warmer top). The
      // actual gradient is painted in CSS; these vars give fallback
      // solid colors for any component that reads them directly.
      "--ws-bg-deep":       "#2a0a3c",
      "--ws-bg-mid":        "#5c2a3c",
      "--ws-bg-top":        "#c85a1c",
      "--ws-accent":        "#7ae0ff",
      "--ws-accent-warm":   "#ff9933",
      "--ws-text":          "#ffffff",
      "--ws-text-dim":      "#d8bcc8",
      "--ws-led":           "#ffd24d",
      "--ws-alert":         "#ff5050",
      "--ws-font-display":  '"Star4000", "Star4000 Extended", "Lato", "Helvetica Neue", "Arial", sans-serif',
      "--ws-font-led":      '"Star4000 Large", "Star4000", "Courier New", monospace',
      "--ws-font-small":    '"Star4000 Small", "Star4000", "Arial", sans-serif',
    }
  },
  gaps: [
    // The footer bar itself is built (src/ui/weatherscan/Ws4000Footer.tsx),
    // measured off the four captures in docs/reference/ws4000/. What is left
    // is content the app cannot source and timing no capture pins down.
    "The footer's month-to-date precipitation stop is not rendered. \"May Precipitation: 1.20 in\" is one of the four confirmed strings, but nothing in the app knows that number — not the observation, not the almanac — and printing a plausible decimal would be inventing a measurement. Needs a precipitation feed.",
    "The footer's wind and pressure stops are extrapolated from the v2 Current Conditions field set, not from a capture. Its dwell time (5s here) is a guess: the four captures are a minute apart.",
    "Radar needs the pink/purple header, 7-step PRECIP legend with Incomplete Data swatch, and the light basemap with red state borders.",
    "Current Conditions is missing the pressure-trend arrow and Ceiling field."
  ]
};
