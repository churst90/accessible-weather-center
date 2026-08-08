import type { Device } from "../types";

/**
 * Weatherscan Local — 1999-2003.
 *
 * Pre-IntelliStar era running on WeatherStar XL hardware. Regional
 * photographic backgrounds (neighbourhood, forest, ocean, mountain,
 * southwest) from the XL's regional pool, Akzidenz-Grotesk typography, UDL
 * and LDL text strips framing the content, Trammell Starks' Music for Local
 * Forecast as the soundtrack. No skylines, no yellow wedge accents — those
 * arrived with Era 2.
 *
 * Pre-Weatherscan Plus, so no activity packs in the rotation.
 */
export const WEATHERSCAN_LOCAL: Device = {
  id: "weatherscan-local",
  label: "Weatherscan Local (1999-2003)",
  years: "1999-2003",
  era: "pre-2004",
  voice: "allan-jackson",
  musicTags: ["trammell-starks"],
  // 7-day, matching the XL hardware it ran on and the "7-Day Outlook"
  // branding. docs/weatherscan-eras.md line 71 lists a "5-day forecast" in
  // the core set, which may describe a different sub-era — flagged in gaps
  // rather than changed on an ambiguous reading.
  extendedDays: 7,
  capabilities: { ldl: true, footer: false, icons: true, radar: true, narration: true, sponsorSlot: true },
  rundown: ["current", "localforecast", "radar", "extended", "hourly", "travel", "almanac"],
  products: {
    current:       { availability: "core" },
    localforecast: { availability: "core", name: "36 Hour Forecast", intro: ["thirtySixHour"] },
    radar:         { availability: "core", name: "Local Doppler Radar" },
    extended:      { availability: "core", name: "Extended Forecast" },
    hourly:        { availability: "core", name: "Daily Planner", intro: ["dailyPlanner"] },
    travel:        { availability: "core" },
    almanac:       { availability: "core" },
    alerts:        { availability: "core" },
    traffic:       { availability: "optional" }
  },
  visuals: {
    iconSet: "/assets/icons",
    backgroundImage: "/assets/themes/weatherscan/backgrounds/local-era/neighborhood/now.webp",
    extendedTitle: "7-Day Outlook",
    vars: {
      "--ws-bg-deep":       "#040915",
      "--ws-bg-mid":        "#0a1838",
      "--ws-bg-top":        "#14295c",
      "--ws-accent":        "#8ec8e8",
      "--ws-accent-warm":   "#e4c878",
      "--ws-text":          "#f0f4fa",
      "--ws-text-dim":      "#a6b4cc",
      "--ws-led":           "#e4c878",
      "--ws-alert":         "#ff4040",
      "--ws-font-display":  '"AkzidenzGroteskBE-BoldEx", "AkzidenzGroteskBE", "Helvetica Neue", "Arial", sans-serif',
      "--ws-font-led":      '"AkzidenzGroteskBE", "Helvetica Neue", "Courier New", monospace',
      "--ws-font-small":    '"AkzidenzGroteskBE-MdEx", "AkzidenzGroteskBE", "Helvetica", "Arial", sans-serif',
    }
  },
  gaps: [
    "Only the 'neighborhood' regional background pack is sourced. Forest, ocean, mountain and southwest packs are missing.",
    "UDL (upper display line) strip is not rendered — only the LDL exists.",
    "Extended day count unconfirmed: kept at 7-day to match the XL hardware and the '7-Day Outlook' branding, but docs/weatherscan-eras.md lists a 5-day forecast in the core set."
  ]
};
