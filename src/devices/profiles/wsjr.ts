import type { Device } from "../types";

/**
 * WeatherStar Jr — 1993/94-2014.
 *
 * Budget Wegener unit for small cable operators. Per docs/legacy-eras.md
 * "Era 3", this is a WeatherStar 3000 product set rendered in the 4000-era
 * typeface — NOT a 4000 variant. Text-only pages, no on-unit radar, no
 * cartoon icons, no graphical moon-phase almanac.
 *
 * Narrator note: allan-jackson is used but is NOT source-confirmed for this
 * unit — Allan Jackson is documented for WS XL and IS1. Revisit if aircheck
 * audio surfaces. Tracked in gaps below.
 */
export const WSJR: Device = {
  id: "wsjr",
  label: "WeatherStar Jr (1993-2014)",
  years: "1993-2014",
  era: "pre-2004",
  voice: "allan-jackson",
  musicTags: ["trammell-starks"],
  extendedDays: 3,
  capabilities: { ldl: false, footer: false, icons: false, radar: false, narration: true, sponsorSlot: false },
  rundown: ["current", "localforecast", "extended", "almanac", "travel"],
  products: {
    current:       { availability: "core", name: "Latest Observations" },
    localforecast: { availability: "core", name: "36 Hour Forecast", intro: ["thirtySixHour"] },
    extended:      { availability: "core", name: "Extended Forecast" },
    almanac:       { availability: "core", name: "Almanac" },
    travel:        { availability: "core", name: "Travel Cities Forecast" },
    alerts:        { availability: "core" },
    radar:         { availability: "absent", absentNote: "The WeatherStar Jr had no on-unit radar." },
    hourly:        { availability: "absent", absentNote: "Inherited the 3000 product set, which had no hourly." },
    stormtracker:  { availability: "absent", absentNote: "Requires radar, which this unit lacked." },
    weekend:       { availability: "absent", absentNote: "No weekend product." }
  },
  gaps: [
    "Shares the unbuilt WS3000 text-page renderer stack.",
    "Narrator assignment (Allan Jackson) is inferred, not source-confirmed.",
    "Needs one Current Conditions still to confirm the layout."
  ]
};
