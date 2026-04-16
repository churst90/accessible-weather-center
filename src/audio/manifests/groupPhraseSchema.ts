/**
 * Day-group phrase schema — maps multi-day weather patterns to pre-recorded
 * composite phrases from Allan Jackson's VocalLocal library.
 *
 * The original Weatherscan system detected when consecutive forecast days
 * shared similar weather and combined them into natural-sounding phrases:
 *   "We'll see rain Monday through Wednesday"
 *   "Look for fair skies Thursday through Saturday"
 *   "Expect thunderstorms on Friday"
 *
 * Six clip directories encode different phrasing styles:
 *   Wx_Phrases_Groups_Well_See/   — "We'll see [condition] [day range]"
 *   Wx_Phrases_Groups_Look_For/   — "Look for [condition] [day range]"
 *   Wx_Phrases_Groups_Expect/     — "Expect [condition] on [day]"
 *   Wx_Phrases_Groups_All_Days/   — "[Condition] [day] through [day]"
 *   Wx_Phrases_Groups_Day3_4/     — 3-4 day range variants
 *   Wx_Phrases_Groups_Day4_5/     — 4-5 day range variants
 *
 * File naming: {DAY}_{CONDITION}{variant}.wav
 *   DAY = MON, TUE, WED, THU, FRI, SAT, SUN
 *   CONDITION = FAIR, MCLOUDY, RAIN, TSTORM, WINTRY
 *   variant = 1 (Well_See), 2 (Look_For), 3 (Expect)
 *
 * For All_Days/Day3_4/Day4_5:
 *   {CONDITION}_{START}_{END}.wav
 *   e.g., RAIN_M_W.wav = "Rain Monday through Wednesday"
 *
 * Allan Jackson only. No other narrator has group phrases.
 */

import type { ClipConfidence } from "./clipSchema";
import { AJ_VOCALLOCAL_BASE } from "./narratorSchema";
import type { NarratorId } from "./narratorSchema";
import type { ForecastPeriod } from "../../core/types";

const GROUP_BASE = AJ_VOCALLOCAL_BASE;

export interface GroupPhraseClip {
  src: string;
  text: string;
  confidence: ClipConfidence;
}

// ────────────────────────────────────────────────────────────────────────────
//  Weather category classification
// ────────────────────────────────────────────────────────────────────────────

type WeatherCategory = "FAIR" | "MCLOUDY" | "RAIN" | "TSTORM" | "WINTRY";

/**
 * Classify a shortForecast string into one of the five IntelliStar categories.
 */
function classifyWeather(shortForecast: string): WeatherCategory {
  const t = shortForecast.toLowerCase();

  if (/thunder/i.test(t))                                      return "TSTORM";
  if (/snow|sleet|ice|blizzard|wintry|freezing/i.test(t))      return "WINTRY";
  if (/rain|shower|drizzle/i.test(t))                          return "RAIN";
  if (/mostly cloudy|overcast|cloudy/i.test(t) && !/partly/i.test(t)) return "MCLOUDY";
  return "FAIR";
}

/**
 * Human-readable labels for each weather category.
 */
const CATEGORY_LABELS: Record<WeatherCategory, string> = {
  FAIR: "fair skies",
  MCLOUDY: "mostly cloudy skies",
  RAIN: "rain",
  TSTORM: "thunderstorms",
  WINTRY: "wintry precipitation",
};

// ────────────────────────────────────────────────────────────────────────────
//  Day code mapping
// ────────────────────────────────────────────────────────────────────────────

type DayCode = "M" | "T" | "W" | "R" | "F" | "S" | "U";
type DayName = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

const PERIOD_TO_DAY: Record<string, DayName> = {
  monday: "MON", tuesday: "TUE", wednesday: "WED", thursday: "THU",
  friday: "FRI", saturday: "SAT", sunday: "SUN",
};

const DAY_TO_SHORT: Record<DayName, DayCode> = {
  MON: "M", TUE: "T", WED: "W", THU: "R", FRI: "F", SAT: "S", SUN: "U",
};

// The All_Days/Day3_4/Day4_5 directories use single-letter codes for
// start and end days. Mapping based on actual filenames:
// M=Mon, T=Tue, W=Wed (sometimes Thu), R=Thu, F=Fri, S=Sat/Sun
// The files use: M=Monday, T=Tuesday/Thursday, W=Wednesday/Friday,
// F=Friday, S=Saturday/Sunday/Saturday
// Looking at actual filenames like RAIN_M_W (Mon-Wed), RAIN_T_S (Tue-Sat),
// the mapping is: M=Mon, T=Tue, W=Wed, T=Thu(context), F=Fri, S=Sat/Sun

// Single-letter day codes used in All_Days filenames
export const SHORT_TO_LABEL: Record<string, string> = {
  M: "Monday", T: "Tuesday", W: "Wednesday",
  F: "Friday", S: "Saturday",
};

// For Day3_4 and Day4_5, the day codes differ slightly
// Day3_4 has patterns like: FAIR_F_S (Fri-Sat), FAIR_M_T (Mon-Tue)
// Day4_5 has the same set

function extractDayName(periodName: string): DayName | null {
  const day = periodName.toLowerCase().replace(/ night$/, "");
  return PERIOD_TO_DAY[day] ?? null;
}

// ────────────────────────────────────────────────────────────────────────────
//  Clip directory transcriptions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Well_See clips: "We'll see [condition] [day range]"
 * Naming: {DAY}_{CONDITION}1.wav
 * 35 clips total (7 days x 5 conditions)
 */
function getWellSeeClip(day: DayName, category: WeatherCategory): GroupPhraseClip {
  return {
    src: `${GROUP_BASE}/Wx_Phrases_Groups_Well_See/${day}_${category}1.wav`,
    // Actual audio: "On Tuesday, we'll see a chance of thunderstorms."
    text: `On ${PERIOD_TO_DAY_LABEL[day]}, we'll see ${CATEGORY_LABELS[category]}`,
    confidence: "likely",
  };
}

/**
 * Look_For clips: "Look for [condition] on [day]"
 * Naming: {DAY}_{CONDITION}2.wav
 */
function getLookForClip(day: DayName, category: WeatherCategory): GroupPhraseClip {
  return {
    src: `${GROUP_BASE}/Wx_Phrases_Groups_Look_For/${day}_${category}2.wav`,
    // Actual audio: "Look for a chance of thunderstorms on Tuesday."
    text: `Look for ${CATEGORY_LABELS[category]} on ${PERIOD_TO_DAY_LABEL[day]}`,
    confidence: "likely",
  };
}

/**
 * Expect clips: actual audio says "And on [day], expect [condition]."
 * The "And on" prefix makes them sound stringy as a scene opener, so they're
 * no longer used by getGroupPhraseClips — kept here for reference only.
 * Naming: {DAY}_{CONDITION}3.wav
 */
function getExpectClip(day: DayName, category: WeatherCategory): GroupPhraseClip {
  return {
    src: `${GROUP_BASE}/Wx_Phrases_Groups_Expect/${day}_${category}3.wav`,
    // Actual audio: "And on Tuesday, expect a chance of thunderstorms."
    text: `And on ${PERIOD_TO_DAY_LABEL[day]}, expect ${CATEGORY_LABELS[category]}`,
    confidence: "likely",
  };
}

const PERIOD_TO_DAY_LABEL: Record<DayName, string> = {
  MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday",
  FRI: "Friday", SAT: "Saturday", SUN: "Sunday",
};

/**
 * All_Days clips: "[Condition] [day] through [day]"
 * Naming: {CONDITION}_{START}_{END}.wav
 * 35 clips total (7 start-end combos x 5 conditions)
 *
 * Available day-range combos (from actual files):
 *   F_S (Fri-Sat), M_W (Mon-Wed), S_M (Sat-Mon), S_T (Sun-Tue),
 *   T_S (Tue-Sat), T_T (Tue-Thu), W_F (Wed-Fri)
 */
interface DayRangeCombo {
  startCode: string;
  endCode: string;
  startLabel: string;
  endLabel: string;
}

const ALL_DAYS_RANGES: DayRangeCombo[] = [
  { startCode: "F", endCode: "S", startLabel: "Friday",    endLabel: "Saturday" },
  { startCode: "M", endCode: "W", startLabel: "Monday",    endLabel: "Wednesday" },
  { startCode: "S", endCode: "M", startLabel: "Saturday",  endLabel: "Monday" },
  { startCode: "S", endCode: "T", startLabel: "Sunday",    endLabel: "Tuesday" },
  { startCode: "T", endCode: "S", startLabel: "Tuesday",   endLabel: "Saturday" },
  { startCode: "T", endCode: "T", startLabel: "Tuesday",   endLabel: "Thursday" },
  { startCode: "W", endCode: "F", startLabel: "Wednesday", endLabel: "Friday" },
];

function getAllDaysClip(category: WeatherCategory, startCode: string, endCode: string, startLabel: string, endLabel: string): GroupPhraseClip {
  return {
    src: `${GROUP_BASE}/Wx_Phrases_Groups_All_Days/${category}_${startCode}_${endCode}.wav`,
    text: `${CATEGORY_LABELS[category]} ${startLabel} through ${endLabel}`,
    confidence: "likely",
  };
}

/**
 * Day3_4 clips: 3-4 day range forecasts
 * Same 5 conditions, different start-end combos:
 *   F_S, M_T, S_M, S_S, T_F, T_W, W_T
 */
const DAY3_4_RANGES: DayRangeCombo[] = [
  { startCode: "F", endCode: "S", startLabel: "Friday",    endLabel: "Sunday" },
  { startCode: "M", endCode: "T", startLabel: "Monday",    endLabel: "Thursday" },
  { startCode: "S", endCode: "M", startLabel: "Saturday",  endLabel: "Monday" },
  { startCode: "S", endCode: "S", startLabel: "Saturday",  endLabel: "Saturday" },
  { startCode: "T", endCode: "F", startLabel: "Tuesday",   endLabel: "Friday" },
  { startCode: "T", endCode: "W", startLabel: "Thursday",  endLabel: "Wednesday" },
  { startCode: "W", endCode: "T", startLabel: "Wednesday", endLabel: "Thursday" },
];

function getDay3_4Clip(category: WeatherCategory, startCode: string, endCode: string, startLabel: string, endLabel: string): GroupPhraseClip {
  return {
    src: `${GROUP_BASE}/Wx_Phrases_Groups_Day3_4/${category}_${startCode}_${endCode}.wav`,
    text: `${CATEGORY_LABELS[category]} ${startLabel} through ${endLabel}`,
    confidence: "likely",
  };
}

/**
 * Day4_5 clips: 4-5 day range forecasts (same combos as Day3_4)
 */
function getDay4_5Clip(category: WeatherCategory, startCode: string, endCode: string, startLabel: string, endLabel: string): GroupPhraseClip {
  return {
    src: `${GROUP_BASE}/Wx_Phrases_Groups_Day4_5/${category}_${startCode}_${endCode}.wav`,
    text: `${CATEGORY_LABELS[category]} ${startLabel} through ${endLabel}`,
    confidence: "likely",
  };
}

// ────────────────────────────────────────────────────────────────────────────
//  Group detection and selection
// ────────────────────────────────────────────────────────────────────────────

interface WeatherGroup {
  /** Weather category for this group */
  category: WeatherCategory;
  /** Start period index (inclusive) */
  startIdx: number;
  /** End period index (inclusive) */
  endIdx: number;
  /** Number of consecutive periods */
  length: number;
}

/**
 * Detect groups of consecutive daytime periods with the same weather category.
 * Only considers daytime periods (skips nights) since group phrases reference
 * day names, not night periods.
 */
function detectGroups(periods: ForecastPeriod[]): WeatherGroup[] {
  // Filter to daytime periods only
  const dayPeriods = periods
    .map((p, i) => ({ period: p, idx: i }))
    .filter(({ period }) => period.isDaytime);

  if (dayPeriods.length < 2) return [];

  const groups: WeatherGroup[] = [];
  let groupStart = 0;

  for (let i = 1; i <= dayPeriods.length; i++) {
    const prevCat = classifyWeather(dayPeriods[groupStart].period.shortForecast);
    const currCat = i < dayPeriods.length ? classifyWeather(dayPeriods[i].period.shortForecast) : null;

    if (currCat !== prevCat || i === dayPeriods.length) {
      const length = i - groupStart;
      if (length >= 2) {
        groups.push({
          category: prevCat,
          startIdx: dayPeriods[groupStart].idx,
          endIdx: dayPeriods[i - 1].idx,
          length,
        });
      }
      groupStart = i;
    }
  }

  return groups;
}

/**
 * Find matching day-range combo for a group of periods.
 */
function findDayRangeCombo(
  startDay: DayName,
  endDay: DayName,
  ranges: DayRangeCombo[]
): DayRangeCombo | null {
  const startShort = DAY_TO_SHORT[startDay];
  const endShort = DAY_TO_SHORT[endDay];
  // Direct match
  for (const r of ranges) {
    if (r.startCode === startShort && r.endCode === endShort) return r;
  }
  // Close match — try first letter of day names
  const startFirst = startDay[0];
  const endFirst = endDay[0];
  for (const r of ranges) {
    if (r.startCode === startFirst && r.endCode === endFirst) return r;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
//  Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Analyze forecast periods and return group phrase clips where consecutive
 * days share similar weather. Returns clips that can replace or supplement
 * the per-period narration in the extended forecast.
 *
 * Only works for AJ narrator (only narrator with group phrase clips).
 *
 * Returns at most 2-3 group phrases to avoid overly long narration.
 * Each group must span at least 2 consecutive daytime periods.
 */
export function getGroupPhraseClips(periods: ForecastPeriod[], narratorId: NarratorId): GroupPhraseClip[] {
  if (narratorId !== "allan-jackson") return [];

  const groups = detectGroups(periods);
  if (groups.length === 0) return [];

  const clips: GroupPhraseClip[] = [];
  // Cycle between Well_See ("On Tuesday, we'll see...") and Look_For
  // ("Look for X on Tuesday") — both sound clean as scene-setting openers.
  // Expect ("And on Tuesday, expect...") is intentionally skipped because
  // its "And on" prefix sounds stringy when used as the opener.
  const styles = ["wellSee", "lookFor"] as const;
  let styleIdx = 0;

  for (const group of groups.slice(0, 3)) {
    const startPeriod = periods[group.startIdx];
    const endPeriod = periods[group.endIdx];
    const startDay = extractDayName(startPeriod.name);
    const endDay = extractDayName(endPeriod.name);

    if (!startDay || !endDay) continue;

    if (group.length === 1 || startDay === endDay) {
      // Single day — alternate Well_See / Look_For
      const style = styles[styleIdx % styles.length];
      if (style === "wellSee") clips.push(getWellSeeClip(startDay, group.category));
      else clips.push(getLookForClip(startDay, group.category));
      styleIdx++;
      continue;
    }

    // Multi-day — try to find a matching day-range clip
    if (group.length === 2) {
      const combo = findDayRangeCombo(startDay, endDay, ALL_DAYS_RANGES);
      if (combo) {
        clips.push(getAllDaysClip(group.category, combo.startCode, combo.endCode, combo.startLabel, combo.endLabel));
        styleIdx++;
        continue;
      }
    }

    if (group.length === 3 || group.length === 4) {
      const combo = findDayRangeCombo(startDay, endDay, DAY3_4_RANGES);
      if (combo) {
        clips.push(getDay3_4Clip(group.category, combo.startCode, combo.endCode, combo.startLabel, combo.endLabel));
        styleIdx++;
        continue;
      }
    }

    if (group.length >= 4) {
      const combo = findDayRangeCombo(startDay, endDay, DAY3_4_RANGES);
      if (combo) {
        clips.push(getDay4_5Clip(group.category, combo.startCode, combo.endCode, combo.startLabel, combo.endLabel));
        styleIdx++;
        continue;
      }
    }

    // Fallback: use Well_See / Look_For for the start day
    const style = styles[styleIdx % styles.length];
    if (style === "wellSee") clips.push(getWellSeeClip(startDay, group.category));
    else clips.push(getLookForClip(startDay, group.category));
    styleIdx++;
  }

  return clips;
}

/**
 * Get a single-day group phrase clip directly.
 * Useful for standalone "Expect rain on Friday" narration.
 */
export function getSingleDayGroupClip(
  periodName: string,
  shortForecast: string,
  style: "wellSee" | "lookFor" | "expect" = "wellSee",
  narratorId: NarratorId = "allan-jackson"
): GroupPhraseClip | null {
  if (narratorId !== "allan-jackson") return null;
  const day = extractDayName(periodName);
  if (!day) return null;
  const category = classifyWeather(shortForecast);
  if (style === "lookFor") return getLookForClip(day, category);
  if (style === "expect") return getExpectClip(day, category);
  return getWellSeeClip(day, category);
}
