import type { Device } from "../types";

/**
 * Weatherscan V2 — September 2005 to December 15, 2022.
 *
 * The final visual redesign, and the one most people remember from the
 * shutdown. Interstate Bold in the outer chrome (logo wordmark, clock, L-bar
 * labels), Frutiger retained inside the main content panel. Same city-skyline
 * backgrounds and colour-coded segment accents as V1. 33-track
 * remastered-in-stereo in-house jazz catalogue. Amy Bargeron continued.
 *
 * The L-bar — a persistent left column carrying logo, observations and radar,
 * plus a bottom horizontal strip — is the defining layout of this era, and it
 * is now built (`src/ui/weatherscan/WeatherscanLBar.tsx`). The 224/496 column
 * split is measured from TWC's own render scripts rather than eyeballed from
 * a still: `products/ext/ticker/CityTicker.rs` falls back to a 496px ticker
 * and `products/pm/Radar/LocalDoppler.prod` draws a 224px legend inside the
 * 'radar' viewport, and those two add to the 720px NTSC raster exactly.
 */
export const WEATHERSCAN_V2: Device = {
  id: "weatherscan-v2",
  label: "Weatherscan V2 L-bar (2005-2022)",
  years: "2005-2022",
  era: "post-2004",
  voice: "amy-bargeron",
  musicTags: ["weatherscan-inhouse"],
  extendedDays: 7,
  capabilities: { ldl: true, footer: false, icons: true, radar: true, narration: true, sponsorSlot: true, lbar: true },
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
    traffic:       { availability: "optional", name: "Traffic Flow" },
    airport:       { availability: "optional", name: "Airport Delays" },
    detailed:      { availability: "optional" },
    feelslike:     { availability: "optional" }
  },
  visuals: {
    iconSet: "/assets/shared/icons",
    backgroundImage: "/assets/devices/weatherscan-v2/backgrounds/city_bg.webp",
    extendedTitle: "7-Day Outlook",
    backgroundPool: "ws-city-skylines",
    vars: {
      "--ws-bg-deep":       "#020a1c",
      "--ws-bg-mid":        "#071638",
      "--ws-bg-top":        "#0d246a",
      "--ws-accent":        "#00b4e8",
      "--ws-accent-warm":   "#ffd24d",
      "--ws-text":          "#ffffff",
      "--ws-text-dim":      "#8aa0c0",
      "--ws-led":           "#ffffff",
      "--ws-alert":         "#ff3333",
      "--ws-font-display":  '"Interstate", "Frutiger", "Helvetica Neue", "Arial", sans-serif',
      "--ws-font-led":      '"Interstate", "InterstateMono", "Courier New", monospace',
      "--ws-font-small":    '"Frutiger", "Interstate", "Arial", sans-serif',
    }
  },
  gaps: [
    // The L-bar itself is built. What is left is the part the render scripts
    // could not answer, kept separate from the part they could.
    "L-bar row heights are a design choice, not a measurement: setupLayers.rs reads every viewport rectangle from headend config (`dsm.configGet('viewports')`) that never shipped inside the package. Only the 224/496 column split and the 19px ticker row are sourced.",
    "The bottom strip runs the alert crawl or the LDL. The real V2 ran a city ticker there — nearby markets' conditions on rotating tabs, Interstate BoldCondensed 16pt, crawl step 2.8px/frame (products/ext/ticker/CityTicker.rs). Needs regional observations the app does not fetch yet.",
    "The clock lives in the shared frame header over the main panel. The real V2 stacked date and clock (with seconds) under the wordmark at the top of the L-bar column. Moving it would mean a per-device header, which no other machine needs yet.",
    "Bottom-left of the column carried the cable provider's logo beneath the radar. Not rendered — there is no provider concept in the app.",
    "Same missing activity-pack scenes as V1."
  ]
};
