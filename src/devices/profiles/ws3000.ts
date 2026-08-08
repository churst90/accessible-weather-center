import type { Device } from "../types";

/**
 * WeatherStar 3000 — 1988-1990.
 *
 * TWC's pre-WS4000 local unit. Blocky coloured text on a dark blue/purple
 * field. Sources: docs/legacy-eras.md "Era 1", HandWiki, Wikipedia.
 *
 * The defining constraints, all confirmed:
 *   - No narration of any kind. A warning tone existed; a local voice track
 *     did not. This is the only machine where silence is CORRECT.
 *   - No radar. The 3000 could not render it on the box.
 *   - No graphical weather icons — text pages only.
 *   - Extended Forecast was 3 columns. The 3000 never had a 5-day.
 *   - Advisories scrolled on tan/brown, warnings on red.
 */
export const WS3000: Device = {
  id: "ws3000",
  label: "WeatherStar 3000 (1988-1990)",
  years: "1988-1990",
  era: "pre-2004",
  voice: "silent",
  musicTags: ["any"],
  extendedDays: 3,
  capabilities: { ldl: false, footer: false, icons: false, radar: false, narration: false, sponsorSlot: false },
  rundown: ["current", "localforecast", "extended", "almanac", "travel"],
  products: {
    current:       { availability: "core", name: "Latest Observations" },
    localforecast: { availability: "core", name: "36 Hour Forecast", intro: ["thirtySixHour"] },
    extended:      { availability: "core", name: "Extended Forecast" },
    almanac:       { availability: "core", name: "Almanac" },
    travel:        { availability: "core", name: "Travel Cities Forecast" },
    alerts:        { availability: "core", name: "Advisories" },
    radar:         { availability: "absent", absentNote: "The WeatherStar 3000 could not render radar on the unit." },
    hourly:        { availability: "absent", absentNote: "Hourly/daypart forecasts did not exist on the 3000." },
    weekend:       { availability: "absent", absentNote: "No weekend product on the 3000." },
    stormtracker:  { availability: "absent", absentNote: "Radar-derived products require radar, which the 3000 lacked." },
    airport:       { availability: "absent", absentNote: "Airport delays were not a 3000 product." },
    traffic:       { availability: "absent", absentNote: "Traffic was not a 3000 product." }
  },
  visuals: {
    iconSet: "/assets/icons/legacy/1990-regional",
    backgroundImage: "",
    extendedTitle: "Extended Forecast",
    vars: {
      "--ws-bg-deep":       "#060028",
      "--ws-bg-mid":        "#1a0858",
      "--ws-bg-top":        "#2e1a90",
      "--ws-accent":        "#e8ecff",
      "--ws-accent-warm":   "#ffc840",
      "--ws-text":          "#f4f6ff",
      "--ws-text-dim":      "#b0b4cc",
      "--ws-led":           "#ffc840",
      "--ws-alert":         "#ff4040",
      "--ws-font-display":  '"Star3000", "Star3000 Large", "Courier New", monospace',
      "--ws-font-led":      '"Star3000 Large", "Star3000", "Courier New", monospace',
      "--ws-font-small":    '"Star3000 Small", "Star3000", "Courier New", monospace',
    }
  },
  gaps: [
    "Text-page renderer stack not built — palette and typography are correct but layouts are generic.",
    "Needs Latest Observations, 36 Hour Forecast, Extended (3-col), Almanac and Travel stills to lay out faithfully.",
    "Tides page variant for coastal markets is unimplemented."
  ]
};
