/**
 * Visual theme definitions. Each theme represents a specific TWC hardware
 * unit; every theme must be visually distinct. Near-duplicates have been
 * consolidated (IS2 HD + IS2 Jr HD use the same fonts and scene order, so
 * they share one "intellistar2" theme with the combined background pool).
 *
 * Themes:
 *   - ws3000:            WeatherStar 3000 (1988-1990) — blocky text, no radar, silent
 *   - ws4000-v1:         WeatherStar 4000 v1 (~2001-2004) — flat orange header,
 *                        solid blue content, full-bleed, no footer bar
 *   - ws4000-v2:         WeatherStar 4000 v2 (~2005-2009) — skewed orange header,
 *                        floating cyan-glow content box on orange-to-purple
 *                        gradient, always-on footer bar, light-basemap radar
 *   - wsjr:              WeatherStar Jr (1993-2014) — StarJR fonts, inherits
 *                        WS3000 product set (text-only pages, no radar/icons)
 *   - weatherstarxl:     WeatherStar XL (1998-2014) — cloud wallpaper, Akzidenz gold
 *   - weatherscan-local: Weatherscan Local (1999-2003) — regional photo bgs, Akzidenz, Trammell Starks music
 *   - weatherscan-v1:    Weatherscan IntelliStar V1 (2003-2005) — cityscape + yellow wedge, Frutiger, in-house jazz, Amy Bargeron
 *   - weatherscan-v2:    Weatherscan L-bar (2005-2022) — same cityscape, Interstate chrome + Frutiger panels, in-house jazz, Amy Bargeron
 *   - intellistar1:      IntelliStar 1 (2003-2013) — Akzidenz, gradient city backgrounds
 *   - intellistar2:      IntelliStar 2 / 2 Jr HD (2013+) — HD graphics, TWC blue, Frutiger
 *
 * The `highContrast` boolean setting in SettingsStore applies a CSS overlay
 * on TOP of any theme for accessibility, rather than existing as its own
 * theme (no TWC hardware unit was ever "high contrast").
 */

import type { NarratorId } from "../../audio/manifests/narratorSchema";
import { pickBackground } from "./backgroundCatalog";

export type ThemeId =
  | "ws3000"
  | "ws4000-v1"
  | "ws4000-v2"
  | "wsjr"
  | "weatherstarxl"
  | "weatherscan-local"
  | "weatherscan-v1"
  | "weatherscan-v2"
  | "intellistar1"
  | "intellistar2";

/**
 * Historical branding for the multi-day forecast scene. WeatherStar 3000
 * ran a 3-column text Extended; WeatherStar 4000 (post-Feb 1991) ran a
 * 3-day graphical Extended; Weatherscan, IntelliStar, and WeatherStar XL
 * ran a 7-day outlook / week-ahead. (The "5-day" alias is kept for
 * narration-era selection — narrator clips tagged "5-day" are reused for
 * 3-day themes since both share the "Extended Forecast" phrasing bucket.)
 * Drives the scene title, how many NWS periods are displayed, and which
 * narrator intro clips are eligible.
 */
export type ExtendedStyle = "3-day" | "5-day" | "7-day";

export interface ThemeDef {
  id: ThemeId;
  label: string;
  /** Default narrator voice for this theme. User can override in settings. */
  defaultNarrator: NarratorId;
  /** Icon set path prefix for this theme's weather icons (GIF pool). */
  iconSet: string;
  /** Optional HD WEBP icon resolution. When set, the renderer uses
   *  /assets/icons/{NN}x{NN}/ for conditions that have a WEBP mapping;
   *  unmapped conditions fall back to the GIF pool at iconSet. */
  iconResolution?: 28 | 42 | 68;
  /** Music collection tags that match this theme. */
  musicTags: string[];
  /** CSS custom property overrides applied to :root. */
  vars: Record<string, string>;
  /** Background image URL (or empty for none). */
  backgroundImage: string;
  /** How the multi-day forecast scene is branded + sized for this era. */
  extendedStyle: ExtendedStyle;
  /** Scene title for the multi-day forecast (e.g. "Extended Forecast",
   *  "7-Day Outlook", "Week Ahead"). */
  extendedTitle: string;
}

export const THEMES: ThemeDef[] = [
  {
    // WeatherStar 4000 v1 (~2001-2004). Mid-era look: flat orange header
    // strip with a dark-blue diagonal cut on the right, full-bleed solid
    // blue content pane with a cyan inner border, yellow Star4000 Extended
    // titles, gold/yellow Star4000 Large temps, 1998 cartoon icon set.
    // Extended Forecast is 3 vertical day-panels (Feb 1991 redesign).
    // Almanac has an orange-top / purple-bottom split background unique
    // to that scene. Radar has its own dark-blue chrome with a cyan title
    // and inline intensity legend. No persistent bottom footer.
    //
    // Reference: docs/reference/ws4000/4000-v1-*.jpg — seven measured stills.
    id: "ws4000-v1",
    label: "WeatherStar 4000 v1 (2001–2004)",
    defaultNarrator: "allan-jackson",
    iconSet: "/assets/icons",
    // WS4000-era predates the Weatherscan in-house jazz catalog (2003+).
    // TWC flagship Local on the 8s ran on Trammell Starks' Music for
    // Local Forecast throughout this period — era-authentic pool.
    musicTags: ["trammell-starks"],
    backgroundImage: "/assets/backgrounds/BackGround1.png",
    extendedStyle: "3-day",
    extendedTitle: "Extended Forecast",
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
    },
  },
  {
    // WeatherStar 4000 v2 (~2005-2009). Late-era redesign on the same
    // hardware: skewed/parallelogram orange header strip layered over a
    // narrow dark-blue band, floating cyan-glow content box with drop
    // shadow on an orange-to-purple vertical gradient background, always-
    // on footer bar carrying contextual data ("Conditions at <city>",
    // "<Month> Precipitation: n.nn in", etc.). Radar uses a pink/purple
    // header with an expanded 7-step PRECIP legend plus an Incomplete
    // Data swatch, and the basemap switched from dark-navy to a light
    // off-white map with red state borders. Current Conditions adds a
    // pressure trend arrow and a Ceiling field.
    //
    // Reference: docs/reference/ws4000/WS4000_Simulator_v2_*.jpg — five
    // simulator stills (high fidelity; simulator, not raw broadcast).
    id: "ws4000-v2",
    label: "WeatherStar 4000 v2 (2005–2009)",
    defaultNarrator: "allan-jackson",
    iconSet: "/assets/icons",
    musicTags: ["trammell-starks"],
    // v2 renders an orange-to-purple vertical gradient as the frame bg
    // and a floating content pane on top. Using empty here so the CSS
    // custom property takes over (--ws-bg-image is set to none, and the
    // CSS body[data-theme="ws4000-v2"] rule paints the gradient).
    backgroundImage: "",
    extendedStyle: "3-day",
    extendedTitle: "Extended Forecast",
    vars: {
      // Orange-to-purple gradient stops (darker deep, warmer top). The
      // actual gradient is painted in CSS; these vars give fallback
      // solid colors for any component that reads them directly.
      "--ws-bg-deep":       "#2a0a3c",
      "--ws-bg-mid":        "#5c2a3c",
      "--ws-bg-top":        "#c85a1c",
      "--ws-accent":        "#7ae0ff",
      "--ws-accent-warm":   "#ff9933",
      "--ws-text":          "#ffffff",
      "--ws-text-dim":      "#d8bcc8",
      "--ws-led":           "#ffd24d",
      "--ws-alert":         "#ff5050",
      "--ws-font-display":  '"Star4000", "Star4000 Extended", "Lato", "Helvetica Neue", "Arial", sans-serif',
      "--ws-font-led":      '"Star4000 Large", "Star4000", "Courier New", monospace',
      "--ws-font-small":    '"Star4000 Small", "Star4000", "Arial", sans-serif',
    },
  },
  {
    // Weatherscan Local (1999-2003). Pre-IntelliStar era on the WeatherStar
    // XL platform. Visual language: regional photo backgrounds (neighborhood,
    // forest, ocean, mountain, southwest) drawn from the XL's regional pool,
    // Akzidenz-Grotesk typography, UDL+LDL text strips framing the content,
    // and Trammell Starks' Music for Local Forecast as the soundtrack. No
    // skyline cityscapes, no yellow wedge accents — those came in Era 2.
    id: "weatherscan-local",
    label: "Weatherscan Local (1999–2003)",
    defaultNarrator: "allan-jackson",
    iconSet: "/assets/icons",
    musicTags: ["trammell-starks"],
    // Fallback image — authentic pre-2003 Weatherscan Local "neighborhood"
    // regional theme Current Conditions background (soft-focus picket fence
    // at golden hour), sourced from the JesseWx2011 Weatherscan Local sim.
    // Real Weatherscan Local rotated scene-specific backgrounds via
    // getSceneBackground(), so this only shows when no per-scene map exists.
    backgroundImage: "/assets/themes/weatherscan/backgrounds/local-era/neighborhood/now.png",
    extendedStyle: "7-day",
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
    },
  },
  {
    // Weatherscan IntelliStar V1 (Feb 2003 – Sept 2005). First era on the
    // IntelliStar platform. Visual signature: city-skyline background with
    // the TWC "weatherscan" wordmark rendered over it in blue Frutiger,
    // color-coded "arc-side" curves per segment (yellow for local forecast,
    // orange traffic, blue travel/airport, green garden/golf, teal health,
    // purple ski). 15-track in-house jazz music catalog, Amy Bargeron as
    // the voice of Weatherscan.
    id: "weatherscan-v1",
    label: "Weatherscan V1 (2003–2005)",
    defaultNarrator: "amy-bargeron",
    iconSet: "/assets/icons",
    musicTags: ["weatherscan-inhouse"],
    backgroundImage: "/assets/themes/weatherscan/backgrounds/city_bg.png",
    extendedStyle: "7-day",
    extendedTitle: "7-Day Outlook",
    vars: {
      "--ws-bg-deep":       "#020818",
      "--ws-bg-mid":        "#061233",
      "--ws-bg-top":        "#0c1f5a",
      "--ws-accent":        "#00c8ff",
      "--ws-accent-warm":   "#ffcc33",
      "--ws-text":          "#ffffff",
      "--ws-text-dim":      "#8899bb",
      "--ws-led":           "#ffffff",
      "--ws-alert":         "#ff3333",
      "--ws-font-display":  '"Frutiger", "Lato", "Helvetica Neue", sans-serif',
      "--ws-font-led":      '"Frutiger", "Courier New", monospace',
      "--ws-font-small":    '"Frutiger", "Arial", sans-serif',
    },
  },
  {
    // Weatherscan V2 / L-bar era (Sept 2005 – Dec 2022). Final visual
    // redesign. Interstate Bold for the outer chrome (logo wordmark, clock,
    // L-bar labels); Frutiger retained inside the main content panel. Same
    // city-skyline backgrounds as V1, same color-coded segment accents.
    // 33-track remastered-in-stereo in-house jazz catalog. Amy Bargeron
    // continued as the voice.
    // NOTE: The L-bar layout (persistent left column with logo/obs/radar +
    // bottom horizontal strip) is not yet wired into WeatherscanFrame — for
    // now V2 renders with the standard frame shell, differentiated from V1
    // by typography and accent palette only.
    id: "weatherscan-v2",
    label: "Weatherscan V2 L-bar (2005–2022)",
    defaultNarrator: "amy-bargeron",
    iconSet: "/assets/icons",
    musicTags: ["weatherscan-inhouse"],
    backgroundImage: "/assets/themes/weatherscan/backgrounds/city_bg.png",
    extendedStyle: "7-day",
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
    },
  },
  {
    id: "weatherstarxl",
    label: "WeatherStar XL",
    defaultNarrator: "allan-jackson",
    iconSet: "/assets/icons/large",
    iconResolution: 42,
    // WeatherStar XL (1998-2014) shared the TWC flagship channel's music
    // pool, which was Trammell Starks' Music for Local Forecast throughout
    // its production life. XL never played the Weatherscan-exclusive
    // in-house jazz — that was a separate catalog for the Weatherscan
    // channel only.
    musicTags: ["trammell-starks"],
    backgroundImage: "",
    extendedStyle: "7-day",
    extendedTitle: "Extended Forecast",
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
    },
  },
  {
    id: "intellistar1",
    label: "IntelliStar 1",
    defaultNarrator: "jim-cantore",
    iconSet: "/assets/icons/large",
    iconResolution: 42,
    // IS1 (2003-2013) had its own dedicated production-music pool (Becker,
    // Chaquico, Cooling, Howard, Hughes, Sample). Strict filter keeps the
    // IS2 HD-era catalog out of the mix.
    musicTags: ["intellistar1"],
    backgroundImage: "",
    extendedStyle: "7-day",
    extendedTitle: "Week Ahead",
    // Typography: Interstate was the IS1 chrome/titles typeface from the
    // Feb 2003 launch onward (Wikipedia + HandWiki). The Jun 2, 2008 LDL
    // redesign swapped LDL body text to Helvetica Neue, but Interstate
    // remained in chrome. Earlier assumption of Akzidenz-Grotesk was
    // incorrect — that was WS XL / Weatherscan-Local typography, not IS1.
    vars: {
      "--ws-bg-deep":       "#001030",
      "--ws-bg-mid":        "#002060",
      "--ws-bg-top":        "#003399",
      "--ws-accent":        "#33aaff",
      "--ws-accent-warm":   "#ffcc00",
      "--ws-text":          "#ffffff",
      "--ws-text-dim":      "#aabbdd",
      "--ws-led":           "#ffcc00",
      "--ws-alert":         "#ff4444",
      "--ws-font-display":  '"Interstate", "Helvetica Neue", "Arial", sans-serif',
      "--ws-font-led":      '"Interstate", "InterstateMono", "Helvetica Neue", "Courier New", monospace',
      "--ws-font-small":    '"Helvetica Neue", "Interstate", "Helvetica", "Arial", sans-serif',
    },
  },
  {
    id: "intellistar2",
    label: "IntelliStar 2 / 2 Jr HD",
    defaultNarrator: "chandler",
    iconSet: "/assets/icons/large",
    iconResolution: 68,
    // (IS2 keeps 68px HD WEBPs; IS1 below gets 42px — its /large GIF
    // fallback dir actually contains .apng files, so without a WEBP
    // resolution every icon 404ed.)
    // IS2 (2013+) used its own HD-era production music (Beach Night,
    // Beautiful Day, Destination Groove, etc.). Era-exclusive filter.
    musicTags: ["intellistar2"],
    backgroundImage: "",
    extendedStyle: "7-day",
    extendedTitle: "7-Day Outlook",
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
    },
  },
  {
    // WeatherStar 3000 (1988-1990). TWC's pre-WS4000 local unit. No
    // narration, no graphical weather icons — just blocky colored text
    // against a dark blue/purple field. Radar wasn't rendered locally on
    // the 3000, so the scene order drops it. Reference: twcarchive.com/
    // wiki/Weather_Star_III describes "blue and white text" on a blue/
    // purple background, decorative backgrounds discontinued in 1988.
    id: "ws3000",
    label: "WeatherStar 3000",
    defaultNarrator: "silent",
    iconSet: "/assets/icons/legacy/1990-regional",
    musicTags: ["any"],
    backgroundImage: "",
    extendedStyle: "5-day",
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
    },
  },
  {
    // WeatherStar Jr (1993-2014). Budget Wegener unit for small cable
    // operators. Per research (docs/legacy-eras.md), WSJr inherited the
    // WS3000 product set and screen layouts — text-only pages on solid
    // color fields, no on-unit radar, no cartoon icons, no graphical
    // moon-phase almanac. The *only* WS4000 DNA is the cleaner typeface
    // (our "StarJR" family). Scene rendering should mirror WS3000, not
    // WS4000, once the WS3000 text-page renderer stack exists.
    //
    // NOTE: defaultNarrator marked allan-jackson for now, but this is
    // NOT source-confirmed — Allan Jackson is documented for WS XL and
    // IS1 eras, not specifically for WSJr. Revisit when aircheck audio
    // can confirm or refute.
    id: "wsjr",
    label: "WeatherStar Jr",
    defaultNarrator: "allan-jackson",
    iconSet: "/assets/icons",
    // WS Jr (1993-2014) rode the TWC flagship Trammell Starks music pool
    // just like WS4000.
    musicTags: ["trammell-starks"],
    backgroundImage: "/assets/backgrounds/BackGround2.png",
    extendedStyle: "5-day",
    extendedTitle: "Extended Forecast",
    vars: {
      "--ws-bg-deep":       "#060e26",
      "--ws-bg-mid":        "#0c1f4c",
      "--ws-bg-top":        "#1a3680",
      "--ws-accent":        "#4fb8e0",
      "--ws-accent-warm":   "#ffc448",
      "--ws-text":          "#ffffff",
      "--ws-text-dim":      "#a8bcd8",
      "--ws-led":           "#ffc448",
      "--ws-alert":         "#ff4848",
      "--ws-font-display":  '"StarJR", "Star4000", "Star4000 Extended", "Lato", "Helvetica Neue", "Arial", sans-serif',
      "--ws-font-led":      '"StarJR Large", "StarJR", "Courier New", monospace',
      "--ws-font-small":    '"StarJR Small", "StarJR", "Arial", sans-serif',
    },
  },
];

const THEME_MAP = new Map(THEMES.map((t) => [t.id, t]));

export function getTheme(id: ThemeId): ThemeDef {
  return THEME_MAP.get(id) ?? THEMES[0];
}

/* ------------------------------------------------------------------ */
/*  Per-theme authentic scene orders                                   */
/* ------------------------------------------------------------------ */

/**
 * Core scenes for each theme — the scenes that played in the authentic loop
 * for that WeatherStar model, in the order they appeared on-air.
 * Value-add scenes are everything NOT listed here (hidden by default).
 */
export const THEME_CORE_SCENES: Record<ThemeId, readonly string[]> = {
  /* Weatherscan Local (1999-2003): the original XL-era loop — current,
     local forecast text, radar, extended, hourly (daypart), travel, almanac.
     Pre-Weatherscan Plus so no activity scenes. */
  "weatherscan-local": ["current", "localforecast", "radar", "extended", "hourly", "travel", "almanac"],

  /* Weatherscan V1 (2003-2005): IntelliStar-era loop. Same core set with
     the same ordering; activity packs (golf/ski/beach/health/garden) rode
     as Weatherscan Plus value-adds rather than base loop. */
  "weatherscan-v1": ["current", "localforecast", "radar", "extended", "hourly", "travel", "almanac"],

  /* Weatherscan V2 (2005-2022): L-bar era. Shown-at-once persistent left
     column kept the current conditions and radar visible throughout; the
     main panel rotated through forecast/almanac/travel. */
  "weatherscan-v2": ["current", "localforecast", "radar", "extended", "hourly", "travel", "almanac"],

  /* WeatherStar 3000 (1988-1990): pre-radar-local era. Current, then
     local forecast, extended (5-day), almanac, travel. No hourly, no
     local radar — the 3000 couldn't render radar on the box. */
  ws3000: ["current", "localforecast", "extended", "almanac", "travel"],

  /* WeatherStar 4000 v1 (~2001-2004): simpler loop, radar after extended */
  "ws4000-v1": ["current", "localforecast", "extended", "radar", "almanac", "travel"],

  /* WeatherStar 4000 v2 (~2005-2009): same scene loop on refreshed chrome */
  "ws4000-v2": ["current", "localforecast", "extended", "radar", "almanac", "travel"],

  /* WeatherStar Jr (1993-2014): per research (docs/legacy-eras.md), WSJr
     is a WS3000 in WS4000 font — not a WS4000 variant. No on-unit radar.
     Scene loop mirrors WS3000, not WS4000. */
  wsjr: ["current", "localforecast", "extended", "almanac", "travel"],

  /* WeatherStar XL (1998-2014): radar right after conditions, 7-day extended, daypart */
  weatherstarxl: ["current", "radar", "localforecast", "extended", "hourly", "travel", "almanac"],

  /* IntelliStar 1 (2003-2013): hourly up front, forecast before radar */
  intellistar1: ["current", "hourly", "extended", "localforecast", "radar", "travel", "almanac"],

  /* IntelliStar 2 / 2 Jr HD (2013+): HD-era modern layout. Both IS2 and
     IS2 Jr shared the same scene progression — the Jr only differed in
     hardware scale, not in scene lineup. */
  intellistar2: ["current", "hourly", "extended", "localforecast", "radar", "travel", "almanac"],
};

/** All value-add scene ids (not part of any era's core loop). */
export const VALUE_ADD_SCENES: readonly string[] = [
  "detailed", "feelslike", "stormtracker", "overnight", "weekend", "precip", "temptrend", "traffic", "airport"
];

/**
 * Per-theme value-add scene exclusions. IntelliStar 2 HD / IS2 Jr never
 * showed a standalone Airport Delays scene — airport data ran in the
 * Lower Display Line (LDL) crawl during national programming instead.
 * See the LDL crawl component wired into WeatherscanFrame for IS2 themes.
 */
const THEME_EXCLUDED_SCENES: Partial<Record<ThemeId, readonly string[]>> = {
  intellistar2: ["airport"],
};

/**
 * Build the full scene order for a given theme: core scenes in authentic
 * order, then value-add scenes (minus any excluded for this theme), then
 * alerts at the very end (it interrupts rather than cycling, but needs to
 * be in the list for jumpToId).
 */
export function getSceneOrder(themeId: ThemeId): string[] {
  const core = THEME_CORE_SCENES[themeId] ?? THEME_CORE_SCENES["weatherscan-v1"];
  const excluded = new Set(THEME_EXCLUDED_SCENES[themeId] ?? []);
  const valueAdd = VALUE_ADD_SCENES.filter((id) => !excluded.has(id));
  return [...core, ...valueAdd, "alerts"];
}

/**
 * Apply a theme to the document. Sets CSS custom properties on :root
 * and the background image on .ws-frame.
 *
 * For IntelliStar themes, the background is picked randomly from the
 * 254 available city gradient images.
 */
export function applyTheme(theme: ThemeDef): void {
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(theme.vars)) {
    root.style.setProperty(prop, value);
  }
  // Themes with a rotating background pool override the fixed
  // backgroundImage: IntelliStar 1/2 rotate 254+ city-gradient tiles,
  // WeatherStar XL rotates cloud wallpapers, and the Weatherscan trio
  // each rotate within their era-authentic pool — Local pulls from the
  // regional photo set (neighborhood/forest/ocean/mountain/southwest),
  // V1/V2 both pull from the city-skyline set (Atlanta, Boston, Chicago,
  // St Louis, etc. — the broadcast used the main reporting site's actual
  // skyline).
  const poolThemes: ThemeId[] = [
    "weatherstarxl", "intellistar1", "intellistar2",
    "weatherscan-local", "weatherscan-v1", "weatherscan-v2",
  ];
  let bgUrl = theme.backgroundImage;
  if (poolThemes.includes(theme.id)) {
    const picked = pickBackground(theme.id);
    if (picked) bgUrl = picked;
  }
  const value = bgUrl ? `url("${bgUrl}")` : "none";
  root.style.setProperty("--ws-bg-image", value);
  // Remembered separately so the per-scene background effect can restore
  // the theme-level background when a scene has no mapping of its own —
  // otherwise the previous scene's art lingered.
  root.style.setProperty("--ws-theme-bg-image", value);
}
