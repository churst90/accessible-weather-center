/**
 * Background image catalog for themes with multiple backgrounds.
 * IntelliStar 1 has 254 city-gradient backgrounds; the merged IS2 / 2 Jr
 * theme draws from both the IS2 HD generic pool (254 sharp) and the
 * IS2 Jr blurred pool (56) for a richer rotation.
 */

import type { ThemeId } from "./themes";

const I1_BASE = "/assets/backgrounds/intellistar1/clean";
const I2_BASE = "/assets/backgrounds/intellistar2/Generic";
const I2JR_BASE = "/assets/backgrounds/intellistar2jr/AMHQ";
const XL_CLOUDS_BASE = "/assets/backgrounds/weatherstarxl-clouds";

/** Period-correct WSXL cloud-wallpaper backgrounds, sourced from the
 *  MIT-licensed mewtek/OpenStar fan project. Authentic blue-sky + cumulus
 *  photography in the graphics style used by WSXL from 2005 onward. */
const XL_CLOUDS = [
  `${XL_CLOUDS_BASE}/Background-Normal.png`,
  `${XL_CLOUDS_BASE}/Background-OutdoorActivity.png`,
];

/** Build an array of numbered background paths. */
function buildNumbered(base: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= count; i++) {
    const num = String(i).padStart(3, "0");
    out.push(`${base}/generic_generic_${num}.png`);
  }
  return out;
}

/** IS2Jr filenames use a `generic_generic-blur_NNN.png` pattern. */
function buildI2JrNumbered(base: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= count; i++) {
    const num = String(i).padStart(3, "0");
    out.push(`${base}/generic_generic-blur_${num}.png`);
  }
  return out;
}

const I1_BACKGROUNDS = buildNumbered(I1_BASE, 254);
const I2_BACKGROUNDS = [
  ...buildNumbered(I2_BASE, 254),
  ...buildI2JrNumbered(I2JR_BASE, 56),
];

/** Severe backgrounds for IntelliStar 2. */
const I2_SEVERE = [
  "/assets/backgrounds/intellistar2/Severe/LOT8_HD_EVENTgenericBG.png",
  "/assets/backgrounds/intellistar2/Severe/LOT8_HD_SevereStormCentral.png",
];

const WS_BG_BASE = "/assets/themes/weatherscan/backgrounds";

/** Weatherscan Local (1999-2003) ran on the WeatherStar XL hardware with
 *  per-scene, regional-themed backgrounds per the May 2000 redesign
 *  (Wikipedia: "backgrounds based on the regional culture, customized for
 *  densely populated areas, smaller markets and suburbs, and coastal and
 *  desert areas"). The "neighborhood" regional theme is the only one
 *  sourced so far — each scene gets its own soft-focus photograph at
 *  golden hour, not a cityscape with yellow wedges. Scene-specific
 *  selection happens via getSceneBackground() below; this pool is the
 *  rotating fallback for any unmapped scene. */
const WS_LOCAL_BASE = "/assets/themes/weatherscan/backgrounds/local-era/neighborhood";
const WS_LOCAL_BACKGROUNDS = [
  `${WS_LOCAL_BASE}/now.png`,
  `${WS_LOCAL_BASE}/extended.png`,
  `${WS_LOCAL_BASE}/almanac.png`,
  `${WS_LOCAL_BASE}/nearby.png`,
  `${WS_LOCAL_BASE}/36hr.png`,
];

/** Weatherscan V1 (2003-2005) and V2 (2005-2022) both used city-skyline
 *  backgrounds featuring the main reporting site's actual skyline with the
 *  "weatherscan" wordmark rendered over it in blue Frutiger. The headend
 *  picked a nearby city per market; we rotate randomly for now (a future
 *  enhancement could match by user state/metro). */
const WS_CITY_BACKGROUNDS = [
  `${WS_BG_BASE}/city_bg.png`,
  `${WS_BG_BASE}/core_city_bg.png`,
  `${WS_BG_BASE}/atlanta_bg.png`,
  `${WS_BG_BASE}/baltimore_bg.png`,
  `${WS_BG_BASE}/boston_bg.png`,
  `${WS_BG_BASE}/charlotte_bg.png`,
  `${WS_BG_BASE}/chicago_bg.png`,
  `${WS_BG_BASE}/cleveland_bg.png`,
  `${WS_BG_BASE}/dallas_bg.png`,
  `${WS_BG_BASE}/denver_bg.png`,
  `${WS_BG_BASE}/detroit_bg.png`,
  `${WS_BG_BASE}/ftworth_bg.png`,
  `${WS_BG_BASE}/hartford_bg.png`,
  `${WS_BG_BASE}/houston_bg.png`,
  `${WS_BG_BASE}/indianapolis_bg.png`,
  `${WS_BG_BASE}/los_angeles_bg.png`,
  `${WS_BG_BASE}/miami_bg.png`,
  `${WS_BG_BASE}/minneapolis_bg.png`,
  `${WS_BG_BASE}/nashville_bg.png`,
  `${WS_BG_BASE}/new_haven_bg.png`,
  `${WS_BG_BASE}/new_york_bg.png`,
  `${WS_BG_BASE}/north_carolina_bg.png`,
  `${WS_BG_BASE}/oklahoma_city_bg.png`,
  `${WS_BG_BASE}/orange_county_bg.png`,
  `${WS_BG_BASE}/orlando_bg.png`,
  `${WS_BG_BASE}/philadelphia_bg.png`,
  `${WS_BG_BASE}/phoenix_bg.png`,
  `${WS_BG_BASE}/pittsburgh_bg.png`,
  `${WS_BG_BASE}/portland_bg.png`,
  `${WS_BG_BASE}/sacramento_bg.png`,
  `${WS_BG_BASE}/san_diego_bg.png`,
  `${WS_BG_BASE}/san_francisco_bg.png`,
  `${WS_BG_BASE}/seattle_bg.png`,
  `${WS_BG_BASE}/stlouis_bg.png`,
  `${WS_BG_BASE}/tampa_bg.png`,
  `${WS_BG_BASE}/washington_dc_bg.png`,
];

/**
 * Pick a random background for the given theme.
 * Returns empty string for themes that use CSS gradients instead.
 */
export function pickBackground(themeId: ThemeId, severe = false): string {
  // WeatherStar XL: authentic cloud wallpaper (post-2005 graphics package).
  if (themeId === "weatherstarxl") {
    return XL_CLOUDS[Math.floor(Math.random() * XL_CLOUDS.length)];
  }
  // IntelliStar 1: rotating city gradient backgrounds.
  if (themeId === "intellistar1") {
    return I1_BACKGROUNDS[Math.floor(Math.random() * I1_BACKGROUNDS.length)];
  }
  if (themeId === "intellistar2") {
    if (severe) {
      return I2_SEVERE[Math.floor(Math.random() * I2_SEVERE.length)];
    }
    return I2_BACKGROUNDS[Math.floor(Math.random() * I2_BACKGROUNDS.length)];
  }
  if (themeId === "weatherscan-local") {
    return WS_LOCAL_BACKGROUNDS[Math.floor(Math.random() * WS_LOCAL_BACKGROUNDS.length)];
  }
  if (themeId === "weatherscan-v1" || themeId === "weatherscan-v2") {
    return WS_CITY_BACKGROUNDS[Math.floor(Math.random() * WS_CITY_BACKGROUNDS.length)];
  }
  // Other themes use a fixed background (set in ThemeDef.backgroundImage)
  return "";
}

/**
 * Get all available backgrounds for a theme (for a future gallery/picker).
 */
export function listBackgrounds(themeId: ThemeId): string[] {
  if (themeId === "weatherstarxl") return [...XL_CLOUDS];
  if (themeId === "intellistar1") return [...I1_BACKGROUNDS];
  if (themeId === "intellistar2") return [...I2_BACKGROUNDS];
  if (themeId === "weatherscan-local") return [...WS_LOCAL_BACKGROUNDS];
  if (themeId === "weatherscan-v1" || themeId === "weatherscan-v2") return [...WS_CITY_BACKGROUNDS];
  return [];
}

/* ------------------------------------------------------------------ */
/*  Per-scene WS4000 backgrounds                                       */
/* ------------------------------------------------------------------ */

/**
 * Period-correct WeatherStar 4000 used a different background template per
 * scene type. The numbered BackGround*.png files in /assets/backgrounds/
 * are the renderer templates from the wesellis/FUN-WeatherStar-4000 fan
 * project. Mapping below is the best-guess assignment (verify visually
 * and tune as needed).
 */
const WS4000_BG_BASE = "/assets/backgrounds";

const WS4000_SCENE_BACKGROUNDS: Record<string, string> = {
  current:        `${WS4000_BG_BASE}/BackGround1.png`,
  localforecast:  `${WS4000_BG_BASE}/BackGround1_2.png`,
  extended:       `${WS4000_BG_BASE}/BackGround2.png`,
  hourly:         `${WS4000_BG_BASE}/BackGround3.png`,
  almanac:        `${WS4000_BG_BASE}/BackGround3_1.png`,
  travel:         `${WS4000_BG_BASE}/BackGround4.png`,
  radar:          `${WS4000_BG_BASE}/BackGround5.png`,
  temptrend:      `${WS4000_BG_BASE}/BackGround1_1_Chart.png`,
  feelslike:      `${WS4000_BG_BASE}/BackGround1_1.png`,
  overnight:      `${WS4000_BG_BASE}/BackGround1_3_1.png`,
  weekend:        `${WS4000_BG_BASE}/BackGround2_1.png`,
  precip:         `${WS4000_BG_BASE}/BackGround5_1.png`,
  detailed:       `${WS4000_BG_BASE}/BackGround1_2_1.png`,
  stormtracker:   `${WS4000_BG_BASE}/BackGround5_2.png`,
  traffic:        `${WS4000_BG_BASE}/BackGround4_1.png`,
  airport:        `${WS4000_BG_BASE}/BackGround4_2.png`,
  alerts:         `${WS4000_BG_BASE}/BackGround6.png`,
};

const WSJR_SCENE_BACKGROUNDS: Record<string, string> = {
  current:        `${WS4000_BG_BASE}/BackGround2.png`,
  localforecast:  `${WS4000_BG_BASE}/BackGround2_1.png`,
  extended:       `${WS4000_BG_BASE}/BackGround2_2.png`,
  hourly:         `${WS4000_BG_BASE}/BackGround3_2.png`,
  almanac:        `${WS4000_BG_BASE}/BackGround3.png`,
  travel:         `${WS4000_BG_BASE}/BackGround4.png`,
  radar:          `${WS4000_BG_BASE}/BackGround5.png`,
};

/** Weatherscan Local (1999-2003) per-scene backgrounds from the authentic
 *  JesseWx2011/Weatherscan-Local-Sim "neighborhood" regional theme pack.
 *  Each scene gets its own soft-focus photograph, matching how the real
 *  XL-era Weatherscan rotated backgrounds per scene. Radar uses the
 *  gray-skeleton template sourced from local.weatherscan.net. */
const WS_LOCAL_SCENE_BACKGROUNDS: Record<string, string> = {
  current:        `${WS_LOCAL_BASE}/now.png`,
  localforecast:  `${WS_LOCAL_BASE}/now.png`,
  extended:       `${WS_LOCAL_BASE}/extended.png`,
  hourly:         `${WS_LOCAL_BASE}/36hr.png`,
  almanac:        `${WS_LOCAL_BASE}/almanac.png`,
  travel:         `${WS_LOCAL_BASE}/nearby.png`,
  overnight:      `${WS_LOCAL_BASE}/now.png`,
  weekend:        `${WS_LOCAL_BASE}/extended.png`,
  radar:          "/assets/themes/weatherscan/backgrounds/local-era/local-doppler-skeleton.png",
};

/**
 * Get the per-scene background for a theme, or null if the theme uses a
 * single fixed background (or rotating pool) instead of per-scene variants.
 */
export function getSceneBackground(themeId: ThemeId, sceneId: string): string | null {
  // WS4000 v1 (2001-2004) uses the per-scene solid-blue + radar-map art.
  // WS4000 v2 (2005-2009) renders an orange-to-purple gradient with a
  // floating content pane — painted entirely in CSS — so we return null
  // and let the theme's CSS rules drive the background.
  if (themeId === "ws4000-v1") return WS4000_SCENE_BACKGROUNDS[sceneId] ?? null;
  if (themeId === "wsjr")   return WSJR_SCENE_BACKGROUNDS[sceneId] ?? null;
  if (themeId === "weatherscan-local") return WS_LOCAL_SCENE_BACKGROUNDS[sceneId] ?? null;
  return null;
}
