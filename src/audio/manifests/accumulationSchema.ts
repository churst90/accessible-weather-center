/**
 * Accumulation narration schema — maps precipitation accumulation codes
 * to Jim Cantore's Wx_Phrases_Accumulation/ clips.
 *
 * The IntelliStar accumulation system uses A-series codes:
 *   A{type}{amount}{variant}.mp3
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
 * Allan Jackson has his own, differently-encoded set — see AJ_ACCUM_* below.
 * His A-series is NOT interchangeable with Jim Cantore's: A2xxx is snow AND
 * ice for Jackson but plain ice for Cantore, A3xxx is wet snow rather than
 * sleet, and the amount ladders differ rung for rung. Reading one table with
 * the other's key is how "he has no accumulation clips" survived as long as
 * it did.
 */

import type { ClipConfidence } from "./clipSchema";
import { JC_VOCALLOCAL_BASE, AJ_VOCALLOCAL_BASE } from "./narratorSchema";
import type { NarratorId } from "./narratorSchema";

const JC_ACCUM_DIR = `${JC_VOCALLOCAL_BASE}/Wx_Phrases_Accumulation`;

/**
 * Allan Jackson's accumulation and rate clips share one directory with his
 * precip-probability set rather than living in an Accumulation folder of
 * their own, which is why they read as absent for so long.
 */
const AJ_ACCUM_DIR = `${AJ_VOCALLOCAL_BASE}/Wx_Phrases_Precip`;

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
    src: `${JC_ACCUM_DIR}/${code}.mp3`,
    text: entry.text,
    confidence: entry.confidence,
  };
}

/**
 * Parse NWS detailed forecast text for accumulation amounts and return
 * matching accumulation clips. Extracts snow, ice, sleet, and rain
 * accumulation amounts from natural language.
 *
 * Jackson and Cantore each have a recorded set; the other narrators do not.
 * The two libraries use incompatible encodings, so each gets its own matcher.
 */
export function getAccumulationClips(detailedForecast: string, narratorId: NarratorId): AccumulationClip[] {
  if (!detailedForecast) return [];
  if (narratorId === "allan-jackson") return getAjAccumulationClips(detailedForecast);
  if (narratorId !== "jim-cantore") return [];

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

// ────────────────────────────────────────────────────────────────────────────
//  Allan Jackson accumulation + rate clips
// ────────────────────────────────────────────────────────────────────────────

/**
 * Jackson's ladders, transcribed from the recordings themselves rather than
 * inferred from Cantore's encoding. Each rung carries the span it names so a
 * forecast amount can be matched to the nearest recorded phrase instead of
 * being bucketed by a hand-written if-chain that has to be re-derived every
 * time a rung is added.
 */
interface AjRange {
  code: string;
  /** Inclusive span the recording names, in inches. */
  lo: number;
  hi: number;
  text: string;
}

/** "snow accumulating N to N inches" — A1xxx. */
const AJ_SNOW: AjRange[] = [
  { code: "A1011", lo: 0,  hi: 0.9, text: "snow accumulations less than one inch" },
  { code: "A1021", lo: 1,  hi: 1,   text: "about an inch of snow" },
  { code: "A1031", lo: 1,  hi: 2,   text: "snow accumulating 1 to 2 inches" },
  { code: "A1041", lo: 1,  hi: 3,   text: "snow accumulating 1 to 3 inches" },
  { code: "A1051", lo: 2,  hi: 4,   text: "snow accumulating 2 to 4 inches" },
  { code: "A1061", lo: 3,  hi: 5,   text: "snow accumulating 3 to 5 inches" },
  { code: "A1071", lo: 4,  hi: 6,   text: "snow accumulating 4 to 6 inches" },
  { code: "A1081", lo: 5,  hi: 8,   text: "snow accumulating 5 to 8 inches" },
  { code: "A1091", lo: 6,  hi: 10,  text: "snow accumulating 6 to 10 inches" },
  { code: "A1101", lo: 8,  hi: 12,  text: "snow accumulating 8 to 12 inches" },
  { code: "A1111", lo: 10, hi: 15,  text: "snow accumulating 10 to 15 inches" },
  { code: "A1121", lo: 12, hi: 99,  text: "snow accumulation of a foot or more" },
];

/** "snow and ice accumulation of N to N inches" — A2xxx. */
const AJ_SNOW_AND_ICE: AjRange[] = [
  { code: "A2011", lo: 0, hi: 0.9, text: "snow and ice accumulations less than one inch" },
  { code: "A2021", lo: 1, hi: 1,   text: "snow and ice accumulating around 1 inch" },
  { code: "A2031", lo: 1, hi: 3,   text: "snow and ice accumulation of 1 to 3 inches" },
  { code: "A2041", lo: 2, hi: 4,   text: "snow and ice accumulation of 2 to 4 inches" },
  { code: "A2051", lo: 3, hi: 6,   text: "snow and ice accumulation of 3 to 6 inches" },
  { code: "A2061", lo: 4, hi: 8,   text: "snow and ice accumulation of 4 to 8 inches" },
  { code: "A2071", lo: 8, hi: 12,  text: "snow and ice accumulation of 8 to 12 inches" },
];

/** Wet / slushy snow — A3xxx. Selected when the text says so explicitly. */
const AJ_WET_SNOW: AjRange[] = [
  { code: "A3011", lo: 0, hi: 0.9, text: "a slushy accumulation less than one inch" },
  { code: "A3021", lo: 1, hi: 1,   text: "wet snow accumulating up to one inch" },
  { code: "A3031", lo: 2, hi: 2,   text: "wet snow accumulating up to 2 inches" },
  { code: "A3041", lo: 1, hi: 3,   text: "wet snow accumulation of 1 to 3 inches" },
  { code: "A3051", lo: 2, hi: 4,   text: "wet snow accumulation of 2 to 4 inches" },
  { code: "A3061", lo: 3, hi: 6,   text: "wet snow accumulation of 3 to 6 inches" },
  { code: "A3071", lo: 4, hi: 8,   text: "wet snow accumulation of 4 to 8 inches" },
  { code: "A3081", lo: 8, hi: 12,  text: "wet snow accumulation of 8 to 12 inches" },
];

/** Rainfall amounts — A6xxx. Spans are in inches of rain, not snow. */
const AJ_RAINFALL: AjRange[] = [
  { code: "A6021", lo: 0.25, hi: 0.25, text: "rainfall around a quarter of an inch" },
  { code: "A6031", lo: 0.5,  hi: 0.5,  text: "rainfall around a half an inch" },
  { code: "A6041", lo: 1,    hi: 1,    text: "rainfall may reach one inch" },
  { code: "A6051", lo: 1,    hi: 2,    text: "1 to 2 inches of rain expected" },
  { code: "A6052", lo: 2,    hi: 99,   text: "rainfall possibly over 2 inches" },
];

const AJ_ALL_RANGES = [...AJ_SNOW, ...AJ_SNOW_AND_ICE, ...AJ_WET_SNOW, ...AJ_RAINFALL];

/** Qualitative clips, keyed by code rather than by amount. */
const AJ_STANDALONE: Record<string, string> = {
  A4011: "some ice accumulation possible",
  A4021: "significant ice accumulation possible",
  A5011: "some icing possible",
  A5021: "significant icing possible",
  A7011: "higher amounts possible in some storms",
  A7013: "locally heavier amounts possible",
  R8011: "snowfall rates may reach one inch per hour at times",
  R8012: "snowfall rates approaching 1 to 2 inches per hour at times",
  R8021: "rainfall rates may reach 1 inch per hour at times",
  R8022: "rainfall rates approaching 1 to 2 inches per hour at times",
};

function ajClip(code: string, text: string): AccumulationClip {
  return { src: `${AJ_ACCUM_DIR}/${code}.mp3`, text, confidence: "likely" };
}

function ajStandalone(code: string): AccumulationClip | null {
  const text = AJ_STANDALONE[code];
  return text ? ajClip(code, text) : null;
}

/**
 * Pick the recorded span whose own midpoint sits closest to the forecast
 * amount. Ties break toward the narrower span, so "1 to 3 inches" is
 * preferred over "1 to 15 inches" when both are equidistant.
 */
function nearestAjRange(ranges: AjRange[], low: number, high: number): AccumulationClip | null {
  const mid = (low + high) / 2;
  let best: AjRange | null = null;
  let bestScore = Infinity;
  for (const r of ranges) {
    const score = Math.abs((r.lo + r.hi) / 2 - mid);
    const width = r.hi - r.lo;
    const bestWidth = best ? best.hi - best.lo : Infinity;
    if (score < bestScore || (score === bestScore && width < bestWidth)) {
      best = r;
      bestScore = score;
    }
  }
  return best ? ajClip(best.code, best.text) : null;
}

/** Words NWS uses for sub-inch amounts, plus plain decimals. */
function parseInches(s: string): number | null {
  if (!s) return null;
  const t = s.toLowerCase().trim();
  if (/^(a |one )?tenth/.test(t)) return 0.1;
  if (/^(a |one )?quarter/.test(t)) return 0.25;
  if (/^(a |one )?third/.test(t)) return 0.33;
  if (/^(a |one )?half/.test(t)) return 0.5;
  if (/three.quarter/.test(t)) return 0.75;
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15,
  };
  if (words[t] != null) return words[t];
  const n = parseFloat(t);
  return Number.isNaN(n) ? null : n;
}

const AMOUNT = "(\\d+(?:\\.\\d+)?|a tenth|one tenth|a quarter|one quarter|a third|a half|one half|three quarters|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen)";

/**
 * Accumulation narration for Allan Jackson.
 *
 * Kept separate from the Cantore matcher rather than generalised: the two
 * libraries disagree on what each type prefix means, so a shared matcher
 * would have to branch on narrator at every lookup anyway, and the failure
 * mode of getting it wrong is silent — the wrong amount, confidently spoken.
 */
function getAjAccumulationClips(detailedForecast: string): AccumulationClip[] {
  const text = detailedForecast.toLowerCase();
  const clips: AccumulationClip[] = [];

  const isWet = /wet snow|slushy|slush/.test(text);
  const isMixed = /snow and ice|ice and snow|wintry mix|mixed precipitation/.test(text);
  const snowTable = isWet ? AJ_WET_SNOW : isMixed ? AJ_SNOW_AND_ICE : AJ_SNOW;

  // Snow, as a range or a single amount.
  const snowRange = text.match(new RegExp(`snow(?:fall)?\\s+accumulations?\\s+(?:of\\s+)?(?:around\\s+)?${AMOUNT}\\s+to\\s+${AMOUNT}\\s+inch`, "i"))
    ?? text.match(new RegExp(`${AMOUNT}\\s+to\\s+${AMOUNT}\\s+inches\\s+of\\s+(?:wet\\s+)?snow`, "i"));
  const snowSingle = text.match(new RegExp(`snow(?:fall)?\\s+accumulations?\\s+(?:of\\s+)?(?:around|about|near|up to)\\s+${AMOUNT}\\s+inch`, "i"));

  if (snowRange) {
    const lo = parseInches(snowRange[1]);
    const hi = parseInches(snowRange[2]);
    if (lo != null && hi != null) {
      const clip = nearestAjRange(snowTable, lo, hi);
      if (clip) clips.push(clip);
    }
  } else if (snowSingle) {
    const v = parseInches(snowSingle[1]);
    if (v != null) {
      const clip = nearestAjRange(snowTable, v, v);
      if (clip) clips.push(clip);
    }
  } else if (/(?:less than (?:an|one|1) inch|dusting)/.test(text) && /snow/.test(text)) {
    clips.push(ajClip(isWet ? "A3011" : "A1011", isWet
      ? "a slushy accumulation less than one inch"
      : "snow accumulations less than one inch"));
  } else if (/(?:a )?foot or more of snow|over a foot of snow/.test(text)) {
    clips.push(ajClip("A1121", "snow accumulation of a foot or more"));
  }

  // Ice, which Jackson recorded qualitatively rather than by amount.
  if (/ice accumulation|freezing rain|glaze of ice/.test(text)) {
    const iceAmt = text.match(new RegExp(`ice accumulations?\\s+(?:of\\s+)?(?:around\\s+|up to\\s+)?${AMOUNT}`, "i"));
    const inches = iceAmt ? parseInches(iceAmt[1]) : null;
    const significant = (inches != null && inches >= 0.25) || /significant|damaging|heavy ice/.test(text);
    const clip = ajStandalone(significant ? "A4021" : "A4011");
    if (clip) clips.push(clip);
  } else if (/icing/.test(text)) {
    const clip = ajStandalone(/significant|heavy/.test(text) ? "A5021" : "A5011");
    if (clip) clips.push(clip);
  }

  // Rainfall amounts.
  const rainRange = text.match(new RegExp(`rainfall amounts?\\s+(?:of\\s+)?between\\s+${AMOUNT}\\s+and\\s+${AMOUNT}`, "i"));
  const rainSingle = text.match(new RegExp(`(?:rainfall amounts?|new rainfall)\\s+(?:of\\s+)?(?:around|near|about|up to)?\\s*${AMOUNT}\\s*(?:of an\\s+)?inch`, "i"));
  if (rainRange) {
    const lo = parseInches(rainRange[1]);
    const hi = parseInches(rainRange[2]);
    if (lo != null && hi != null) {
      const clip = nearestAjRange(AJ_RAINFALL, lo, hi);
      if (clip) clips.push(clip);
    }
  } else if (rainSingle) {
    const v = parseInches(rainSingle[1]);
    if (v != null) {
      const clip = nearestAjRange(AJ_RAINFALL, v, v);
      if (clip) clips.push(clip);
    }
  }

  // Rates and the "locally heavier" tail, both of which ride on top.
  if (/snowfall rates?/.test(text)) {
    const clip = ajStandalone(/two inches|2 inches|1 to 2/.test(text) ? "R8012" : "R8011");
    if (clip) clips.push(clip);
  }
  if (/rainfall rates?/.test(text)) {
    const clip = ajStandalone(/two inches|2 inches|1 to 2/.test(text) ? "R8022" : "R8021");
    if (clip) clips.push(clip);
  }
  if (/locally heav|higher amounts/.test(text)) {
    const clip = ajStandalone(/in some storms/.test(text) ? "A7011" : "A7013");
    if (clip) clips.push(clip);
  }

  return clips;
}

/** Exposed for the sweep and for tests that assert AJ coverage. */
export const AJ_ACCUMULATION_CODES: string[] = [
  ...AJ_ALL_RANGES.map((r) => r.code),
  ...Object.keys(AJ_STANDALONE),
];
