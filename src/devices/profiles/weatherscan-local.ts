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
  extendedDays: 5,
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
  gaps: [
    "Only the 'neighborhood' regional background pack is sourced. Forest, ocean, mountain and southwest packs are missing.",
    "UDL (upper display line) strip is not rendered — only the LDL exists."
  ]
};
