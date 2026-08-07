/**
 * Period-accurate product names, and which narrator clips introduce them.
 *
 * The Weather Channel renamed two products in **September 2004**, documented
 * on the IntelliStar timeline (docs/reference/is1/handwiki/page.html, mirrored
 * at docs/reference/is1/fandom/page.html):
 *
 *   > "36 Hour Forecast" is renamed "Local Forecast" when it switches to a
 *   > 48-hour Local Forecast product, and is increased to four screens.
 *   > ...
 *   > The hour-by-hour forecast, referred to as "Daily Planner" is now
 *   > renamed the "Daypart Forecast".
 *
 * That single date is the axis this file encodes. It matters because the clip
 * libraries contain BOTH namings and the narration has to match the hardware
 * the user picked, or a WeatherStar 3000 announces a product name that did not
 * exist until fourteen years after that unit shipped.
 *
 * The two clip families this resolves:
 *
 *   Default_Phrases_36_Hr_Fcast  "your 36-hour forecast."          -> Local Forecast, pre-2004
 *   Default_Phrases_Daypart      "Our Daily Planner" (DEFAULT3)    -> Hourly, pre-2004
 *   Default_Phrases_Daypart      "our local forecast." (DEFAULT1)  -> Hourly, post-2004
 *   general/Your Daily Planner   "Your Daily Planner."             -> Hourly, pre-2004
 *
 * Neither belongs on the Extended Forecast. Extended has its own families
 * (Default_Phrases_Ext_Fcast for the 5-day era, Default_Phrases_7Day_Fcast
 * plus "Your 7-Day Outlook" / "Your Week Ahead" for the 7-day era), which are
 * selected by the separate `eras` tag on each clip.
 */

/**
 * Which side of the September 2004 rename a theme's hardware sits on.
 *
 * Themes whose lifespan straddles the date are assigned by the look the theme
 * actually reproduces, which is recorded per entry below rather than guessed
 * at call time.
 */
export type ProductEra = "pre-2004" | "post-2004";

/**
 * Per-theme product era.
 *
 * Straddling themes and why they land where they do:
 *   - `ws4000-v1` (2001-2004) ends at the rename, so it keeps the old names.
 *   - `intellistar1` (2003-2013) — the theme deliberately reproduces the
 *     2007-era look (see docs/legacy-eras.md, "Suggest single intellistar1 =
 *     2007-era look"), which is after the rename.
 *   - `weatherscan-v1` (2003-2005) runs on the IntelliStar platform the
 *     rename applied to, and most of its life is after it.
 *   - `wsjr` (1993-2014) ran for two decades, but it inherited the WS3000
 *     product set and never received the later products, so it keeps the
 *     older naming.
 */
export const THEME_PRODUCT_ERA: Record<string, ProductEra> = {
  ws3000:             "pre-2004",
  wsjr:               "pre-2004",
  "ws4000-v1":        "pre-2004",
  "weatherscan-local": "pre-2004",
  weatherstarxl:      "pre-2004",

  "ws4000-v2":        "post-2004",
  "weatherscan-v1":   "post-2004",
  "weatherscan-v2":   "post-2004",
  intellistar1:       "post-2004",
  intellistar2:       "post-2004"
};

/** What a given unit called a given screen. Used for narration selection and
 *  by `npm run clips:explain` so the choice is inspectable. */
export const SEGMENT_LABELS: Record<string, Record<ProductEra, string>> = {
  localforecast: { "pre-2004": "36 Hour Forecast", "post-2004": "Local Forecast" },
  hourly:        { "pre-2004": "Daily Planner",    "post-2004": "Daypart Forecast" },
  extended:      { "pre-2004": "Extended Forecast", "post-2004": "Extended Forecast" },
  current:       { "pre-2004": "Latest Observations", "post-2004": "Current Conditions" },
  radar:         { "pre-2004": "Local Doppler Radar", "post-2004": "Local Doppler Radar" }
};

/**
 * Narrator intro keys to try for a scene, most period-appropriate first.
 *
 * Only scenes whose naming actually changed need an entry; everything else
 * resolves through the plain scene id and the alias table in narratorSchema.
 * The later name is always kept as a fallback so a narrator missing the
 * era-correct clip still says something sensible rather than nothing.
 */
export const ERA_INTRO_KEYS: Record<string, Record<ProductEra, readonly string[]>> = {
  localforecast: {
    "pre-2004":  ["thirtySixHour", "localForecast"],
    "post-2004": ["localForecast", "thirtySixHour"]
  },
  hourly: {
    "pre-2004":  ["dailyPlanner", "hourly"],
    "post-2004": ["hourly", "dailyPlanner"]
  }
};

/**
 * Active product era, set when the theme changes.
 *
 * Module-level rather than threaded through every composer, matching the
 * existing `setIconBase` / `setIconResolution` pattern in WeatherIcon. The
 * composers are already deep call chains; adding an era parameter to each one
 * would touch a dozen signatures to carry a value that is constant for the
 * lifetime of a theme.
 */
let activeProductEra: ProductEra = "post-2004";

export function setProductEra(themeId: string): void {
  activeProductEra = THEME_PRODUCT_ERA[themeId] ?? "post-2004";
}

export function getProductEra(): ProductEra {
  return activeProductEra;
}

/**
 * Narrators whose library contains BOTH the pre- and post-2004 namings, so
 * the era rule can actually be enforced for them.
 *
 * The other two can't be held to it, and pretending otherwise would mean
 * silence rather than accuracy:
 *
 *   - **Chandler** — every clip in his hour-by-hour pool says "the 36-hour
 *     forecast", which is pre-rename IntelliStar language, yet he is the
 *     default narrator for IntelliStar 2 (2013+). His recordings appear to
 *     date from the 2003-2004 IntelliStar 1 window, before the rename.
 *     Enforcing the rule would leave IS2 with no hourly or local-forecast
 *     narration at all.
 *   - **Amy Bargeron** — has only `Local-DaypartForecast`, the *post*-2004
 *     name, while also narrating Weatherscan Local (1999-2003).
 *
 * Both are recorded as known era inaccuracies in docs/TODO.md. Fixing them
 * needs different source audio, not different code.
 */
const ERA_STRICT_NARRATORS: ReadonlySet<string> = new Set(["allan-jackson", "jim-cantore"]);

export function isEraStrict(narratorId: string): boolean {
  return ERA_STRICT_NARRATORS.has(narratorId);
}

/** Intro keys to try for a scene under the active era, most accurate first. */
export function eraIntroKeys(sceneId: string): readonly string[] {
  return ERA_INTRO_KEYS[sceneId.toLowerCase()]?.[activeProductEra] ?? [];
}

/** Human product name for a scene under a given era. Debug/report use. */
export function segmentLabel(sceneId: string, era: ProductEra = activeProductEra): string | null {
  return SEGMENT_LABELS[sceneId.toLowerCase()]?.[era] ?? null;
}
