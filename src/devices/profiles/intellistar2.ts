import type { Device } from "../types";

/**
 * IntelliStar 2 / 2 Jr HD — 2013+.
 *
 * The modern HD look. Bright blue palette, Interstate chrome with Helvetica
 * Neue LDL body text (matching the June 2, 2008 LDL redesign), and a combined
 * background pool of 254 sharp HD generics plus 28 blurred IS2 Jr plates.
 * Severe weather draws from a dedicated LOT8 severe background set.
 *
 * Jim Cantore is the voice. TWC recorded him for the IntelliStar 2 HD
 * generation in 2008, and from the IntelliStar's retirement in November 2015
 * his was the only Vocal Local heard on the network.
 *
 * This was previously set to `chandler`, which cannot be right on a 2013+
 * unit: Dan Chandler was TWC's voice in the late 1980s and 1990s, and his
 * library proves its own age — every hourly clip says "your local 36 hour
 * forecast" and the extended says "the five day forecast", both pre-September
 * 2004 product names. `docs/asset-gaps.md` had already noticed the symptom
 * ("Chandler's clips use pre-2004 phrasing, which is anachronistic for a
 * 2013+ unit") without spotting that the cause was the voice sitting on the
 * wrong machine by about twenty-five years.
 *
 * Confirmed products (docs/legacy-eras.md "Era 5"): Current Conditions,
 * 12-hour forecast graph and 24-hour descriptive, 7-day, Local Forecast
 * narrative, Local Doppler in the LOT8s frame, Almanac (average and record
 * min/max with year first set, sunrise/sunset on an analog clock graphic,
 * moon phase).
 *
 * Explicitly NOT confirmed, do not invent: a separate 36-hour horizontal
 * strip, and Travel Cities as a standalone post-2013 scene.
 *
 * Severe treatment: a single-line crawl over the LDL with a red box at left,
 * yellow for watches, orange for statements. The full-bleed red takeover is
 * the tornado-emergency tier only, not the default.
 */
export const INTELLISTAR2: Device = {
  id: "intellistar2",
  label: "IntelliStar 2 / 2 Jr HD (2013+)",
  years: "2013-2022",
  era: "post-2004",
  voice: "jim-cantore",
  musicTags: ["intellistar2"],
  extendedDays: 7,
  capabilities: { ldl: true, footer: false, icons: true, radar: true, narration: true, sponsorSlot: true },
  // Travel is deliberately NOT in the base rundown: docs/legacy-eras.md
  // records its post-2013 standalone status as unverified, and regional
  // forecasts ran through the sidebar rundown instead. Offered as optional
  // rather than asserted as core.
  rundown: ["current", "hourly", "extended", "localforecast", "radar", "almanac"],
  products: {
    current:       { availability: "core", name: "Current Conditions" },
    hourly:        { availability: "core", name: "Hourly Forecast" },
    extended:      { availability: "core", name: "7-Day Forecast" },
    localforecast: { availability: "core", name: "Local Forecast" },
    radar:         { availability: "core", name: "Local Doppler Radar" },
    almanac:       { availability: "core" },
    alerts:        { availability: "core" },
    // Post-2013 standalone status is unverified — offered, not assumed.
    travel:        { availability: "optional" },
    detailed:      { availability: "optional" },
    feelslike:     { availability: "optional" },
    temptrend:     { availability: "optional" },
    stormtracker:  { availability: "optional" }
  },
  visuals: {
    iconSet: "/assets/icons/large",
    iconResolution: 68,
    backgroundImage: "",
    extendedTitle: "7-Day Outlook",
    backgroundPool: "is2-generics",
    severePool: "is2-severe",
    vars: {
      "--ws-bg-deep":       "#000714",
      "--ws-bg-mid":        "#001e46",
      "--ws-bg-top":        "#003a7a",
      "--ws-accent":        "#3fa9ff",
      "--ws-accent-warm":   "#ffc832",
      "--ws-text":          "#ffffff",
      "--ws-text-dim":      "#a6bbd0",
      "--ws-led":           "#ffc832",
      "--ws-alert":         "#ff4040",
      "--ws-font-display":  '"Frutiger", "Interstate", "Helvetica Neue", "Arial", sans-serif',
      "--ws-font-led":      '"Interstate", "Frutiger", "Helvetica Neue", "Courier New", monospace',
      "--ws-font-small":    '"Frutiger", "Interstate", "Helvetica Neue", "Arial", sans-serif',
    }
  },
  gaps: [
    "LOT8s windowed frame is not built — radar should render inside it, not full-bleed.",
    "Severe treatment should default to a single-line crawl over the LDL (red box left, yellow watches, orange statements); full-bleed red is the tornado-emergency tier only.",
    "Almanac needs the analog sunrise/sunset clock graphic (white = sunrise, black = sunset).",
    "IS2 Jr should suppress its LDL during national segments; currently both render identically.",
    // Replaces "Chandler's clips use pre-2004 phrasing, anachronistic for a
    // 2013+ unit" — the cause was the voice, not the phrasing, and the voice
    // is now Cantore. What remains is a genuine hole in his library.
    "Jim Cantore has no radar intro clip, so Local Doppler falls back to spoken text. Unresolved whether TWC recorded one for the IntelliStar 2; the IS2 StarBundles (archive.org/details/bundles.-7z) would settle it."
  ]
};
