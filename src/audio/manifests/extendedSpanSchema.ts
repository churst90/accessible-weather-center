import type { ClipResolution } from "./clipSchema";
import { getClipText } from "../data/clipReferenceTable";

/**
 * Allen Jackson's three-day extended forecast, read as prose.
 *
 * The WeatherStar 4000 did not narrate its extended forecast as three
 * sentences. When consecutive days shared a sky it collapsed them into one
 * phrase, and used a different opener depending on which slot the day
 * occupied:
 *
 *     all three agree   "Expect cloudy skies Friday through Sunday."
 *     two agree         "Expect cloudy skies on Saturday and Sunday."
 *     one day alone     "On Sunday we'll see cloudy skies."
 *
 * 399 recordings covering every combination sat unreferenced in
 * `extended forecast/` for the life of the project — nothing in the codebase
 * built a path into that directory, so the app read three flat sentences
 * while the library held the real thing.
 *
 * INDEXING, which took some working out. Filenames are `D{n}_{SPAN}_{COND}`,
 * and `n` is the weekday of the LAST day the phrase covers, not the first:
 *
 *     D0_FIRST_CLOUDY1        "On Sunday…"                      (Sunday)
 *     D0_FIRSTSECOND_CLOUDY   "…on Saturday and Sunday."        (ends Sunday)
 *     D0_ALL_CLOUDY           "…Friday through Sunday."         (ends Sunday)
 *
 * `first second` and `second third` are the same phrase recorded twice. Both
 * name two consecutive weekdays, so once the ending day is fixed the words
 * are identical — checked across all 48 pairs, and the only differences are
 * transcription noise ("a chance" vs "the chance", "wintery" vs "wintry").
 * Either folder answers a two-day span; this uses `first second` and treats
 * `second third` as its fallback.
 */

const AJ_EXT = "/assets/shared/narration/Alan Jackson/extended forecast";

/** The seven sky buckets the recordings cover. */
export type SpanCondition = "SUNNY" | "PCLOUDY" | "MCLOUDY" | "CLOUDY" | "RAIN" | "TSTORM" | "WINTER";

/**
 * Map an NWS short forecast onto one of the seven recorded buckets.
 *
 * Order matters and mirrors the rule the rest of the composer follows:
 * specific compounds before their general fallbacks, and precipitation
 * before sky cover, because "Rain and cloudy" is a rain day.
 */
export function spanConditionFor(shortForecast: string | null | undefined): SpanCondition | null {
  if (!shortForecast) return null;
  const t = shortForecast.toLowerCase();
  if (/snow|sleet|freez|winter|wintry|ice|blizzard|flurr/.test(t)) return "WINTER";
  if (/thunder|t-?storm/.test(t))                                  return "TSTORM";
  if (/rain|shower|drizzle|precip/.test(t))                        return "RAIN";
  if (/mostly cloudy|overcast/.test(t))                            return "MCLOUDY";
  if (/partly cloudy|partly sunny|mostly sunny/.test(t))           return "PCLOUDY";
  if (/cloud/.test(t))                                             return "CLOUDY";
  if (/sunny|clear|fair/.test(t))                                  return "SUNNY";
  return null;
}

/** A run of consecutive days that share a sky. */
export interface DaySpan {
  /** 0 = Sunday … 6 = Saturday, for the LAST day of the run. */
  lastWeekday: number;
  /** How many days the run covers: 1, 2 or 3. */
  length: 1 | 2 | 3;
  condition: SpanCondition;
}

/**
 * Group consecutive days that share a bucket, longest run first.
 *
 * Greedy from the front and capped at three, because that is the longest
 * phrase recorded. A four-day agreement on a longer forecast becomes a
 * three-day span plus whatever follows, which is what the hardware did.
 */
export function groupDaySpans(
  days: Array<{ weekday: number; shortForecast: string | null }>
): DaySpan[] {
  const out: DaySpan[] = [];
  let i = 0;
  while (i < days.length) {
    const cond = spanConditionFor(days[i].shortForecast);
    if (!cond) { i++; continue; }
    let run = 1;
    while (
      run < 3 &&
      i + run < days.length &&
      spanConditionFor(days[i + run].shortForecast) === cond &&
      // Only genuinely consecutive calendar days collapse. A gap would make
      // "Friday through Sunday" a lie.
      days[i + run].weekday === (days[i + run - 1].weekday + 1) % 7
    ) run++;
    out.push({ lastWeekday: days[i + run - 1].weekday, length: run as 1 | 2 | 3, condition: cond });
    i += run;
  }
  return out;
}

/**
 * The recorded phrase for one span, or null when it was never recorded.
 *
 * Confidence follows the reference table: a clip the table knows about is
 * "likely", one it does not is "guess" and will be filtered at the default
 * threshold rather than played blind. That is the same contract every other
 * pool honours, and it is what keeps a missing recording silent instead of a
 * 404.
 */
export function getSpanClip(span: DaySpan): ClipResolution | null {
  const d = `D${span.lastWeekday}`;
  const c = span.condition;
  const candidates =
    span.length === 3 ? [`all days/allwconditions/${d}_ALL_${c}.mp3`]
    : span.length === 2 ? [
        `first second/${d}_FIRSTSECOND_${c}.mp3`,
        `second third/${d}_SECONDTHIRD_${c}.mp3`,
      ]
    // The single-day recordings carry a "1" suffix; a handful have a "2".
    : [`firstwcondition/${d}_FIRST_${c}1.mp3`, `firstwcondition/${d}_FIRST_${c}2.mp3`];

  for (const rel of candidates) {
    const src = `${AJ_EXT}/${rel}`;
    // getClipText returns the reference entry, whose presence is what marks
    // the clip as real. The compact runtime index carries paths without text,
    // so `text` may be empty — the fallbackText the composer supplies is what
    // the screen reader speaks either way.
    const known = getClipText("allan-jackson", `extended forecast/${rel}`);
    if (known) return { src, text: known.text ?? "", confidence: "likely" };
  }
  return null;
}
