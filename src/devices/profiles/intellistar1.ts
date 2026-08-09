import type { Device } from "../types";

/**
 * IntelliStar 1 — 2003-2013 (SD).
 *
 * Black-to-navy gradient palette with muted gold accents, Interstate
 * typography, and a pool of 254 city-gradient backgrounds rotating between
 * scenes.
 *
 * Allen Jackson is the voice, NOT Jim Cantore. TWC Archive's Vocal Local
 * article is explicit: Jackson voiced the WeatherStar XL and the IntelliStar,
 * and his narration stayed in service until the IntelliStar was retired in
 * November 2015; Cantore was recorded for the IntelliStar 2 HD generation
 * from 2008. The surviving IS1 drive dumps agree — their Vocal Local tree
 * uses the same `doppler/LRADAR_DEFAULT{1,2}` filenames as our Allen Jackson
 * library, which Cantore's library does not contain at all.
 *
 * This was previously set to jim-cantore, and that single wrong field is the
 * whole reason `docs/asset-gaps.md` recorded "Jim Cantore has NO radar intro
 * clip — Local Doppler and Storm Tracker are silent on this theme". The clips
 * were never missing. They were on disk the entire time, under the narrator
 * this hardware actually used.
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
  voice: "allan-jackson",
  musicTags: ["intellistar1"],
  extendedDays: 7,
  capabilities: { ldl: true, footer: false, icons: true, radar: true, narration: true, sponsorSlot: true },
  // Derived from 3,839 real per-headend IntelliStar configuration files, not
  // from a wiki: every deployed unit carried its playlist with an explicit
  // priority per product, and thousands of markets agree on the order. See
  // docs/reference/rundowns.md, regenerate with `npm run rundowns:extract`.
  //
  // This previously read current → hourly → extended → localforecast → radar,
  // which put the two products the machine ran FIRST (the text forecast and
  // Doppler, both priority 1) behind two that ran later (extended at 2,
  // daypart at 4). NWSHeadlines is also priority 1 upstream, but alerts stay
  // last here because in this application they are an interrupt rather than a
  // rotation slot.
  rundown: ["current", "localforecast", "radar", "extended", "hourly", "travel", "almanac"],
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
    iconSet: "/assets/shared/icons/large",
    iconResolution: 42,
    backgroundImage: "",
    extendedTitle: "Week Ahead",
    backgroundPool: "is1-city-gradients",
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
    // Resolved: this used to read "Jim Cantore has NO radar intro clip". He
    // was never this machine's voice. Allen Jackson's radar intros were on
    // disk the whole time and now play.
    "Air Quality product (colour-coded index, metro markets) has no scene.",
    "School Day Weather and Outdoor Activity Forecast (added Sept 2004) have no scenes.",
    "Pre-2007 layout variants (CC hero, Week Ahead 7-column, Daypart 4-column, Almanac 2-column) are unbuilt.",
    "Alert chrome should be brown for advisory / red for warning."
  ]
};
