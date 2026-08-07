/**
 * Minimal clip schema — residual named singletons for Allan Jackson.
 *
 * Most per-category clip resolution lives in `semanticRegistry.ts` now
 * (enumerable families: periods, temps, CC/CCSH/CCEF, wind, precip,
 * qualifiers, rate-OP, accumulation). What remains here is the small
 * set of **named one-off clips** that don't fit an enumerable scheme:
 * the "Currently, the temperature is" intro, severe-weather tones,
 * zero-degree special cases, and a handful of legacy condition phrases
 * (CCDUST / CCSAND / CCSNOW / CCTHUNDER / CCSHOWERS) that live in the
 * pre-VocalLocal MP3 dir.
 *
 * When in doubt, prefer `getLibrary(narrator).resolve(Sem.xxx(...))`
 * over adding entries here.
 */

const AJ_BASE = "/assets/narration/Alan Jackson";
const VL = `${AJ_BASE}/VocalLocal`;
const VL_TEMPS = `${VL}/Temps_Specific`;
const VL_INTROS = `${VL}/Intros_Curr_Cond`;

/** Legacy MP3 fallback dir for condition phrases missing from VocalLocal. */
const CC_LEGACY = `${AJ_BASE}/current conditions`;

/** Severe weather + sounds. */
const SEVERE_BASE = `${AJ_BASE}/severe`;
const SOUNDS_BASE = "/assets/sounds";

export type ClipConfidence = "confirmed" | "likely" | "guess";

export interface ClipResolution {
  src: string;
  /** What the file says, in plain English. */
  text: string;
  confidence: ClipConfidence;
}

interface NamedClip {
  file: string;
  text: string;
  intent: string;
  confidence: ClipConfidence;
}

const NAMED_CLIPS: NamedClip[] = [
  // Intro clips — VocalLocal
  { file: `${VL_INTROS}/CC_INTRO1.mp3`,                        intent: "current_intro",           text: "Currently, the temperature is",            confidence: "confirmed" },
  { file: `${VL_INTROS}/CC_INTRO2.mp3`,                        intent: "current_intro_alt",       text: "Currently, the temperature is (alt)",      confidence: "likely" },
  // Signature / tones
  { file: `${SOUNDS_BASE}/TWC_Mnemonic.mp3`,                   intent: "mnemonic",                text: "Weatherscan musical signature",            confidence: "confirmed" },
  // NWS 4-beep pattern that precedes spoken warnings on Weatherscan's
  // orange severe-alert crawl. Played at the head of composeAlerts() for
  // AJ before the spoken warning clip; JC uses narrator-specific crawl
  // beeps instead (see composeAlerts).
  { file: `${SOUNDS_BASE}/severe_weather_tone.mp3`,            intent: "warning_beep",            text: "NWS four-beep warning tone",               confidence: "confirmed" },
  // Severe weather alerts
  { file: `${SEVERE_BASE}/tornado_warning.mp3`,                intent: "alert_tornado",           text: "tornado warning alert",                    confidence: "confirmed" },
  { file: `${SEVERE_BASE}/severe_thunderstorm_warning.mp3`,    intent: "alert_tstorm",            text: "thunderstorm warning alert",               confidence: "confirmed" },
  { file: `${SEVERE_BASE}/f_flood_warning.mp3`,                intent: "alert_flood",             text: "flash flood warning alert",                confidence: "confirmed" },
  // Number special cases — VocalLocal
  { file: `${VL_TEMPS}/Zero.mp3`,                              intent: "number_zero_degrees",     text: "zero degrees",                             confidence: "likely" },
  { file: `${VL_TEMPS}/Zero.mp3`,                              intent: "number_zero",             text: "zero",                                     confidence: "likely" },
  { file: `${VL_TEMPS}/Zeros.mp3`,                             intent: "number_zero_plural",      text: "zero (alternate take)",                    confidence: "guess" },
  { file: `${VL_TEMPS}/1s.mp3`,                                intent: "number_one_singular",     text: "one (singular form, e.g. \"1 degree\")",   confidence: "likely" },
  // Named condition phrases — legacy dir (no VocalLocal equivalent)
  { file: `${CC_LEGACY}/CCDUST.mp3`,                           intent: "condition_dust",          text: "with dust",                                confidence: "likely" },
  { file: `${CC_LEGACY}/CCSAND.mp3`,                           intent: "condition_sand",          text: "with sand",                                confidence: "likely" },
  { file: `${CC_LEGACY}/CCSNOW.mp3`,                           intent: "condition_snow_generic", text: "with snow",                                confidence: "likely" },
  { file: `${CC_LEGACY}/CCTHUNDER.mp3`,                        intent: "condition_thunder",       text: "with thunder",                             confidence: "likely" },
  { file: `${CC_LEGACY}/CCSHOWERS.mp3`,                        intent: "condition_showers",       text: "with showers",                             confidence: "likely" },
];

const NAMED_BY_INTENT = new Map<string, NamedClip>();
for (const c of NAMED_CLIPS) NAMED_BY_INTENT.set(c.intent, c);

export function getNamedClip(intent: string): ClipResolution | null {
  const c = NAMED_BY_INTENT.get(intent);
  if (!c) return null;
  return { src: c.file, text: c.text, confidence: c.confidence };
}

// The `getRateOpClip` that appendForecastWindPrecip still uses lives below.
// It parses detailed-forecast text for snowfall/rainfall rate phrases and
// returns the JC rate-OP clip. A future pass can move this pattern-matching
// into the registry layer or a separate module; kept here temporarily to
// avoid widening this cleanup pass.

interface RateOpEntry {
  pattern: RegExp;
  code: number;
  text: string;
}

const RATE_OP_PATTERNS: RateOpEntry[] = [
  { pattern: /snow.*(1\s*to\s*2|1-2)\s+inch.*per hour/i, code: 8012, text: "Snowfall rates approaching 1 to 2 inches per hour at times" },
  { pattern: /snow.*inch.*per hour/i,                    code: 8011, text: "Snowfall rates may reach one inch per hour at times" },
  { pattern: /rain.*(1\s*to\s*2|1-2)\s+inch.*per hour/i, code: 8022, text: "Rainfall rates approaching one to two inches per hour at times" },
  { pattern: /rain.*inch.*per hour/i,                    code: 8021, text: "Rainfall rates may reach one inch per hour at times" },
];

const JC_VL = "/assets/narration/Jim Cantore/Vocal Local";

export function getRateOpClip(detailedForecast: string): ClipResolution | null {
  if (!detailedForecast) return null;
  for (const r of RATE_OP_PATTERNS) {
    if (r.pattern.test(detailedForecast)) {
      return {
        src: `${JC_VL}/Wx_Phrases_RateOP/R${r.code}.mp3`,
        text: r.text,
        confidence: "likely",
      };
    }
  }
  return null;
}
