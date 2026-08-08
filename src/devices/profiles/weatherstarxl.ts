import type { Device } from "../types";

/**
 * WeatherStar XL — approx 1998-2005 as the flagship local unit.
 *
 * Interstate and Frutiger typography, deep navy palette, blue-sky cumulus
 * wallpaper, and a 7-Day Outlook rather than an Extended Forecast. Radar runs
 * immediately after conditions. The most visually complete theme in the app.
 *
 * Era note: the XL predates the IntelliStar rollout and the September 2004
 * rename, so it keeps the older product names. themes.ts carries no dated
 * label for this unit, so the assignment is inferred rather than confirmed —
 * tracked in gaps.
 */
export const WEATHERSTAR_XL: Device = {
  id: "weatherstarxl",
  label: "WeatherStar XL",
  years: "1998-2005",
  era: "pre-2004",
  voice: "allan-jackson",
  musicTags: ["trammell-starks"],
  extendedDays: 7,
  capabilities: { ldl: true, footer: false, icons: true, radar: true, narration: true, sponsorSlot: false },
  rundown: ["current", "radar", "localforecast", "extended", "hourly", "travel", "almanac"],
  products: {
    current:       { availability: "core" },
    radar:         { availability: "core", name: "Local Doppler Radar" },
    localforecast: { availability: "core", name: "36 Hour Forecast", intro: ["thirtySixHour"] },
    extended:      { availability: "core", name: "7-Day Outlook" },
    hourly:        { availability: "core", name: "Daily Planner", intro: ["dailyPlanner"] },
    travel:        { availability: "core", name: "Travel Cities Forecast" },
    almanac:       { availability: "core" },
    alerts:        { availability: "core" },
    detailed:      { availability: "optional", name: "Latest Observations" },
    airport:       { availability: "optional" }
  },
  visuals: {
    iconSet: "/assets/icons/large",
    iconResolution: 42,
    backgroundImage: "",
    extendedTitle: "Extended Forecast",
    backgroundPool: "xl-clouds",
    vars: {
      "--ws-bg-deep":       "#000000",
      "--ws-bg-mid":        "#0a1930",
      "--ws-bg-top":        "#152a50",
      "--ws-accent":        "#5eaacc",
      "--ws-accent-warm":   "#debd69",
      "--ws-text":          "#d4d4d4",
      "--ws-text-dim":      "#9eaabb",
      "--ws-led":           "#debd69",
      "--ws-alert":         "#ff4444",
      "--ws-font-display":  '"AkzidenzGroteskBE-BoldEx", "AkzidenzGroteskBE", "Helvetica Neue", "Arial", sans-serif',
      "--ws-font-led":      '"AkzidenzGroteskBE", "Helvetica Neue", "Courier New", monospace',
      "--ws-font-small":    '"AkzidenzGroteskBE-MdEx", "AkzidenzGroteskBE", "Helvetica", "Arial", sans-serif',
    }
  },
  gaps: [
    "No dated label in themes.ts, so the pre-2004 product era is inferred from the XL predating the IntelliStar rollout."
  ]
};
