/**
 * Background image catalog for themes with multiple backgrounds.
 * IntelliStar 1 has 254 city-gradient backgrounds; the merged IS2 / 2 Jr
 * theme draws from both the IS2 HD generic pool (254 sharp) and the
 * IS2 Jr blurred pool (56) for a richer rotation.
 */

import type { ThemeId } from "./themes";
import { getDevice } from "../../devices";

const I1_BASE = "/assets/backgrounds/intellistar1/clean";
const I2_BASE = "/assets/backgrounds/intellistar2/Generic";
const I2JR_BASE = "/assets/backgrounds/intellistar2jr/AMHQ";
const XL_CLOUDS_BASE = "/assets/backgrounds/weatherstarxl-clouds";

/** Period-correct WSXL cloud-wallpaper backgrounds, sourced from the
 *  MIT-licensed mewtek/OpenStar fan project. Authentic blue-sky + cumulus
 *  photography in the graphics style used by WSXL from 2005 onward. */
const XL_CLOUDS = [
  `${XL_CLOUDS_BASE}/Background-Normal.webp`,
  `${XL_CLOUDS_BASE}/Background-OutdoorActivity.webp`,
];

/** Build an array of numbered background paths. */
function buildNumbered(base: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= count; i++) {
    const num = String(i).padStart(3, "0");
    out.push(`${base}/generic_generic_${num}.webp`);
  }
  return out;
}

/** IS2Jr filenames use a `generic_generic-blur_NNN.webp` pattern. */
function buildI2JrNumbered(base: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= count; i++) {
    const num = String(i).padStart(3, "0");
    out.push(`${base}/generic_generic-blur_${num}.webp`);
  }
  return out;
}

const I1_BACKGROUNDS = buildNumbered(I1_BASE, 254);
const I2_BACKGROUNDS = [
  ...buildNumbered(I2_BASE, 254),
  // 28, not 56. The AMHQ folder holds 28 `-blur_NNN` files alongside 28
  // non-blur `generic_generic_NNN` ones; counting the folder rather than the
  // blur series meant paths 029-056 were generated for files that have never
  // existed, so half of this pool 404'd. Found by scripts/check-asset-refs.mjs.
  ...buildI2JrNumbered(I2JR_BASE, 28),
];

/** Severe backgrounds for IntelliStar 2. */
const I2_SEVERE = [
  "/assets/backgrounds/intellistar2/Severe/LOT8_HD_EVENTgenericBG.webp",
  "/assets/backgrounds/intellistar2/Severe/LOT8_HD_SevereStormCentral.webp",
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
  `${WS_LOCAL_BASE}/now.webp`,
  `${WS_LOCAL_BASE}/extended.webp`,
  `${WS_LOCAL_BASE}/almanac.webp`,
  `${WS_LOCAL_BASE}/nearby.webp`,
  `${WS_LOCAL_BASE}/36hr.webp`,
];

/** Weatherscan V1 (2003-2005) and V2 (2005-2022) both used city-skyline
 *  backgrounds featuring the main reporting site's actual skyline with the
 *  "weatherscan" wordmark rendered over it in blue Frutiger. The headend
 *  picked a nearby city per market; we rotate randomly for now (a future
 *  enhancement could match by user state/metro). */
const WS_CITY_BACKGROUNDS = [
  `${WS_BG_BASE}/city_bg.webp`,
  `${WS_BG_BASE}/core_city_bg.webp`,
  `${WS_BG_BASE}/atlanta_bg.webp`,
  `${WS_BG_BASE}/baltimore_bg.webp`,
  `${WS_BG_BASE}/boston_bg.webp`,
  `${WS_BG_BASE}/charlotte_bg.webp`,
  `${WS_BG_BASE}/chicago_bg.webp`,
  `${WS_BG_BASE}/cleveland_bg.webp`,
  `${WS_BG_BASE}/dallas_bg.webp`,
  `${WS_BG_BASE}/denver_bg.webp`,
  `${WS_BG_BASE}/detroit_bg.webp`,
  `${WS_BG_BASE}/ftworth_bg.webp`,
  `${WS_BG_BASE}/hartford_bg.webp`,
  `${WS_BG_BASE}/houston_bg.webp`,
  `${WS_BG_BASE}/indianapolis_bg.webp`,
  `${WS_BG_BASE}/los_angeles_bg.webp`,
  `${WS_BG_BASE}/miami_bg.webp`,
  `${WS_BG_BASE}/minneapolis_bg.webp`,
  `${WS_BG_BASE}/nashville_bg.webp`,
  `${WS_BG_BASE}/new_haven_bg.webp`,
  `${WS_BG_BASE}/new_york_bg.webp`,
  `${WS_BG_BASE}/north_carolina_bg.webp`,
  `${WS_BG_BASE}/oklahoma_city_bg.webp`,
  `${WS_BG_BASE}/orange_county_bg.webp`,
  `${WS_BG_BASE}/orlando_bg.webp`,
  `${WS_BG_BASE}/philadelphia_bg.webp`,
  `${WS_BG_BASE}/phoenix_bg.webp`,
  `${WS_BG_BASE}/pittsburgh_bg.webp`,
  `${WS_BG_BASE}/portland_bg.webp`,
  `${WS_BG_BASE}/sacramento_bg.webp`,
  `${WS_BG_BASE}/san_diego_bg.webp`,
  `${WS_BG_BASE}/san_francisco_bg.webp`,
  `${WS_BG_BASE}/seattle_bg.webp`,
  `${WS_BG_BASE}/stlouis_bg.webp`,
  `${WS_BG_BASE}/tampa_bg.webp`,
  `${WS_BG_BASE}/washington_dc_bg.webp`,
];

/**
 * Named background pools. The device profile says which one a machine uses;
 * this is the lookup, not a decision. Previously each of these functions
 * branched on themeId, which is the pattern the device layer exists to
 * remove — the machine should declare what it is, and the kernel should
 * simply honour it.
 */
const POOLS: Record<string, readonly string[]> = {
  "xl-clouds": XL_CLOUDS,
  "is1-city-gradients": I1_BACKGROUNDS,
  "is2-generics": I2_BACKGROUNDS,
  "is2-severe": I2_SEVERE,
  "ws-local-neighborhood": WS_LOCAL_BACKGROUNDS,
  "ws-city-skylines": WS_CITY_BACKGROUNDS,
};

const pickFrom = (pool: readonly string[]): string =>
  pool.length ? pool[Math.floor(Math.random() * pool.length)] : "";

/**
 * Pick a background for the machine's rotating pool.
 * Returns "" for units with a fixed background or a CSS gradient.
 */
export function pickBackground(themeId: ThemeId, severe = false): string {
  const { backgroundPool, severePool } = getDevice(themeId).visuals;
  if (severe && severePool) return pickFrom(POOLS[severePool] ?? []);
  if (!backgroundPool) return "";
  return pickFrom(POOLS[backgroundPool] ?? []);
}

/** Every background available to a machine (gallery / picker use). */
export function listBackgrounds(themeId: ThemeId): string[] {
  const { backgroundPool } = getDevice(themeId).visuals;
  return backgroundPool ? [...(POOLS[backgroundPool] ?? [])] : [];
}

/* ------------------------------------------------------------------ */
/*  Per-scene WS4000 backgrounds                                       */
/* ------------------------------------------------------------------ */

/**
 * Period-correct WeatherStar 4000 used a different background template per
 * scene type. The numbered BackGround*.webp files in /assets/backgrounds/
 * are the renderer templates from the wesellis/FUN-WeatherStar-4000 fan
 * project. Mapping below is the best-guess assignment (verify visually
 * and tune as needed).
 */
const WS4000_BG_BASE = "/assets/backgrounds";

const WS4000_SCENE_BACKGROUNDS: Record<string, string> = {
  current:        `${WS4000_BG_BASE}/BackGround1.webp`,
  localforecast:  `${WS4000_BG_BASE}/BackGround1_2.webp`,
  extended:       `${WS4000_BG_BASE}/BackGround2.webp`,
  hourly:         `${WS4000_BG_BASE}/BackGround3.webp`,
  almanac:        `${WS4000_BG_BASE}/BackGround3_1.webp`,
  travel:         `${WS4000_BG_BASE}/BackGround4.webp`,
  radar:          `${WS4000_BG_BASE}/BackGround5.webp`,
  temptrend:      `${WS4000_BG_BASE}/BackGround1_1_Chart.webp`,
  feelslike:      `${WS4000_BG_BASE}/BackGround1_1.webp`,
  overnight:      `${WS4000_BG_BASE}/BackGround1_3_1.webp`,
  weekend:        `${WS4000_BG_BASE}/BackGround2_1.webp`,
  precip:         `${WS4000_BG_BASE}/BackGround5_1.webp`,
  detailed:       `${WS4000_BG_BASE}/BackGround1_2_1.webp`,
  stormtracker:   `${WS4000_BG_BASE}/BackGround5_2.webp`,
  traffic:        `${WS4000_BG_BASE}/BackGround4_1.webp`,
  airport:        `${WS4000_BG_BASE}/BackGround4_2.webp`,
  alerts:         `${WS4000_BG_BASE}/BackGround6.webp`,
};

const WSJR_SCENE_BACKGROUNDS: Record<string, string> = {
  current:        `${WS4000_BG_BASE}/BackGround2.webp`,
  localforecast:  `${WS4000_BG_BASE}/BackGround2_1.webp`,
  extended:       `${WS4000_BG_BASE}/BackGround2_2.webp`,
  hourly:         `${WS4000_BG_BASE}/BackGround3_2.webp`,
  almanac:        `${WS4000_BG_BASE}/BackGround3.webp`,
  travel:         `${WS4000_BG_BASE}/BackGround4.webp`,
  radar:          `${WS4000_BG_BASE}/BackGround5.webp`,
};

/** Weatherscan Local (1999-2003) per-scene backgrounds from the authentic
 *  JesseWx2011/Weatherscan-Local-Sim "neighborhood" regional theme pack.
 *  Each scene gets its own soft-focus photograph, matching how the real
 *  XL-era Weatherscan rotated backgrounds per scene. Radar uses the
 *  gray-skeleton template sourced from local.weatherscan.net. */
const WS_LOCAL_SCENE_BACKGROUNDS: Record<string, string> = {
  current:        `${WS_LOCAL_BASE}/now.webp`,
  localforecast:  `${WS_LOCAL_BASE}/now.webp`,
  extended:       `${WS_LOCAL_BASE}/extended.webp`,
  hourly:         `${WS_LOCAL_BASE}/36hr.webp`,
  almanac:        `${WS_LOCAL_BASE}/almanac.webp`,
  travel:         `${WS_LOCAL_BASE}/nearby.webp`,
  overnight:      `${WS_LOCAL_BASE}/now.webp`,
  weekend:        `${WS_LOCAL_BASE}/extended.webp`,
  radar:          "/assets/themes/weatherscan/backgrounds/local-era/local-doppler-skeleton.webp",
};

/**
 * Get the per-scene background for a theme, or null if the theme uses a
 * single fixed background (or rotating pool) instead of per-scene variants.
 */
/** Named per-scene background sets, keyed the same way as POOLS. */
const SCENE_SETS: Record<string, Record<string, string>> = {
  "ws4000-v1": WS4000_SCENE_BACKGROUNDS,
  wsjr: WSJR_SCENE_BACKGROUNDS,
  "weatherscan-local": WS_LOCAL_SCENE_BACKGROUNDS,
};

/**
 * Per-scene background for machines that varied their art by product.
 *
 * WS4000 v2 deliberately has no set: it paints an orange-to-purple gradient
 * with a floating content pane entirely in CSS, so returning null lets the
 * theme's stylesheet drive it.
 */
export function getSceneBackground(themeId: ThemeId, sceneId: string): string | null {
  const setName = getDevice(themeId).visuals.sceneBackgroundSet;
  if (!setName) return null;
  return SCENE_SETS[setName]?.[sceneId] ?? null;
}
