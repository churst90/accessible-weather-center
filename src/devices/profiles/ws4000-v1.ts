import type { Device } from "../types";

/**
 * WeatherStar 4000 v1 — approx 2001-2004.
 *
 * Flat orange header strip with a dark-blue diagonal cut, full-bleed solid
 * blue content pane with a cyan inner border, yellow Star4000 Extended
 * titles, gold Star4000 Large temps, 1998 cartoon icon set. No persistent
 * footer. Almanac has its own orange/purple split background.
 *
 * Dated hardware milestones (docs/legacy-eras.md background timeline):
 *   Feb 1991  Extended became the 3-day graphical format
 *   Nov 1992  Local radar with 6-image loop (J, K, M flavors)
 *   Aug 1994  Radar upgraded to 8 intensity levels
 *
 * Ends at the September 2004 rename, so it keeps "36 Hour Forecast" and
 * "Daily Planner".
 */
export const WS4000_V1: Device = {
  id: "ws4000-v1",
  label: "WeatherStar 4000 v1 (2001-2004)",
  years: "2001-2004",
  era: "pre-2004",
  voice: "allan-jackson",
  musicTags: ["trammell-starks"],
  extendedDays: 3,
  capabilities: { ldl: false, footer: false, icons: true, radar: true, narration: true, sponsorSlot: false },
  rundown: ["current", "localforecast", "extended", "radar", "almanac", "travel"],
  products: {
    current:       { availability: "core" },
    localforecast: { availability: "core", name: "36 Hour Forecast", intro: ["thirtySixHour"] },
    extended:      { availability: "core", name: "Extended Forecast" },
    radar:         { availability: "core", name: "Local Doppler Radar" },
    almanac:       { availability: "core" },
    travel:        { availability: "core", name: "Travel Cities Forecast" },
    alerts:        { availability: "core" },
    hourly:        { availability: "optional", name: "Daily Planner", intro: ["dailyPlanner"] },
    airport:       { availability: "absent", absentNote: "Airport delays were not a WeatherStar 4000 product." }
  },
  gaps: [
    "Extended Forecast should be 3 vertical day-panels with the louvered blue gradient.",
    "Current Conditions wants the icon-left / fields-right layout from the broadcast stills.",
    "Almanac needs its scene-specific orange-top / purple-bottom split background."
  ]
};
