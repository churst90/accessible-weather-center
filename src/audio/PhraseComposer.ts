import type { Observation, ForecastPeriod, HourlyForecastPoint, WeatherAlert, LatLon } from "../core/types";
import {
  getNamedClip,
  getRateOpClip,
  // getHighRangeClip, getTempRangeClip — available for Regional Forecast scene
  type ClipResolution,
} from "./manifests/clipSchema";
import {
  type NarratorId,
  getNarrator,
  pickSceneIntro,
} from "./manifests/narratorSchema";
import { getMultiHeadlineClips, getAjEventClip, parseEventToVtec } from "./manifests/headlineSchema";
import { getAccumulationClips } from "./manifests/accumulationSchema";
import { findLongformMatch } from "./manifests/longformSchema";
import { getSunTimes } from "../core/weather/SunCalc";
import { getLibrary, Sem, precipKindNoun, type CompassDir, type WindRange, type PeriodKey, type Weekday, type PrecipKind } from "./manifests/semanticRegistry";

/**
 * The PhraseComposer turns structured scene data into an ordered narration
 * script: a list of {audio file, fallback text} segments. The PhraseSequencer
 * plays them in order, falling back to TTS for any segment that has no clip
 * or whose clip has low confidence.
 *
 * Splitting compose (this file) from sequence (PhraseSequencer) lets us unit
 * test the script generation without touching the audio context.
 */

export interface PhraseSegment {
  /** Resolved audio clip, if available. */
  clip: ClipResolution | null;
  /** What to say if the clip is missing or rejected by confidence threshold. */
  fallbackText: string;
}

export type PhraseScript = PhraseSegment[];

/** Convert a narrator scene intro to a PhraseSegment clip. The optional
 *  `era` narrows the intro pool to entries that match the active theme's
 *  extendedStyle — used so a 5-day WS4000 theme doesn't play a "Seven day
 *  outlook" intro. */
function pickSceneIntroClip(narratorId: NarratorId, sceneId: string, era?: "5-day" | "7-day"): ClipResolution | null {
  const intro = pickSceneIntro(narratorId, sceneId, era);
  if (!intro) return null;
  return { src: intro.file, text: intro.text, confidence: "confirmed" };
}

/**
 * Compose narration for a current-conditions observation.
 *
 *   "Currently, the temperature is" + [degrees] + [condition phrase]
 *
 * The condition phrase uses CC codes which say things like "under partly
 * cloudy skies", "with snow", "under clear skies with windy conditions", etc.
 *
 * Wind, humidity, pressure clips aren't in the library — those are appended
 * as a single TTS segment.
 */
export function composeCurrentConditions(obs: Observation, placeName: string, narrator: NarratorId = "allan-jackson", coord?: LatLon | null): PhraseScript {
  const script: PhraseScript = [];
  const def = getNarrator(narrator);
  const useClips = def.hasTemps && def.hasConditions;

  // Intro clip: "Currently, the temperature is" or narrator-specific equivalent.
  // AJ uses the named "current_intro" clip (flows into temp), with occasional
  // rotation to a scene-intro variant for variety. JC and other narrators with
  // clips use their own CC_INTRO from sceneIntros. Narrators without clips use
  // their scene intro as a standalone label.
  // Announce the scene, THEN lead into the reading.
  //
  // This used to be a 30/70 coin flip between a scene-title intro ("Your
  // Current Conditions") and the bare lead-in clip ("Currently, the
  // temperature is"), so seven times in ten the scene opened straight onto a
  // number. Every other scene announces itself first, and the broadcast units
  // did too, so current conditions now does the same: title first, lead-in
  // second, both when they're available.
  const sceneTitleClip = useClips ? pickSceneIntroClip(narrator, "current") : null;

  // The `current` pool mixes two kinds of clip, and they compose differently:
  //
  //   scene titles  "Your Current Conditions", "Our current conditions"
  //   lead-ins      "Currently In Your Area"
  //
  // A title wants the "Currently, the temperature is" lead-in after it. A clip
  // that is ALREADY a lead-in does not — pairing them produced "Currently in
  // your area... currently, the temperature is... 90 degrees", saying
  // "currently" twice before the reading ever starts.
  const titleIsLeadIn = /^currently\b/i.test(sceneTitleClip?.text ?? "");
  const leadInClip = narrator === "allan-jackson" && useClips && !titleIsLeadIn
    ? getNamedClip("current_intro")
    : null;

  if (sceneTitleClip) {
    script.push({
      clip: sceneTitleClip,
      fallbackText: `Current conditions for ${placeName}.`
    });
  }
  // Skip the lead-in entirely when the title already served as one — the
  // screen reader would otherwise read the doubled "currently" too, not just
  // the narrator.
  if (!titleIsLeadIn) {
    script.push({
      clip: leadInClip ?? (sceneTitleClip ? null : pickSceneIntroClip(narrator, "current")),
      fallbackText: sceneTitleClip
        ? "Currently, the temperature is"
        : `Currently in ${placeName}, the temperature is`
    });
  }

  if (obs.temperatureF != null) {
    script.push({
      clip: useClips ? getNumberClipForNarrator(obs.temperatureF, narrator) : null,
      fallbackText: `${obs.temperatureF} degrees`
    });
  }

  // Map NWS condition text to a CC code.
  //
  // The time hint matters: without it, an observation of "Sunny" or "Mostly
  // Clear" after dark selected the sunny clip and Allan Jackson announced
  // sunny skies at 11pm. Current conditions carry no period name, so derive
  // day/night from real solar times at the observation's own coordinate
  // rather than a fixed clock hour, which would be wrong by hours in summer.
  const isWindy = (obs.windSpeedMph ?? 0) >= 15;
  const conditionCode = guessConditionCode(obs.conditionText, isWindy, observationTimeHint(obs, coord));
  if (conditionCode != null) {
    script.push({
      clip: useClips ? getConditionClipForNarrator(conditionCode, narrator) : null,
      fallbackText: obs.conditionText ? describeCondition(obs.conditionText) : ""
    });
  } else if (obs.conditionText) {
    script.push({
      clip: null,
      fallbackText: describeCondition(obs.conditionText)
    });
  }

  // Wind narration — AJ and JC both have wind direction + speed clips
  if (obs.windSpeedMph != null) {
    if (def.hasWind) {
      script.push(...getWindClips(obs.windDirDeg ?? null, obs.windSpeedMph, narrator));
    } else {
      if (obs.windSpeedMph > 0) {
        const dir = obs.windDirDeg != null ? compass(obs.windDirDeg) : "";
        script.push({ clip: null, fallbackText: `Wind ${dir} at ${obs.windSpeedMph} miles per hour.` });
      } else {
        script.push({ clip: null, fallbackText: "Winds calm." });
      }
    }
  }

  // Wind gusts — spoken after wind direction/speed
  if (obs.windGustMph != null && obs.windGustMph > 0) {
    script.push({
      clip: null,
      fallbackText: `with gusts up to ${obs.windGustMph} miles per hour.`
    });
  }

  // Feels like — important for wind chill/heat index awareness
  if (obs.feelsLikeF != null && obs.temperatureF != null && Math.abs(obs.feelsLikeF - obs.temperatureF) >= 5) {
    script.push({
      clip: useClips ? getNumberClipForNarrator(obs.feelsLikeF, narrator) : null,
      fallbackText: `Feels like ${obs.feelsLikeF} degrees.`
    });
  }

  // Humidity, pressure, visibility — always TTS (no clips in narrator libraries)
  const tail: string[] = [];
  if (obs.humidityPct != null) tail.push(`Humidity ${obs.humidityPct} percent.`);
  if (obs.pressureInHg != null) tail.push(`Pressure ${obs.pressureInHg} inches.`);
  if (obs.visibilityMi != null) tail.push(`Visibility ${obs.visibilityMi} miles.`);
  if (tail.length > 0) {
    script.push({ clip: null, fallbackText: tail.join(" ") });
  }

  return script;
}

// ───────────────────────── Extended Forecast ─────────────────────────

/**
 * Compose narration for the extended forecast.
 *
 * For each period, the narration is:
 *   [period name] + [hi/lo temp] + [condition] + [wind/precip/qualifiers/accumulation]
 *
 * Condition clip selection cascades through three families:
 *   1. CCEF ("with X" — attaches to temp): "high of 82, with scattered thunderstorms"
 *   2. CCSH (standalone sentence): "Partly cloudy." / "Showers ending early."
 *   3. CC ("with X" — current conditions style): fallback
 *
 * The final period uses the "and on ..." variant ("and on Sunday." /
 * "and Sunday night.") so the forecast closes naturally instead of just
 * trailing off on a bare day name.
 *
 * Example output:
 *   "Extended forecast for Greeneville."
 *   "Monday," [HIGH_82.mp3] [CCEF3800.mp3 "with scattered thunderstorms"]
 *   "Monday Night," [LOW_64.mp3] [CCSH7100.mp3 "Showers during the afternoon"]
 *   ...
 *   "and on Sunday," [HIGH_79.mp3] [CCEF1100.mp3 "with showers"]
 */
export function composeExtendedForecast(periods: ForecastPeriod[], placeName: string, narrator: NarratorId = "allan-jackson", era?: "5-day" | "7-day", title?: string): PhraseScript {
  const script: PhraseScript = [];
  const def = getNarrator(narrator);
  const useClips = def.hasTemps && def.hasConditions;

  script.push({
    clip: pickSceneIntroClip(narrator, "extended", era),
    fallbackText: `${title ?? "Extended forecast"} for ${placeName}.`
  });

  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    const isLast = i === periods.length - 1;
    appendPeriodNarration(script, p, isLast, narrator, def, useClips);
  }

  return script;
}

/**
 * Emit the narration for a single forecast period in authentic Weatherscan
 * style. When a longform clip matches, the flow is:
 *
 *   [period name] + [longform condition phrase] + [high/low temp]
 *
 * e.g. "Today. A few showers early, with ample sunshine later in the day. High of 72."
 *
 * The longform phrase is a complete weather description (often including time
 * of day and wind references), so wind / precip% / qualifiers are intentionally
 * omitted — piling those on top makes the narration feel robotic and choppy.
 *
 * When no longform match is available, falls through to the CCEF/CCSH/CC
 * cascade and appends wind/precip/qualifiers to compensate for the less
 * descriptive condition clip.
 */
function appendPeriodNarration(
  script: PhraseScript,
  p: ForecastPeriod,
  isLast: boolean,
  narrator: NarratorId,
  def: { hasWind: boolean },
  useClips: boolean
): void {
  const hiLo = p.isDaytime ? "high" : "low";

  // Period name clip — always include when a clean clip is available.
  // For the final period use the "and on ..." variant so the forecast
  // closes naturally ("and on Sunday," / "and Sunday night,").
  const periodClip = useClips ? getPeriodClip(p.name, narrator, isLast) : null;
  if (periodClip) {
    const prefix = isLast ? "and " : "";
    script.push({ clip: periodClip, fallbackText: `${prefix}${p.name},` });
  }

  // AJ has dedicated "high of N" / "low of N" clips that sound more natural
  // than a bare number. Other narrators use the generic number clip.
  const hiLoClip = useClips
    ? (p.isDaytime ? getHighTempClip(p.temperatureF, narrator) : getLowTempClip(p.temperatureF, narrator))
    : null;
  const tempSegment: PhraseSegment = {
    clip: hiLoClip ?? (useClips ? getNumberClipForNarrator(p.temperatureF, narrator) : null),
    fallbackText: `${hiLo} ${p.temperatureF} degrees`
  };

  // Try longform first — these are complete detailed descriptions
  const longformClip = useClips ? findLongformMatch(p.detailedForecast ?? p.shortForecast, narrator) : null;
  if (longformClip && longformClip.confidence !== "guess") {
    // Authentic Weatherscan flow: [period (if clean)] [longform] [temp]
    // Longform already covers conditions and often wind, so those clips stay
    // omitted here to avoid the stacked-clip feel.
    script.push({ clip: longformClip, fallbackText: longformClip.text + "." });
    script.push(tempSegment);
    // The numbers are the exception. Of the 2,083 longform recordings, not
    // one states a precipitation percentage and not one states an
    // accumulation amount — checked, not assumed — so the early return was
    // dropping both outright: "showers and thunderstorms likely" with the
    // 70% never spoken, "snow" with the 3 to 5 inches never spoken. Those
    // are the two most decision-relevant figures on the screen, and no
    // longform clip can ever cover them, so they are appended here.
    const conditionText = `${p.shortForecast} ${p.detailedForecast ?? ""}`;
    appendPrecipProb(script, p.precipProbabilityPct, narrator, conditionText);
    if (p.detailedForecast) {
      for (const ac of getAccumulationClips(p.detailedForecast, narrator)) {
        script.push({ clip: { src: ac.src, text: ac.text, confidence: ac.confidence }, fallbackText: ac.text + "." });
      }
    }
    return;
  }

  // No longform match — fall back to CCEF/CCSH cascade + wind/precip
  script.push(tempSegment);

  const timeHint = periodTimeHint(p.name, p.isDaytime);
  const isWindy = /wind|breezy/i.test(p.windSpeedText);

  // Condition narration cascade (most natural → most robotic):
  //   2. CCEF — "with X" phrase attaching to temp
  //   3. CCSH — standalone condition sentence
  //   4. CC — "with X" current-conditions phrase
  //   5. TTS fallback
  const ccefCode = guessCcefForecastCode(p.shortForecast, timeHint, isWindy);
  if (ccefCode != null && useClips) {
    const ccefClip = getLibrary(narrator).resolve(Sem.ccef(ccefCode));
    if (ccefClip && ccefClip.confidence !== "guess") {
      script.push({ clip: ccefClip, fallbackText: describeCondition(p.shortForecast) });
    } else {
      appendCcshOrCcFallback(script, p.shortForecast, timeHint, isWindy, useClips, narrator);
    }
  } else {
    appendCcshOrCcFallback(script, p.shortForecast, timeHint, isWindy, useClips, narrator);
  }

  // Wind, precipitation, qualifiers, and accumulation — only when no longform
  // covered them. This prevents the stacked-clip feel when longform matches.
  appendForecastWindPrecip(script, p.windDirText, p.windSpeedText, p.precipProbabilityPct, narrator, def, p.detailedForecast, p.shortForecast);
}

/**
 * Try CCSH then CC as a fallback for forecast condition narration.
 */
function appendCcshOrCcFallback(
  script: PhraseScript,
  shortForecast: string,
  timeHint: TimeHint,
  isWindy: boolean,
  useClips: boolean,
  narrator: NarratorId
): void {
  // Night + clear sky: prefer the CC pool's "under clear skies." over the
  // shortcast pool's time-neutral "fair.", and never let the sunny clips win.
  if (timeHint === "night") {
    const nightCode = nightSkyConditionCode(shortForecast, isWindy);
    if (nightCode != null) {
      script.push({
        clip: useClips ? getConditionClipForNarrator(nightCode, narrator) : null,
        fallbackText: describeCondition(shortForecast)
      });
      return;
    }
  }

  const ccshCode = guessCcshForecastCode(shortForecast, timeHint, isWindy);
  if (ccshCode != null) {
    script.push({
      clip: useClips ? getCcshClipForNarrator(ccshCode, narrator) : null,
      fallbackText: shortForecast + "."
    });
  } else {
    const ccCode = guessConditionCode(shortForecast, isWindy);
    if (ccCode != null) {
      script.push({
        clip: useClips ? getConditionClipForNarrator(ccCode, narrator) : null,
        fallbackText: describeCondition(shortForecast)
      });
    } else {
      script.push({
        clip: null,
        fallbackText: shortForecast + "."
      });
    }
  }
}

// ───────────────────────── Hourly Forecast ─────────────────────────

/**
 * Compose narration for the hourly forecast. Speaks 4 sample hours
 * (now, +3h, +6h, +9h).
 *
 * For each sample:
 *   [time, TTS] + [temp, number clip] + [condition, CC clip]
 *
 * Example:
 *   "Hourly forecast for Greeneville."
 *   "At 3 PM," [68 degrees] "under partly cloudy skies."
 */
export function composeHourlyForecast(hours: HourlyForecastPoint[], placeName: string, narrator: NarratorId = "allan-jackson"): PhraseScript {
  const script: PhraseScript = [];
  const def = getNarrator(narrator);
  const useClips = def.hasTemps && def.hasConditions;

  script.push({
    clip: pickSceneIntroClip(narrator, "hourly"),
    fallbackText: `Hourly forecast for ${placeName}.`
  });

  const samples = [hours[0], hours[3], hours[6], hours[9]].filter(Boolean);
  for (const h of samples) {
    const time = h.time.toLocaleTimeString([], { hour: "numeric" });

    script.push({
      clip: null,
      fallbackText: `At ${time},`
    });

    script.push({
      clip: useClips ? getNumberClipForNarrator(h.temperatureF, narrator) : null,
      fallbackText: `${h.temperatureF} degrees`
    });

    const windyH = (h.windSpeedMph ?? 0) >= 15;
    const ccshCodeH = guessCcshForecastCode(h.shortForecast, null, windyH);
    if (ccshCodeH != null) {
      script.push({
        clip: useClips ? getCcshClipForNarrator(ccshCodeH, narrator) : null,
        fallbackText: h.shortForecast + "."
      });
    } else {
      const ccCodeH = guessConditionCode(h.shortForecast, windyH);
      if (ccCodeH != null) {
        script.push({
          clip: useClips ? getConditionClipForNarrator(ccCodeH, narrator) : null,
          fallbackText: describeCondition(h.shortForecast)
        });
      } else {
        script.push({
          clip: null,
          fallbackText: h.shortForecast + "."
        });
      }
    }

    // Wind, then precipitation probability — the two facts the hourly screen
    // was showing and the narrator was not saying.
    //
    // Precip probability was already in this script but pinned to
    // `clip: null`, so only the screen reader ever spoke it even though both
    // Allen Jackson and Jim Cantore have the whole P9 decile set recorded.
    // Wind was absent altogether, despite `windSpeedMph`/`windDirDeg` sitting
    // in every HourlyForecastPoint and the forecast composer already having a
    // helper for exactly this. The result was an hourly readout of time,
    // temperature and sky condition, noticeably thinner than the screen.
    const mphH = Math.round(h.windSpeedMph ?? 0);
    if (mphH > 0) {
      if (def.hasWind && h.windDirDeg != null) {
        // Same helper the forecast path uses, so hourly and daily wind are
        // spoken identically rather than drifting into two phrasings.
        script.push(...getWindClips(h.windDirDeg, mphH, narrator));
      } else {
        script.push({ clip: null, fallbackText: `winds at ${mphH} miles per hour.` });
      }
    }

    appendPrecipProb(script, h.precipProbabilityPct, narrator, h.shortForecast);
  }

  return script;
}

// ───────────────────────── Local Radar ─────────────────────────

/**
 * Compose clip narration for the radar scene.
 * Plays "The local Doppler radar" intro clip.
 */
export function composeRadar(narrator: NarratorId = "allan-jackson"): PhraseScript {
  return [{
    clip: pickSceneIntroClip(narrator, "radar"),
    fallbackText: "Your local Doppler radar."
  }];
}

// ───────────────────────── Alerts ─────────────────────────

/**
 * Compose narration for the alerts scene.
 *
 * Enhanced narration flow:
 *   1. Alert tone (tornado/tstorm/flood/generic)
 *   2. Headline clips for each alert event using pre-recorded narrator clips:
 *      - AJ: "A Winter Storm Warning" + "has been issued" (from Headline_* dirs)
 *      - JC: "Winter Storm Warning" (from Headline_Event_Phrases/ via VTEC)
 *   3. Fallback to Default_Phrases_Severe/ for severe weather announcements
 *      when headline clips aren't available
 *   4. Alert details (TTS)
 */
export function composeAlerts(alerts: WeatherAlert[], placeName: string, narrator: NarratorId = "allan-jackson"): PhraseScript {
  const script: PhraseScript = [];

  if (alerts.length === 0) {
    script.push({
      clip: null,
      fallbackText: `No active alerts for ${placeName}.`
    });
    return script;
  }

  // Authentic Weatherscan severe-alert opening: [N-beep warning tone] →
  // [spoken warning]. AJ uses the NWS 4-beep (severe_weather_tone.mp3)
  // followed by the short VocalLocal announcement; JC uses the matching
  // pair from his Crawl audio/ folder keyed to alert event type.
  const intro = getSevereAlertIntroClips(alerts, narrator);
  for (const clip of intro) {
    script.push({ clip, fallbackText: "" });
  }

  // If the intro didn't find a narrator-specific pair, fall back to the
  // generic scheme: attention tone + headline/severe-announcement clips.
  if (intro.length === 0) {
    const toneIntent = pickAlertTone(alerts);
    script.push({ clip: getNamedClip(toneIntent), fallbackText: "" });

    const eventTexts = alerts.map(a => a.event);
    const headlineSegs = getMultiHeadlineClips(eventTexts, narrator);
    if (headlineSegs.length > 0) {
      for (const hc of headlineSegs) {
        script.push({
          clip: { src: hc.src, text: hc.text, confidence: hc.confidence },
          fallbackText: hc.text
        });
      }
    } else {
      // No event-name clip for this alert. Only 64 of the ~229 event strings
      // the parser recognises have an Allen Jackson recording, so this is the
      // common path, not the rare one.
      //
      // What must NOT happen here is playing the alerts "scene intro" on its
      // own. Those entries are sentence TAILS — "is in effect for your area",
      // "has been issued for your area" — miscategorised as intros. Alone
      // they produce four attention beeps followed by a voice saying "is in
      // effect for your area", naming nothing. For a weather alert that is
      // worse than silence: the tone says something urgent happened and the
      // voice withholds what.
      //
      // So the tail is used only when something can name the event first.
      // Otherwise the clip is dropped and the spoken fallback below carries
      // the whole thing, which the screen reader reads in full.
      const named = pickEventNameClip(alerts, narrator);
      if (named) {
        script.push({ clip: named, fallbackText: "" });
        const tail = pickSevereAnnouncementClip(alerts, narrator);
        if (tail) script.push({ clip: tail, fallbackText: "" });
      }
    }
  }

  script.push({
    clip: null,
    fallbackText: `${alerts.length} active alert${alerts.length === 1 ? "" : "s"} for ${placeName}.`
  });

  for (const a of alerts) {
    const expiresAt = a.expires.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    script.push({
      clip: null,
      fallbackText: `${a.event}. Severity ${a.severity}, urgency ${a.urgency}, expires ${expiresAt}. ${a.headline}.`
    });
  }

  return script;
}

/**
 * Pick the crawl-audio beep tier + matching spoken warning for an alert
 * set. Weatherscan's crawl-audio library pairs a beep-count prefix with a
 * spoken event announcement — higher tiers (more beeps) signal greater
 * urgency. Tier 4 covers the life-safety warnings (tornado / severe
 * thunderstorm / flash flood / flood / extreme wind); tier 2 covers the
 * slower-onset severe events (hurricane / blizzard / ice storm / tsunami
 * / earthquake). Tier 1 is the fallback "generic alert" beep.
 *
 * AJ uses the NWS four-beep tone (severe_weather_tone.mp3) for all
 * severe events and routes the spoken half through AJ_NAMED_MAP's
 * alert_tornado / alert_tstorm / alert_flood. Returns [] for alert sets
 * with no narrator-specific severe clip pair — caller falls through to
 * the legacy headline/fallback scheme.
 */
function getSevereAlertIntroClips(alerts: WeatherAlert[], narrator: NarratorId): ClipResolution[] {
  const events = alerts.map((a) => a.event.toLowerCase());
  const hasTornado = events.some((e) => /tornado/.test(e));
  const hasTstorm  = events.some((e) => /thunderstorm/.test(e));
  const hasFlash   = events.some((e) => /flash flood/.test(e));
  const hasFlood   = events.some((e) => /flood/.test(e)) && !hasFlash;
  const hasExtWind = events.some((e) => /extreme wind/.test(e));
  const hasHurr    = events.some((e) => /hurricane/.test(e));
  const hasBlizz   = events.some((e) => /blizzard/.test(e));
  const hasIce     = events.some((e) => /ice storm/.test(e));
  const hasTsunami = events.some((e) => /tsunami/.test(e));
  const hasQuake   = events.some((e) => /earthquake/.test(e));

  if (narrator === "allan-jackson") {
    // AJ: NWS 4-beep → VocalLocal spoken announcement.
    const beep = getNamedClip("warning_beep");
    const library = getLibrary(narrator);
    let spoken: ClipResolution | null = null;
    if (hasTornado)     spoken = library.resolve(Sem.named("alert_tornado"));
    else if (hasTstorm) spoken = library.resolve(Sem.named("alert_tstorm"));
    else if (hasFlash || hasFlood) spoken = library.resolve(Sem.named("alert_flood"));
    if (!beep || !spoken) return [];
    return [beep, spoken];
  }

  if (narrator === "jim-cantore") {
    // JC: Crawl audio/{tier}_Beep.mp3 → Crawl audio/{tier}_{EVENT}.mp3.
    const JC_CRAWL = "/assets/shared/narration/Jim Cantore/Crawl audio";
    const crawlClip = (file: string, text: string): ClipResolution => ({
      src: `${JC_CRAWL}/${file}`, text, confidence: "confirmed",
    });

    if (hasTornado) return [crawlClip("4_Beep.mp3", ""), crawlClip("4_TOW.mp3", "A tornado warning has been issued for our area.")];
    if (hasTstorm)  return [crawlClip("4_Beep.mp3", ""), crawlClip("4_SVW.mp3", "A severe thunderstorm warning has been issued for our area.")];
    if (hasFlash)   return [crawlClip("4_Beep.mp3", ""), crawlClip("4_FFW.mp3", "A flash flood warning has been issued for our area.")];
    if (hasFlood)   return [crawlClip("4_Beep.mp3", ""), crawlClip("4_FAW.mp3", "A flood warning has been issued for our area.")];
    if (hasExtWind) return [crawlClip("4_Beep.mp3", ""), crawlClip("4_EWW.mp3", "An extreme wind warning has been issued for our area.")];
    if (hasHurr)    return [crawlClip("2_Beep.mp3", ""), crawlClip("2_HUW.mp3", "A hurricane warning has been issued for our area.")];
    if (hasBlizz)   return [crawlClip("2_Beep.mp3", ""), crawlClip("2_BZW.mp3", "A blizzard warning has been issued for our area.")];
    if (hasIce)     return [crawlClip("2_Beep.mp3", ""), crawlClip("2_ISW.mp3", "An ice storm warning has been issued for our area.")];
    if (hasTsunami) return [crawlClip("2_Beep.mp3", ""), crawlClip("2_TSW.mp3", "A tsunami warning is in effect.")];
    if (hasQuake)   return [crawlClip("2_Beep.mp3", ""), crawlClip("2_TEQW.mp3", "An earthquake warning is in effect.")];
    // Non-matched severe event — use tier-1 generic beep only.
    const anySevere = alerts.some((a) => a.severity === "Extreme" || a.severity === "Severe");
    if (anySevere) return [crawlClip("1_Beep.mp3", "")];
    return [];
  }

  return [];
}

/**
 * Pick a narrator-specific severe weather announcement clip based on alert
 * type. Routes through the semantic registry so there's a single canonical
 * clip per (narrator, alert intent) — see AJ_NAMED_MAP / JC_NAMED_MAP.
 * Amy / Chandler fall back to the generic "alerts" scene intro.
 */
/**
 * A clip that actually NAMES the event, for use ahead of a sentence tail.
 *
 * Falls back through the narrator's own event vocabulary: the bare
 * Headline_Event recording if the alert maps to one, then the generic
 * tornado / thunderstorm / flood announcements, which name their event even
 * though they are not per-code recordings. Returns null when nothing in the
 * library can say what this alert is — the signal to stay quiet and let the
 * screen reader speak instead.
 */
function pickEventNameClip(alerts: WeatherAlert[], narrator: NarratorId): ClipResolution | null {
  if (narrator === "allan-jackson") {
    for (const a of alerts) {
      const vtec = parseEventToVtec(a.event);
      if (!vtec) continue;
      const clip = getAjEventClip(vtec.phenomenon, vtec.significance);
      if (clip) return { src: clip.src, text: clip.text, confidence: clip.confidence };
    }
  }
  const events = alerts.map((a) => a.event.toLowerCase());
  const library = getLibrary(narrator);
  if (events.some((e) => /tornado/.test(e)))      return library.resolve(Sem.named("alert_tornado"));
  if (events.some((e) => /thunderstorm/.test(e))) return library.resolve(Sem.named("alert_tstorm"));
  if (events.some((e) => /flood|flash/.test(e)))  return library.resolve(Sem.named("alert_flood"));
  return null;
}

function pickSevereAnnouncementClip(alerts: WeatherAlert[], narrator: NarratorId): ClipResolution | null {
  const events = alerts.map((a) => a.event.toLowerCase());
  const library = getLibrary(narrator);

  if (events.some((e) => /tornado/.test(e))) {
    const clip = library.resolve(Sem.named("alert_tornado"));
    if (clip) return clip;
  }
  if (events.some((e) => /thunderstorm/.test(e))) {
    const clip = library.resolve(Sem.named("alert_tstorm"));
    if (clip) return clip;
  }
  if (events.some((e) => /flood|flash/.test(e))) {
    const clip = library.resolve(Sem.named("alert_flood"));
    if (clip) return clip;
  }

  return pickSceneIntroClip(narrator, "alerts");
}

function pickAlertTone(alerts: WeatherAlert[]): string {
  const events = alerts.map((a) => a.event.toLowerCase());
  if (events.some((e) => /tornado/.test(e)))       return "alert_tornado";
  if (events.some((e) => /thunderstorm/.test(e)))  return "alert_tstorm";
  if (events.some((e) => /flood|flash/.test(e)))   return "alert_flood";
  if (alerts.some((a) => a.severity === "Extreme" || a.severity === "Severe"))
    return "warning_beep";
  return "mnemonic";
}

// ───────────────────────── Forecast wind + precip helpers ─────────────────────────

/**
 * Parse NWS wind speed text like "10 to 15 mph" or "5 mph" into a numeric mph.
 * Returns the midpoint for ranges, or the single value.
 */
function parseWindSpeedMph(text: string): number | null {
  if (!text) return null;
  const range = text.match(/(\d+)\s*to\s*(\d+)/i);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
  const single = text.match(/(\d+)/);
  if (single) return Number(single[1]);
  return null;
}

/**
 * Append wind, precipitation, and qualifier narration for a forecast period.
 * Uses wind clips for narrators that have them, TTS fallback otherwise.
 * Qualifiers add nuance from the detailed forecast (e.g. "humid", "a few storms may be severe").
 */
function appendForecastWindPrecip(
  script: PhraseScript,
  windDirText: string,
  windSpeedText: string,
  precipPct: number | null,
  narrator: NarratorId,
  def: { hasWind: boolean },
  detailedForecast?: string,
  /** Short condition text, used to pick the rain / snow / precip clip set. */
  conditionHint?: string
): void {
  // Wind — parse the NWS text into a direction + speed for wind clips
  const mph = parseWindSpeedMph(windSpeedText);
  if (mph != null && mph > 0) {
    const dirDeg = windDirTextToDeg(windDirText);
    if (def.hasWind && dirDeg != null) {
      script.push(...getWindClips(dirDeg, mph, narrator));
    } else {
      const dir = windDirText || "";
      script.push({ clip: null, fallbackText: `Winds ${dir} at ${windSpeedText}.` });
    }
  }

  // Precipitation probability — use P9 clips when available
  appendPrecipProb(script, precipPct, narrator, `${conditionHint ?? ""} ${detailedForecast ?? ""}`);

  // Wind changes — becoming/shifting/increasing/diminishing from the detailed forecast
  if (detailedForecast && (narrator === "allan-jackson" || narrator === "jim-cantore")) {
    const windChangeSegs = parseWindChanges(detailedForecast, narrator);
    script.push(...windChangeSegs);
  }

  // Qualifiers — match the detailed forecast for extra context.
  // Now returns multiple matches (humidity, fog, severe storms, etc.)
  if (detailedForecast) {
    const qualClips = getQualifierClips(detailedForecast, narrator);
    for (const qc of qualClips) {
      script.push({ clip: qc, fallbackText: qc.text + "." });
    }
  }

  // Accumulation — JC has dedicated clips for snow/ice/sleet amounts
  if (detailedForecast) {
    const accumClips = getAccumulationClips(detailedForecast, narrator);
    for (const ac of accumClips) {
      script.push({
        clip: { src: ac.src, text: ac.text, confidence: ac.confidence },
        fallbackText: ac.text + "."
      });
    }
  }

  // Rate of precipitation — JC has "at times heavy" / "locally heavy" clips
  if (detailedForecast && narrator === "jim-cantore") {
    const rateClip = getRateOpClip(detailedForecast);
    if (rateClip) {
      script.push({ clip: rateClip, fallbackText: rateClip.text + "." });
    }
  }
}

/** Convert NWS wind direction text ("SW", "NNE", etc.) to degrees. */
function windDirTextToDeg(text: string): number | null {
  if (!text) return null;
  const map: Record<string, number> = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5
  };
  return map[text.toUpperCase()] ?? null;
}

// ───────────────────────── Local Forecast ─────────────────────────

/**
 * Compose narration for the local forecast scene. Reads each period's
 * name, temperature, and short forecast using clips where available.
 */
export function composeLocalForecast(periods: ForecastPeriod[], placeName: string, narrator: NarratorId = "allan-jackson"): PhraseScript {
  const script: PhraseScript = [];
  const def = getNarrator(narrator);
  const useClips = def.hasTemps && def.hasConditions;

  script.push({
    clip: pickSceneIntroClip(narrator, "localForecast") ?? pickSceneIntroClip(narrator, "hourly"),
    fallbackText: `Local forecast for ${placeName}.`
  });

  for (const p of periods) {
    appendPeriodNarration(script, p, false, narrator, def, useClips);
  }

  return script;
}

// ───────────────────────── Overnight / Weekend / Generic ─────────────────────────

/**
 * Compose narration for the overnight forecast scene.
 */
export function composeOvernightForecast(period: ForecastPeriod | null, placeName: string, narrator: NarratorId = "allan-jackson"): PhraseScript {
  const script: PhraseScript = [];
  const def = getNarrator(narrator);
  const useClips = def.hasTemps && def.hasConditions;

  // Use the forecast/hourly intro, NOT "current conditions"
  script.push({
    clip: pickSceneIntroClip(narrator, "localForecast") ?? pickSceneIntroClip(narrator, "hourly"),
    fallbackText: `Tonight's forecast for ${placeName}.`
  });

  if (!period) {
    script.push({ clip: null, fallbackText: "Overnight forecast is not available." });
    return script;
  }

  appendPeriodNarration(script, period, false, narrator, def, useClips);

  return script;
}

/**
 * Compose narration for the weekend forecast scene.
 */
export function composeWeekendForecast(periods: ForecastPeriod[], placeName: string, narrator: NarratorId = "allan-jackson"): PhraseScript {
  const script: PhraseScript = [];
  const def = getNarrator(narrator);
  const useClips = def.hasTemps && def.hasConditions;

  // Weekend-specific intro ("This weekend" / "Heading into the weekend")
  // — falls to TTS rather than reusing the 7-day outlook intro, which
  // sounded identical to the extended forecast opener.
  script.push({
    clip: pickSceneIntroClip(narrator, "weekend"),
    fallbackText: `Weekend forecast for ${placeName}.`
  });

  for (const p of periods) {
    appendPeriodNarration(script, p, false, narrator, def, useClips);
  }

  return script;
}

/**
 * Compose a simple intro-only narration for scenes where we only have
 * a scene intro clip and no structured data clips (detailed conditions,
 * feels like, almanac, travel, temp trend, storm tracker, precip outlook).
 */
export function composeSceneIntro(sceneId: string, narrator: NarratorId = "allan-jackson"): PhraseScript {
  const clip = pickSceneIntroClip(narrator, sceneId);
  if (!clip) return []; // No intro for this narrator — NVDA reads the scene via aria-live
  return [{ clip, fallbackText: "" }];
}

// ───────────────────────── Shared helpers ─────────────────────────

/**
 * Build a natural fallback text for a condition.
 * NWS sends things like "Partly Cloudy" — we want "under partly cloudy skies"
 * to match the style of the AJ clips.
 */
function describeCondition(text: string): string {
  const t = text.toLowerCase();
  // Sky conditions use "under X skies"
  if (/cloudy|clear|sunny|fair/.test(t)) return `under ${t} skies`;
  // Everything else uses "with X"
  return `with ${t}`;
}

/**
 * Map NWS textDescription to the correct CC condition code. Each mapping is
 * verified against Whisper transcription of the actual clip audio.
 *
 * The CC library has two pattern families that matter here:
 *   - Weather conditions: "with snow" (CC1600), "with showers" (CC1100), etc.
 *   - Sky conditions: "under clear skies" (CC3100), "under cloudy skies" (CC2600), etc.
 *
 * Many codes have a +10 "windy" variant (e.g., CC2690 = "under cloudy skies
 * with windy conditions"). When the observation shows wind >= 15 mph, we pick
 * the windy variant if one exists.
 */
export function guessConditionCode(
  text: string | null,
  isWindy: boolean,
  timeHint: TimeHint = null
): number | null {
  if (!text) return null;
  const t = text.toLowerCase();

  // Never narrate "sunny" after dark. NWS usually reports "Clear" at night,
  // but not always — "Mostly Sunny" can linger in an observation near dusk,
  // and the forecast fallback path routes night text through here too.
  if (timeHint === "night" && /sunny|clear|fair/.test(t) && !/partly|mostly cloudy|overcast/.test(t)) {
    return isWindy ? 3190 : 3100; // "under clear skies."
  }

  // ── Thunderstorm family ──
  if (/thunderstorm/.test(t) && /hail/.test(t))              return 1730;
  if (/heavy thunderstorm/.test(t))                           return 402;
  if (/strong thunderstorm|severe thunderstorm/.test(t))      return 422;
  if (/thunderstorm/.test(t))                                 return 400;

  // ── Freezing precipitation ──
  if (/heavy freezing rain/.test(t))                          return 1002;
  if (/freezing rain/.test(t) && isWindy)                     return 1010;
  if (/freezing rain/.test(t))                                return 1000;
  if (/freezing drizzle/.test(t))                             return 800;

  // ── Sleet / ice ──
  if (/heavy sleet/.test(t) && /thunder/.test(t))             return 1832;
  if (/heavy sleet/.test(t))                                  return 1802;
  if (/sleet/.test(t) && /thunder/.test(t))                   return 1811;
  if (/sleet|ice pellets/.test(t))                            return 1800;
  if (/wintry mix/.test(t) && /thunder/.test(t))              return 730;
  if (/wintry mix/.test(t))                                   return 720;

  // ── Snow ──
  if (/heavy snow/.test(t) && /thunder/.test(t))              return 1632;
  if (/heavy snow/.test(t))                                   return isWindy ? 1472 : 1402;
  if (/blowing snow|drifting snow/.test(t))                   return 1500;
  if (/snow shower/.test(t))                                  return 1312;
  if (/flurr/.test(t))                                        return 1310;
  if (/light snow/.test(t))                                   return 1601;
  if (/snow/.test(t) && /thunder/.test(t))                    return 1630;
  if (/snow/.test(t) && /rain/.test(t))                       return 500;
  if (/snow/.test(t))                                         return 1600;

  // ── Rain / showers ──
  if (/heavy rain/.test(t))                                   return isWindy ? 1172 : 1102;
  if (/light rain/.test(t))                                   return 1101;
  if (/shower/.test(t))                                       return isWindy ? 2785 : 1100;
  if (/rain/.test(t))                                         return 1200;

  // ── Drizzle ──
  if (/light drizzle/.test(t))                                return 901;
  if (/drizzle/.test(t) && /fog/.test(t))                     return 910;
  if (/drizzle/.test(t))                                      return 900;

  // ── Dust / sand ──
  if (/dust storm/.test(t))                                   return 1939;
  if (/sandstorm/.test(t))                                    return 1929;
  if (/blowing dust/.test(t))                                 return 1900;
  if (/blowing sand/.test(t))                                 return 1910;

  // ── Fog / haze / smoke ──
  if (/fog/.test(t))                                          return 2000;
  if (/haz[ey]/.test(t))                                      return 2100;
  if (/smok[ey]/.test(t))                                     return 2200;

  // ── Wind only ──
  if (/^wind/.test(t) || /^breezy/.test(t))                   return 2410;

  // ── Sky conditions ──
  if (/overcast|cloudy/.test(t) && !/partly|mostly/.test(t))  return isWindy ? 2690 : 2600;
  if (/mostly cloudy/.test(t))                                return isWindy ? 2790 : 2700;
  if (/partly cloudy|partly sunny/.test(t))                   return isWindy ? 2990 : 2900;
  if (/mostly clear|mostly sunny/.test(t))                    return isWindy ? 3190 : 3100;
  if (/clear/.test(t))                                        return isWindy ? 3190 : 3100;
  if (/sunny/.test(t))                                        return isWindy ? 3290 : 3200;
  if (/fair/.test(t))                                         return isWindy ? 3390 : 3400;

  return null;
}

/**
 * Map NWS shortForecast to a CCSH standalone forecast code. The CCSH
 * library has 302 clips covering every combination of weather condition,
 * time-of-day, wind, and transitions. These are complete sentences.
 *
 * Code ranges:
 *   0-999:    Base conditions (thunderstorms, mixed precip, drizzle, sky)
 *   1000-1999: Freezing rain, rain, snow, sleet
 *   2000-2999: Fog, haze, cloudy
 *   3000-3999: Partly cloudy, fair, few clouds, scattered storms
 *   4000-4999: Heavy/at-times/scattered variants
 *   5000-5999: Mixed precip, squalls, blizzard
 *   6000-6999: "Early" / "morning" time-of-day variants
 *   7000-7999: "Late" / "afternoon" / "overnight" variants
 *   8000-8999: Transition conditions (changing to)
 *   9000-9999: Clearing, fog developing
 *
 * Windy variants are typically code+10 (e.g., 3000=partly cloudy, 3010=partly cloudy and windy).
 */
export function guessCcshForecastCode(text: string | null, timeHint: TimeHint, isWindy: boolean): number | null {
  if (!text) return null;
  const t = text.toLowerCase();
  const w = isWindy;

  // ── Transitions (highest priority — "rain then snow") ──
  if (/rain.*chang.*snow|rain.*then.*snow/.test(t))        return w ? 8010 : 8000;
  if (/rain.*chang.*ice|rain.*then.*ice/.test(t))          return w ? 8110 : 8100;
  if (/snow.*chang.*rain|snow.*then.*rain/.test(t))        return w ? 8210 : 8200;
  if (/snow.*ice.*chang.*rain|wintry.*chang.*rain/.test(t)) return w ? 8310 : 8300;
  if (/snow.*chang.*ice/.test(t))                          return w ? 8410 : 8400;
  if (/ice.*chang.*rain/.test(t))                          return w ? 8510 : 8500;
  if (/ice.*chang.*snow/.test(t))                          return w ? 8610 : 8600;
  if (/snow.*chang.*wintry|snow.*then.*wintry/.test(t))    return w ? 8810 : 8800;
  if (/wintry.*chang.*rain|wintry.*then.*rain/.test(t))    return w ? 8910 : 8900;
  if (/rain.*then.*wintry/.test(t))                        return w ? 9510 : 9500;

  // ── Clearing / fog developing ──
  if (/clearing/.test(t) && /fog/.test(t))                 return w ? 9110 : 9100;
  if (/clearing|becoming sunny/.test(t))                   return w ? 9010 : 9000;
  if (/fog.*develop/.test(t))                              return w ? 9310 : 9300;
  if (/fog.*then.*cloudy/.test(t))                         return w ? 9210 : 9200;
  if (/fog.*then.*sun/.test(t))                            return w ? 9113 : 9103;

  // ── Blizzard ──
  if (/blizzard/.test(t))                                  return 4300;

  // ── Time-of-day: morning/early (6xxx) ──
  if (timeHint === "morning" || /early|ending/.test(t)) {
    if (/thunder/.test(t) && /shower/.test(t))             return w ? 6170 : 6140;
    if (/thunderstorm/.test(t))                            return w ? 6213 : 6203;
    if (/rain.*snow/.test(t))                              return w ? 6413 : 6403;
    if (/rain.*ice/.test(t))                               return w ? 6513 : 6503;
    if (/freezing rain.*sleet/.test(t))                    return w ? 6610 : 6603;
    if (/wintry mix/.test(t))                              return w ? 6713 : 6703;
    if (/snow.*shower/.test(t))                            return w ? 6813 : 6803;
    if (/light snow/.test(t))                              return w ? 6914 : 6904;
    if (/snow/.test(t))                                    return w ? 6913 : 6903;
    if (/light rain/.test(t))                              return w ? 6314 : 6304;
    if (/rain.*ending|periods.*rain/.test(t))              return w ? 6310 : 6300;
    if (/rain/.test(t))                                    return w ? 6313 : 6303;
    if (/shower.*ending|shower/.test(t))                   return w ? 6113 : 6103;
    if (/drizzle/.test(t))                                 return w ? 6013 : 6003;
  }

  // ── Time-of-day: afternoon/late/overnight (7xxx) ──
  if (timeHint === "afternoon" || timeHint === "night" || /late|overnight|developing|afternoon/.test(t)) {
    if (/thunder.*shower/.test(t))                         return w ? 7173 : 7143;
    if (/thunderstorm/.test(t))                            return w ? 7213 : 7203;
    if (/rain.*snow/.test(t))                              return w ? 7413 : 7403;
    if (/rain.*ice/.test(t))                               return w ? 7513 : 7503;
    if (/freezing rain|icy mix/.test(t))                   return w ? 7613 : 7603;
    if (/wintry mix/.test(t))                              return w ? 7713 : 7703;
    if (/snow.*shower/.test(t))                            return w ? 7813 : 7803;
    if (/light snow/.test(t))                              return w ? 7914 : 7904;
    if (/snow/.test(t))                                    return w ? 7913 : 7903;
    if (/light rain/.test(t))                              return w ? 7314 : 7304;
    if (/rain.*develop|rain/.test(t))                      return w ? 7313 : 7303;
    if (/shower/.test(t))                                  return w ? 7113 : 7103;
    if (/drizzle/.test(t))                                 return w ? 7013 : 7003;
  }

  // ── Scattered / isolated / chance ──
  if (/scattered.*strong.*thunder/.test(t))                return w ? 5710 : 5700;
  if (/scattered.*thunder/.test(t))                        return w ? 3810 : 3800;
  if (/slight.*chance.*thunder|isolated.*thunder/.test(t)) return w ? 3710 : 3700;
  if (/scattered.*snow.*shower/.test(t))                   return w ? 4110 : 4100;
  if (/scattered.*shower/.test(t))                         return w ? 3910 : 3900;
  if (/scattered.*flurr/.test(t))                          return w ? 4810 : 4800;
  if (/few.*shower/.test(t))                               return w ? 4610 : 4600;
  if (/few.*snow.*shower/.test(t))                         return w ? 4710 : 4700;
  if (/sprinkle/.test(t))                                  return w ? 4510 : 4500;

  // ── Severe / strong ──
  if (/strong.*thunder|severe.*thunder/.test(t))           return w ? 310 : 300;

  // ── Thunder + rain ──
  if (/thunder.*heavy.*rain/.test(t))                      return w ? 412 : 402;
  if (/shower.*thunder|rain.*thunder/.test(t))             return w ? 1170 : 1140;
  if (/thunderstorm/.test(t))                              return w ? 410 : 400;
  if (/snow.*thunder/.test(t))                             return w ? 5610 : 5600;

  // ── Heavy variants ──
  if (/heavy.*rain.*at.*time|rain.*heavy/.test(t))         return w ? 4010 : 4000;
  if (/heavy.*snow|snow.*heavy/.test(t))                   return w ? 4210 : 4200;

  // ── Freezing precipitation ──
  if (/heavy.*freezing rain/.test(t))                      return 1002;
  if (/light.*freezing rain.*sleet/.test(t))               return w ? 5111 : 5101;
  if (/freezing rain.*sleet|sleet.*freezing rain/.test(t)) return w ? 5110 : 5100;
  if (/light.*freezing rain/.test(t))                      return w ? 1011 : 1001;
  if (/freezing rain/.test(t))                             return w ? 1010 : 1000;
  if (/freezing drizzle.*fog/.test(t))                     return 850;
  if (/freezing drizzle/.test(t))                          return w ? 810 : 800;

  // ── Mixed precipitation ──
  if (/blowing snow/.test(t))                              return 5000;
  if (/snow.*sleet/.test(t))                               return w ? 5210 : 5200;
  if (/rain.*freezing rain/.test(t))                       return w ? 5310 : 5300;
  if (/rain.*snow.*shower/.test(t))                        return w ? 4910 : 4900;
  if (/rain.*snow|snow.*rain/.test(t))                     return w ? 510 : 500;
  if (/rain.*sleet|sleet.*rain/.test(t))                   return w ? 610 : 600;
  if (/light.*wintry mix/.test(t))                         return w ? 711 : 701;
  if (/wintry mix/.test(t))                                return w ? 710 : 700;

  // ── Snow ──
  if (/snow.*shower.*at.*time/.test(t))                    return w ? 4110 : 4100;
  if (/snow.*shower/.test(t))                              return w ? 1410 : 1400;
  if (/flurr/.test(t))                                     return w ? 1310 : 1300;
  if (/light snow.*fog/.test(t))                           return 1651;
  if (/light snow/.test(t))                                return w ? 1611 : 1601;
  if (/snow/.test(t))                                      return w ? 1610 : 1600;

  // ── Rain / showers ──
  if (/shower.*at.*time/.test(t))                          return 5500;
  if (/shower/.test(t))                                    return w ? 1110 : 1100;
  if (/light rain.*fog/.test(t))                           return 1251;
  if (/light rain/.test(t))                                return w ? 1211 : 1201;
  if (/rain.*rumble/.test(t))                              return w ? 1270 : 1240;
  if (/rain/.test(t))                                      return w ? 1210 : 1200;

  // ── Sleet ──
  if (/light sleet/.test(t))                               return 1801;
  if (/sleet/.test(t))                                     return w ? 1810 : 1800;

  // ── Drizzle ──
  if (/drizzle.*fog/.test(t))                              return 950;
  if (/drizzle/.test(t))                                   return w ? 910 : 900;

  // ── Fog / haze / smoke ──
  if (/fog/.test(t))                                       return w ? 2010 : 2000;
  if (/haz/.test(t))                                       return w ? 2110 : 2100;

  // ── Sky conditions ──
  if (/overcast|^cloudy/.test(t))                          return w ? 2610 : 2600;
  if (/mostly cloudy/.test(t))                             return w ? 2810 : 2800;
  if (/partly cloudy|partly sunny/.test(t))                return w ? 3010 : 3000;
  if (/few cloud/.test(t))                                 return w ? 3410 : 3400;
  if (/clear|sunny/.test(t))                               return w ? 3210 : 3200;
  if (/fair/.test(t))                                      return w ? 3210 : 3200;

  return null;
}

/**
 * Map NWS shortForecast to a CCEF extended-forecast condition code.
 * CCEF clips are "with X" phrases that attach to temperature readings —
 * they're designed to follow "high of 82" with "with scattered thunderstorms".
 *
 * The CCEF library has 49 base codes plus time-of-day variants (6xxx morning,
 * 7xxx afternoon) and transition phrases (8xxx). It overlaps with CCSH but
 * uses forecast-appropriate wording.
 *
 * Code ranges:
 *   300-3900:  Base forecast conditions
 *   4000-5710: Heavy/scattered/mixed variants
 *   6003-6903: Morning time-of-day variants
 *   7103-7903: Afternoon/evening variants
 *   8000-8400: Transition conditions (rain turning to snow, etc.)
 *   9003:      Morning clouds
 */
export function guessCcefForecastCode(text: string | null, timeHint: TimeHint, _isWindy: boolean): number | null {
  if (!text) return null;
  const t = text.toLowerCase();

  // ── Transitions ──
  if (/rain.*then.*snow|rain.*chang.*snow/.test(t))           return 8000;
  if (/snow.*then.*rain|snow.*chang.*rain/.test(t))           return 8200;
  if (/wintry.*then.*rain|wintry.*chang.*rain/.test(t))       return 8300;
  if (/snow.*freez.*rain|snow.*and.*ice/.test(t))             return 8400;

  // ── Time-of-day: morning (6xxx) ──
  // Specific compounds MUST come before their general fallbacks — /shower/
  // would swallow "snow showers" and /rain/ would swallow "rain and snow".
  // (The CCSH blocks below always had this ordering; these two didn't.)
  if (timeHint === "morning" || /early|ending/.test(t)) {
    if (/drizzle/.test(t))                                    return 6003;
    if (/rain.*snow/.test(t))                                 return 6403;
    if (/wintry mix/.test(t))                                 return 6703;
    if (/snow.*shower/.test(t))                               return 6803;
    if (/shower/.test(t) && !(/thunder/.test(t)))             return 6103;
    if (/thunderstorm/.test(t))                               return 6143;
    if (/rain/.test(t))                                       return 6303;
    if (/snow/.test(t))                                       return 6903;
    if (/cloud/.test(t))                                      return 9003;
  }

  // ── Time-of-day: afternoon/evening (7xxx) ──
  if (timeHint === "afternoon" || timeHint === "night" || /late|overnight|developing|afternoon/.test(t)) {
    if (/rain.*snow/.test(t))                                 return 7403;
    if (/snow.*shower/.test(t))                               return 7803;
    if (/shower/.test(t) && !(/thunder/.test(t)))             return 7103;
    if (/thunderstorm/.test(t))                               return 7143;
    if (/rain/.test(t))                                       return 7303;
    if (/snow/.test(t))                                       return 7903;
  }

  // ── Scattered / isolated ──
  if (/scattered.*strong.*thunder/.test(t))                   return 5700;
  if (/scattered.*thunder/.test(t))                           return 3800;
  if (/slight.*chance.*thunder|isolated.*thunder/.test(t))    return 3700;
  if (/scattered.*snow.*shower/.test(t))                      return 4100;
  if (/scattered.*shower/.test(t))                            return 3900;
  if (/few.*shower/.test(t))                                  return 4500;

  // ── Severe ──
  if (/strong.*thunder|severe.*thunder/.test(t))              return 300;

  // ── Heavy ──
  if (/heavy.*rain/.test(t))                                  return 4000;
  if (/heavy.*snow/.test(t))                                  return 4200;

  // ── Freezing ──
  if (/freezing rain.*sleet/.test(t))                         return 5100;
  if (/freezing rain/.test(t))                                return 1000;
  if (/freezing drizzle/.test(t))                             return 800;

  // ── Mixed ──
  if (/snow.*sleet/.test(t))                                  return 5200;
  if (/rain.*freezing rain/.test(t))                          return 5300;
  if (/rain.*snow/.test(t))                                   return 500;
  if (/rain.*sleet/.test(t))                                  return 600;
  if (/wintry mix/.test(t))                                   return 700;

  // ── Snow ──
  if (/snow.*shower/.test(t))                                 return 1400;
  if (/flurr/.test(t))                                        return 1300;
  if (/light snow/.test(t))                                   return 1601;
  if (/snow/.test(t))                                         return 1600;

  // ── Rain / showers ──
  if (/thunderstorm/.test(t))                                 return 400;
  if (/shower/.test(t))                                       return 1100;
  if (/light rain/.test(t))                                   return 1201;
  if (/rain/.test(t))                                         return 1200;

  // ── Sleet ──
  if (/sleet/.test(t))                                        return 1800;

  // ── Drizzle ──
  if (/drizzle/.test(t))                                      return 900;

  // ── Fog / haze ──
  if (/fog/.test(t))                                          return 2000;
  if (/haz/.test(t))                                          return 2100;

  // ── Sky conditions ──
  if (/overcast|cloudy/.test(t) && !/partly|mostly/.test(t))  return 2600;
  if (/mostly cloudy/.test(t))                                return 2800;
  if (/partly cloudy/.test(t))                                return 3000;
  // Clear/sunny: NOT at night. The Ext_Fcast pool has no "clear skies" clip —
  // 3200 and 3400 both say "under sunny skies", so a night period forecast as
  // "Mostly Clear" narrated as sunny at 11pm. Returning null here hands the
  // period to the CC-family fallback, which does have 3100 "under clear
  // skies." See appendCcshOrCcFallback / nightSkyConditionCode.
  if (/clear|sunny/.test(t))                                  return timeHint === "night" ? null : 3200;

  return null;
}

/**
 * Night-appropriate sky-condition code from the CC family.
 *
 * The extended-forecast clip pool only ever says "sunny", so clear night
 * skies have to borrow from the current-conditions pool, which has both.
 * Returns null when the text isn't a plain clear/sunny sky description.
 */
export function nightSkyConditionCode(text: string | null, isWindy: boolean): number | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/partly|mostly cloudy|overcast/.test(t)) return null;
  if (!/clear|sunny|fair/.test(t)) return null;
  return isWindy ? 3190 : 3100; // "under clear skies[ with windy conditions]."
}

/**
 * Determine a time-of-day hint from the NWS period name.
 * "Tonight", "Monday Night" → "night"; "This Afternoon" → "afternoon";
 * "Monday" (daytime) → "day"; etc.
 */
export type TimeHint = "morning" | "afternoon" | "night" | "day" | null;

/**
 * Day or night for a current observation.
 *
 * Current conditions carry no NWS period name, so there is nothing to parse
 * a time hint out of. With a coordinate we use real solar times; without
 * one, fall back to a clock heuristic, which is crude but still beats
 * assuming daytime and announcing sunny skies at midnight.
 */
export function observationTimeHint(obs: Observation, coord?: LatLon | null): TimeHint {
  const at = obs.observedAt instanceof Date && !Number.isNaN(obs.observedAt.getTime())
    ? obs.observedAt
    : new Date();
  if (coord) {
    try {
      const { sunrise, sunset } = getSunTimes(coord, at);
      return at >= sunrise && at < sunset ? "day" : "night";
    } catch {
      // Fall through to the clock heuristic.
    }
  }
  const hour = at.getHours();
  return hour >= 7 && hour < 19 ? "day" : "night";
}

export function periodTimeHint(periodName: string, isDaytime: boolean): TimeHint {
  const n = periodName.toLowerCase();
  if (/tonight|overnight/.test(n)) return "night";
  if (/night/.test(n)) return "night";
  if (/this morning/.test(n)) return "morning";
  if (/this afternoon/.test(n)) return "afternoon";
  // Generic daytime/nighttime periods like "Monday", "Tuesday Night"
  return isDaytime ? "day" : "night";
}

function compass(deg: number): string {
  const dirs = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  return dirs[Math.round(deg / 45) % 8];
}

// ───────────────────────── Period name clips ─────────────────────────

/**
 * Map an NWS period name to a VocalLocal period clip. The Periods2/
 * directory has clips like MON.mp3, TUE.mp3, TONIGHT1.mp3, etc.
 *
 * When `isLast` is true, uses the *4.mp3 variant which says
 * "and on Monday" instead of just "Monday" — for the final period
 * in the extended forecast to sound natural.
 *
 * Period names from NWS: "Monday", "Monday Night", "Tonight",
 * "This Afternoon", "Tuesday", etc.
 */
function getPeriodClip(periodName: string, narratorId: NarratorId, isLast = false): ClipResolution | null {
  const key = periodNameToKey(periodName);
  if (!key) return null;
  const clip = getLibrary(narratorId).resolve(Sem.period(key));
  if (!clip) return null;

  // For the final period, swap to the "and on Monday." / "and Monday
  // night." variants so the forecast closes naturally. AJ and JC both
  // have the MON4 / MON5 family under their Periods2 directory; other
  // narrators fall through with the bare clip.
  if (isLast && (narratorId === "allan-jackson" || narratorId === "jim-cantore")) {
    const lastVariant = LAST_PERIOD_VARIANT[key];
    if (lastVariant) {
      const src = clip.src.replace(/[^/]+\.mp3$/, lastVariant.file);
      return { src, text: lastVariant.text, confidence: clip.confidence };
    }
  }

  return clip;
}

/**
 * Final-period ("and on …") swaps. Keys are registry PeriodKeys; values
 * point at the MON4 / MON5 family clips — daytime uses the "and on
 * Monday." form, nights use "and Monday night.". TODAY/TONIGHT/OVERNIGHT
 * have no closing variant and are omitted. AJ and JC share the exact
 * same filenames under their respective Periods2 directories.
 */
const LAST_PERIOD_VARIANT: Partial<Record<PeriodKey, { file: string; text: string }>> = {
  MON: { file: "MON4.mp3", text: "and on Monday." },
  TUE: { file: "TUE4.mp3", text: "and on Tuesday." },
  WED: { file: "WED4.mp3", text: "and on Wednesday." },
  THU: { file: "THU4.mp3", text: "and on Thursday." },
  FRI: { file: "FRI4.mp3", text: "and on Friday." },
  SAT: { file: "SAT4.mp3", text: "and on Saturday." },
  SUN: { file: "SUN4.mp3", text: "and on Sunday." },
  MON_NIGHT: { file: "MON5.mp3", text: "and Monday night." },
  TUE_NIGHT: { file: "TUE5.mp3", text: "and Tuesday night." },
  WED_NIGHT: { file: "WED5.mp3", text: "and Wednesday night." },
  THU_NIGHT: { file: "THU5.mp3", text: "and Thursday night." },
  FRI_NIGHT: { file: "FRI5.mp3", text: "and Friday night." },
  SAT_NIGHT: { file: "SAT5.mp3", text: "and Saturday night." },
  SUN_NIGHT: { file: "SUN5.mp3", text: "and Sunday night." },
};

/** Map a free-form NWS period name ("Monday Night", "Tuesday") to a
 * registry `PeriodKey`. Returns null for names without a clean clip
 * (e.g. "This Afternoon" — handled by TTS fallback). */
function periodNameToKey(periodName: string): PeriodKey | null {
  const n = periodName.toLowerCase();
  if (/^tonight/.test(n))   return "TONIGHT";
  if (/^overnight/.test(n)) return "OVERNIGHT";
  if (/^today/.test(n))     return "TODAY";
  if (/afternoon/.test(n))  return "AFTERNOON";

  const dayMap: Record<string, Weekday> = {
    monday: "MON", tuesday: "TUE", wednesday: "WED", thursday: "THU",
    friday: "FRI", saturday: "SAT", sunday: "SUN",
  };
  const dayMatch = n.match(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  if (!dayMatch) return null;
  const day = dayMap[dayMatch[1]];
  return /night$/.test(n) ? `${day}_NIGHT` as PeriodKey : day;
}

/** Per-narrator temperature / condition-code dispatch. All delegate to the
 * semantic registry, which handles AJ's zero-padding for CCSH, JC's ranges,
 * and pulls display text from the reference table when available. */
function getNumberClipForNarrator(value: number, narratorId: NarratorId): ClipResolution | null {
  return getLibrary(narratorId).resolve(Sem.temp(value));
}

function getConditionClipForNarrator(code: number, narratorId: NarratorId): ClipResolution | null {
  return getLibrary(narratorId).resolve(Sem.cc(code));
}

function getCcshClipForNarrator(code: number, narratorId: NarratorId): ClipResolution | null {
  return getLibrary(narratorId).resolve(Sem.ccsh(code));
}

// ───────────────────────── Wind clips (AJ + JC) ─────────────────────────

/**
 * Wind speed ranges. Both AJ and JC have the same AT_* files.
 * The observed wind speed is bucketed into the nearest range.
 */
const WIND_SPEED_RANGES = [
  { max: 5,   file: "Below_5" },
  { max: 10,  file: "5_10" },
  { max: 15,  file: "10_15" },
  { max: 20,  file: "10_20" },
  { max: 25,  file: "15_25" },
  { max: 30,  file: "20_30" },
  { max: 35,  file: "25_35" },
  { max: 40,  file: "25_40" },
  { max: 50,  file: "35_50" },
  { max: 60,  file: "40_60" },
  { max: 70,  file: "50_70" },
  { max: 80,  file: "60_80" },
  { max: 90,  file: "70_90" },
  { max: 100, file: "80_100" },
];

function getWindSpeedRange(mph: number): string {
  for (const r of WIND_SPEED_RANGES) {
    if (mph <= r.max) return r.file;
  }
  return "80_100";
}

/** Map compass degrees to the 16-point direction code used by wind clips. */
function compassCode16(deg: number): CompassDir {
  const codes: CompassDir[] = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return codes[Math.round(deg / 22.5) % 16];
}

/** Compose wind clips for the given narrator. The registry handles folder
 * quirks (AJ Winds_Misc vs JC Wind_Misc) and narrator-specific dir variants. */
function getWindClips(dirDeg: number | null, speedMph: number, narratorId: NarratorId = "allan-jackson"): PhraseSegment[] {
  const lib = getLibrary(narratorId);
  const segs: PhraseSegment[] = [];
  if (dirDeg != null) {
    const clip = lib.resolve(Sem.windDir1(compassCode16(dirDeg)));
    if (clip) segs.push({ clip, fallbackText: `${compass(dirDeg)} winds` });
  }
  if (speedMph > 0) {
    const clip = lib.resolve(Sem.windAtSpeed(getWindSpeedRange(speedMph) as WindRange));
    if (clip) segs.push({ clip, fallbackText: `at ${speedMph} miles per hour` });
  } else {
    const clip = lib.resolve(Sem.windCalm());
    if (clip) segs.push({ clip, fallbackText: "Winds calm." });
  }
  return segs;
}

// ───────────────────────── Qualifier clips (AJ + JC) ─────────────────────────

/**
 * Weather qualifier code mappings. These come from Wx_Phrases_Qualifiers/
 * and add nuance after the main forecast condition:
 *   "Partly cloudy." + "Humid." or "A few storms may be severe."
 *
 * Pattern-matched against NWS detailedForecast text.
 * Only the first match is used (highest priority = most severe/specific).
 */
const QUALIFIER_PATTERNS: Array<{ pattern: RegExp; code: number; text: string }> = [
  // Thunderstorm severity (highest priority)
  { pattern: /tornado/i,                                    code: 8060, text: "Storms could contain tornadoes" },
  { pattern: /large hail.*(strong|damaging) wind/i,         code: 8075, text: "Storms may produce large hail and strong winds" },
  { pattern: /large hail/i,                                 code: 8045, text: "Storms could contain large hail" },
  { pattern: /damaging wind/i,                              code: 8030, text: "Storms could contain damaging winds" },
  { pattern: /storms? may be severe/i,                      code: 8010, text: "A few storms may be severe" },
  { pattern: /frequent lightning/i,                         code: 8015, text: "Storms could contain frequent lightning" },

  // Flooding
  { pattern: /significant flooding/i,                       code: 5047, text: "Significant flooding is expected" },
  { pattern: /flash flood/i,                                code: 5046, text: "Localized flooding is expected" },
  { pattern: /flooding.*poor drainage/i,                    code: 5045, text: "Flooding possible in poor drainage areas" },
  { pattern: /locally heavy rain/i,                         code: 5050, text: "Locally heavy rainfall possible" },

  // Fog
  { pattern: /dense.*morning fog/i,                         code: 910, text: "Areas of dense morning fog" },
  { pattern: /dense fog/i,                                  code: 905, text: "Areas of dense fog" },
  { pattern: /fog.*drizzle/i,                               code: 920, text: "Areas of fog with some patchy drizzle" },

  // Wind gusts
  { pattern: /gust.*over 100/i,                             code: 1025, text: "Winds could occasionally gust over 100 mph" },
  { pattern: /gust.*over 80/i,                              code: 1024, text: "Winds could occasionally gust over 80 mph" },
  { pattern: /gust.*over 60/i,                              code: 1023, text: "Winds could occasionally gust over 60 mph" },
  { pattern: /gust.*over 50/i,                              code: 1022, text: "Winds could occasionally gust over 50 mph" },
  { pattern: /gust.*over 40/i,                              code: 1021, text: "Winds could occasionally gust over 40 mph" },

  // Blowing snow / blizzard
  { pattern: /blowing.*drifting snow/i,                     code: 1020, text: "Blowing snow and local ground blizzards" },
  { pattern: /blowing snow/i,                               code: 1017, text: "Some blowing and drifting snow" },

  // Temperature qualifiers
  { pattern: /bitterly cold/i,                              code: 735, text: "Bitterly cold" },
  { pattern: /record high/i,                                code: 616, text: "Record high temperatures expected" },
  { pattern: /record low/i,                                 code: 731, text: "Record low temperatures expected" },
  { pattern: /much warmer/i,                                code: 2025, text: "Much warmer" },
  { pattern: /much colder/i,                                code: 2525, text: "Much colder" },
  { pattern: /turning warmer/i,                             code: 2015, text: "Turning warmer" },
  { pattern: /turning colder/i,                             code: 2520, text: "Turning colder" },
  { pattern: /turning cooler/i,                             code: 2515, text: "Turning cooler" },
  { pattern: /not as cold/i,                                code: 2010, text: "Not as cold" },
  { pattern: /not as hot/i,                                 code: 2510, text: "Not as hot" },
  { pattern: /not as warm/i,                                code: 2513, text: "Not as warm" },

  // Humidity
  { pattern: /hazy.*hot.*humid/i,                           code: 806, text: "Hazy, hot and humid" },
  { pattern: /hot and humid/i,                              code: 804, text: "Hot and humid" },
  { pattern: /warm and humid/i,                             code: 802, text: "Warm and humid" },
  { pattern: /muggy/i,                                      code: 808, text: "Muggy" },

  // Frost/freeze
  { pattern: /hard freeze/i,                                code: 3015, text: "Hard freeze expected" },
  { pattern: /widespread frost/i,                           code: 3010, text: "Widespread frost likely" },
  { pattern: /scattered frost/i,                            code: 3005, text: "Scattered frost possible" },

  // Snow accumulation
  { pattern: /storm accumulations? 12.?18/i,                code: 7885, text: "Total storm accumulations 12-18 inches" },
  { pattern: /storm accumulations? 8.?12/i,                 code: 7882, text: "Total storm accumulations 8-12 inches" },
  { pattern: /storm accumulations? 5.?8/i,                  code: 7879, text: "Total storm accumulations 5-8 inches" },
  { pattern: /storm accumulations? 3.?6/i,                  code: 7876, text: "Total storm accumulations 3-6 inches" },
  { pattern: /storm accumulations? 2.?4/i,                  code: 7875, text: "Total storm accumulations 2-4 inches" },
  { pattern: /storm accumulations? 1.?3/i,                  code: 7872, text: "Total storm accumulations 1-3 inches" },

  // Freezing rain/ice
  { pattern: /significant icing/i,                          code: 7643, text: "Significant icing possible" },
  { pattern: /freezing rain/i,                              code: 7615, text: "Areas of freezing rain possible" },
  { pattern: /freezing drizzle/i,                           code: 7610, text: "Patchy freezing drizzle possible" },

  // Blowing dust / smoke
  { pattern: /blowing dust/i,                               code: 4005, text: "Areas of blowing dust" },
  { pattern: /visibilit.*smoke/i,                           code: 4010, text: "Visibilities reduced by smoke" },

  // Precipitation modifiers
  { pattern: /showers? tapering/i,                          code: 5035, text: "Showers tapering off" },
  { pattern: /rain.*ending/i,                               code: 5040, text: "Rain or showers ending" },
  { pattern: /drizzle ending/i,                             code: 5030, text: "Drizzle ending" },
  { pattern: /slight chance.*(shower|rain)/i,               code: 5015, text: "Slight chance of a rain shower" },
  { pattern: /patchy drizzle/i,                             code: 5012, text: "Patchy drizzle possible" },
  { pattern: /precipitation ending/i,                       code: 7605, text: "Precipitation ending" },

  // Winter precipitation
  { pattern: /snow.*mix.*rain/i,                            code: 7845, text: "Some rain may mix in" },
  { pattern: /rain.*start.*freezing/i,                      code: 7640, text: "Rain may start as a period of freezing rain" },
  { pattern: /rain.*freeze.*surface/i,                      code: 7635, text: "Rain may freeze on some surfaces" },
  { pattern: /wintry mix/i,                                 code: 7620, text: "Some mixed winter precipitation possible" },
  { pattern: /sleet.*freezing rain/i,                       code: 7646, text: "Some sleet or freezing rain possible" },
  { pattern: /flurries.*snow shower/i,                      code: 7815, text: "A few flurries or snow showers possible" },
  { pattern: /snow.*ending/i,                               code: 7810, text: "Snow ending" },
  { pattern: /snow showers.*ending/i,                       code: 7805, text: "Snow showers and flurries ending" },
  { pattern: /snow.*inch.*per hour/i,                       code: 7874, text: "Snowfall rates of an inch or more per hour" },
  { pattern: /whiteout/i,                                   code: 7715, text: "Brief whiteouts in intense snow squalls" },

  // Stray storms
  { pattern: /stray.*(thunderstorm|shower)/i,               code: 8001, text: "A stray shower or thunderstorm is possible" },
  { pattern: /lingering.*shower.*thunderstorm.*end/i,       code: 8002, text: "Any lingering showers or thunderstorms will end" },

  // Coastal flooding
  { pattern: /coastal flood/i,                              code: 1015, text: "Coastal flooding possible at high tide" },

  // Canyon/mountain winds
  { pattern: /winds.*canyon/i,                              code: 1005, text: "Stronger winds in and below canyons and passes" },
  { pattern: /tropical storm.*wind/i,                       code: 1026, text: "Tropical storm force winds expected" },
  { pattern: /hurricane.*wind/i,                            code: 1030, text: "Hurricane force winds expected" },

  // Temperature (less specific — lower priority)
  { pattern: /\bvery hot\b/i,                               code: 605, text: "Very hot" },
  { pattern: /\bhot\b(?!.*humid)/i,                         code: 604, text: "Hot" },
  { pattern: /\bvery cold\b/i,                              code: 706, text: "Very cold" },
  { pattern: /\bvery warm\b/i,                              code: 602, text: "Very warm" },
  { pattern: /cooler.*less humid/i,                         code: 2504, text: "Cooler and less humid" },
];

/**
 * Match NWS detailed forecast text against qualifier patterns.
 * Returns clips for all matching qualifiers (up to 3), not just the first.
 * Patterns are ordered by priority — most severe/specific first.
 */
function getQualifierClips(detailedForecast: string, narratorId: NarratorId): ClipResolution[] {
  if (!detailedForecast) return [];
  const lib = getLibrary(narratorId);
  const results: ClipResolution[] = [];
  const usedCodes = new Set<number>();

  for (const q of QUALIFIER_PATTERNS) {
    if (results.length >= 3) break; // Cap at 3 qualifiers to avoid overly long narration
    if (q.pattern.test(detailedForecast) && !usedCodes.has(q.code)) {
      usedCodes.add(q.code);
      const clip = lib.resolve(Sem.qualifier(q.code));
      // Prefer the pattern's curated text (matched against the forecast) over
      // whatever Whisper heard — the pattern text is the canonical phrasing.
      if (clip) results.push({ ...clip, text: q.text });
    }
  }
  return results;
}

// ───────────────────────── Wind change clips (becoming/shifting/increasing/diminishing) ─────

/**
 * Parse NWS detailed forecast text for wind direction/speed changes.
 * Returns clip segments for phrases like:
 *   "becoming northwest" → Wind_Becoming/Bec_NW.mp3
 *   "increasing to 15 to 25 mph" → Wind_Increasing/Inc_15_25.mp3
 *   "diminishing to 5 to 10 mph" → Wind_Diminishing/Dim_5_10.mp3
 *   "shifting to southeast" → Wind_Shifting/Shift_SE.mp3
 */
function parseWindChanges(detailedForecast: string, narratorId: NarratorId): PhraseSegment[] {
  const lib = getLibrary(narratorId);
  const segs: PhraseSegment[] = [];
  const text = detailedForecast.toLowerCase();

  // "becoming {direction}" — wind direction change
  const becDir = text.match(/becoming\s+(north|south|east|west|n(?:n?[ew]|[ew])?|s(?:s?[ew]|[ew])?|e(?:ne|se)?|w(?:nw|sw)?)\b/i);
  if (becDir) {
    const code = dirTextToCode(becDir[1]);
    const clip = code && lib.resolve(Sem.windBecoming(code));
    if (clip) segs.push({ clip, fallbackText: `becoming ${becDir[1]}.` });
  }

  // "shifting to {direction}" — only if no "becoming" already matched
  const shiftDir = text.match(/shifting\s+to\s+(north|south|east|west|n(?:n?[ew]|[ew])?|s(?:s?[ew]|[ew])?|e(?:ne|se)?|w(?:nw|sw)?)\b/i);
  if (shiftDir && !becDir) {
    const code = dirTextToCode(shiftDir[1]);
    const clip = code && lib.resolve(Sem.windShifting(code));
    if (clip) segs.push({ clip, fallbackText: `shifting to ${shiftDir[1]}.` });
  }

  // "increasing to X to Y mph" — try compound "and-increasing" first if a
  // direction change preceded it (smoother flow). Falls back to plain form
  // when the narrator lacks the compound clip (JC).
  const incMatch = text.match(/increasing\s+to\s+(\d+)\s+to\s+(\d+)/i);
  if (incMatch) {
    const range = getWindSpeedRange(Math.round((Number(incMatch[1]) + Number(incMatch[2])) / 2)) as WindRange;
    const fallback = `increasing to ${incMatch[1]} to ${incMatch[2]} miles per hour.`;
    const compound = segs.length > 0 ? lib.resolve(Sem.windAndInc(range)) : null;
    const clip = compound ?? lib.resolve(Sem.windInc(range));
    if (clip) segs.push({ clip, fallbackText: compound ? `and ${fallback}` : fallback });
  }

  // "diminishing to X to Y mph" (or "decreasing to") — same compound/fallback.
  const dimMatch = text.match(/(?:diminishing|decreasing)\s+to\s+(\d+)\s+to\s+(\d+)/i);
  if (dimMatch) {
    const range = getWindSpeedRange(Math.round((Number(dimMatch[1]) + Number(dimMatch[2])) / 2)) as WindRange;
    const fallback = `diminishing to ${dimMatch[1]} to ${dimMatch[2]} miles per hour.`;
    const wantCompound = segs.length > 0 && !incMatch;
    const compound = wantCompound ? lib.resolve(Sem.windAndDim(range)) : null;
    const clip = compound ?? lib.resolve(Sem.windDim(range));
    if (clip) segs.push({ clip, fallbackText: compound ? `and ${fallback}` : fallback });
  }

  return segs;
}

/** Convert direction text like "northwest", "sse", "n" to a 16-point code. */
function dirTextToCode(text: string): CompassDir | null {
  const map: Record<string, CompassDir> = {
    north: "N", south: "S", east: "E", west: "W",
    northeast: "NE", northwest: "NW", southeast: "SE", southwest: "SW",
    n: "N", s: "S", e: "E", w: "W",
    ne: "NE", nw: "NW", se: "SE", sw: "SW",
    nne: "NNE", nnw: "NNW", ene: "ENE", ese: "ESE",
    sse: "SSE", ssw: "SSW", wnw: "WNW", wsw: "WSW",
  };
  return map[text.toLowerCase()] ?? null;
}

// ───────────────────────── Precipitation probability clips (AJ + JC) ─────────────────────────

/**
 * Get a P9 precipitation probability clip. Both AJ and JC have these:
 *   AJ: VocalLocal/Wx_Phrases_Precip/P9{index}1.mp3
 *   JC: Vocal Local/Wx_Phrases_POP/P9{index}1.mp3
 *
 * `kind` selects the rain / snow / precipitation set — see precipRelPath.
 * Rounds to the nearest 10%.
 */
function getPrecipProbClip(pct: number, narratorId: NarratorId, kind: PrecipKind): ClipResolution | null {
  return getLibrary(narratorId).resolve(Sem.precipProb(pct, kind));
}

/**
 * Choose which recorded set matches the forecast wording.
 *
 * The generic "chance of precipitation" set is the answer whenever the type
 * is mixed or ambiguous, which is also what the on-screen label says. Naming
 * the wrong form is worse than staying generic: freezing rain is liquid that
 * freezes on contact, so announcing "chance of snow" for it describes the
 * wrong hazard, and "rain and snow" is neither one alone.
 *
 * "Snow showers" is snow, not a shower — the word has to be discounted
 * before testing for liquid, or every snow shower reads as rain.
 */
function precipKindFor(conditionText: string): PrecipKind {
  const t = conditionText.toLowerCase();
  if (/freezing (rain|drizzle)/.test(t)) return "precip";

  const snowy = /snow|flurr|wintry|winter mix|sleet|blizzard|ice pellets/.test(t);
  const rainy = /\brain\b|drizzle|thunder|\bshowers?\b/.test(t.replace(/snow showers?/g, "snow"));

  if (snowy && rainy) return "precip";
  if (snowy) return "snow";
  if (rainy) return "rain";
  return "precip";
}

/**
 * Emit the precipitation-probability segment, picking the set that matches
 * the forecast wording so the spoken clip and the fallback text agree.
 * No-ops at zero, which is how NWS reports "no chance".
 */
function appendPrecipProb(
  script: PhraseScript,
  precipPct: number | null | undefined,
  narrator: NarratorId,
  conditionText: string
): void {
  if (precipPct == null || precipPct <= 0) return;
  const kind = precipKindFor(conditionText);
  script.push({
    clip: getPrecipProbClip(precipPct, narrator, kind),
    fallbackText: `${precipPct} percent chance of ${precipKindNoun(kind)}.`
  });
}

// ───────────────────────── High/Low temp clips (AJ) ─────────────────────────

function getHighTempClip(value: number, narratorId: NarratorId): ClipResolution | null {
  return getLibrary(narratorId).resolve(Sem.tempHigh(value));
}

function getLowTempClip(value: number, narratorId: NarratorId): ClipResolution | null {
  return getLibrary(narratorId).resolve(Sem.tempLow(value));
}

/**
 * Confidence threshold helper. The PhraseSequencer can be told to only
 * play "confirmed" clips and fall back to TTS for "likely" / "guess".
 * Default is "likely" — accept anything that isn't a wild guess.
 */
export function shouldUseClip(seg: PhraseSegment, threshold: "confirmed" | "likely" | "guess"): boolean {
  if (!seg.clip) return false;
  const order = { confirmed: 3, likely: 2, guess: 1 };
  return order[seg.clip.confidence] >= order[threshold];
}
