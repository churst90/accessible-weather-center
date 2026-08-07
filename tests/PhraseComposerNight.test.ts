import { test } from "node:test";
import assert from "node:assert/strict";
import {
  guessConditionCode,
  guessCcefForecastCode,
  nightSkyConditionCode,
  observationTimeHint,
  periodTimeHint
} from "../src/audio/PhraseComposer";
import type { Observation } from "../src/core/types";

/**
 * "Sunny" after dark.
 *
 * The extended-forecast clip pool has NO clear-skies clip — codes 3200 and
 * 3400 both say "under sunny skies." — so mapping /clear|sunny/ to 3200
 * meant a night period forecast as "Mostly Clear" narrated as sunny at 11pm.
 * timeHint was already threaded into the guesser and simply wasn't consulted
 * for sky conditions.
 */

test("extended forecast never picks the sunny clip at night", () => {
  for (const text of ["Mostly Clear", "Clear", "Sunny", "Mostly Sunny"]) {
    const code = guessCcefForecastCode(text, "night", false);
    assert.notEqual(code, 3200, `"${text}" at night resolved to the sunny clip`);
    assert.notEqual(code, 3400, `"${text}" at night resolved to the other sunny clip`);
  }
});

test("extended forecast still uses the sunny clip during the day", () => {
  assert.equal(guessCcefForecastCode("Sunny", "day", false), 3200);
  assert.equal(guessCcefForecastCode("Mostly Clear", "day", false), 3200);
});

test("night clear skies fall back to the current-conditions clear clip", () => {
  // CC 3100 is "under clear skies." — the phrasing the Ext_Fcast pool lacks.
  assert.equal(nightSkyConditionCode("Mostly Clear", false), 3100);
  assert.equal(nightSkyConditionCode("Clear", true), 3190, "windy variant");
});

test("night sky fallback declines anything that isn't a clear sky", () => {
  for (const text of ["Partly Cloudy", "Mostly Cloudy", "Overcast", "Rain", "Snow"]) {
    assert.equal(nightSkyConditionCode(text, false), null, `should not claim "${text}"`);
  }
});

test("current conditions never announce sunny skies at night", () => {
  // 3200/3290 are the CC family's sunny clips.
  for (const text of ["Sunny", "Mostly Sunny", "Fair", "Clear"]) {
    const code = guessConditionCode(text, false, "night");
    assert.notEqual(code, 3200, `"${text}" at night resolved to sunny`);
    assert.notEqual(code, 3290);
    assert.equal(code, 3100, `"${text}" at night should be clear skies`);
  }
});

test("current conditions keep sunny during the day and without a hint", () => {
  assert.equal(guessConditionCode("Sunny", false, "day"), 3200);
  // No hint provided — preserve the original behaviour rather than guessing.
  assert.equal(guessConditionCode("Sunny", false), 3200);
});

test("windy variants survive the night remap", () => {
  assert.equal(guessConditionCode("Clear", true, "night"), 3190);
  assert.equal(guessConditionCode("Sunny", true, "day"), 3290);
});

// ───────────────────────── observationTimeHint ─────────────────────────

const obsAt = (iso: string): Observation => ({
  placeId: "test",
  observedAt: new Date(iso),
  temperatureF: 72,
  feelsLikeF: null,
  dewpointF: null,
  humidityPct: null,
  windDirDeg: null,
  windSpeedMph: null,
  windGustMph: null,
  pressureInHg: null,
  visibilityMi: null,
  conditionText: "Clear",
  conditionIcon: null
});

test("observation time hint uses real solar times, not a fixed hour", () => {
  const stLouis = { lat: 38.627, lon: -90.199 };
  // Late June, 21:00 UTC = 16:00 local — daylight.
  assert.equal(observationTimeHint(obsAt("2026-06-21T21:00:00Z"), stLouis), "day");
  // Same clock hour in local terms but after sunset in December would be
  // night; 2026-12-21 23:30 UTC = 17:30 local, already dark in midwinter.
  assert.equal(observationTimeHint(obsAt("2026-12-21T23:30:00Z"), stLouis), "night");
  // Deep night either way.
  assert.equal(observationTimeHint(obsAt("2026-08-07T06:00:00Z"), stLouis), "night");
});

test("observation time hint degrades to a clock heuristic without a coordinate", () => {
  const hint = observationTimeHint(obsAt("2026-08-07T04:39:00Z"), null);
  assert.ok(hint === "day" || hint === "night", "still returns a usable hint");
});

test("observation time hint tolerates a broken timestamp", () => {
  const broken = { ...obsAt("2026-08-07T04:39:00Z"), observedAt: new Date("nonsense") };
  assert.doesNotThrow(() => observationTimeHint(broken, { lat: 38.6, lon: -90.2 }));
});

test("period names still drive the forecast time hint", () => {
  assert.equal(periodTimeHint("Tonight", false), "night");
  assert.equal(periodTimeHint("Monday Night", false), "night");
  assert.equal(periodTimeHint("This Afternoon", true), "afternoon");
});

// ───────────────────── scene intros lead every scene ─────────────────────

import { composeCurrentConditions, composeHourlyForecast, composeExtendedForecast } from "../src/audio/PhraseComposer";
import type { ForecastPeriod, HourlyForecastPoint } from "../src/core/types";

const OBS: Observation = {
  placeId: "x", observedAt: new Date("2026-08-07T18:00:00Z"), temperatureF: 72,
  feelsLikeF: 73, dewpointF: 68, humidityPct: 88, windDirDeg: 135, windSpeedMph: 7,
  windGustMph: null, pressureInHg: 30.1, visibilityMi: 10, conditionText: "Cloudy", conditionIcon: null
};

test("current conditions always opens with a spoken scene title", () => {
  // This was a 30/70 coin flip: seven times in ten the scene opened straight
  // onto "Currently, the temperature is" and then a number, with no
  // announcement that the scene had changed at all.
  for (let i = 0; i < 25; i++) {
    const script = composeCurrentConditions(OBS, "Saint Louis", "allan-jackson");
    assert.ok(script[0]?.clip, `run ${i}: first segment has no clip`);
    assert.notEqual(
      script[0].clip!.src.split("/").pop(),
      "CC_INTRO1.mp3",
      `run ${i}: opened on the lead-in instead of a scene title`
    );
  }
});

test("the lead-in still follows the title, so the sentence flows into the temperature", () => {
  const script = composeCurrentConditions(OBS, "Saint Louis", "allan-jackson");
  assert.equal(script[1]?.clip?.src.split("/").pop(), "CC_INTRO1.mp3");
  assert.match(script[2]?.fallbackText ?? "", /72/);
});

test("hourly and extended forecasts open with their scene intro", () => {
  const hours: HourlyForecastPoint[] = Array.from({ length: 4 }, (_, i) => ({
    time: new Date(Date.now() + i * 3.6e6), temperatureF: 70 + i,
    shortForecast: "Cloudy", precipProbability: 20, windSpeedMph: 7, windDirDeg: 135
  })) as HourlyForecastPoint[];
  const hourly = composeHourlyForecast(hours, "Saint Louis", "allan-jackson");
  assert.ok(hourly[0]?.clip, "hourly forecast lost its intro");

  const periods = [{
    name: "Tonight", isDaytime: false, temperatureF: 71, shortForecast: "Chance Showers",
    detailedForecast: "A chance of showers.", startTime: new Date(), endTime: new Date(),
    windSpeedMph: 5, windDirDeg: 135, precipProbability: 40
  }] as unknown as ForecastPeriod[];
  const ext = composeExtendedForecast(periods, "Saint Louis", "allan-jackson", "5-day", "Extended Forecast");
  assert.ok(ext[0]?.clip, "extended forecast lost its intro");
});
