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
 * plus a bottom horizontal strip — is the defining layout of this era and is
 * NOT built. V2 currently renders in the standard frame, distinguished from
 * V1 by typography and palette only.
 */
export const WEATHERSCAN_V2: Device = {
  id: "weatherscan-v2",
  label: "Weatherscan V2 L-bar (2005-2022)",
  years: "2005-2022",
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
    traffic:       { availability: "optional", name: "Traffic Flow" },
    airport:       { availability: "optional", name: "Airport Delays" },
    detailed:      { availability: "optional" },
    feelslike:     { availability: "optional" }
  },
  visuals: {
    iconSet: "/assets/icons",
    backgroundImage: "/assets/themes/weatherscan/backgrounds/city_bg.webp",
    extendedTitle: "7-Day Outlook",
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
    "THE L-BAR IS NOT BUILT. Persistent left column (logo / observations / radar) plus bottom horizontal strip — the defining layout of the era.",
    "Needs a full-frame still showing the L-bar to lay out faithfully.",
    "Same missing activity-pack scenes as V1."
  ]
};
