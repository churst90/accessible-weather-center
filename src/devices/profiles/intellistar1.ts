import type { Device } from "../types";

/**
 * IntelliStar 1 — 2003-2013 (SD).
 *
 * Black-to-navy gradient palette with muted gold accents, Interstate
 * typography, and a pool of 254 city-gradient backgrounds rotating between
 * scenes. Jim Cantore is the voice.
 *
 * The theme deliberately reproduces the 2007-era look — see
 * docs/legacy-eras.md, "Suggest single intellistar1 = 2007-era look (longest
 * running variant)" — which places it after the September 2004 rename.
 *
 * Products confirmed from the IS1 timeline (docs/reference/is1/): Now /
 * Current Conditions, Latest Observations, Regional Conditions, Daypart
 * Forecast, 12/24-Hour Metro Forecast, Local Forecast narrative,
 * Extended/Week Ahead, Local + Regional Doppler, Almanac, Air Quality,
 * Travel/Getaway/Traffic, Alerts. September 2004 also added School Day
 * Weather and Outdoor Activity Forecast.
 *
 * Alerts are a full-screen vertical scroll: brown = advisory, red = warning.
 */
export const INTELLISTAR1: Device = {
  id: "intellistar1",
  label: "IntelliStar 1 (2003-2013)",
  years: "2003-2013",
  era: "post-2004",
  voice: "jim-cantore",
  musicTags: ["intellistar1"],
  extendedDays: 7,
  capabilities: { ldl: true, footer: false, icons: true, radar: true, narration: true, sponsorSlot: true },
  rundown: ["current", "hourly", "extended", "localforecast", "radar", "travel", "almanac"],
  products: {
    current:       { availability: "core", name: "Now" },
    hourly:        { availability: "core", name: "Daypart Forecast" },
    extended:      { availability: "core", name: "Week Ahead" },
    localforecast: { availability: "core", name: "Local Forecast" },
    radar:         { availability: "core", name: "Local Doppler" },
    travel:        { availability: "core", name: "Getaway Forecast" },
    almanac:       { availability: "core" },
    alerts:        { availability: "core" },
    detailed:      { availability: "optional", name: "Latest Observations" },
    traffic:       { availability: "optional", name: "Traffic Pulse" },
    feelslike:     { availability: "optional" },
    stormtracker:  { availability: "optional" }
  },
  visuals: {
    iconSet: "/assets/icons/large",
    iconResolution: 42,
    backgroundImage: "",
    extendedTitle: "Week Ahead",
    vars: {
      "--ws-bg-deep":       "#001030",
      "--ws-bg-mid":        "#002060",
      "--ws-bg-top":        "#003399",
      "--ws-accent":        "#33aaff",
      "--ws-accent-warm":   "#ffcc00",
      "--ws-text":          "#ffffff",
      "--ws-text-dim":      "#aabbdd",
      "--ws-led":           "#ffcc00",
      "--ws-alert":         "#ff4444",
      "--ws-font-display":  '"Interstate", "Helvetica Neue", "Arial", sans-serif',
      "--ws-font-led":      '"Interstate", "InterstateMono", "Helvetica Neue", "Courier New", monospace',
      "--ws-font-small":    '"Helvetica Neue", "Interstate", "Helvetica", "Arial", sans-serif',
    }
  },
  gaps: [
    "Jim Cantore has NO radar intro clip — Local Doppler and Storm Tracker are silent on this theme.",
    "Air Quality product (colour-coded index, metro markets) has no scene.",
    "School Day Weather and Outdoor Activity Forecast (added Sept 2004) have no scenes.",
    "Pre-2007 layout variants (CC hero, Week Ahead 7-column, Daypart 4-column, Almanac 2-column) are unbuilt.",
    "Alert chrome should be brown for advisory / red for warning."
  ]
};
