import { test } from "node:test";
import assert from "node:assert/strict";
import {
  composeSceneIntro, composeOvernightForecast, composeWeekendForecast,
  composeRadar, composeCurrentConditions, composeHourlyForecast,
  composeExtendedForecast, composeLocalForecast, composeAlerts
} from "../src/audio/PhraseComposer";
import { setProductEra } from "../src/audio/manifests/sceneSegments";
import type { NarratorId } from "../src/audio/manifests/narratorSchema";
import type { Observation, ForecastPeriod, HourlyForecastPoint } from "../src/core/types";

/**
 * Narration coverage for every scene x every narrator.
 *
 * The opt-in scenes are the ones this exists for. A user turns on Airport
 * Delays or Almanac in Settings expecting it to behave like the built-in
 * scenes; if the narrator has nothing to say, that should be a known and
 * recorded fact rather than something discovered by listening.
 *
 * Amy Bargeron has nine clips in total — that is the entire library that was
 * ever recorded for her, not a gap to fix. The expectations below encode what
 * each narrator's library can actually support.
 */

const N: NarratorId[] = ["allan-jackson", "jim-cantore", "amy-bargeron", "chandler"];

const OBS: Observation = {
  placeId: "x", observedAt: new Date("2026-08-07T18:00:00Z"), temperatureF: 72,
  feelsLikeF: 73, dewpointF: 68, humidityPct: 60, windDirDeg: 160, windSpeedMph: 7,
  windGustMph: null, pressureInHg: 30, visibilityMi: 10, conditionText: "Partly Cloudy", conditionIcon: null
};
const PERIOD = {
  name: "Tonight", isDaytime: false, temperatureF: 71, shortForecast: "Chance Showers",
  detailedForecast: "A chance of showers.", startTime: new Date(), endTime: new Date(),
  windSpeedMph: 5, windDirDeg: 135, precipProbability: 40
} as unknown as ForecastPeriod;
const ALERT = {
  id: "a1", event: "Severe Thunderstorm Warning", headline: "Severe Thunderstorm Warning in effect",
  description: "", instruction: "", severity: "Severe", urgency: "Immediate", certainty: "Likely",
  onset: new Date(), expires: new Date(Date.now() + 3.6e6), affectedAreaDescription: "St. Louis County",
  polygon: null
} as unknown as import("../src/core/types").WeatherAlert;
const HOURS = Array.from({ length: 4 }, (_, i) => ({
  time: new Date(Date.now() + i * 3.6e6), temperatureF: 70 + i, shortForecast: "Cloudy",
  precipProbability: 20, windSpeedMph: 7, windDirDeg: 135
})) as unknown as HourlyForecastPoint[];

/** Does this narrator open this scene with a clip, through the real path the
 *  app uses (dedicated composer where one exists, generic intro otherwise)? */
function announces(sceneId: string, n: NarratorId): boolean {
  const first = (() => {
    switch (sceneId) {
      case "current":       return composeCurrentConditions(OBS, "Saint Louis", n)[0];
      case "hourly":        return composeHourlyForecast(HOURS, "Saint Louis", n)[0];
      // 7-day: Jim Cantore's extended pool is tagged 7-day only, because
      // IntelliStar never ran a 5-day version. A 5-day theme correctly falls
      // through to the screen reader for him — asserted separately below.
      case "extended":      return composeExtendedForecast([PERIOD], "Saint Louis", n, "7-day", "7-Day Outlook")[0];
      case "localforecast": return composeLocalForecast([PERIOD], "Saint Louis", n)[0];
      case "radar":         return composeRadar(n)[0];
      case "alerts":        return composeAlerts([ALERT], "Saint Louis", n)[0];
      case "overnight":     return composeOvernightForecast(PERIOD, "Saint Louis", n)[0];
      case "weekend":       return composeWeekendForecast([PERIOD, PERIOD], "Saint Louis", n)[0];
      default:              return composeSceneIntro(sceneId, n)[0];
    }
  })();
  return Boolean(first?.clip);
}

/**
 * Expected coverage, narrator by narrator. Anything absent here is absent
 * from the source recordings — see the notes.
 */
const EXPECTED: Record<string, NarratorId[]> = {
  // Fully covered.
  current:       ["allan-jackson", "jim-cantore", "amy-bargeron", "chandler"],
  hourly:        ["allan-jackson", "jim-cantore", "amy-bargeron", "chandler"],
  localforecast: ["allan-jackson", "jim-cantore", "amy-bargeron", "chandler"],
  overnight:     ["allan-jackson", "jim-cantore", "amy-bargeron", "chandler"],
  detailed:      ["allan-jackson", "jim-cantore", "amy-bargeron", "chandler"],
  feelslike:     ["allan-jackson", "jim-cantore", "amy-bargeron", "chandler"],
  temptrend:     ["allan-jackson", "jim-cantore", "amy-bargeron", "chandler"],

  // Jim Cantore has no radar clip of any kind — no Default_Phrases_Local_Radar
  // directory exists for him. Storm Tracker borrows the radar intro, so it
  // inherits the same gap.
  radar:         ["allan-jackson", "amy-bargeron", "chandler"],
  stormtracker:  ["allan-jackson", "amy-bargeron", "chandler"],

  // Amy's nine clips include no extended-forecast phrasing.
  extended:      ["allan-jackson", "jim-cantore", "chandler"],
  // Alerts open with the shared NWS four-beep attention tone, which is not
  // narrator-specific — so every narrator "announces" this scene even when
  // they have no spoken alert phrase of their own.
  alerts:        ["allan-jackson", "jim-cantore", "amy-bargeron", "chandler"],

  // Only Allan Jackson and Jim Cantore have weekend phrasing.
  weekend:       ["allan-jackson", "jim-cantore"],

  // Traffic: Allan Jackson has three traffic families, Amy has two clips.
  traffic:       ["allan-jackson", "amy-bargeron"],

  // Travel Cities: only Chandler ("forecast cities nationwide").
  travel:        ["chandler"],

  // Airport delays: only Amy ("local airport delays").
  airport:       ["amy-bargeron"],

  // Nobody has a phrase for these. Reusing an unrelated clip would be worse
  // than silence — the screen reader still reads both scenes in full.
  almanac:       [],
  precip:        []
};

test("scene narration coverage matches the recorded libraries", () => {
  setProductEra("ws4000-v2");
  const drift: string[] = [];
  for (const [sceneId, expected] of Object.entries(EXPECTED)) {
    const actual = N.filter((n) => announces(sceneId, n));
    const missing = expected.filter((n) => !actual.includes(n));
    const extra = actual.filter((n) => !expected.includes(n));
    if (missing.length) drift.push(`${sceneId}: LOST ${missing.join(", ")}`);
    if (extra.length) drift.push(`${sceneId}: GAINED ${extra.join(", ")} (update EXPECTED)`);
  }
  assert.deepEqual(drift, [], `narration coverage changed:\n  ${drift.join("\n  ")}`);
});

test("every scene a user can opt into is either narrated or knowingly silent", () => {
  // The opt-in scenes specifically — the ones enabled from Settings.
  const OPT_IN = [
    "travel", "almanac", "detailed", "feelslike", "stormtracker",
    "precip", "temptrend", "traffic", "airport"
  ];
  const KNOWN_SILENT = new Set(["almanac", "precip"]);
  setProductEra("ws4000-v2");
  for (const sceneId of OPT_IN) {
    const anyone = N.some((n) => announces(sceneId, n));
    if (KNOWN_SILENT.has(sceneId)) {
      assert.equal(anyone, false, `${sceneId} gained narration — remove it from KNOWN_SILENT`);
    } else {
      assert.ok(anyone, `${sceneId} is opt-in but no narrator can announce it`);
    }
  }
});

test("a narrator with no clip for a scene yields an empty script, not a broken one", () => {
  // The screen reader carries these scenes. What must not happen is a thrown
  // error or a segment holding a clip that doesn't exist.
  setProductEra("ws4000-v2");
  for (const sceneId of ["almanac", "precip", "airport", "travel"]) {
    for (const n of N) {
      assert.doesNotThrow(() => composeSceneIntro(sceneId, n), `${sceneId}/${n} threw`);
      for (const seg of composeSceneIntro(sceneId, n)) {
        assert.ok(seg.clip, "a segment was emitted with no clip — should have been omitted");
      }
    }
  }
});

test("Amy Bargeron's nine clips are all put to use", () => {
  // Her library is tiny and complete; every clip should reach a scene except
  // the two whose scenes don't exist yet (pollen report, regional forecast).
  setProductEra("weatherscan-v1");
  const scenes = ["current", "hourly", "localforecast", "radar", "traffic", "airport"];
  for (const sceneId of scenes) {
    assert.ok(announces(sceneId, "amy-bargeron"), `Amy should announce "${sceneId}"`);
  }
});

test("Jim Cantore's extended pool is 7-day only, by design", () => {
  // IntelliStar never ran a 5-day Extended Forecast, so his clips are tagged
  // 7-day. On a 5-day theme the scene correctly falls to the screen reader
  // rather than announcing a day count the unit never showed.
  setProductEra("intellistar1");
  const sevenDay = composeExtendedForecast([PERIOD], "Saint Louis", "jim-cantore", "7-day", "7-Day Outlook");
  assert.ok(sevenDay[0]?.clip, "7-day era should give Jim Cantore an intro");
  const fiveDay = composeExtendedForecast([PERIOD], "Saint Louis", "jim-cantore", "5-day", "Extended Forecast");
  assert.equal(fiveDay[0]?.clip ?? null, null, "5-day era should not borrow his 7-day phrasing");
});

test("Jim Cantore announces the Local Forecast", () => {
  // DAYPART_DEFAULT6 says "your local forecast" outright but was never wired,
  // so this scene had no Jim Cantore intro at all.
  setProductEra("intellistar1");
  assert.ok(announces("localforecast", "jim-cantore"));
});
