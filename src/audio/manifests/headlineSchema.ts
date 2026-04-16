/**
 * Headline narration schema — maps NWS alert data to pre-recorded clips.
 *
 * Two narrator systems:
 *
 * 1. JC (Jim Cantore): VTEC phenomenon+significance codes.
 *    Headline_Event_Phrases/{phenomenon}_{significance}.wav
 *    e.g. TO_W.wav = "Tornado Warning"
 *
 * 2. AJ (Allan Jackson): NWS AWIPS product code + sequence numbers,
 *    split across grammatical-variant directories:
 *      Headline_Event/{code}.wav        — bare event name
 *      Headline_A_Event/{code}A.wav     — "A [event]"
 *      Headline_A_Event2/{code}A2.wav   — "A [event]" (variant 2)
 *      Headline_The_Event/{code}B.wav   — "The [event]"
 *      Headline_And_Event/{code}C.wav   — "and a [event]"
 *      Headline_Action/{letter}.wav     — action/status phrases
 *      Headline_Misc/                   — connectors
 *
 * The headline composer parses alert.event text, matches to VTEC codes
 * or NWS product codes, and builds a spoken headline from clips.
 */

import type { ClipConfidence } from "./clipSchema";
import { AJ_VOCALLOCAL_BASE, JC_VOCALLOCAL_BASE } from "./narratorSchema";
import type { NarratorId } from "./narratorSchema";

export interface HeadlineClip {
  src: string;
  text: string;
  confidence: ClipConfidence;
}

// ────────────────────────────────────────────────────────────────────────────
//  JC — VTEC phenomenon + significance → clip
// ────────────────────────────────────────────────────────────────────────────

interface VtecEntry {
  phenomenon: string;
  significance: string;
  text: string;
  confidence: ClipConfidence;
}

const JC_HEADLINE_DIR = `${JC_VOCALLOCAL_BASE}/Headline_Event_Phrases`;

/**
 * Every clip in Jim Cantore's Headline_Event_Phrases/ directory, transcribed
 * from standard NWS VTEC phenomenon + significance codes.
 *
 * File naming: {phenomenon}_{significance}.wav
 * Significance: W = Warning, A = Watch, Y = Advisory
 */
const JC_VTEC_HEADLINES: VtecEntry[] = [
  // ── Tornado / Severe ──
  { phenomenon: "TO", significance: "W", text: "Tornado Warning",                          confidence: "likely" },
  { phenomenon: "TO", significance: "A", text: "Tornado Watch",                            confidence: "likely" },
  { phenomenon: "SV", significance: "A", text: "Severe Thunderstorm Watch",                confidence: "likely" },

  // ── Hurricane / Tropical ──
  { phenomenon: "HU", significance: "W", text: "Hurricane Warning",                        confidence: "likely" },
  { phenomenon: "HU", significance: "A", text: "Hurricane Watch",                          confidence: "likely" },
  { phenomenon: "TR", significance: "W", text: "Tropical Storm Warning",                   confidence: "likely" },
  { phenomenon: "TR", significance: "A", text: "Tropical Storm Watch",                     confidence: "likely" },
  { phenomenon: "TI", significance: "W", text: "Inland Tropical Storm Warning",            confidence: "likely" },
  { phenomenon: "TI", significance: "A", text: "Inland Tropical Storm Watch",              confidence: "likely" },
  { phenomenon: "TY", significance: "W", text: "Typhoon Warning",                          confidence: "likely" },
  { phenomenon: "TY", significance: "A", text: "Typhoon Watch",                            confidence: "likely" },
  { phenomenon: "HI", significance: "W", text: "Inland Hurricane Warning",                 confidence: "likely" },
  { phenomenon: "HI", significance: "A", text: "Inland Hurricane Watch",                   confidence: "likely" },
  { phenomenon: "HF", significance: "W", text: "Hurricane Force Wind Warning",             confidence: "likely" },
  { phenomenon: "HF", significance: "A", text: "Hurricane Force Wind Watch",               confidence: "likely" },

  // ── Winter ──
  { phenomenon: "WS", significance: "W", text: "Winter Storm Warning",                     confidence: "likely" },
  { phenomenon: "WS", significance: "A", text: "Winter Storm Watch",                       confidence: "likely" },
  { phenomenon: "WW", significance: "Y", text: "Winter Weather Advisory",                  confidence: "likely" },
  { phenomenon: "BZ", significance: "W", text: "Blizzard Warning",                         confidence: "likely" },
  { phenomenon: "BZ", significance: "A", text: "Blizzard Watch",                           confidence: "likely" },
  { phenomenon: "IS", significance: "W", text: "Ice Storm Warning",                        confidence: "likely" },
  { phenomenon: "LE", significance: "W", text: "Lake Effect Snow Warning",                 confidence: "likely" },
  { phenomenon: "LE", significance: "A", text: "Lake Effect Snow Watch",                   confidence: "likely" },
  { phenomenon: "LE", significance: "Y", text: "Lake Effect Snow Advisory",                confidence: "likely" },
  { phenomenon: "LB", significance: "Y", text: "Lake Effect Snow and Blowing Snow Advisory", confidence: "likely" },
  { phenomenon: "ZR", significance: "Y", text: "Freezing Rain Advisory",                   confidence: "likely" },
  { phenomenon: "ZF", significance: "Y", text: "Freezing Fog Advisory",                    confidence: "likely" },

  // ── Wind ──
  { phenomenon: "HW", significance: "W", text: "High Wind Warning",                        confidence: "likely" },
  { phenomenon: "HW", significance: "A", text: "High Wind Watch",                          confidence: "likely" },
  { phenomenon: "WI", significance: "Y", text: "Wind Advisory",                            confidence: "likely" },
  { phenomenon: "WC", significance: "W", text: "Wind Chill Warning",                       confidence: "likely" },
  { phenomenon: "WC", significance: "A", text: "Wind Chill Watch",                         confidence: "likely" },
  { phenomenon: "WC", significance: "Y", text: "Wind Chill Advisory",                      confidence: "likely" },
  { phenomenon: "LW", significance: "Y", text: "Lake Wind Advisory",                       confidence: "likely" },

  // ── Heat / Cold ──
  { phenomenon: "EH", significance: "W", text: "Excessive Heat Warning",                   confidence: "likely" },
  { phenomenon: "EH", significance: "A", text: "Excessive Heat Watch",                     confidence: "likely" },
  { phenomenon: "HT", significance: "Y", text: "Heat Advisory",                            confidence: "likely" },
  { phenomenon: "EC", significance: "W", text: "Extreme Cold Warning",                     confidence: "likely" },
  { phenomenon: "EC", significance: "A", text: "Extreme Cold Watch",                       confidence: "likely" },
  { phenomenon: "FZ", significance: "W", text: "Freeze Warning",                           confidence: "likely" },
  { phenomenon: "FZ", significance: "A", text: "Freeze Watch",                             confidence: "likely" },
  { phenomenon: "HZ", significance: "W", text: "Hard Freeze Warning",                      confidence: "likely" },
  { phenomenon: "HZ", significance: "A", text: "Hard Freeze Watch",                        confidence: "likely" },
  { phenomenon: "FR", significance: "Y", text: "Frost Advisory",                           confidence: "likely" },

  // ── Flood ──
  { phenomenon: "FF", significance: "A", text: "Flash Flood Watch",                        confidence: "likely" },
  { phenomenon: "FA", significance: "A", text: "Flood Watch",                              confidence: "likely" },
  { phenomenon: "FA", significance: "Y", text: "Flood Advisory",                           confidence: "likely" },
  { phenomenon: "CF", significance: "W", text: "Coastal Flood Warning",                    confidence: "likely" },
  { phenomenon: "CF", significance: "A", text: "Coastal Flood Watch",                      confidence: "likely" },
  { phenomenon: "LS", significance: "W", text: "Lakeshore Flood Warning",                  confidence: "likely" },
  { phenomenon: "LS", significance: "A", text: "Lakeshore Flood Watch",                    confidence: "likely" },
  { phenomenon: "LS", significance: "Y", text: "Lakeshore Flood Advisory",                 confidence: "likely" },

  // ── Marine ──
  { phenomenon: "GL", significance: "W", text: "Gale Warning",                             confidence: "likely" },
  { phenomenon: "GL", significance: "A", text: "Gale Watch",                               confidence: "likely" },
  { phenomenon: "SC", significance: "Y", text: "Small Craft Advisory",                     confidence: "likely" },
  { phenomenon: "SE", significance: "W", text: "Hazardous Seas Warning",                   confidence: "likely" },
  { phenomenon: "SR", significance: "W", text: "Storm Warning",                            confidence: "likely" },
  { phenomenon: "SR", significance: "A", text: "Storm Watch",                              confidence: "likely" },
  { phenomenon: "SU", significance: "W", text: "High Surf Warning",                        confidence: "likely" },
  { phenomenon: "SU", significance: "Y", text: "High Surf Advisory",                       confidence: "likely" },
  { phenomenon: "UP", significance: "W", text: "Heavy Freezing Spray Warning",             confidence: "likely" },
  { phenomenon: "UP", significance: "A", text: "Heavy Freezing Spray Watch",               confidence: "likely" },
  { phenomenon: "UP", significance: "Y", text: "Heavy Freezing Spray Advisory",            confidence: "likely" },

  // ── Fog / Smoke / Dust ──
  { phenomenon: "FG", significance: "Y", text: "Dense Fog Advisory",                       confidence: "likely" },
  { phenomenon: "SM", significance: "Y", text: "Dense Smoke Advisory",                     confidence: "likely" },
  { phenomenon: "MF", significance: "Y", text: "Marine Dense Fog Advisory",                confidence: "likely" },
  { phenomenon: "MS", significance: "Y", text: "Marine Dense Smoke Advisory",              confidence: "likely" },
  { phenomenon: "DU", significance: "Y", text: "Blowing Dust Advisory",                    confidence: "likely" },
  { phenomenon: "DS", significance: "W", text: "Dust Storm Warning",                       confidence: "likely" },

  // ── Other ──
  { phenomenon: "AF", significance: "W", text: "Ashfall Warning",                          confidence: "likely" },
  { phenomenon: "AF", significance: "Y", text: "Ashfall Advisory",                         confidence: "likely" },
  { phenomenon: "AS", significance: "Y", text: "Air Stagnation Advisory",                  confidence: "likely" },
  { phenomenon: "LO", significance: "Y", text: "Low Water Advisory",                       confidence: "likely" },

  // ── Weatherscan-specific (not standard NWS VTEC) ──
  { phenomenon: "TAV", significance: "W", text: "Avalanche Warning",                       confidence: "guess" },
  { phenomenon: "TAV", significance: "A", text: "Avalanche Watch",                         confidence: "guess" },
];

const JC_VTEC_MAP = new Map<string, VtecEntry>();
for (const e of JC_VTEC_HEADLINES) {
  JC_VTEC_MAP.set(`${e.phenomenon}_${e.significance}`, e);
}

/**
 * Get a JC headline event clip by VTEC phenomenon + significance.
 */
export function getJcHeadlineClip(phenomenon: string, significance: string): HeadlineClip | null {
  const key = `${phenomenon}_${significance}`;
  const entry = JC_VTEC_MAP.get(key);
  if (!entry) return null;
  return {
    src: `${JC_HEADLINE_DIR}/${key}.wav`,
    text: entry.text,
    confidence: entry.confidence,
  };
}

// ────────────────────────────────────────────────────────────────────────────
//  AJ — NWS AWIPS product code + sequence → clip
// ────────────────────────────────────────────────────────────────────────────

/**
 * IntelliStar/Weatherscan headline system for Allan Jackson.
 *
 * Each headline event is identified by an AWIPS product code (NPW, WSW, CFW,
 * etc.) and a numeric sequence index. The system supports 5 grammatical
 * variants of each event name stored in separate directories:
 *
 *   Headline_Event/NPW005.wav      → "Wind Chill Warning"
 *   Headline_A_Event/NPW005A.wav   → "A Wind Chill Warning"
 *   Headline_A_Event2/NPW005A2.wav → "A Wind Chill Warning" (variant take)
 *   Headline_The_Event/NPW005B.wav → "The Wind Chill Warning"
 *   Headline_And_Event/NPW005C.wav → "and a Wind Chill Warning"
 */

interface AjHeadlineEntry {
  /** AWIPS product code + sequence, e.g., "NPW005" */
  code: string;
  text: string;
  confidence: ClipConfidence;
}

const AJ_HL_BASE = `${AJ_VOCALLOCAL_BASE}`;

// NPW = Non-Precipitation Watches/Warnings/Advisories
// WSW = Winter Storm Watches/Warnings
// CFW = Coastal Flood Watches/Warnings
// CWF = Coastal Waters Forecast
// FFS = Flash Flood Statement
// FLS = Flood Statement
// FLW = Flood Warning
// LSH = Lakeshore Hazard
// SLS = Severe Local Storms
// ZFP = Zone Forecast Product

const AJ_HEADLINE_EVENTS: AjHeadlineEntry[] = [
  // ── NPW: Non-Precipitation Weather ──
  { code: "NPW005", text: "Wind Chill Warning",                     confidence: "likely" },
  { code: "NPW006", text: "Wind Chill Advisory",                    confidence: "likely" },
  { code: "NPW013", text: "Excessive Heat Warning",                 confidence: "likely" },
  { code: "NPW014", text: "Excessive Heat Watch",                   confidence: "likely" },
  { code: "NPW015", text: "Heat Advisory",                          confidence: "likely" },
  { code: "NPW020", text: "Red Flag Warning",                       confidence: "likely" },
  { code: "NPW021", text: "Fire Weather Watch",                     confidence: "likely" },
  { code: "NPW024", text: "Dense Fog Advisory",                     confidence: "likely" },
  { code: "NPW027", text: "Freeze Warning",                         confidence: "likely" },
  { code: "NPW030", text: "Frost Advisory",                         confidence: "likely" },
  { code: "NPW035", text: "High Wind Warning",                      confidence: "likely" },
  { code: "NPW036", text: "High Wind Watch",                        confidence: "likely" },
  { code: "NPW042", text: "Wind Advisory",                          confidence: "likely" },
  { code: "NPW043", text: "Lake Wind Advisory",                     confidence: "likely" },
  { code: "NPW046", text: "Dense Smoke Advisory",                   confidence: "likely" },
  { code: "NPW049", text: "Blowing Dust Advisory",                  confidence: "likely" },
  { code: "NPW052", text: "Dust Storm Warning",                     confidence: "likely" },
  { code: "NPW055", text: "Hard Freeze Warning",                    confidence: "likely" },
  { code: "NPW064", text: "Extreme Cold Warning",                   confidence: "likely" },
  { code: "NPW067", text: "Extreme Cold Watch",                     confidence: "likely" },
  { code: "NPW070", text: "Freeze Watch",                           confidence: "likely" },
  { code: "NPW073", text: "Hard Freeze Watch",                      confidence: "likely" },
  { code: "NPW076", text: "Air Stagnation Advisory",                confidence: "likely" },
  { code: "NPW079", text: "Ashfall Advisory",                       confidence: "likely" },
  { code: "NPW082", text: "Freezing Fog Advisory",                  confidence: "likely" },
  { code: "NPW085", text: "Low Water Advisory",                     confidence: "likely" },
  { code: "NPW088", text: "Brisk Wind Advisory",                    confidence: "guess" },
  { code: "NPW091", text: "Special Weather Statement",              confidence: "guess" },
  { code: "NPW500", text: "Weather Advisory",                       confidence: "guess" },
  { code: "NPW520", text: "Weather Warning",                        confidence: "guess" },

  // ── WSW: Winter Storm ──
  { code: "WSW005", text: "Winter Storm Warning",                   confidence: "likely" },
  { code: "WSW006", text: "Winter Storm Watch",                     confidence: "likely" },
  { code: "WSW007", text: "Winter Weather Advisory",                confidence: "likely" },
  { code: "WSW018", text: "Blizzard Warning",                       confidence: "likely" },
  { code: "WSW019", text: "Blizzard Watch",                         confidence: "likely" },
  { code: "WSW020", text: "Ice Storm Warning",                      confidence: "likely" },
  { code: "WSW021", text: "Ice Storm Watch",                        confidence: "guess" },
  { code: "WSW022", text: "Lake Effect Snow Warning",               confidence: "likely" },
  { code: "WSW025", text: "Lake Effect Snow Watch",                 confidence: "likely" },
  { code: "WSW028", text: "Lake Effect Snow Advisory",              confidence: "likely" },
  { code: "WSW031", text: "Lake Effect Snow and Blowing Snow Advisory", confidence: "likely" },
  { code: "WSW036", text: "Wind Chill Warning",                     confidence: "likely" },
  { code: "WSW037", text: "Wind Chill Watch",                       confidence: "likely" },
  { code: "WSW040", text: "Avalanche Warning",                      confidence: "likely" },
  { code: "WSW043", text: "Avalanche Watch",                        confidence: "likely" },
  { code: "WSW047", text: "Winter Weather Advisory",                confidence: "guess" },
  { code: "WSW050", text: "Freezing Rain Advisory",                 confidence: "likely" },
  { code: "WSW053", text: "Snow Advisory",                          confidence: "guess" },
  { code: "WSW056", text: "Blowing Snow Advisory",                  confidence: "guess" },
  { code: "WSW059", text: "Sleet Advisory",                         confidence: "guess" },
  { code: "WSW062", text: "Heavy Snow Warning",                     confidence: "guess" },
  { code: "WSW065", text: "Snow Squall Warning",                    confidence: "guess" },
  { code: "WSW068", text: "Lake Effect Snow and Blowing Snow Advisory", confidence: "guess" },
  { code: "WSW071", text: "Freezing Spray Advisory",                confidence: "guess" },
  { code: "WSW500", text: "Winter Weather Warning",                 confidence: "guess" },
  { code: "WSW510", text: "Winter Weather Watch",                   confidence: "guess" },

  // ── CFW: Coastal Flood ──
  { code: "CFW005", text: "Coastal Flood Warning",                  confidence: "likely" },
  { code: "CFW006", text: "Coastal Flood Watch",                    confidence: "likely" },

  // ── CWF: Coastal Waters ──
  { code: "CWF046", text: "Gale Warning",                           confidence: "guess" },
  { code: "CWF500", text: "Small Craft Advisory",                   confidence: "guess" },
  { code: "CWF520", text: "Hazardous Seas Warning",                 confidence: "guess" },

  // ── FFS/FLS/FLW: Flood products ──
  { code: "FFS007", text: "Flash Flood Warning",                    confidence: "likely" },
  { code: "FFS008", text: "Flash Flood Watch",                      confidence: "likely" },
  { code: "FFS009", text: "Flash Flood Statement",                  confidence: "likely" },
  { code: "FLS007", text: "Flood Warning",                          confidence: "likely" },
  { code: "FLS008", text: "Flood Watch",                            confidence: "likely" },
  { code: "FLW001", text: "Flood Warning",                          confidence: "likely" },

  // ── LSH: Lakeshore ──
  { code: "LSH005", text: "Lakeshore Flood Warning",                confidence: "likely" },

  // ── SLS: Severe Local Storms ──
  { code: "SLS001", text: "Severe Thunderstorm Warning",            confidence: "likely" },
  { code: "SLS002", text: "Tornado Warning",                        confidence: "likely" },

  // ── ZFP: Zone Forecast Product headlines ──
  { code: "ZFP005", text: "Today's Forecast",                       confidence: "guess" },
  { code: "ZFP010", text: "Tonight's Forecast",                     confidence: "guess" },
  { code: "ZFP015", text: "Tomorrow's Forecast",                    confidence: "guess" },
  { code: "ZFP020", text: "Extended Forecast",                      confidence: "guess" },
  { code: "ZFP025", text: "Weekend Forecast",                       confidence: "guess" },

  // ── CWF special variants ──
  { code: "CWF510A", text: "Marine Weather Warning",                confidence: "guess" },
  { code: "CWF510B", text: "Marine Weather Advisory",               confidence: "guess" },

  // ── NPW special variants ──
  { code: "NPW510A", text: "Weather Warning",                       confidence: "guess" },
  { code: "NPW510B", text: "Weather Watch",                         confidence: "guess" },
  { code: "NPW510C", text: "Weather Advisory",                      confidence: "guess" },
  { code: "NPW530",  text: "Special Weather Statement",             confidence: "guess" },
];

const AJ_HEADLINE_MAP = new Map<string, AjHeadlineEntry>();
for (const e of AJ_HEADLINE_EVENTS) AJ_HEADLINE_MAP.set(e.code, e);

/**
 * AJ Headline_Action clips. These are spoken action/status phrases that
 * describe what is happening with an alert. The IntelliStar system combined
 * these with event names to form complete headline sentences.
 *
 * Single-letter codes map to VTEC action/significance statuses.
 * Multi-character codes are special event types.
 */
interface ActionEntry {
  code: string;
  text: string;
  confidence: ClipConfidence;
}

const AJ_HEADLINE_ACTIONS: ActionEntry[] = [
  // VTEC-style action/status phrases
  { code: "A",  text: "is in effect",                               confidence: "likely" },
  { code: "B",  text: "has been issued",                            confidence: "likely" },
  { code: "C",  text: "continues",                                  confidence: "likely" },
  { code: "D",  text: "has been cancelled",                         confidence: "likely" },
  { code: "E",  text: "has expired",                                confidence: "likely" },
  { code: "F",  text: "is in effect for",                           confidence: "guess" },
  { code: "G",  text: "remains in effect",                          confidence: "guess" },
  { code: "H",  text: "has been extended",                          confidence: "guess" },
  { code: "I",  text: "has been issued for",                        confidence: "guess" },
  { code: "J",  text: "is in effect through",                       confidence: "guess" },
  { code: "K",  text: "has been upgraded to",                       confidence: "guess" },
  { code: "L",  text: "is no longer in effect",                     confidence: "guess" },
  { code: "N",  text: "has been issued by the National Weather Service", confidence: "guess" },
  { code: "O",  text: "is now in effect",                           confidence: "guess" },
  { code: "P",  text: "has been posted",                            confidence: "guess" },
  { code: "Q",  text: "will expire",                                confidence: "guess" },
  { code: "R",  text: "has been replaced",                          confidence: "guess" },
  { code: "S",  text: "is in effect until",                         confidence: "guess" },
  { code: "T",  text: "is in effect for your area",                 confidence: "guess" },
  { code: "U",  text: "has been updated",                           confidence: "guess" },
  { code: "X",  text: "has been downgraded",                        confidence: "guess" },
  // Compound action variants
  { code: "CF", text: "continues for",                              confidence: "guess" },
  { code: "CT", text: "continues through",                          confidence: "guess" },
  { code: "DF", text: "has been discontinued for",                  confidence: "guess" },
  { code: "DT", text: "has been discontinued through",              confidence: "guess" },
  { code: "RB", text: "has been replaced by",                       confidence: "guess" },
  { code: "RW", text: "remains in effect with",                     confidence: "guess" },
  { code: "UF", text: "has been updated for",                       confidence: "guess" },
  { code: "UT", text: "has been updated through",                   confidence: "guess" },
  // Named special types
  { code: "Multi",       text: "Multiple alerts are",               confidence: "guess" },
  { code: "AIR_QUALITY", text: "Air Quality Alert",                 confidence: "likely" },
  { code: "AVALANCHE",   text: "Avalanche Warning",                 confidence: "likely" },
  { code: "RIP_TIDE",    text: "Rip Current Statement",             confidence: "likely" },
];

const AJ_ACTION_MAP = new Map<string, ActionEntry>();
for (const e of AJ_HEADLINE_ACTIONS) AJ_ACTION_MAP.set(e.code, e);

/**
 * AJ Headline_Misc connectors and structural words.
 */
interface MiscEntry {
  code: string;
  text: string;
  confidence: ClipConfidence;
}

const AJ_HEADLINE_MISC: MiscEntry[] = [
  { code: "A",     text: "A",                                       confidence: "likely" },
  { code: "AND",   text: "and",                                     confidence: "likely" },
  { code: "ANDA",  text: "and a",                                   confidence: "likely" },
  { code: "ANDAN", text: "and an",                                  confidence: "likely" },
  { code: "BTNWS", text: "by the National Weather Service",         confidence: "likely" },
  { code: "NWS",   text: "National Weather Service",                confidence: "likely" },
  { code: "THE",   text: "the",                                     confidence: "likely" },
];

const AJ_MISC_MAP = new Map<string, MiscEntry>();
for (const e of AJ_HEADLINE_MISC) AJ_MISC_MAP.set(e.code, e);

// ────────────────────────────────────────────────────────────────────────────
//  NWS alert.event text → VTEC code mapping
// ────────────────────────────────────────────────────────────────────────────

/**
 * Maps NWS alert event strings (e.g., "Winter Storm Warning") to VTEC
 * phenomenon + significance codes. NWS APIs provide event text but not
 * always the raw VTEC line, so we reverse-map from the human-readable name.
 */
interface EventMapping {
  pattern: RegExp;
  phenomenon: string;
  significance: string;
}

const EVENT_TO_VTEC: EventMapping[] = [
  // Tornado / Severe (highest priority)
  { pattern: /^Tornado Warning$/i,                            phenomenon: "TO", significance: "W" },
  { pattern: /^Tornado Watch$/i,                              phenomenon: "TO", significance: "A" },
  { pattern: /^Severe Thunderstorm Warning$/i,                phenomenon: "SV", significance: "W" },
  { pattern: /^Severe Thunderstorm Watch$/i,                  phenomenon: "SV", significance: "A" },

  // Hurricane / Tropical
  { pattern: /^Hurricane Warning$/i,                          phenomenon: "HU", significance: "W" },
  { pattern: /^Hurricane Watch$/i,                            phenomenon: "HU", significance: "A" },
  { pattern: /^Tropical Storm Warning$/i,                     phenomenon: "TR", significance: "W" },
  { pattern: /^Tropical Storm Watch$/i,                       phenomenon: "TR", significance: "A" },
  { pattern: /^Inland Tropical Storm Warning$/i,              phenomenon: "TI", significance: "W" },
  { pattern: /^Inland Tropical Storm Watch$/i,                phenomenon: "TI", significance: "A" },
  { pattern: /^Typhoon Warning$/i,                            phenomenon: "TY", significance: "W" },
  { pattern: /^Typhoon Watch$/i,                              phenomenon: "TY", significance: "A" },
  { pattern: /^Inland Hurricane Warning$/i,                   phenomenon: "HI", significance: "W" },
  { pattern: /^Inland Hurricane Watch$/i,                     phenomenon: "HI", significance: "A" },
  { pattern: /^Hurricane Force Wind Warning$/i,               phenomenon: "HF", significance: "W" },
  { pattern: /^Hurricane Force Wind Watch$/i,                 phenomenon: "HF", significance: "A" },

  // Winter
  { pattern: /^Winter Storm Warning$/i,                       phenomenon: "WS", significance: "W" },
  { pattern: /^Winter Storm Watch$/i,                         phenomenon: "WS", significance: "A" },
  { pattern: /^Winter Weather Advisory$/i,                    phenomenon: "WW", significance: "Y" },
  { pattern: /^Blizzard Warning$/i,                           phenomenon: "BZ", significance: "W" },
  { pattern: /^Blizzard Watch$/i,                             phenomenon: "BZ", significance: "A" },
  { pattern: /^Ice Storm Warning$/i,                          phenomenon: "IS", significance: "W" },
  { pattern: /^Lake Effect Snow Warning$/i,                   phenomenon: "LE", significance: "W" },
  { pattern: /^Lake Effect Snow Watch$/i,                     phenomenon: "LE", significance: "A" },
  { pattern: /^Lake Effect Snow Advisory$/i,                  phenomenon: "LE", significance: "Y" },
  { pattern: /^Lake Effect Snow and Blowing Snow Advisory$/i, phenomenon: "LB", significance: "Y" },
  { pattern: /^Freezing Rain Advisory$/i,                     phenomenon: "ZR", significance: "Y" },
  { pattern: /^Freezing Fog Advisory$/i,                      phenomenon: "ZF", significance: "Y" },

  // Wind
  { pattern: /^High Wind Warning$/i,                          phenomenon: "HW", significance: "W" },
  { pattern: /^High Wind Watch$/i,                            phenomenon: "HW", significance: "A" },
  { pattern: /^Wind Advisory$/i,                              phenomenon: "WI", significance: "Y" },
  { pattern: /^Wind Chill Warning$/i,                         phenomenon: "WC", significance: "W" },
  { pattern: /^Wind Chill Watch$/i,                           phenomenon: "WC", significance: "A" },
  { pattern: /^Wind Chill Advisory$/i,                        phenomenon: "WC", significance: "Y" },
  { pattern: /^Lake Wind Advisory$/i,                         phenomenon: "LW", significance: "Y" },

  // Heat / Cold
  { pattern: /^Excessive Heat Warning$/i,                     phenomenon: "EH", significance: "W" },
  { pattern: /^Excessive Heat Watch$/i,                       phenomenon: "EH", significance: "A" },
  { pattern: /^Heat Advisory$/i,                              phenomenon: "HT", significance: "Y" },
  { pattern: /^Extreme Cold Warning$/i,                       phenomenon: "EC", significance: "W" },
  { pattern: /^Extreme Cold Watch$/i,                         phenomenon: "EC", significance: "A" },
  { pattern: /^Freeze Warning$/i,                             phenomenon: "FZ", significance: "W" },
  { pattern: /^Freeze Watch$/i,                               phenomenon: "FZ", significance: "A" },
  { pattern: /^Hard Freeze Warning$/i,                        phenomenon: "HZ", significance: "W" },
  { pattern: /^Hard Freeze Watch$/i,                          phenomenon: "HZ", significance: "A" },
  { pattern: /^Frost Advisory$/i,                             phenomenon: "FR", significance: "Y" },

  // Flood
  { pattern: /^Flash Flood Warning$/i,                        phenomenon: "FF", significance: "W" },
  { pattern: /^Flash Flood Watch$/i,                          phenomenon: "FF", significance: "A" },
  { pattern: /^Flash Flood Statement$/i,                      phenomenon: "FF", significance: "S" },
  { pattern: /^Flood Warning$/i,                              phenomenon: "FA", significance: "W" },
  { pattern: /^Flood Watch$/i,                                phenomenon: "FA", significance: "A" },
  { pattern: /^Flood Advisory$/i,                             phenomenon: "FA", significance: "Y" },
  { pattern: /^Coastal Flood Warning$/i,                      phenomenon: "CF", significance: "W" },
  { pattern: /^Coastal Flood Watch$/i,                        phenomenon: "CF", significance: "A" },
  { pattern: /^Coastal Flood Advisory$/i,                     phenomenon: "CF", significance: "Y" },
  { pattern: /^Lakeshore Flood Warning$/i,                    phenomenon: "LS", significance: "W" },
  { pattern: /^Lakeshore Flood Watch$/i,                      phenomenon: "LS", significance: "A" },
  { pattern: /^Lakeshore Flood Advisory$/i,                   phenomenon: "LS", significance: "Y" },

  // Marine
  { pattern: /^Gale Warning$/i,                               phenomenon: "GL", significance: "W" },
  { pattern: /^Gale Watch$/i,                                 phenomenon: "GL", significance: "A" },
  { pattern: /^Small Craft Advisory$/i,                       phenomenon: "SC", significance: "Y" },
  { pattern: /^Hazardous Seas Warning$/i,                     phenomenon: "SE", significance: "W" },
  { pattern: /^Storm Warning$/i,                              phenomenon: "SR", significance: "W" },
  { pattern: /^Storm Watch$/i,                                phenomenon: "SR", significance: "A" },
  { pattern: /^High Surf Warning$/i,                          phenomenon: "SU", significance: "W" },
  { pattern: /^High Surf Advisory$/i,                         phenomenon: "SU", significance: "Y" },
  { pattern: /^Heavy Freezing Spray Warning$/i,               phenomenon: "UP", significance: "W" },
  { pattern: /^Heavy Freezing Spray Watch$/i,                 phenomenon: "UP", significance: "A" },
  { pattern: /^Heavy Freezing Spray Advisory$/i,              phenomenon: "UP", significance: "Y" },
  { pattern: /^Rip Current Statement$/i,                      phenomenon: "RP", significance: "S" },

  // Fog / Smoke / Dust
  { pattern: /^Dense Fog Advisory$/i,                         phenomenon: "FG", significance: "Y" },
  { pattern: /^Dense Smoke Advisory$/i,                       phenomenon: "SM", significance: "Y" },
  { pattern: /^Blowing Dust Advisory$/i,                      phenomenon: "DU", significance: "Y" },
  { pattern: /^Dust Storm Warning$/i,                         phenomenon: "DS", significance: "W" },

  // Other
  { pattern: /^Ashfall Warning$/i,                            phenomenon: "AF", significance: "W" },
  { pattern: /^Ashfall Advisory$/i,                           phenomenon: "AF", significance: "Y" },
  { pattern: /^Air Stagnation Advisory$/i,                    phenomenon: "AS", significance: "Y" },
  { pattern: /^Low Water Advisory$/i,                         phenomenon: "LO", significance: "Y" },
  { pattern: /^Avalanche Warning$/i,                          phenomenon: "TAV", significance: "W" },
  { pattern: /^Avalanche Watch$/i,                            phenomenon: "TAV", significance: "A" },
  { pattern: /^Red Flag Warning$/i,                           phenomenon: "FW", significance: "W" },
  { pattern: /^Fire Weather Watch$/i,                         phenomenon: "FW", significance: "A" },
  { pattern: /^Air Quality Alert$/i,                          phenomenon: "AQ", significance: "Y" },
  { pattern: /^Snow Squall Warning$/i,                        phenomenon: "SQ", significance: "W" },

  // Fuzzy fallbacks — match partial text when exact match fails
  { pattern: /tornado/i,                                      phenomenon: "TO", significance: "W" },
  { pattern: /hurricane.*warning/i,                           phenomenon: "HU", significance: "W" },
  { pattern: /hurricane.*watch/i,                             phenomenon: "HU", significance: "A" },
  { pattern: /tropical storm.*warning/i,                      phenomenon: "TR", significance: "W" },
  { pattern: /tropical storm.*watch/i,                        phenomenon: "TR", significance: "A" },
  { pattern: /blizzard/i,                                     phenomenon: "BZ", significance: "W" },
  { pattern: /ice storm/i,                                    phenomenon: "IS", significance: "W" },
  { pattern: /winter storm.*warning/i,                        phenomenon: "WS", significance: "W" },
  { pattern: /winter storm.*watch/i,                          phenomenon: "WS", significance: "A" },
  { pattern: /winter weather/i,                               phenomenon: "WW", significance: "Y" },
  { pattern: /flash flood/i,                                  phenomenon: "FF", significance: "W" },
  { pattern: /flood.*warning/i,                               phenomenon: "FA", significance: "W" },
  { pattern: /flood.*watch/i,                                 phenomenon: "FA", significance: "A" },
  { pattern: /severe thunderstorm/i,                          phenomenon: "SV", significance: "W" },
];

/**
 * Parse an NWS alert event string into VTEC phenomenon + significance.
 */
export function parseEventToVtec(eventText: string): { phenomenon: string; significance: string } | null {
  for (const m of EVENT_TO_VTEC) {
    if (m.pattern.test(eventText)) {
      return { phenomenon: m.phenomenon, significance: m.significance };
    }
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
//  VTEC → AJ product code reverse lookup
// ────────────────────────────────────────────────────────────────────────────

/**
 * Maps VTEC phenomenon+significance to the AJ AWIPS product code.
 * Some events appear in multiple products (e.g., Wind Chill Warning is in
 * both NPW005 and WSW036); we pick the primary one.
 */
interface VtecToAjMapping {
  phenomenon: string;
  significance: string;
  ajCode: string;
}

const VTEC_TO_AJ: VtecToAjMapping[] = [
  // Tornado / Severe
  { phenomenon: "TO", significance: "W", ajCode: "SLS002" },
  { phenomenon: "SV", significance: "W", ajCode: "SLS001" },

  // Winter
  { phenomenon: "WS", significance: "W", ajCode: "WSW005" },
  { phenomenon: "WS", significance: "A", ajCode: "WSW006" },
  { phenomenon: "WW", significance: "Y", ajCode: "WSW007" },
  { phenomenon: "BZ", significance: "W", ajCode: "WSW018" },
  { phenomenon: "BZ", significance: "A", ajCode: "WSW019" },
  { phenomenon: "IS", significance: "W", ajCode: "WSW020" },
  { phenomenon: "LE", significance: "W", ajCode: "WSW022" },
  { phenomenon: "LE", significance: "A", ajCode: "WSW025" },
  { phenomenon: "LE", significance: "Y", ajCode: "WSW028" },
  { phenomenon: "LB", significance: "Y", ajCode: "WSW031" },
  { phenomenon: "ZR", significance: "Y", ajCode: "WSW050" },
  { phenomenon: "TAV", significance: "W", ajCode: "WSW040" },
  { phenomenon: "TAV", significance: "A", ajCode: "WSW043" },

  // Wind / Wind Chill
  { phenomenon: "WC", significance: "W", ajCode: "NPW005" },
  { phenomenon: "WC", significance: "Y", ajCode: "NPW006" },
  { phenomenon: "WC", significance: "A", ajCode: "WSW037" },
  { phenomenon: "HW", significance: "W", ajCode: "NPW035" },
  { phenomenon: "HW", significance: "A", ajCode: "NPW036" },
  { phenomenon: "WI", significance: "Y", ajCode: "NPW042" },
  { phenomenon: "LW", significance: "Y", ajCode: "NPW043" },

  // Heat / Cold
  { phenomenon: "EH", significance: "W", ajCode: "NPW013" },
  { phenomenon: "EH", significance: "A", ajCode: "NPW014" },
  { phenomenon: "HT", significance: "Y", ajCode: "NPW015" },
  { phenomenon: "EC", significance: "W", ajCode: "NPW064" },
  { phenomenon: "EC", significance: "A", ajCode: "NPW067" },
  { phenomenon: "FZ", significance: "W", ajCode: "NPW027" },
  { phenomenon: "FZ", significance: "A", ajCode: "NPW070" },
  { phenomenon: "HZ", significance: "W", ajCode: "NPW055" },
  { phenomenon: "HZ", significance: "A", ajCode: "NPW073" },
  { phenomenon: "FR", significance: "Y", ajCode: "NPW030" },

  // Flood
  { phenomenon: "FF", significance: "W", ajCode: "FFS007" },
  { phenomenon: "FF", significance: "A", ajCode: "FFS008" },
  { phenomenon: "FA", significance: "W", ajCode: "FLS007" },
  { phenomenon: "FA", significance: "A", ajCode: "FLS008" },
  { phenomenon: "CF", significance: "W", ajCode: "CFW005" },
  { phenomenon: "CF", significance: "A", ajCode: "CFW006" },
  { phenomenon: "LS", significance: "W", ajCode: "LSH005" },

  // Fog / Smoke / Dust
  { phenomenon: "FG", significance: "Y", ajCode: "NPW024" },
  { phenomenon: "SM", significance: "Y", ajCode: "NPW046" },
  { phenomenon: "DU", significance: "Y", ajCode: "NPW049" },
  { phenomenon: "DS", significance: "W", ajCode: "NPW052" },
  { phenomenon: "AS", significance: "Y", ajCode: "NPW076" },
  { phenomenon: "AF", significance: "Y", ajCode: "NPW079" },
  { phenomenon: "ZF", significance: "Y", ajCode: "NPW082" },
  { phenomenon: "LO", significance: "Y", ajCode: "NPW085" },

  // Fire
  { phenomenon: "FW", significance: "W", ajCode: "NPW020" },
  { phenomenon: "FW", significance: "A", ajCode: "NPW021" },
];

const VTEC_TO_AJ_MAP = new Map<string, string>();
for (const m of VTEC_TO_AJ) VTEC_TO_AJ_MAP.set(`${m.phenomenon}_${m.significance}`, m.ajCode);

// ────────────────────────────────────────────────────────────────────────────
//  Public headline composition API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get a headline clip for an NWS alert event string.
 *
 * For JC: looks up the VTEC code and plays Headline_Event_Phrases/{code}.wav
 * For AJ: looks up the AWIPS product code and composes from parts:
 *   "A" + [event name] + [action] → "A Winter Storm Warning has been issued"
 *
 * Returns an array of clip segments to play in sequence.
 */
export function getHeadlineClips(eventText: string, narratorId: NarratorId): HeadlineClip[] {
  const vtec = parseEventToVtec(eventText);
  if (!vtec) return [];

  if (narratorId === "jim-cantore") {
    const clip = getJcHeadlineClip(vtec.phenomenon, vtec.significance);
    if (clip) return [clip];
    return [];
  }

  if (narratorId === "allan-jackson") {
    return getAjHeadlineClips(vtec.phenomenon, vtec.significance);
  }

  // Other narrators: no headline clips
  return [];
}

/**
 * Compose AJ headline from parts. The typical Weatherscan pattern is:
 *   [Headline_A_Event] + [Headline_Action "B"] → "A Winter Storm Warning has been issued"
 *
 * For multiple alerts, uses Headline_And_Event for subsequent events:
 *   "A Winter Storm Warning" + "and a Blizzard Watch" + "has been issued"
 */
function getAjHeadlineClips(phenomenon: string, significance: string): HeadlineClip[] {
  const ajCode = VTEC_TO_AJ_MAP.get(`${phenomenon}_${significance}`);
  if (!ajCode) return [];

  const entry = AJ_HEADLINE_MAP.get(ajCode);
  if (!entry) return [];

  const clips: HeadlineClip[] = [];

  // "A [event]" variant
  clips.push({
    src: `${AJ_HL_BASE}/Headline_A_Event/${ajCode}A.wav`,
    text: `A ${entry.text}`,
    confidence: entry.confidence,
  });

  // "has been issued" action
  const actionEntry = AJ_ACTION_MAP.get("B");
  if (actionEntry) {
    clips.push({
      src: `${AJ_HL_BASE}/Headline_Action/B.wav`,
      text: actionEntry.text,
      confidence: actionEntry.confidence,
    });
  }

  return clips;
}

/**
 * Get a bare event name clip for AJ (e.g., "Winter Storm Warning").
 */
export function getAjEventClip(phenomenon: string, significance: string): HeadlineClip | null {
  const ajCode = VTEC_TO_AJ_MAP.get(`${phenomenon}_${significance}`);
  if (!ajCode) return null;
  const entry = AJ_HEADLINE_MAP.get(ajCode);
  if (!entry) return null;
  return {
    src: `${AJ_HL_BASE}/Headline_Event/${ajCode}.wav`,
    text: entry.text,
    confidence: entry.confidence,
  };
}

/**
 * Get an AJ action clip by code.
 */
export function getAjActionClip(code: string): HeadlineClip | null {
  const entry = AJ_ACTION_MAP.get(code);
  if (!entry) return null;
  return {
    src: `${AJ_HL_BASE}/Headline_Action/${code}.wav`,
    text: entry.text,
    confidence: entry.confidence,
  };
}

/**
 * Get an AJ misc clip by code.
 */
export function getAjMiscClip(code: string): HeadlineClip | null {
  const entry = AJ_MISC_MAP.get(code);
  if (!entry) return null;
  return {
    src: `${AJ_HL_BASE}/Headline_Misc/${code}.wav`,
    text: entry.text,
    confidence: entry.confidence,
  };
}

/**
 * Compose headline clips for multiple alerts. Uses "and" connectors for
 * subsequent events. Example for [Winter Storm Warning, Blizzard Watch]:
 *   "A Winter Storm Warning" + "and a Blizzard Watch" + "has been issued"
 */
export function getMultiHeadlineClips(eventTexts: string[], narratorId: NarratorId): HeadlineClip[] {
  if (eventTexts.length === 0) return [];
  if (eventTexts.length === 1) return getHeadlineClips(eventTexts[0], narratorId);

  if (narratorId === "jim-cantore") {
    // JC: play each headline event clip in sequence
    const clips: HeadlineClip[] = [];
    for (const event of eventTexts) {
      const c = getHeadlineClips(event, narratorId);
      clips.push(...c);
    }
    return clips;
  }

  if (narratorId === "allan-jackson") {
    const clips: HeadlineClip[] = [];

    for (let i = 0; i < eventTexts.length; i++) {
      const vtec = parseEventToVtec(eventTexts[i]);
      if (!vtec) continue;

      const ajCode = VTEC_TO_AJ_MAP.get(`${vtec.phenomenon}_${vtec.significance}`);
      if (!ajCode) continue;

      const entry = AJ_HEADLINE_MAP.get(ajCode);
      if (!entry) continue;

      if (i === 0) {
        // First: "A [event]"
        clips.push({
          src: `${AJ_HL_BASE}/Headline_A_Event/${ajCode}A.wav`,
          text: `A ${entry.text}`,
          confidence: entry.confidence,
        });
      } else {
        // Subsequent: "and a [event]"
        clips.push({
          src: `${AJ_HL_BASE}/Headline_And_Event/${ajCode}C.wav`,
          text: `and a ${entry.text}`,
          confidence: entry.confidence,
        });
      }
    }

    // End with "has been issued"
    const action = AJ_ACTION_MAP.get("B");
    if (action && clips.length > 0) {
      clips.push({
        src: `${AJ_HL_BASE}/Headline_Action/B.wav`,
        text: action.text,
        confidence: action.confidence,
      });
    }

    return clips;
  }

  return [];
}

/**
 * JC's Headline_Phrases/024.wav — a standalone phrase, likely "24 hour".
 * Included for completeness.
 */
export function getJcHeadlinePhraseClip(): HeadlineClip {
  return {
    src: `${JC_VOCALLOCAL_BASE}/Headline_Phrases/024.wav`,
    text: "24 hour",
    confidence: "guess",
  };
}
