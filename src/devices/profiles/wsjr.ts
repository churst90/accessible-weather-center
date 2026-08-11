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
  // 3-day. The old themes table said 5-day; docs/legacy-eras.md is explicit:
  // "Not 5 columns — WS3000 never had a 5-day Extended." Corrected here.
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
    weekend:       { availability: "absent", absentNote: "No weekend product." }
  },
  visuals: {
    iconSet: "/assets/shared/icons",
    backgroundImage: "/assets/shared/backgrounds/BackGround2.webp",
    extendedTitle: "Extended Forecast",
    sceneBackgroundSet: "wsjr",
    vars: {
      "--ws-bg-deep":       "#060e26",
      "--ws-bg-mid":        "#0c1f4c",
      "--ws-bg-top":        "#1a3680",
      "--ws-accent":        "#4fb8e0",
      "--ws-accent-warm":   "#ffc448",
      "--ws-text":          "#ffffff",
      "--ws-text-dim":      "#a8bcd8",
      "--ws-led":           "#ffc448",
      "--ws-alert":         "#ff4848",
      "--ws-font-display":  '"StarJR", "Star4000", "Star4000 Extended", "Lato", "Helvetica Neue", "Arial", sans-serif',
      "--ws-font-led":      '"StarJR Large", "StarJR", "Courier New", monospace',
      "--ws-font-small":    '"StarJR Small", "StarJR", "Arial", sans-serif',
    }
  },
  gaps: [
    "Shares the unbuilt WS3000 text-page renderer stack.",
    "Narrator assignment (Allan Jackson) is inferred, not source-confirmed.",
    "Needs one Current Conditions still to confirm the layout."
  ]
};
