/**
 * Narrator schema — maps each voice narrator to their available clips,
 * capabilities, and file paths.
 *
 * Narrators:
 *   - allan-jackson: Full narration (scene intros + temp numbers + condition phrases)
 *   - jim-cantore:   Partial narration (scene intros + temps, fewer conditions)
 *   - amy-bargeron:  Scene intros only (Weatherscan era labels)
 *   - chandler:      Scene intros only (multiple variations per scene)
 *
 * All served audio is MP3. The source libraries arrived as a mix of WAV,
 * FLAC and MP2; scripts/build-web-assets.mjs re-encodes everything to MP3 and
 * clip paths here name the served file. Paths and clipReferenceTable.json
 * keys must agree on the extension — when they drifted apart, every affected
 * clip degraded to confidence "guess" and was silently dropped at playback.
 * See docs/asset-pipeline.md.
 *
 * The PhraseComposer uses this to decide whether to emit a clip segment
 * or fall back to TTS for a given narrator × content combination.
 */

export type NarratorId = "allan-jackson" | "jim-cantore" | "amy-bargeron" | "chandler" | "silent";

import { eraIntroKeys } from "./sceneSegments";

export interface NarratorDef {
  id: NarratorId;
  label: string;
  /** Does this narrator have temperature number clips? */
  hasTemps: boolean;
  /** Does this narrator have condition-code clips (CC/CCSH/CCEF)? */
  hasConditions: boolean;
  /** Does this narrator have wind clips? */
  hasWind: boolean;
  /** Scene intro clip mappings. Each scene can have multiple variations. */
  sceneIntros: Record<string, NarratorClipDef[]>;
}

export interface NarratorClipDef {
  file: string;
  text: string;
  /**
   * Optional era-style restriction. When the scene (and the active theme)
   * care about era branding — e.g. the multi-day forecast is called a
   * "5-day Extended Forecast" on WeatherStar 4000 vs. a "7-Day Outlook"
   * on Weatherscan — pickSceneIntro filters to entries that include the
   * current theme's extendedStyle. Entries with no `eras` array match
   * any era.
   */
  eras?: ReadonlyArray<"5-day" | "7-day">;
}

// ─── Base paths for each narrator's assets ───

const AJ_NARRATION = "/assets/shared/narration/Alan Jackson";
const JC_NARRATION = "/assets/shared/narration/Jim Cantore";
const AB_NARRATION = "/assets/shared/narration/Amy Bargeron";
const CH_NARRATION = "/assets/shared/narration/Chandler";

/** Per-narrator asset root. Paths in clipReferenceTable.json are relative
 * to these roots — join with `/` to get the full src path. */
export const NARRATOR_ASSET_ROOTS: Record<NarratorId, string> = {
  "allan-jackson": AJ_NARRATION,
  "jim-cantore":   JC_NARRATION,
  "amy-bargeron":  AB_NARRATION,
  "chandler":      CH_NARRATION,
  "silent":        "",
};

// ─── Clip path used by the existing clipSchema (AJ legacy library) ───

export const AJ_TEMPS_BASE = `${AJ_NARRATION}/temps`;
export const AJ_GENERAL_BASE = `${AJ_NARRATION}/general`;
export const AJ_VOCALLOCAL_BASE = `${AJ_NARRATION}/VocalLocal`;

export const JC_VOCALLOCAL_BASE = `${JC_NARRATION}/Vocal Local`;

// ─── Narrator definitions ───

export const NARRATORS: NarratorDef[] = [
  {
    id: "allan-jackson",
    label: "Allan Jackson (Weatherscan)",
    hasTemps: true,
    hasConditions: true,
    hasWind: true,
    sceneIntros: {
      current: [
        { file: `${AJ_GENERAL_BASE}/Your Current Conditions.mp3`, text: "Your current conditions" },
        { file: `${AJ_GENERAL_BASE}/The Current Conditions for Your Area.mp3`, text: "The current conditions for your area" },
        { file: `${AJ_GENERAL_BASE}/Currently In Your Area.mp3`, text: "Currently in your area" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Curr_Cond/CC_DEFAULT1.mp3`, text: "Our current conditions" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Curr_Cond/CC_DEFAULT2.mp3`, text: "The current conditions for our area" },
      ],
      radar: [
        { file: `${AJ_GENERAL_BASE}/Your Local Doppler Radar.mp3`, text: "Your local Doppler radar" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Local_Radar/LRADAR_DEFAULT1.mp3`, text: "Here's our local Doppler radar" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Local_Radar/LRADAR_DEFAULT2.mp3`, text: "Our local Doppler radar" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Local_Radar/Heres your Local Doppler Radar.mp3`, text: "Here's your local Doppler radar" },
      ],
      extended: [
        // "Extended Forecast" phrasing — fits the 5-day WeatherStar-era
        // branding. "Your/Our extended forecast" reads naturally before
        // a 5-day rundown and was the TWC term through the early 2000s.
        { file: `${AJ_GENERAL_BASE}/Your Extended Forecast.mp3`, text: "Your extended forecast", eras: ["5-day"] },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Ext_Fcast/EXT_DEFAULT1.mp3`, text: "Our extended forecast", eras: ["5-day"] },
        // "7-Day Outlook" / "Week Ahead" phrasing — Weatherscan-era
        // branding for the full 7-day rundown.
        { file: `${AJ_GENERAL_BASE}/Your 7-Day Outlook.mp3`, text: "Your seven-day outlook", eras: ["7-day"] },
        { file: `${AJ_GENERAL_BASE}/Heres your 7-Day Outlook.mp3`, text: "Here's your seven-day outlook", eras: ["7-day"] },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_7Day_Fcast/7DAY_DEFAULT1.mp3`, text: "Here's our 7-day-out look", eras: ["7-day"] },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_7Day_Fcast/7DAY_DEFAULT2.mp3`, text: "Our 7-day Outlook", eras: ["7-day"] },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_7Day_Fcast/7DAY_DEFAULT3.mp3`, text: "Our week ahead", eras: ["7-day"] },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_7Day_Fcast/7DAY_DEFAULT4.mp3`, text: "The week ahead", eras: ["7-day"] },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Ext_Fcast/EXT_DEFAULT3.mp3`, text: "The week ahead", eras: ["7-day"] },
        // EXT_DEFAULT2 transcribed as "Hour week ahead" — almost
        // certainly "Your week ahead"; keeping as 7-day until verified.
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Ext_Fcast/EXT_DEFAULT2.mp3`, text: "Hour week ahead", eras: ["7-day"] },
      ],
      hourly: [
        { file: `${AJ_GENERAL_BASE}/Your Local Forecast.mp3`, text: "Your local forecast" },
        { file: `${AJ_GENERAL_BASE}/The Forecast for Your Area.mp3`, text: "The forecast for your area" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Daypart/DAYPART_DEFAULT1.mp3`, text: "Our local forecast" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Daypart/DAYPART_DEFAULT2.mp3`, text: "The forecast for our area" },
        // DAYPART_DEFAULT3 ("Our Daily Planner") lives in `dailyPlanner`, not
        // here: TWC renamed the hour-by-hour forecast from "Daily Planner" to
        // "Daypart Forecast" in September 2004, so a post-2004 unit must not
        // announce the older name. sceneSegments.ts routes pre-2004 themes to
        // the dailyPlanner pool first.
      ],
      alerts: [
        { file: `${AJ_GENERAL_BASE}/Is in effect for Your Area.mp3`, text: "Is in effect for your area" },
        { file: `${AJ_GENERAL_BASE}/Has been issued for Your Area.mp3`, text: "Has been issued for your area" },
      ],
      localForecast: [
        { file: `${AJ_GENERAL_BASE}/Your Local Forecast.mp3`, text: "Your local forecast" },
      ],
      observations: [
        { file: `${AJ_GENERAL_BASE}/Your Local Observations.mp3`, text: "Your local observations" },
        { file: `${AJ_GENERAL_BASE}/Local Observations for Your Area.mp3`, text: "Local observations for your area" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Local_Obs/LOBS_DEFAULT1.mp3`, text: "Our local observations" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Local_Obs/LOBS_DEFAULT2.mp3`, text: "Local observations for our area" },
      ],
      weekAhead: [
        { file: `${AJ_GENERAL_BASE}/Your Week Ahead.mp3`, text: "You're a week ahead" },
      ],
      // AJ has no dedicated "Your Weekend Forecast" clip; WEEK3 ("heading
      // into the weekend") is the only single-phrase weekend reference in
      // the library. Sounds natural as a scene opener before the Sat/Sun
      // rundown plays.
      weekend: [
        { file: `${AJ_VOCALLOCAL_BASE}/Periods2/WEEK3.mp3`, text: "Heading into the weekend" },
      ],
      // Pre-September-2004 name for the hour-by-hour forecast. Selected for
      // themes whose hardware predates the rename — see sceneSegments.ts.
      dailyPlanner: [
        { file: `${AJ_GENERAL_BASE}/Your Daily Planner.mp3`, text: "Your Daily Planner" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Daypart/DAYPART_DEFAULT3.mp3`, text: "Our Daily Planner" },
      ],
      // Pre-September-2004 name for the Local Forecast, which became a
      // 48-hour product under the new name. Reached via sceneSegments.ts.
      thirtySixHour: [
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_36_Hr_Fcast/36HR_DEFAULT1.mp3`, text: "Your 36-hour forecast" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_36_Hr_Fcast/36HR_DEFAULT2.mp3`, text: "Your forecast for the next 36 hours" },
      ],
      traffic: [
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Traffic_Flow/TRFLO_DEFAULT1.mp3`, text: "Traffic flow for our area" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Traffic_Flow/TRFLO_DEFAULT2.mp3`, text: "The current average trip times for our area" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Traffic_Overview/TRORV_DEFAULT1.mp3`, text: "Traffic conditions around our area" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Traffic_Overview/TRORV_DEFAULT2.mp3`, text: "Traffic congestion for our area" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Traffic_Report/TRREP_DEFAULT1.mp3`, text: "Incidents and construction impacting our area" },
      ],
    },
  },
  {
    id: "jim-cantore",
    label: "Jim Cantore (IntelliStar)",
    hasTemps: true,
    hasConditions: true,
    hasWind: true,
    sceneIntros: {
      current: [
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Now/CC_INTRO1.mp3`, text: "Currently, the temperature is.." },
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Now/CC_INTRO2.mp3`, text: "Currently in our area" },
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Now/CC_INTRO3.mp3`, text: "Currently in your area" },
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Now/CC_INTRO4.mp3`, text: "Currently, it's.." },
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Now/CC_INTRO5.mp3`, text: "Right now it's" },
      ],
      // No radar intros, and this is now understood rather than merely
      // observed. `Default_Phrases_Local_Radar/RADAR_DEFAULT{1,2}` were listed
      // here from the initial commit but never existed in Cantore's library,
      // so the radar scene played silence instead of falling back to text.
      //
      // The reason is that the IntelliStar 1 radar screens were never his to
      // narrate: Allen Jackson voiced Vocal Local on the XL and IntelliStar,
      // Cantore was recorded for the IntelliStar 2 HD generation in 2008, and
      // the two libraries are not parallel. IS1 now correctly points at Allen
      // Jackson (see devices/profiles/intellistar1.ts), whose radar intros are
      // present, so the audible gap this comment used to describe is closed
      // from the other end. If IS2-era radar clips ever surface, add them here.
      extended: [
        // JC's extended pool is entirely 7-day / week-ahead phrasing —
        // IntelliStar never ran a 5-day version. Tagged so 5-day themes
        // (WS4000, WS3000, WSJr) fall to TTS rather than hearing "seven
        // day outlook" over a 5-day rundown.
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_7Day_Fcast/7DAY_DEFAULT1.mp3`, text: "Here's our seven day outlook", eras: ["7-day"] },
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_7Day_Fcast/7DAY_DEFAULT2.mp3`, text: "Our seven-day outlook", eras: ["7-day"] },
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_7Day_Fcast/7DAY_DEFAULT3.mp3`, text: "Our week ahead", eras: ["7-day"] },
      ],
      hourly: [
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Daypart/DAYPART_DEFAULT1.mp3`, text: "Our local forecast" },
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Daypart/DAYPART_DEFAULT2.mp3`, text: "The forecast for our area" },
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Daypart/DAYPART_DEFAULT4.mp3`, text: "The forecast for your area" },
        // DAYPART_DEFAULT3 ("Our Daily Planner") moved to `dailyPlanner` —
        // the name was retired in September 2004 and Jim Cantore narrates
        // IntelliStar-era themes, which are all post-rename.
      ],
      // Pre-September-2004 name, kept for themes that predate the rename.
      dailyPlanner: [
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Daypart/DAYPART_DEFAULT3.mp3`, text: "Our Daily Planner" },
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Daypart/DAYPART_DEFAULT5.mp3`, text: "Your daily planner" },
      ],
      // DAYPART_DEFAULT6 says "your local forecast" outright — the Local
      // Forecast scene had no Jim Cantore intro at all until this was wired,
      // even though the clip was sitting in the library.
      localForecast: [
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Daypart/DAYPART_DEFAULT6.mp3`, text: "Your local forecast" },
        { file: `${JC_VOCALLOCAL_BASE}/Headline_Phrases/024.mp3`, text: "Your local forecast" },
      ],
      alerts: [
        { file: `${JC_NARRATION}/Weatherscan severe/SEVERE_DEFAULT.mp3`, text: "Severe weather alert" },
        { file: `${JC_NARRATION}/Weatherscan severe/TORNADO_DEFAULT.mp3`, text: "Tornado warning" },
        { file: `${JC_NARRATION}/Weatherscan severe/FFLOOD_DEFAULT.mp3`, text: "Flash flood warning" },
      ],
      weekend: [
        { file: `${JC_VOCALLOCAL_BASE}/Periods2/WEEKEND2.mp3`, text: "This weekend" },
      ],
    },
  },
  {
    id: "amy-bargeron",
    label: "Amy Bargeron (Weatherscan)",
    hasTemps: false,
    hasConditions: false,
    hasWind: false,
    // Amy's full Weatherscan voice pack is 9 clips (all verified). Each
    // entry here maps a clip to the scene she actually narrated it on.
    // Scenes she narrated historically but for which we don't have the
    // preserved clip (7-Day Outlook, Almanac, Local Observations,
    // Weekly Outlook) are intentionally omitted rather than back-filled
    // with mismatched clips — they fall through to TTS.
    sceneIntros: {
      current: [
        { file: `${AB_NARRATION}/Local-CurrentConditions.mp3`, text: "Your current conditions" },
      ],
      radar: [
        { file: `${AB_NARRATION}/Local-LocalDoppler.mp3`, text: "The local Doppler radar" },
      ],
      // `extended` intentionally omitted — our Regional Forecast clip
      // ("Local-RegionalForecastConditions.mp3") is for the Weatherscan
      // Regional Forecast scene (nearby-cities map), not the 7-Day
      // Outlook. Using it on Extended would mislabel the screen. Move
      // that clip here if/when a dedicated Regional scene is added.
      hourly: [
        // Weatherscan's "Daypart Forecast" was the closest historical
        // analog of our hour-by-hour scene; Amy's DaypartForecast clip
        // fits as an opener.
        { file: `${AB_NARRATION}/Local-DaypartForecast.mp3`, text: "Your local forecast" },
      ],
      localForecast: [
        { file: `${AB_NARRATION}/Local-TextForecast.mp3`, text: "Your local forecast" },
      ],
      traffic: [
        { file: `${AB_NARRATION}/Local-TrafficFlow.mp3`, text: "Traffic flow" },
        { file: `${AB_NARRATION}/Local-TrafficOverview.mp3`, text: "Traffic conditions across your area" },
      ],
      airport: [
        { file: `${AB_NARRATION}/Local-LocalAirportConditions.mp3`, text: "Local airport delays" },
      ],
      // Pollen report clip exists but the app has no allergy scene
      // yet. Kept as a placeholder for when an allergy scene is added
      // — until then, this entry is a no-op (scheduler never fires an
      // `allergy` scene).
      allergy: [
        { file: `${AB_NARRATION}/Local-AllergyReport.mp3`, text: "The pollen report for your area" },
      ],
    },
  },
  {
    id: "chandler",
    // Dan Chandler (1938-2023), TWC's staff voice from 1987 through the
    // 1990s — NOT an IntelliStar voice, which is how this library ended up
    // mislabelled and assigned to a 2013+ unit. The recordings date
    // themselves: every hourly clip says "your local 36 hour forecast" and
    // the extended says "the five day forecast", both retired in the
    // September 2004 product rename.
    //
    // No device currently claims him. The library is intact and selectable
    // by hand in Settings, but which machine it shipped on is unconfirmed —
    // he has radar and travel-cities clips, which rules out the radar-less
    // 3000 and Jr, and a five-day extended, which does not match the 4000's
    // post-Feb-1991 three-day format. Left unassigned rather than guessed,
    // since guessing the narrator is exactly the error being corrected here.
    label: "Dan Chandler (1987-1990s)",
    hasTemps: false,
    hasConditions: false,
    hasWind: false,
    sceneIntros: {
      // Current conditions — only use the simple "The current conditions" clips (16-22, 25)
      current: chandlerClips("cc", [
        [16, "current-conditions", "The current conditions"],
        [17, "current-conditions", "The current conditions"],
        [18, "current-conditions", "The current conditions"],
        [19, "current-conditions", "The current conditions"],
        [20, "current-conditions", "The current conditions"],
        [21, "current-conditions", "The current conditions"],
        [22, "current-conditions", "The current conditions"],
        [25, "current-local-conditions", "The current local conditions"],
      ]),
      // Radar — current radar with intensity description
      radar: chandlerClips("cr", [
        [3, "current-radar-precip-intensity", "The current radar"],
        [4, "current-radar-precip-intensity", "The current radar"],
        [5, "current-radar-precip-intensity", "The current radar"],
        [6, "current-radar-precip-intensity", "The current radar"],
        [7, "current-radar-precip-intensity", "The current radar"],
        [8, "current-radar-precip-intensity", "The current radar"],
      ]),
      // Extended forecast
      extended: chandlerRange("ex", "extended-forecast", "The extended forecast", 1, 19),
      // 36-hour / hourly forecast — use "Your local 36 hour forecast" clips
      hourly: chandlerClips("hr", [
        [15, "local-36hr-forecast", "Your local 36 hour forecast"],
        [16, "local-36hr-forecast", "Your local 36 hour forecast"],
        [17, "local-36hr-forecast", "Your local 36 hour forecast"],
        [18, "local-36hr-forecast", "Your local 36 hour forecast"],
        [19, "local-36hr-forecast", "Your local 36 hour forecast"],
        [20, "local-36hr-forecast", "Your local 36 hour forecast"],
      ]),
      // Local forecast — use the simple 36hr clips
      localForecast: chandlerClips("hr", [
        [1, "36hr-forecast", "The 36 hour forecast"],
        [2, "36hr-forecast", "The 36 hour forecast"],
        [3, "36hr-forecast", "The 36 hour forecast"],
      ]),
      // Alerts
      alerts: chandlerRange("al", "special-regional-info", "Special regional information", 1, 10),
      // Regional forecast
      regional: chandlerRange("rf", "regional-forecast", "The regional forecast", 1, 21),
      // Outlook
      outlook: chandlerRange("ol", "long-range-outlook", "Your region's long range outlook", 1, 7),
      // Regional conditions
      regionalConditions: chandlerRange("rc", "current-regional-conditions", "Current regional conditions", 1, 6),
      // Travel / cities
      travelForecast: chandlerRange("tf", "forecast-cities-nationwide", "The forecast for cities nationwide", 1, 10),
      // Local update (NWS)
      localUpdate: chandlerClips("lu", [
        [3, "local-update-nws", "An update on local weather conditions from the National Weather Service"],
        [4, "local-update-nws", "An update on local weather conditions from the National Weather Service"],
      ]),
    },
  },
  // Silent narrator — for eras that predate TWC's local-voice overlay
  // (WeatherStar 3000 etc.). No clips; the composer falls through to
  // TTS/NVDA for every scene.
  {
    id: "silent",
    label: "None (TTS / NVDA only)",
    hasTemps: false,
    hasConditions: false,
    hasWind: false,
    sceneIntros: {},
  },
];

/** Build a single Chandler clip reference. */
function ch(category: string, num: number, desc: string, text: string): NarratorClipDef {
  const n = String(num).padStart(2, "0");
  return { file: `${CH_NARRATION}/${category}/${category}_${n}_${desc}.mp3`, text };
}

/** Build Chandler clips from explicit [number, desc, text] tuples. */
function chandlerClips(category: string, entries: [number, string, string][]): NarratorClipDef[] {
  return entries.map(([num, desc, text]) => ch(category, num, desc, text));
}

/** Build a range of Chandler clips that all have the same description. */
function chandlerRange(category: string, desc: string, text: string, from: number, to: number): NarratorClipDef[] {
  const clips: NarratorClipDef[] = [];
  for (let i = from; i <= to; i++) clips.push(ch(category, i, desc, text));
  return clips;
}

// ─── Lookup helpers ───

const NARRATOR_MAP = new Map(NARRATORS.map((n) => [n.id, n]));

export function getNarrator(id: NarratorId): NarratorDef {
  return NARRATOR_MAP.get(id) ?? NARRATORS[0];
}

/**
 * Pick a random scene intro clip for the given narrator and scene.
 * Returns null if the narrator has no intros for that scene.
 *
 * `era` narrows the pool to entries whose `eras` list contains it (or
 * entries with no `eras` set, which match any era). Used by the extended
 * forecast scene so WeatherStar-4000-era themes (5-day) only hear
 * "Extended Forecast" phrasing while Weatherscan-era themes (7-day)
 * hear "7-Day Outlook" / "Week Ahead" phrasing.
 */
/**
 * Scenes that legitimately borrow another scene's intro, in preference order.
 *
 * Nine of the seventeen scenes have no dedicated composer and fall through to
 * a plain scene-intro clip. Seven of those had no intro defined for ANY
 * narrator, so they announced nothing at all — the screen reader read them,
 * but the narrator sat silent, which on a themed unit reads as the app having
 * stalled. Several of them are simply another view of data a narrator already
 * introduces, so borrowing is accurate rather than a fudge:
 *
 *   detailed     — the observation, in more detail. "Your Local Observations".
 *   feelslike    — derived entirely from the current observation.
 *   temptrend    — the observed temperature over time.
 *   stormtracker — the radar-derived storm list. "Your Local Doppler Radar".
 *
 * Two entries here are not borrowing at all, but repairs: Chandler's Travel
 * Cities clips ("forecast cities nationwide", 13 of them) were wired under
 * `travelForecast`, and his regional-conditions clips under
 * `regionalConditions` — key names no scene id has ever matched, so the audio
 * existed and could never play. Same failure as `localForecast` vs the
 * registry's `localforecast`: a silent miss, no error anywhere.
 *
 * Deliberately NOT aliased: `almanac`, `precip` and `airport` are distinct
 * subjects, and no narrator has a phrase that honestly covers them (Amy has a
 * real airport clip and is already wired for it directly). Those stay silent
 * until real clips exist — `npm run clips:sweep` reports them so the gap is
 * visible instead of being discovered by ear.
 */
const SCENE_INTRO_ALIASES: Record<string, readonly string[]> = {
  detailed:     ["observations", "regionalConditions", "current"],
  feelslike:    ["observations", "current"],
  temptrend:    ["observations", "current"],
  travel:       ["travelForecast"]
  // `stormtracker` deliberately has NO alias. It used to borrow `radar`, so
  // the storm list announced itself as "your local Doppler radar" — which is
  // not what the screen shows, and was never a thing TWC did. Storm Tracker
  // is our own derived scene: 3,839 real IntelliStar market configs contain
  // no product of that name (docs/reference/rundowns.md), so there is no
  // authentic recording to reach for and inventing one by aliasing describes
  // the wrong screen. It is knowingly silent; the screen reader reads the
  // storm list, which is the accurate description of what is on screen.
};

/** Scene ids are compared case-insensitively. The scene registry uses
 *  lowercase ids ("localforecast") while several intro keys are camelCase
 *  ("localForecast"), and a mismatch fails silently — no clip, no error. */
function introsFor(narrator: NarratorDef, sceneId: string): NarratorClipDef[] | undefined {
  const direct = narrator.sceneIntros[sceneId];
  if (direct?.length) return direct;
  const wanted = sceneId.toLowerCase();
  for (const [key, clips] of Object.entries(narrator.sceneIntros)) {
    if (key.toLowerCase() === wanted && clips?.length) return clips;
  }
  return undefined;
}

export function pickSceneIntro(narratorId: NarratorId, sceneId: string, era?: "5-day" | "7-day"): NarratorClipDef | null {
  const narrator = getNarrator(narratorId);
  // Era-correct product naming first: a WeatherStar 3000 should introduce the
  // "36 Hour Forecast" and the "Daily Planner", not the names those products
  // were given in September 2004. See sceneSegments.ts for the source.
  const candidates = [
    ...eraIntroKeys(sceneId),
    sceneId,
    ...(SCENE_INTRO_ALIASES[sceneId.toLowerCase()] ?? [])
  ];
  for (const candidate of candidates) {
    const intros = introsFor(narrator, candidate);
    if (!intros || intros.length === 0) continue;
    const pool = era
      ? intros.filter((c) => !c.eras || c.eras.includes(era))
      : intros;
    if (pool.length === 0) continue;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return null;
}
