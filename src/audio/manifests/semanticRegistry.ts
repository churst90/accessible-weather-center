/**
 * Semantic ID registry — the narrator-agnostic dispatch layer.
 *
 * Instead of hard-coding clip paths per narrator throughout PhraseComposer
 * (`if (narrator === "allan-jackson") ... else if ...`), composer code asks
 * the registry to resolve a **semantic ID** and gets back the right clip for
 * the active narrator — or `null` if this narrator doesn't have one (caller
 * falls back to TTS).
 *
 * Every ID has the shape `"<category>:<param>"` (e.g. `period:MON`,
 * `temp:72`, `ccsh:1600`, `windDir1:NE`, `precip:30`). Category dispatch
 * is a direct lookup; per-narrator resolvers compute the relPath from the
 * param. Text comes from `clipReferenceTable.json` when a verified entry
 * exists; otherwise it's derived from the ID (e.g. "72 degrees").
 *
 * ── Coverage ────────────────────────────────────────────────────────────
 * Enumerable tier (this module): periods, temps (specific / high / low /
 * range), condition codes (CC / CCSH / CCEF), wind directions (16 compass
 * points × 3 variants), wind speeds (14 ranges × 5 variants), wind misc
 * (calm / becoming / shifting), precip probability, qualifier codes,
 * JC rate-OP, JC accumulation, and named singletons (intros, tones).
 *
 * Fuzzy / text-matched tier (stays separate):
 *   - longformSchema.ts (N-series + composites)
 *   - groupPhraseSchema.ts (AJ multi-day summaries)
 *   - headlineSchema.ts (VTEC/AWIPS event composition)
 *
 * PhraseComposer still uses the legacy per-narrator getters. Rewiring is
 * Phase 3 of the refactor — one compose function at a time.
 */

import type { ClipConfidence, ClipResolution } from "./clipSchema";
import {
  type NarratorId,
  NARRATOR_ASSET_ROOTS,
} from "./narratorSchema";
import { getClipText } from "../data/clipReferenceTable";

// ───────────────────────── Semantic IDs ──────────────────────────────

/**
 * Branded string — construct only via the `Sem` helpers below. Shape:
 * `"category:param"` (e.g. `"period:MON"`, `"temp:72"`).
 */
export type SemanticId = string & { readonly __semanticId: unique symbol };

export type Weekday = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export type PeriodKey =
  | Weekday
  | `${Weekday}_NIGHT`
  | "TODAY"
  | "TONIGHT"
  | "OVERNIGHT"
  | "AFTERNOON";

/** 16-point compass directions — matches the clip library's naming. */
export type CompassDir =
  | "N" | "NNE" | "NE" | "ENE"
  | "E" | "ESE" | "SE" | "SSE"
  | "S" | "SSW" | "SW" | "WSW"
  | "W" | "WNW" | "NW" | "NNW";

/** Wind speed range tokens used in clip filenames (e.g. `AT_10_15.mp3`). */
export type WindRange =
  | "Below_5" | "5_10" | "10_15" | "10_20" | "15_25" | "20_30" | "25_35"
  | "25_40" | "35_50" | "40_60" | "50_70" | "60_80" | "70_90" | "80_100"
  | "Over_100";

/** Temperature range tokens used by AJ (e.g. `H80S`, `L30S`, `M50S`). */
export type TempRangeCode =
  | "BELOW" | "WELL_BELOW" | "SINGLE"
  | `${"H" | "L" | "M"}${"0" | "10" | "20" | "30" | "40" | "50" | "60" | "70" | "80" | "90" | "100"}S`;

/** Named singleton intents the library exposes (non-enumerable one-offs). */
export type NamedIntent =
  | "current_intro"        // "Currently, the temperature is"
  | "current_intro_alt"
  | "mnemonic"             // Weatherscan musical signature
  | "warning_beep"         // NWS 4-beep pattern (AJ) — JC uses crawl beeps
  | "alert_tornado"
  | "alert_tstorm"
  | "alert_flood";

/** Category tags — one per resolver family. */
type Category =
  | "period"
  | "temp"          | "tempHigh"      | "tempLow"
  | "tempRange"     | "tempHighRange" | "tempRange2"
  | "cc"            | "ccsh"          | "ccef"
  | "windDir1"      | "windDir2"      | "windDir3"
  | "windAtSpeed"   | "windSpeed"
  | "windAndInc"    | "windAndDim"
  | "windInc"       | "windDim"
  | "windBecoming"  | "windShifting"
  | "windCalm"
  | "precipProb"
  | "qualifier"
  | "rateOp"
  | "accumulation"  // param shape: "TYPE_CODE" (e.g. "SNOW_6")
  | "named";

const make = <T extends string>(category: Category, param: T): SemanticId =>
  `${category}:${param}` as SemanticId;

/** Constructors for every supported semantic ID. Group by clip family. */
export const Sem = {
  // Periods
  period: (k: PeriodKey) => make("period", k),

  // Temperatures
  temp:          (deg: number)              => make("temp",          String(deg)),
  tempHigh:      (deg: number)              => make("tempHigh",      String(deg)),
  tempLow:       (deg: number)              => make("tempLow",       String(deg)),
  tempRange:     (code: TempRangeCode)      => make("tempRange",     code),
  tempHighRange: (code: TempRangeCode)      => make("tempHighRange", code),
  tempRange2:    (code: TempRangeCode)      => make("tempRange2",    code),

  // Conditions
  cc:   (code: number) => make("cc",   String(code)),
  ccsh: (code: number) => make("ccsh", String(code)),
  ccef: (code: number) => make("ccef", String(code)),

  // Wind — direction (three variants: bare, "from the", word form)
  windDir1: (dir: CompassDir) => make("windDir1", dir),
  windDir2: (dir: CompassDir) => make("windDir2", dir),
  windDir3: (dir: CompassDir) => make("windDir3", dir),

  // Wind — speed + compounds
  windAtSpeed:  (range: WindRange) => make("windAtSpeed",  range),
  windSpeed:    (range: WindRange) => make("windSpeed",    range),
  windAndInc:   (range: WindRange) => make("windAndInc",   range),
  windAndDim:   (range: WindRange) => make("windAndDim",   range),
  windInc:      (range: WindRange) => make("windInc",      range),
  windDim:      (range: WindRange) => make("windDim",      range),
  windBecoming: (dir: CompassDir)  => make("windBecoming", dir),
  windShifting: (dir: CompassDir)  => make("windShifting", dir),
  windCalm:     () => make("windCalm", ""),

  // Precip probability (10-90% in steps of 10)
  precipProb: (pct: number) => make("precipProb", String(pct)),

  // Qualifiers (pattern codes like 8060 = "Storms could contain tornadoes")
  qualifier: (code: number) => make("qualifier", String(code)),

  // JC-only rate-of-precipitation codes
  rateOp: (code: number) => make("rateOp", String(code)),

  // JC-only accumulation: type is SNOW | ICE | SLEET | RAIN, code is amount.
  accumulation: (type: "SNOW" | "ICE" | "SLEET" | "RAIN", code: string) =>
    make("accumulation", `${type}_${code}`),

  // Named singletons
  named: (intent: NamedIntent) => make("named", intent),
} as const;

// ─────────────────────────── Library surface ─────────────────────────

export interface NarratorLibrary {
  readonly narratorId: NarratorId;
  resolve(id: SemanticId): ClipResolution | null;
}

// ───────────────────────── Parse helpers ─────────────────────────────

function splitId(id: SemanticId): [Category, string] {
  const colon = id.indexOf(":");
  if (colon < 0) return ["period" as Category, ""];
  return [id.slice(0, colon) as Category, id.slice(colon + 1)];
}

// ───────────────────────── Period maps ───────────────────────────────

const AJ_PERIOD_MAP: Partial<Record<PeriodKey, string>> = {
  MON: "VocalLocal/Periods2/MON.mp3",
  TUE: "VocalLocal/Periods2/TUE.mp3",
  WED: "VocalLocal/Periods2/WED.mp3",
  THU: "VocalLocal/Periods2/THU.mp3",
  FRI: "VocalLocal/Periods2/FRI.mp3",
  SAT: "VocalLocal/Periods2/SAT.mp3",
  SUN: "VocalLocal/Periods2/SUN.mp3",
  // Weekday night clips — MON7/TUE7/... are the "on Monday night." form,
  // which works as a period intro for the extended / weekend forecasts.
  MON_NIGHT: "VocalLocal/Periods2/MON7.mp3",
  TUE_NIGHT: "VocalLocal/Periods2/TUE7.mp3",
  WED_NIGHT: "VocalLocal/Periods2/WED7.mp3",
  THU_NIGHT: "VocalLocal/Periods2/THU7.mp3",
  FRI_NIGHT: "VocalLocal/Periods2/FRI7.mp3",
  SAT_NIGHT: "VocalLocal/Periods2/SAT7.mp3",
  SUN_NIGHT: "VocalLocal/Periods2/SUN7.mp3",
  TODAY: "VocalLocal/Periods2/TODAY1.mp3",
  TONIGHT: "VocalLocal/Periods2/TONIGHT1.mp3",
  OVERNIGHT: "VocalLocal/Periods2/OVERNIGHT.mp3",
  AFTERNOON: "VocalLocal/Periods2/AFTERNOON1.mp3",
};

const JC_PERIOD_MAP: Partial<Record<PeriodKey, string>> = {
  MON: "Vocal Local/Periods2/MON.mp3",
  TUE: "Vocal Local/Periods2/TUE.mp3",
  WED: "Vocal Local/Periods2/WED.mp3",
  THU: "Vocal Local/Periods2/THU.mp3",
  FRI: "Vocal Local/Periods2/FRI.mp3",
  SAT: "Vocal Local/Periods2/SAT.mp3",
  SUN: "Vocal Local/Periods2/SUN.mp3",
  MON_NIGHT: "Vocal Local/Periods2/Monday_Night.mp3",
  TUE_NIGHT: "Vocal Local/Periods2/Tuesday_Night.mp3",
  WED_NIGHT: "Vocal Local/Periods2/Wednesday_Night.mp3",
  THU_NIGHT: "Vocal Local/Periods2/Thursday_Night.mp3",
  FRI_NIGHT: "Vocal Local/Periods2/Friday_Night.mp3",
  SAT_NIGHT: "Vocal Local/Periods2/Saturday_Night.mp3",
  SUN_NIGHT: "Vocal Local/Periods2/Sunday_Night.mp3",
  OVERNIGHT: "Vocal Local/Periods2/OVERNIGHT1.mp3",
  TODAY: "Vocal Local/Periods2/TODAY1.mp3",
  TONIGHT: "Vocal Local/Periods2/TONIGHT1.mp3",
  AFTERNOON: "Vocal Local/Periods2/AFTERNOON1.mp3",
};

// ───────────────────────── Named clip maps ───────────────────────────

// Severe alert clips use the verified Default_Phrases_Severe/ set. There
// are also older /severe/*.mp3 files with identical text at lower whisper
// confidence and verified:false — intentionally not mapped here so the
// registry has a single canonical source per intent.
const AJ_NAMED_MAP: Partial<Record<NamedIntent, string>> = {
  current_intro:     "VocalLocal/Intros_Curr_Cond/CC_INTRO1.mp3",
  current_intro_alt: "VocalLocal/Intros_Curr_Cond/CC_INTRO2.mp3",
  alert_tornado:     "VocalLocal/Default_Phrases_Severe/TOR001.mp3",
  alert_tstorm:      "VocalLocal/Default_Phrases_Severe/SVR001.mp3",
  alert_flood:       "VocalLocal/Default_Phrases_Severe/FFW001.mp3",
};

// The mnemonic and alert tones live outside narrator trees — they're not
// narrator-specific audio, so not mapped per-narrator here. JC's severe
// clips are under "Default phrases severe/" (space-separated, lowercase)
// — there's a parallel "Weatherscan severe/" folder with near-duplicate
// DEFAULT.mp3 versions; the 001 set is preferred as it matches AJ's
// naming convention and has viewer-area phrasing.
const JC_NAMED_MAP: Partial<Record<NamedIntent, string>> = {
  current_intro:     "Vocal Local/Default_Phrases_Now/CC_INTRO1.mp3",
  current_intro_alt: "Vocal Local/Default_Phrases_Now/CC_INTRO2.mp3",
  alert_tornado:     "Default phrases severe/TOR001.mp3",
  alert_tstorm:      "Default phrases severe/SVR001.mp3",
  alert_flood:       "Default phrases severe/FFW001.mp3",
};

// ───────────────────────── Category resolvers ───────────────────────

/**
 * Per-narrator resolvers. Each takes the param portion of an ID and
 * returns a relPath (relative to the narrator's asset root) or null.
 * Text derivation happens in a separate step so resolvers stay focused
 * on path construction.
 */
type CategoryResolver = (param: string) => string | null;
type NarratorResolvers = Partial<Record<Category, CategoryResolver>>;

// ─── Allan Jackson ─────────────────────────────────────────────────

const AJ_VL = "VocalLocal";

const AJ_RESOLVERS: NarratorResolvers = {
  period:     (p) => AJ_PERIOD_MAP[p as PeriodKey] ?? null,
  named:      (p) => AJ_NAMED_MAP[p as NamedIntent] ?? null,

  temp: (p) => {
    const n = Number(p);
    if (!Number.isInteger(n)) return null;
    if (n === 0)                   return `${AJ_VL}/Temps_Specific/Zero.mp3`;
    if (n > 0 && n <= 139)         return `${AJ_VL}/Temps_Specific/${n}.mp3`;
    if (n < 0 && n >= -99)         return `${AJ_VL}/Temps_Specific/M${-n}.mp3`;
    return null;
  },
  tempHigh: (p) => {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 130) return null;
    return `${AJ_VL}/Temps_Highs/HIGH_${n}.mp3`;
  },
  tempLow: (p) => {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 105) return null;
    return `${AJ_VL}/Temps_Lows/LOW_${n}.mp3`;
  },
  tempHighRange: (p) => `${AJ_VL}/Temps_High_Ranges/HIGH_${p}.mp3`,
  tempRange:     (p) => `${AJ_VL}/Temps_Ranges1/${p}.mp3`,
  tempRange2:    (p) => `${AJ_VL}/Temps_Ranges2/TEMP_${p}.mp3`,

  // Conditions — AJ zero-pads CCSH codes < 1000 to 4 digits.
  cc:   (p) => `${AJ_VL}/Wx_Phrases_Curr_Cond/${p}.mp3`,
  ccsh: (p) => {
    const n = Number(p);
    if (!Number.isFinite(n)) return null;
    const padded = n < 1000 ? String(n).padStart(4, "0") : String(n);
    return `${AJ_VL}/Wx_Phrases_Shortcast/${padded}.mp3`;
  },
  ccef: (p) => `${AJ_VL}/Wx_Phrases_Ext_Fcast/${p}.mp3`,

  // Wind — AJ has 3 direction variants, compound "and-inc/dim", AND
  // folder name is "Winds_Misc" (with 's').
  windDir1:     (p) => `${AJ_VL}/Wind_Dir1/${p}_W.mp3`,
  windDir2:     (p) => `${AJ_VL}/Wind_Dir2/W_${p}.mp3`,
  windDir3:     (p) => `${AJ_VL}/Wind_Dir3/${p}.mp3`,
  windAtSpeed:  (p) => `${AJ_VL}/Wind_At_Speed/AT_${p}.mp3`,
  windSpeed:    (p) => `${AJ_VL}/Wind_Speed/${p}.mp3`,
  windAndInc:   (p) => `${AJ_VL}/Wind_And_Increasing/And_Inc_${p}.mp3`,
  windAndDim:   (p) => `${AJ_VL}/Wind_And_Diminishing/And_Dim_${p}.mp3`,
  windInc:      (p) => `${AJ_VL}/Wind_Increasing/Inc_${p}.mp3`,
  windDim:      (p) => `${AJ_VL}/Wind_Diminishing/Dim_${p}.mp3`,
  windBecoming: (p) => `${AJ_VL}/Wind_Becoming/Bec_${p}.mp3`,
  windShifting: (p) => `${AJ_VL}/Wind_Shifting/Shift_${p}.mp3`,
  windCalm:     ()  => `${AJ_VL}/Winds_Misc/W9900.mp3`,

  // Precip probability — AJ uses P9{decile}1 under Wx_Phrases_Precip.
  precipProb: (p) => precipRelPath(p, `${AJ_VL}/Wx_Phrases_Precip`, /*excludeTen=*/ false),

  // Qualifiers — numeric code under Wx_Phrases_Qualifiers.
  qualifier: (p) => `${AJ_VL}/Wx_Phrases_Qualifiers/${p}.mp3`,

  // No rate-OP / accumulation for AJ.
};

// ─── Jim Cantore ──────────────────────────────────────────────────

const JC_VL = "Vocal Local";

const JC_RESOLVERS: NarratorResolvers = {
  period: (p) => JC_PERIOD_MAP[p as PeriodKey] ?? null,
  named:  (p) => JC_NAMED_MAP[p as NamedIntent] ?? null,

  temp: (p) => {
    const n = Number(p);
    if (!Number.isInteger(n)) return null;
    if (n >= 0 && n <= 130)  return `${JC_VL}/Temps_Specific/${n}.mp3`;
    if (n < 0 && n >= -99)   return `${JC_VL}/Temps_Specific/M${-n}.mp3`;
    return null;
  },
  tempHigh: (p) => {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 130) return null;
    return `${JC_VL}/Temps_Highs/HIGH_${n}.mp3`;
  },
  tempLow: (p) => {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 105) return null;
    return `${JC_VL}/Temps_Lows/LOW_${n}.mp3`;
  },
  // JC does not ship Temps_Ranges* / Temps_High_Ranges.

  // Conditions — JC does NOT zero-pad CCSH codes.
  cc:   (p) => `${JC_VL}/Wx_Phrases_Curr_Cond/${p}.mp3`,
  ccsh: (p) => `${JC_VL}/Wx_Phrases_Shortcast/${p}.mp3`,
  // JC does not ship Wx_Phrases_Ext_Fcast.

  // Wind — JC has Wind_Dir1/At_Speed/Increasing/Diminishing/Becoming/Shifting,
  // folder is "Wind_Misc" (no 's'), and no compound "and-inc/dim" clips.
  windDir1:     (p) => `${JC_VL}/Wind_Dir1/${p}_W.mp3`,
  windAtSpeed:  (p) => `${JC_VL}/Wind_At_Speed/AT_${p}.mp3`,
  windInc:      (p) => `${JC_VL}/Wind_Increasing/Inc_${p}.mp3`,
  windDim:      (p) => `${JC_VL}/Wind_Diminishing/Dim_${p}.mp3`,
  windBecoming: (p) => `${JC_VL}/Wind_Becoming/Bec_${p}.mp3`,
  windShifting: (p) => `${JC_VL}/Wind_Shifting/Shift_${p}.mp3`,
  windCalm:     ()  => `${JC_VL}/Wind_Misc/W9900.mp3`,

  // Precip — JC uses Wx_Phrases_POP and is missing 10%.
  precipProb: (p) => precipRelPath(p, `${JC_VL}/Wx_Phrases_POP`, /*excludeTen=*/ true),

  // Qualifiers (same shape as AJ).
  qualifier: (p) => `${JC_VL}/Wx_Phrases_Qualifiers/${p}.mp3`,

  // Rate-of-precipitation — JC only. Clips are R-prefixed (R8011, R8012,
  // R8021, R8022). Param is the numeric code without the prefix.
  rateOp: (p) => `${JC_VL}/Wx_Phrases_RateOP/R${p}.mp3`,

  // Accumulation — JC only. Param shape: "TYPE_CODE" → Wx_Phrases_Accumulation/{TYPE}_{CODE}.mp3
  accumulation: (p) => `${JC_VL}/Wx_Phrases_Accumulation/${p}.mp3`,
};

// ─── Amy & Chandler & Silent ────────────────────────────────────────
// No enumerable-category clips — these narrators only have scene intros
// (served by narratorSchema.sceneIntros, not this registry) or nothing
// at all (silent = TTS-only, used by WS3000 and any pre-voiceover era).
const AMY_RESOLVERS: NarratorResolvers = {};
const CHANDLER_RESOLVERS: NarratorResolvers = {};
const SILENT_RESOLVERS: NarratorResolvers = {};

const RESOLVERS_BY_NARRATOR: Record<NarratorId, NarratorResolvers> = {
  "allan-jackson": AJ_RESOLVERS,
  "jim-cantore":   JC_RESOLVERS,
  "amy-bargeron":  AMY_RESOLVERS,
  "chandler":      CHANDLER_RESOLVERS,
  "silent":        SILENT_RESOLVERS,
};

// ───────────────────────── Helpers ───────────────────────────────────

/** Build a precip probability relPath. `P9{decile}1.mp3` — e.g. 30% → P9031. */
function precipRelPath(paramPct: string, dir: string, excludeTen: boolean): string | null {
  const pct = Number(paramPct);
  if (!Number.isInteger(pct)) return null;
  const rounded = Math.round(pct / 10) * 10;
  if (rounded < 10 || rounded > 90) return null;
  if (excludeTen && rounded === 10) return null;
  const decile = String(rounded / 10).padStart(2, "0");
  return `${dir}/P9${decile}1.mp3`;
}

/** Derive display text from an ID when the reference table has no entry. */
function deriveText(category: Category, param: string): string {
  switch (category) {
    case "period": {
      const k = param as PeriodKey;
      if (k === "TODAY") return "today";
      if (k === "TONIGHT") return "tonight";
      if (k === "OVERNIGHT") return "overnight";
      if (k === "AFTERNOON") return "this afternoon";
      const weekdayNames: Record<Weekday, string> = {
        MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday",
        FRI: "Friday", SAT: "Saturday", SUN: "Sunday",
      };
      if (k.endsWith("_NIGHT")) {
        const day = k.slice(0, -"_NIGHT".length) as Weekday;
        return `${weekdayNames[day] ?? day} night`;
      }
      return weekdayNames[k as Weekday] ?? param;
    }
    case "temp": {
      const n = Number(param);
      if (n === 0)  return "zero degrees";
      if (n === 1)  return "one degree";
      if (n === -1) return "minus one degree";
      if (n < 0)    return `minus ${-n} degrees`;
      return `${n} degrees`;
    }
    case "tempHigh":       return `high of ${param}`;
    case "tempLow":        return `low of ${param}`;
    case "tempRange":      return `in the ${formatRange(param)}`;
    case "tempHighRange":  return `highs in the ${formatRange(param)}`;
    case "tempRange2":     return `temperatures in the ${formatRange(param)}`;
    case "cc":             return `condition code ${param}`;
    case "ccsh":           return `condition ${param}`;
    case "ccef":           return `forecast condition ${param}`;
    case "windDir1":
    case "windDir2":
    case "windDir3":       return `${compassLong(param as CompassDir)} winds`;
    case "windAtSpeed":    return `at ${formatWindRange(param as WindRange)}`;
    case "windSpeed":      return `${formatWindRange(param as WindRange)} mph`;
    case "windAndInc":     return `and increasing to ${formatWindRange(param as WindRange)}`;
    case "windAndDim":     return `and diminishing to ${formatWindRange(param as WindRange)}`;
    case "windInc":        return `increasing to ${formatWindRange(param as WindRange)}`;
    case "windDim":        return `diminishing to ${formatWindRange(param as WindRange)}`;
    case "windBecoming":   return `becoming ${compassLong(param as CompassDir)}`;
    case "windShifting":   return `shifting to ${compassLong(param as CompassDir)}`;
    case "windCalm":       return "Wind calm";
    case "precipProb":     return `${param} percent chance of precipitation`;
    case "qualifier":      return `qualifier ${param}`;
    case "rateOp":         return `rate ${param}`;
    case "accumulation":   return `accumulation ${param}`;
    case "named":          return param;
  }
}

function formatRange(code: string): string {
  if (code === "BELOW")       return "below zero";
  if (code === "WELL_BELOW")  return "well below zero";
  if (code === "SINGLE")      return "single digits";
  const m = /^([HLM])(\d+)S$/.exec(code);
  if (!m) return code;
  const prefix = { H: "high ", L: "low ", M: "mid " }[m[1] as "H" | "L" | "M"];
  return `${prefix}${m[2]}s`;
}

function formatWindRange(range: WindRange): string {
  if (range === "Below_5") return "below 5 mph";
  if (range === "Over_100") return "over 100 mph";
  const [lo, hi] = range.split("_");
  return `${lo} to ${hi} mph`;
}

function compassLong(d: CompassDir): string {
  const names: Record<CompassDir, string> = {
    N: "north", NNE: "north-northeast", NE: "northeast", ENE: "east-northeast",
    E: "east",  ESE: "east-southeast",  SE: "southeast", SSE: "south-southeast",
    S: "south", SSW: "south-southwest", SW: "southwest", WSW: "west-southwest",
    W: "west",  WNW: "west-northwest",  NW: "northwest", NNW: "north-northwest",
  };
  return names[d];
}

// ───────────────────────── Resolver driver ───────────────────────────

/** Tidy a raw Whisper transcription for display: strip a single trailing
 * period and surrounding whitespace. Preserves Whisper's natural casing —
 * condition clips are transcribed lowercase ("with a thunderstorm") for
 * mid-sentence use, standalone clips uppercase ("Cloudy"). Don't force-
 * capitalize here; callers that need capitalized display can do so. */
function normalizeText(raw: string): string {
  let t = raw.trim();
  if (t.endsWith(".")) t = t.slice(0, -1).trimEnd();
  return t;
}

function resolveFor(narratorId: NarratorId, id: SemanticId): ClipResolution | null {
  const [category, param] = splitId(id);
  const resolver = RESOLVERS_BY_NARRATOR[narratorId]?.[category];
  if (!resolver) return null;
  const rel = resolver(param);
  if (!rel) return null;

  const root = NARRATOR_ASSET_ROOTS[narratorId];
  const ref = getClipText(narratorId, rel);

  // Prefer the verified reference-table transcription; otherwise derive
  // text from the ID params. Confidence reflects whether a human has
  // signed off on the transcription.
  let text: string;
  let confidence: ClipConfidence;
  if (ref?.verified) {
    text = normalizeText(ref.text);
    confidence = "confirmed";
  } else if (ref) {
    text = normalizeText(ref.text) || deriveText(category, param);
    confidence = "likely";
  } else {
    text = deriveText(category, param);
    confidence = "guess";
  }

  return { src: `${root}/${rel}`, text, confidence };
}

// ───────────────────────── Library factory ───────────────────────────

const LIBRARIES = new Map<NarratorId, NarratorLibrary>();

export function getLibrary(narratorId: NarratorId): NarratorLibrary {
  let lib = LIBRARIES.get(narratorId);
  if (!lib) {
    lib = {
      narratorId,
      resolve: (id) => resolveFor(narratorId, id),
    };
    LIBRARIES.set(narratorId, lib);
  }
  return lib;
}
