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

import { deviceSceneOrder, DEVICES } from "../../devices";
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
   *  /assets/shared/icons/{NN}x{NN}/ for conditions that have a WEBP mapping;
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

/**
 * Themes are DERIVED from the device profiles.
 *
 * A machine's palette, typeface stack, icon set and forecast branding are
 * facts about that machine, so they live in src/devices/profiles/<id>.ts
 * beside its products and capabilities. This is only the adapter that
 * presents them in the shape the renderer already expects — not a second
 * source of truth, and no per-theme data left to drift.
 */
export const THEMES: ThemeDef[] = DEVICES.map((d) => ({
  id: d.id as ThemeId,
  label: d.label,
  defaultNarrator: d.voice,
  iconSet: d.visuals.iconSet,
  ...(d.visuals.iconResolution ? { iconResolution: d.visuals.iconResolution } : {}),
  musicTags: [...d.musicTags],
  vars: d.visuals.vars,
  backgroundImage: d.visuals.backgroundImage,
  extendedStyle: `${d.extendedDays}-day` as ExtendedStyle,
  extendedTitle: d.visuals.extendedTitle
}));

const THEME_MAP = new Map(THEMES.map((t) => [t.id, t]));

export function getTheme(id: ThemeId): ThemeDef {
  return THEME_MAP.get(id) ?? THEMES[0];
}

/* ------------------------------------------------------------------ */
/*  Per-theme authentic scene orders                                   */
/* ------------------------------------------------------------------ */

/**
 * Build the full scene order for a given theme: core scenes in authentic
 * order, then value-add scenes (minus any excluded for this theme), then
 * alerts at the very end (it interrupts rather than cycling, but needs to
 * be in the list for jumpToId).
 */
export function getSceneOrder(themeId: ThemeId): string[] {
  // Delegates to the device profile. The rundown, which products were
  // optional packages, and which the hardware never had at all are all
  // machine facts and live in src/devices/profiles/<id>.ts.
  //
  // The returned list is every product the machine COULD show; the
  // scheduler's enabled-predicate then applies the user's Settings choices.
  // Products marked `absent` are excluded here and can never be enabled —
  // a WeatherStar 3000 with a radar screen is not a WeatherStar 3000.
  return deviceSceneOrder(themeId);
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
