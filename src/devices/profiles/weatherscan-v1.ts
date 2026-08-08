import type { Device } from "../types";

/**
 * Weatherscan V1 — February 2003 to September 2005.
 *
 * First era on the IntelliStar platform. City-skyline backgrounds with the
 * "weatherscan" wordmark in blue Frutiger, and colour-coded arc-side curves
 * per segment: yellow local forecast, orange traffic, blue travel/airport,
 * green garden/golf, teal health, purple ski. 15-track in-house jazz
 * catalogue. Amy Bargeron is the voice of Weatherscan.
 *
 * This is where the Weatherscan Plus activity packs belong — they rode as
 * value-adds a cable operator could buy, not as base rotation, which is
 * exactly what `optional` means here.
 *
 * Era note: launched Feb 2003 (pre-rename) but ran mostly after it, on the
 * platform the rename applied to. Assigned post-2004; needs an aircheck to
 * confirm which naming Weatherscan itself used. Tracked in gaps.
 */
export const WEATHERSCAN_V1: Device = {
  id: "weatherscan-v1",
  label: "Weatherscan V1 (2003-2005)",
  years: "2003-2005",
  era: "post-2004",
  voice: "amy-bargeron",
  musicTags: ["weatherscan-inhouse"],
  extendedDays: 7,
  capabilities: { ldl: true, footer: false, icons: true, radar: true, narration: true, sponsorSlot: true },
  rundown: ["current", "localforecast", "radar", "extended", "hourly", "travel", "almanac"],
  products: {
    current:       { availability: "core" },
    localforecast: { availability: "core", name: "Local Forecast" },
    radar:         { availability: "core", name: "Local Doppler Radar" },
    extended:      { availability: "core", name: "7-Day Outlook" },
    hourly:        { availability: "core", name: "Daypart Forecast" },
    travel:        { availability: "core" },
    almanac:       { availability: "core" },
    alerts:        { availability: "core" },
    // Weatherscan Plus packs — operator-purchased value-adds.
    traffic:       { availability: "optional", name: "Traffic Flow" },
    airport:       { availability: "optional", name: "Airport Delays" },
    detailed:      { availability: "optional" },
    feelslike:     { availability: "optional" }
  },
  gaps: [
    "Colour-coded arc-side segment curves (yellow/orange/blue/green/teal/purple) are not implemented.",
    "Activity packs from Weatherscan Plus — golf, ski, beach, garden, health — have no scenes or art.",
    "Product era assignment straddles the Sept 2004 rename and is unconfirmed."
  ]
};
