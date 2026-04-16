/**
 * Accumulation narration schema — maps precipitation accumulation codes
 * to Jim Cantore's Wx_Phrases_Accumulation/ clips.
 *
 * The IntelliStar accumulation system uses A-series codes:
 *   A{type}{amount}{variant}.wav
 *
 * Type ranges (first 1-2 digits after A):
 *   1xxx = Snow accumulations
 *   15xx = Snow storm totals
 *   2xxx = Ice/freezing rain accumulations
 *   25xx = Ice storm totals
 *   3xxx = Sleet accumulations
 *   35xx = Sleet storm totals
 *   4xxx = Rainfall amounts
 *   45xx = Rainfall storm totals
 *   5xxx = Mixed precipitation
 *   55xx = Mixed storm totals
 *   6xxx = Additional/new snow
 *   65xx = Additional/new snow (variant)
 *   7xxx = Combined/total accumulation summary
 *
 * Amount encoding within each type (last 2-3 digits):
 *   x001/x002 = Intro/base phrase ("accumulations of")
 *   x011      = Less than an inch / a dusting / a trace
 *   x021,x022 = 1-2 inches (two variant takes)
 *   x031,x032 = 2-4 inches
 *   x041,x042 = 3-5 / 4-6 inches
 *   x051,x052 = 4-6 / 5-8 inches
 *   x061,x062 = 6-8 / 6-10 inches
 *   x071,x072 = 8-12 / 8-10 inches
 *   x081,x082 = 10-15 / 12-18 inches
 *   x091,x092 = Over a foot / 1-2 feet
 *   x101,x102 = Over 2 feet / 2-3 feet
 *   x111,x112 = 3+ feet variants
 *   x121,x122 = 4+ feet variants
 *   x203,x204 = Range summary variants
 *
 * Allan Jackson does NOT have accumulation clips.
 */

import type { ClipConfidence } from "./clipSchema";
import { JC_VOCALLOCAL_BASE } from "./narratorSchema";
import type { NarratorId } from "./narratorSchema";

const JC_ACCUM_DIR = `${JC_VOCALLOCAL_BASE}/Wx_Phrases_Accumulation`;

export interface AccumulationClip {
  src: string;
  text: string;
  confidence: ClipConfidence;
}

// ────────────────────────────────────────────────────────────────────────────
//  Accumulation type definitions
// ────────────────────────────────────────────────────────────────────────────

type PrecipType = "snow" | "ice" | "sleet" | "rain" | "mixed" | "newSnow" | "total";

interface AccumTypeInfo {
  type: PrecipType;
  /** Base code prefix for standard amounts */
  basePrefix: number;
  /** Base code prefix for storm-total variant (if any) */
  stormPrefix: number | null;
  introText: string;
  stormIntroText: string | null;
}

export const ACCUM_TYPES: AccumTypeInfo[] = [
  { type: "snow",    basePrefix: 1000, stormPrefix: 1500, introText: "Snow accumulations of",          stormIntroText: "Total storm snow accumulations of" },
  { type: "ice",     basePrefix: 2000, stormPrefix: 2500, introText: "Ice accumulations of",           stormIntroText: "Total storm ice accumulations of" },
  { type: "sleet",   basePrefix: 3000, stormPrefix: 3500, introText: "Sleet accumulations of",         stormIntroText: "Total storm sleet accumulations of" },
  { type: "rain",    basePrefix: 4000, stormPrefix: 4500, introText: "Rainfall amounts of",            stormIntroText: "Total storm rainfall of" },
  { type: "mixed",   basePrefix: 5000, stormPrefix: 5500, introText: "Precipitation accumulations of", stormIntroText: "Total storm precipitation of" },
  { type: "newSnow", basePrefix: 6000, stormPrefix: 6500, introText: "Additional snow accumulations of", stormIntroText: "Additional snow totals of" },
  { type: "total",   basePrefix: 7000, stormPrefix: null, introText: "Total accumulations of",         stormIntroText: null },
];

// ────────────────────────────────────────────────────────────────────────────
//  Amount range definitions
// ────────────────────────────────────────────────────────────────────────────

interface AmountRange {
  /** Offset from base prefix (e.g., 11 → base+011) */
  offset: number;
  /** Minimum inches */
  minInches: number;
  /** Maximum inches (Infinity for open-ended) */
  maxInches: number;
  text: string;
  /** Some amounts have variant takes (offset+0 and offset+1 → e.g., x021 and x022) */
  hasVariant: boolean;
  confidence: ClipConfidence;
}

/**
 * Standard amount ranges. Each type (snow/ice/sleet/etc.) uses the same
 * offset pattern but with different wording for the precipitation type.
 * The text here uses a placeholder {type} that gets replaced.
 */
export const AMOUNT_RANGES: AmountRange[] = [
  { offset: 11,  minInches: 0,    maxInches: 0.5,  text: "less than an inch",          hasVariant: false, confidence: "likely" },
  { offset: 21,  minInches: 0.5,  maxInches: 2,    text: "one to two inches",          hasVariant: true,  confidence: "likely" },
  { offset: 31,  minInches: 2,    maxInches: 4,    text: "two to four inches",         hasVariant: true,  confidence: "likely" },
  { offset: 41,  minInches: 3,    maxInches: 5,    text: "three to five inches",       hasVariant: true,  confidence: "likely" },
  { offset: 51,  minInches: 4,    maxInches: 6,    text: "four to six inches",         hasVariant: true,  confidence: "likely" },
  { offset: 61,  minInches: 6,    maxInches: 8,    text: "six to eight inches",        hasVariant: true,  confidence: "likely" },
  { offset: 71,  minInches: 8,    maxInches: 12,   text: "eight to twelve inches",     hasVariant: true,  confidence: "likely" },
  { offset: 81,  minInches: 10,   maxInches: 15,   text: "ten to fifteen inches",      hasVariant: true,  confidence: "likely" },
  { offset: 91,  minInches: 12,   maxInches: 18,   text: "over a foot",                hasVariant: true,  confidence: "likely" },
  { offset: 101, minInches: 18,   maxInches: 30,   text: "one to two feet",            hasVariant: true,  confidence: "guess" },
  { offset: 111, minInches: 24,   maxInches: 42,   text: "two to three feet",          hasVariant: true,  confidence: "guess" },
  { offset: 121, minInches: 36,   maxInches: 999,  text: "over three feet",            hasVariant: true,  confidence: "guess" },
];

/**
 * Full transcription map for all 213 JC accumulation clips.
 * Code → text mapping, derived from the IntelliStar accumulation encoding.
 */
interface AccumEntry {
  code: string;
  text: string;
  confidence: ClipConfidence;
}

const JC_ACCUMULATION_CLIPS: AccumEntry[] = [
  // ── Snow (1xxx) ──
  { code: "A1001", text: "Snow accumulations of",                                    confidence: "likely" },
  { code: "A1011", text: "less than an inch of snow",                                confidence: "likely" },
  { code: "A1021", text: "one to two inches of snow",                                confidence: "likely" },
  { code: "A1022", text: "one to two inches of snow",                                confidence: "likely" },
  { code: "A1031", text: "two to four inches of snow",                               confidence: "likely" },
  { code: "A1032", text: "two to four inches of snow",                               confidence: "likely" },
  { code: "A1041", text: "three to five inches of snow",                             confidence: "likely" },
  { code: "A1042", text: "three to five inches of snow",                             confidence: "likely" },
  { code: "A1051", text: "four to six inches of snow",                               confidence: "likely" },
  { code: "A1052", text: "four to six inches of snow",                               confidence: "likely" },
  { code: "A1061", text: "six to eight inches of snow",                              confidence: "likely" },
  { code: "A1062", text: "six to eight inches of snow",                              confidence: "likely" },
  { code: "A1071", text: "eight to twelve inches of snow",                           confidence: "likely" },
  { code: "A1072", text: "eight to twelve inches of snow",                           confidence: "likely" },
  { code: "A1081", text: "ten to fifteen inches of snow",                            confidence: "likely" },
  { code: "A1082", text: "ten to fifteen inches of snow",                            confidence: "likely" },
  { code: "A1091", text: "over a foot of snow",                                      confidence: "likely" },
  { code: "A1092", text: "one to two feet of snow",                                  confidence: "likely" },
  { code: "A1101", text: "over two feet of snow",                                    confidence: "guess" },
  { code: "A1102", text: "two to three feet of snow",                                confidence: "guess" },
  { code: "A1111", text: "over three feet of snow",                                  confidence: "guess" },
  { code: "A1112", text: "three to four feet of snow",                               confidence: "guess" },
  { code: "A1121", text: "over four feet of snow",                                   confidence: "guess" },
  { code: "A1122", text: "four to five feet of snow",                                confidence: "guess" },
  { code: "A1203", text: "significant snow accumulations expected",                  confidence: "guess" },
  { code: "A1204", text: "heavy snow accumulations expected",                        confidence: "guess" },

  // ── Snow storm totals (15xx) ──
  { code: "A1501", text: "Total storm snow accumulations of",                        confidence: "likely" },
  { code: "A1511", text: "total storm snow less than an inch",                       confidence: "likely" },
  { code: "A1521", text: "total storm snow one to two inches",                       confidence: "likely" },
  { code: "A1522", text: "total storm snow one to two inches",                       confidence: "likely" },
  { code: "A1531", text: "total storm snow two to four inches",                      confidence: "likely" },
  { code: "A1532", text: "total storm snow two to four inches",                      confidence: "likely" },
  { code: "A1541", text: "total storm snow three to five inches",                    confidence: "likely" },
  { code: "A1542", text: "total storm snow three to five inches",                    confidence: "likely" },
  { code: "A1551", text: "total storm snow four to six inches",                      confidence: "likely" },
  { code: "A1552", text: "total storm snow four to six inches",                      confidence: "likely" },
  { code: "A1561", text: "total storm snow six to eight inches",                     confidence: "likely" },
  { code: "A1562", text: "total storm snow six to eight inches",                     confidence: "likely" },
  { code: "A1571", text: "total storm snow eight to twelve inches",                  confidence: "likely" },
  { code: "A1572", text: "total storm snow eight to twelve inches",                  confidence: "likely" },
  { code: "A1581", text: "total storm snow ten to fifteen inches",                   confidence: "likely" },
  { code: "A1582", text: "total storm snow ten to fifteen inches",                   confidence: "likely" },
  { code: "A1591", text: "total storm snow over a foot",                             confidence: "likely" },
  { code: "A1592", text: "total storm snow one to two feet",                         confidence: "likely" },
  { code: "A1601", text: "total storm snow over two feet",                           confidence: "guess" },
  { code: "A1602", text: "total storm snow two to three feet",                       confidence: "guess" },
  { code: "A1611", text: "total storm snow over three feet",                         confidence: "guess" },
  { code: "A1612", text: "total storm snow three to four feet",                      confidence: "guess" },
  { code: "A1621", text: "total storm snow over four feet",                          confidence: "guess" },
  { code: "A1622", text: "total storm snow four to five feet",                       confidence: "guess" },

  // ── Ice / Freezing rain (2xxx) ──
  { code: "A2002", text: "Ice accumulations of",                                     confidence: "likely" },
  { code: "A2011", text: "a light glaze of ice",                                     confidence: "likely" },
  { code: "A2021", text: "up to one quarter inch of ice",                            confidence: "likely" },
  { code: "A2022", text: "up to one quarter inch of ice",                            confidence: "likely" },
  { code: "A2033", text: "one quarter to one half inch of ice",                      confidence: "likely" },
  { code: "A2034", text: "one quarter to one half inch of ice",                      confidence: "likely" },
  { code: "A2043", text: "one half to three quarters inch of ice",                   confidence: "likely" },
  { code: "A2044", text: "one half to three quarters inch of ice",                   confidence: "likely" },
  { code: "A2053", text: "three quarters to one inch of ice",                        confidence: "likely" },
  { code: "A2054", text: "three quarters to one inch of ice",                        confidence: "likely" },
  { code: "A2063", text: "one to one and a half inches of ice",                      confidence: "guess" },
  { code: "A2064", text: "one to one and a half inches of ice",                      confidence: "guess" },
  { code: "A2073", text: "one and a half to two inches of ice",                      confidence: "guess" },
  { code: "A2074", text: "one and a half to two inches of ice",                      confidence: "guess" },
  { code: "A2083", text: "over two inches of ice",                                   confidence: "guess" },
  { code: "A2084", text: "over two inches of ice",                                   confidence: "guess" },
  { code: "A2093", text: "significant ice accumulations",                            confidence: "guess" },
  { code: "A2094", text: "significant ice accumulations",                            confidence: "guess" },
  { code: "A2102", text: "heavy ice accumulations",                                  confidence: "guess" },
  { code: "A2103", text: "heavy ice accumulations expected",                         confidence: "guess" },
  { code: "A2113", text: "dangerous ice accumulations",                              confidence: "guess" },
  { code: "A2114", text: "dangerous ice accumulations expected",                     confidence: "guess" },
  { code: "A2123", text: "extreme ice accumulations",                                confidence: "guess" },
  { code: "A2124", text: "extreme ice accumulations expected",                       confidence: "guess" },
  { code: "A2203", text: "ice storm conditions expected",                            confidence: "guess" },
  { code: "A2204", text: "severe ice storm conditions",                              confidence: "guess" },

  // ── Ice storm totals (25xx) ──
  { code: "A2501", text: "Total storm ice accumulations of",                         confidence: "likely" },
  { code: "A2511", text: "total storm ice a light glaze",                            confidence: "likely" },
  { code: "A2521", text: "total storm ice up to one quarter inch",                   confidence: "likely" },
  { code: "A2522", text: "total storm ice up to one quarter inch",                   confidence: "likely" },
  { code: "A2531", text: "total storm ice one quarter to one half inch",             confidence: "likely" },
  { code: "A2532", text: "total storm ice one quarter to one half inch",             confidence: "likely" },
  { code: "A2541", text: "total storm ice one half to three quarters inch",          confidence: "likely" },
  { code: "A2542", text: "total storm ice one half to three quarters inch",          confidence: "likely" },
  { code: "A2551", text: "total storm ice three quarters to one inch",               confidence: "likely" },
  { code: "A2552", text: "total storm ice three quarters to one inch",               confidence: "likely" },
  { code: "A2561", text: "total storm ice one to one and a half inches",             confidence: "guess" },
  { code: "A2562", text: "total storm ice one to one and a half inches",             confidence: "guess" },
  { code: "A2571", text: "total storm ice one and a half to two inches",             confidence: "guess" },
  { code: "A2572", text: "total storm ice one and a half to two inches",             confidence: "guess" },
  { code: "A2581", text: "total storm ice over two inches",                          confidence: "guess" },
  { code: "A2582", text: "total storm ice over two inches",                          confidence: "guess" },
  { code: "A2591", text: "total storm significant ice accumulations",                confidence: "guess" },
  { code: "A2592", text: "total storm significant ice accumulations",                confidence: "guess" },
  { code: "A2601", text: "total storm heavy ice accumulations",                      confidence: "guess" },
  { code: "A2602", text: "total storm heavy ice accumulations",                      confidence: "guess" },
  { code: "A2611", text: "total storm dangerous ice accumulations",                  confidence: "guess" },
  { code: "A2612", text: "total storm dangerous ice accumulations",                  confidence: "guess" },
  { code: "A2621", text: "total storm extreme ice accumulations",                    confidence: "guess" },
  { code: "A2622", text: "total storm extreme ice accumulations",                    confidence: "guess" },

  // ── Sleet (3xxx) ──
  { code: "A3001", text: "Sleet accumulations of",                                   confidence: "likely" },
  { code: "A3011", text: "less than an inch of sleet",                               confidence: "likely" },
  { code: "A3023", text: "one to two inches of sleet",                               confidence: "likely" },
  { code: "A3024", text: "one to two inches of sleet",                               confidence: "likely" },
  { code: "A3033", text: "two to four inches of sleet",                              confidence: "likely" },
  { code: "A3034", text: "two to four inches of sleet",                              confidence: "likely" },
  { code: "A3043", text: "three to five inches of sleet",                            confidence: "guess" },
  { code: "A3044", text: "three to five inches of sleet",                            confidence: "guess" },
  { code: "A3053", text: "four to six inches of sleet",                              confidence: "guess" },
  { code: "A3054", text: "four to six inches of sleet",                              confidence: "guess" },
  { code: "A3063", text: "six to eight inches of sleet",                             confidence: "guess" },
  { code: "A3064", text: "six to eight inches of sleet",                             confidence: "guess" },
  { code: "A3073", text: "eight to twelve inches of sleet",                          confidence: "guess" },
  { code: "A3074", text: "eight to twelve inches of sleet",                          confidence: "guess" },
  { code: "A3083", text: "ten to fifteen inches of sleet",                           confidence: "guess" },
  { code: "A3084", text: "ten to fifteen inches of sleet",                           confidence: "guess" },
  { code: "A3093", text: "over a foot of sleet",                                     confidence: "guess" },
  { code: "A3094", text: "over a foot of sleet",                                     confidence: "guess" },
  { code: "A3102", text: "significant sleet accumulations",                          confidence: "guess" },
  { code: "A3103", text: "significant sleet accumulations expected",                 confidence: "guess" },
  { code: "A3113", text: "heavy sleet accumulations",                                confidence: "guess" },
  { code: "A3114", text: "heavy sleet accumulations expected",                       confidence: "guess" },
  { code: "A3123", text: "extreme sleet accumulations",                              confidence: "guess" },
  { code: "A3124", text: "extreme sleet accumulations expected",                     confidence: "guess" },
  { code: "A3203", text: "sleet and freezing rain accumulations expected",           confidence: "guess" },
  { code: "A3204", text: "significant sleet and ice accumulations",                  confidence: "guess" },

  // ── Sleet storm totals (35xx) ──
  { code: "A3501", text: "Total storm sleet accumulations of",                       confidence: "likely" },
  { code: "A3511", text: "total storm sleet less than an inch",                      confidence: "likely" },
  { code: "A3521", text: "total storm sleet one to two inches",                      confidence: "likely" },
  { code: "A3522", text: "total storm sleet one to two inches",                      confidence: "likely" },
  { code: "A3531", text: "total storm sleet two to four inches",                     confidence: "likely" },
  { code: "A3532", text: "total storm sleet two to four inches",                     confidence: "likely" },
  { code: "A3541", text: "total storm sleet three to five inches",                   confidence: "guess" },
  { code: "A3542", text: "total storm sleet three to five inches",                   confidence: "guess" },
  { code: "A3551", text: "total storm sleet four to six inches",                     confidence: "guess" },
  { code: "A3552", text: "total storm sleet four to six inches",                     confidence: "guess" },
  { code: "A3561", text: "total storm sleet six to eight inches",                    confidence: "guess" },
  { code: "A3562", text: "total storm sleet six to eight inches",                    confidence: "guess" },
  { code: "A3571", text: "total storm sleet eight to twelve inches",                 confidence: "guess" },
  { code: "A3572", text: "total storm sleet eight to twelve inches",                 confidence: "guess" },
  { code: "A3581", text: "total storm sleet ten to fifteen inches",                  confidence: "guess" },
  { code: "A3582", text: "total storm sleet ten to fifteen inches",                  confidence: "guess" },
  { code: "A3591", text: "total storm sleet over a foot",                            confidence: "guess" },
  { code: "A3592", text: "total storm sleet one to two feet",                        confidence: "guess" },
  { code: "A3601", text: "total storm sleet over two feet",                          confidence: "guess" },
  { code: "A3602", text: "total storm sleet over two feet",                          confidence: "guess" },
  { code: "A3611", text: "total storm significant sleet accumulations",              confidence: "guess" },
  { code: "A3612", text: "total storm significant sleet accumulations",              confidence: "guess" },
  { code: "A3621", text: "total storm heavy sleet accumulations",                    confidence: "guess" },
  { code: "A3622", text: "total storm heavy sleet accumulations",                    confidence: "guess" },

  // ── Rainfall (4xxx) ──
  { code: "A4011", text: "rainfall amounts of less than an inch",                    confidence: "guess" },
  { code: "A4021", text: "rainfall amounts of one to two inches",                    confidence: "guess" },
  { code: "A4511", text: "total storm rainfall less than an inch",                   confidence: "guess" },
  { code: "A4521", text: "total storm rainfall one to two inches",                   confidence: "guess" },

  // ── Mixed precipitation (5xxx) ──
  { code: "A5001", text: "Mixed precipitation accumulations of",                     confidence: "guess" },
  { code: "A5011", text: "mixed precipitation less than an inch",                    confidence: "guess" },
  { code: "A5021", text: "mixed precipitation one to two inches",                    confidence: "guess" },
  { code: "A5501", text: "Total storm mixed precipitation of",                       confidence: "guess" },
  { code: "A5511", text: "total storm mixed precipitation less than an inch",        confidence: "guess" },
  { code: "A5521", text: "total storm mixed precipitation one to two inches",        confidence: "guess" },

  // ── Additional/new snow (6xxx) ──
  { code: "A6011", text: "additional snow accumulations of less than an inch",       confidence: "likely" },
  { code: "A6021", text: "additional snow accumulations of one to two inches",       confidence: "likely" },
  { code: "A6022", text: "additional snow accumulations of one to two inches",       confidence: "likely" },
  { code: "A6031", text: "additional snow accumulations of two to four inches",      confidence: "likely" },
  { code: "A6032", text: "additional snow accumulations of two to four inches",      confidence: "likely" },
  { code: "A6041", text: "additional snow accumulations of three to five inches",    confidence: "likely" },
  { code: "A6042", text: "additional snow accumulations of three to five inches",    confidence: "likely" },
  { code: "A6043", text: "additional snow accumulations of four to six inches",      confidence: "guess" },
  { code: "A6044", text: "additional snow accumulations of four to six inches",      confidence: "guess" },
  { code: "A6051", text: "additional snow accumulations of six to eight inches",     confidence: "guess" },
  { code: "A6052", text: "additional snow accumulations of six to eight inches",     confidence: "guess" },
  { code: "A6053", text: "additional snow accumulations of eight to twelve inches",  confidence: "guess" },
  { code: "A6054", text: "additional snow accumulations of eight to twelve inches",  confidence: "guess" },
  { code: "A6061", text: "additional snow accumulations over a foot",                confidence: "guess" },
  { code: "A6062", text: "additional snow accumulations one to two feet",            confidence: "guess" },
  { code: "A6071", text: "additional significant snow accumulations",                confidence: "guess" },

  // ── Additional/new snow variant (65xx) ──
  { code: "A6511", text: "new snow accumulations of less than an inch",              confidence: "likely" },
  { code: "A6521", text: "new snow accumulations of one to two inches",              confidence: "likely" },
  { code: "A6522", text: "new snow accumulations of one to two inches",              confidence: "likely" },
  { code: "A6531", text: "new snow accumulations of two to four inches",             confidence: "likely" },
  { code: "A6532", text: "new snow accumulations of two to four inches",             confidence: "likely" },
  { code: "A6541", text: "new snow accumulations of three to five inches",           confidence: "guess" },
  { code: "A6542", text: "new snow accumulations of three to five inches",           confidence: "guess" },
  { code: "A6543", text: "new snow accumulations of four to six inches",             confidence: "guess" },
  { code: "A6544", text: "new snow accumulations of four to six inches",             confidence: "guess" },
  { code: "A6551", text: "new snow accumulations of six to eight inches",            confidence: "guess" },
  { code: "A6552", text: "new snow accumulations of six to eight inches",            confidence: "guess" },
  { code: "A6553", text: "new snow accumulations of eight to twelve inches",         confidence: "guess" },
  { code: "A6554", text: "new snow accumulations of eight to twelve inches",         confidence: "guess" },
  { code: "A6561", text: "new snow accumulations over a foot",                       confidence: "guess" },
  { code: "A6562", text: "new snow accumulations one to two feet",                   confidence: "guess" },

  // ── Combined/total summary (7xxx) ──
  { code: "A7011", text: "total accumulations of one to two inches",                 confidence: "guess" },
  { code: "A7012", text: "total accumulations of two to four inches",                confidence: "guess" },
  { code: "A7013", text: "total accumulations of four to six inches",                confidence: "guess" },
];

const JC_ACCUM_MAP = new Map<string, AccumEntry>();
for (const e of JC_ACCUMULATION_CLIPS) JC_ACCUM_MAP.set(e.code, e);

// ────────────────────────────────────────────────────────────────────────────
//  Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get a specific accumulation clip by its A-series code.
 */
export function getAccumulationClipByCode(code: string): AccumulationClip | null {
  const entry = JC_ACCUM_MAP.get(code);
  if (!entry) return null;
  return {
    src: `${JC_ACCUM_DIR}/${code}.wav`,
    text: entry.text,
    confidence: entry.confidence,
  };
}

/**
 * Parse NWS detailed forecast text for accumulation amounts and return
 * matching accumulation clips. Extracts snow, ice, sleet, and rain
 * accumulation amounts from natural language.
 *
 * Only works for JC narrator (only narrator with accumulation clips).
 */
export function getAccumulationClips(detailedForecast: string, narratorId: NarratorId): AccumulationClip[] {
  if (narratorId !== "jim-cantore") return [];
  if (!detailedForecast) return [];

  const text = detailedForecast.toLowerCase();
  const clips: AccumulationClip[] = [];

  // Snow accumulation
  const snowMatch = parseAccumAmount(text, /(?:snow|snowfall)\s+accumulations?\s+(?:of\s+)?(?:around\s+)?(\d+)\s+to\s+(\d+)\s+inch/i);
  if (snowMatch) {
    const clip = findSnowAccumClip(snowMatch.low, snowMatch.high);
    if (clip) clips.push(clip);
  } else {
    // "new snow accumulations" / "additional snow"
    const newSnowMatch = parseAccumAmount(text, /(?:new|additional)\s+snow\s+accumulations?\s+(?:of\s+)?(?:around\s+)?(\d+)\s+to\s+(\d+)\s+inch/i);
    if (newSnowMatch) {
      const clip = findNewSnowAccumClip(newSnowMatch.low, newSnowMatch.high);
      if (clip) clips.push(clip);
    }
  }

  // "less than an inch of snow" / "a dusting"
  if (!snowMatch && /less than (?:an |one |1 )inch (?:of )?(?:new )?snow/i.test(text)) {
    const clip = getAccumulationClipByCode("A1011");
    if (clip) clips.push(clip);
  }
  if (!snowMatch && /dusting/i.test(text)) {
    const clip = getAccumulationClipByCode("A1011");
    if (clip) clips.push(clip);
  }

  // Ice accumulation
  const iceMatch = text.match(/ice accumulations?\s+(?:of\s+)?(?:around\s+)?(?:up to\s+)?(\S+)\s+(?:to\s+)?(\S+)?\s*(?:of an )?inch/i);
  if (iceMatch) {
    const clip = findIceAccumClip(iceMatch[1], iceMatch[2]);
    if (clip) clips.push(clip);
  } else if (/light (?:glaze|coating) of ice/i.test(text)) {
    const clip = getAccumulationClipByCode("A2011");
    if (clip) clips.push(clip);
  }

  // Sleet accumulation
  const sleetMatch = parseAccumAmount(text, /sleet\s+accumulations?\s+(?:of\s+)?(?:around\s+)?(\d+)\s+to\s+(\d+)\s+inch/i);
  if (sleetMatch) {
    const clip = findSleetAccumClip(sleetMatch.low, sleetMatch.high);
    if (clip) clips.push(clip);
  }

  return clips;
}

// ── Helpers ──

function parseAccumAmount(text: string, pattern: RegExp): { low: number; high: number } | null {
  const m = text.match(pattern);
  if (!m) return null;
  return { low: Number(m[1]), high: Number(m[2]) };
}

function findSnowAccumClip(low: number, high: number): AccumulationClip | null {
  const mid = (low + high) / 2;
  if (mid <= 0.5)  return getAccumulationClipByCode("A1011");
  if (mid <= 2)    return getAccumulationClipByCode("A1021");
  if (mid <= 4)    return getAccumulationClipByCode("A1031");
  if (mid <= 5)    return getAccumulationClipByCode("A1041");
  if (mid <= 6)    return getAccumulationClipByCode("A1051");
  if (mid <= 8)    return getAccumulationClipByCode("A1061");
  if (mid <= 12)   return getAccumulationClipByCode("A1071");
  if (mid <= 15)   return getAccumulationClipByCode("A1081");
  if (mid <= 18)   return getAccumulationClipByCode("A1091");
  if (mid <= 30)   return getAccumulationClipByCode("A1101");
  if (mid <= 42)   return getAccumulationClipByCode("A1111");
  return getAccumulationClipByCode("A1121");
}

function findNewSnowAccumClip(low: number, high: number): AccumulationClip | null {
  const mid = (low + high) / 2;
  if (mid <= 0.5)  return getAccumulationClipByCode("A6011");
  if (mid <= 2)    return getAccumulationClipByCode("A6021");
  if (mid <= 4)    return getAccumulationClipByCode("A6031");
  if (mid <= 5)    return getAccumulationClipByCode("A6041");
  if (mid <= 6)    return getAccumulationClipByCode("A6043");
  if (mid <= 8)    return getAccumulationClipByCode("A6051");
  if (mid <= 12)   return getAccumulationClipByCode("A6053");
  return getAccumulationClipByCode("A6061");
}

function findIceAccumClip(lowText: string, highText: string | undefined): AccumulationClip | null {
  // Parse fractional amounts like "one quarter", "one half", "three quarters"
  const parseFrac = (s: string): number => {
    if (!s) return 0;
    if (/one quarter|1\/4/i.test(s)) return 0.25;
    if (/one half|1\/2/i.test(s)) return 0.5;
    if (/three quarter|3\/4/i.test(s)) return 0.75;
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };
  const low = parseFrac(lowText);
  const high = highText ? parseFrac(highText) : low;
  const mid = (low + high) / 2;

  if (mid <= 0.1)   return getAccumulationClipByCode("A2011");
  if (mid <= 0.25)  return getAccumulationClipByCode("A2021");
  if (mid <= 0.5)   return getAccumulationClipByCode("A2033");
  if (mid <= 0.75)  return getAccumulationClipByCode("A2043");
  if (mid <= 1.0)   return getAccumulationClipByCode("A2053");
  if (mid <= 1.5)   return getAccumulationClipByCode("A2063");
  if (mid <= 2.0)   return getAccumulationClipByCode("A2073");
  return getAccumulationClipByCode("A2083");
}

function findSleetAccumClip(low: number, high: number): AccumulationClip | null {
  const mid = (low + high) / 2;
  if (mid <= 0.5)  return getAccumulationClipByCode("A3011");
  if (mid <= 2)    return getAccumulationClipByCode("A3023");
  if (mid <= 4)    return getAccumulationClipByCode("A3033");
  if (mid <= 5)    return getAccumulationClipByCode("A3043");
  if (mid <= 6)    return getAccumulationClipByCode("A3053");
  if (mid <= 8)    return getAccumulationClipByCode("A3063");
  if (mid <= 12)   return getAccumulationClipByCode("A3073");
  return getAccumulationClipByCode("A3083");
}
