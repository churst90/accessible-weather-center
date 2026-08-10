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
 *
 * Voice: Dan Chandler, not Allen Jackson
 * ---------------------------------------
 * Two independent reasons, one negative and one positive.
 *
 * Allen Jackson cannot be right here. Vocal Local — the feature that
 * assembles his recordings — arrived with the WeatherStar XL in 1998; a 4000
 * running "36 Hour Forecast" and "Daily Planner" predates it.
 *
 * Chandler fits on every axis. He narrated the Local Forecast from 1987 and
 * on the 4000 specifically from 1990 until it was discontinued in April 1995,
 * across four recorded sets (debut 1990, July 1990, July 1991, August 1992).
 * The sources describe his 4000 narration as used *only to introduce products
 * in the forecast segment* — which is exactly the shape of the library we
 * hold: 202 clips, all scene intros, `hasTemps: false`, `hasConditions:
 * false`. It also dates itself to this machine: "your local 36 hour forecast"
 * and "the five day forecast", both retired in September 2004.
 *
 * And it rules out the 3000, which he also re-recorded for (July 1991, Fall
 * 1992). His library contains radar intros — "the current local radar,
 * showing any precipitation in your area" — and Local Radar was a 4000
 * product added in November 1992. The 3000 could not render radar at all.
 *
 * Unresolved, and left alone deliberately: this profile is labelled
 * "approx 2001-2004" while every hardware milestone its own docblock cites is
 * 1991-1994, and Chandler stopped in 1995. The date range looks like the
 * guess and the milestones look like the sourced part, but confirming that
 * means deciding whether the project wants a separate early-4000 machine.
 * That is a modelling decision, not a research one.
 */
export const WS4000_V1: Device = {
  id: "ws4000-v1",
  label: "WeatherStar 4000 v1 (2001-2004)",
  years: "2001-2004",
  era: "pre-2004",
  voice: "chandler",
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
  visuals: {
    iconSet: "/assets/shared/icons",
    backgroundImage: "/assets/shared/backgrounds/BackGround1.webp",
    extendedTitle: "Extended Forecast",
    sceneBackgroundSet: "ws4000-v1",
    vars: {
      "--ws-bg-deep":       "#050d28",
      "--ws-bg-mid":        "#0a1f4a",
      "--ws-bg-top":        "#1b3b87",
      "--ws-accent":        "#4ec9ff",
      "--ws-accent-warm":   "#ff9933",
      "--ws-text":          "#ffffff",
      "--ws-text-dim":      "#b8c6e0",
      "--ws-led":           "#ffd24d",
      "--ws-alert":         "#ff5050",
      "--ws-font-display":  '"Star4000", "Star4000 Extended", "Lato", "Helvetica Neue", "Arial", sans-serif',
      "--ws-font-led":      '"Star4000 Large", "Star4000", "Courier New", monospace',
      "--ws-font-small":    '"Star4000 Small", "Star4000", "Arial", sans-serif',
    }
  },
  gaps: [
    "Extended Forecast should be 3 vertical day-panels with the louvered blue gradient.",
    "Current Conditions wants the icon-left / fields-right layout from the broadcast stills.",
    "Almanac needs its scene-specific orange-top / purple-bottom split background."
  ]
};
