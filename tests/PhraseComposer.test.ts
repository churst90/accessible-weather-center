import { test } from "node:test";
import assert from "node:assert/strict";
import {
  guessCcefForecastCode,
  guessCcshForecastCode,
  guessConditionCode,
  periodTimeHint
} from "../src/audio/PhraseComposer";

// The CCEF regression: general patterns (/shower/, /rain/) used to sit above
// their specific compounds, so wintry phrasing narrated as plain rain.

test("CCEF morning: 'snow showers ending early' maps to the snow-shower code", () => {
  assert.equal(guessCcefForecastCode("Snow showers ending early", "morning", false), 6803);
});

test("CCEF morning: 'rain and snow early' maps to the rain-and-snow code", () => {
  assert.equal(guessCcefForecastCode("Rain and snow early", "morning", false), 6403);
});

test("CCEF morning: 'wintry mix early' maps to the wintry-mix code", () => {
  assert.equal(guessCcefForecastCode("Wintry mix early", "morning", false), 6703);
});

test("CCEF morning: plain rain and plain showers still map to their own codes", () => {
  assert.equal(guessCcefForecastCode("Rain ending early", "morning", false), 6303);
  assert.equal(guessCcefForecastCode("Showers ending early", "morning", false), 6103);
});

test("CCEF evening: 'snow showers late' maps to the evening snow-shower code", () => {
  assert.equal(guessCcefForecastCode("Snow showers late", "night", false), 7803);
});

test("CCEF evening: 'rain and snow overnight' maps to the evening rain-and-snow code", () => {
  assert.equal(guessCcefForecastCode("Rain and snow overnight", "night", false), 7403);
});

test("CCEF transitions still win over time-of-day blocks", () => {
  assert.equal(guessCcefForecastCode("Rain changing to snow early", "morning", false), 8000);
  assert.equal(guessCcefForecastCode("Snow then rain", "morning", false), 8200);
});

test("CCEF thunderstorms are not swallowed by the shower branch", () => {
  assert.equal(guessCcefForecastCode("Thunderstorms early", "morning", false), 6143);
  assert.equal(guessCcefForecastCode("Thunderstorms late", "night", false), 7143);
});

// Sanity net over the other two guess functions with real NWS shortForecast
// phrasing, so future reordering can't silently regress them.

test("CCSH keeps specific-before-general ordering", () => {
  const snowShower = guessCcshForecastCode("Scattered snow showers", "day", false);
  const plainShower = guessCcshForecastCode("Scattered showers", "day", false);
  assert.ok(snowShower != null && plainShower != null);
  assert.notEqual(snowShower, plainShower, "snow showers must not collapse into plain showers");
});

test("guessConditionCode: representative NWS strings resolve", () => {
  for (const text of ["Sunny", "Partly Cloudy", "Light Rain", "Heavy Snow", "Thunderstorms"]) {
    assert.notEqual(guessConditionCode(text, false), null, `no code for "${text}"`);
  }
});

test("guessConditionCode: null and unknown text return null, not garbage", () => {
  assert.equal(guessConditionCode(null, false), null);
  assert.equal(guessConditionCode("Volcanic ash advisory", false), null);
});

test("periodTimeHint reads NWS period names", () => {
  assert.equal(periodTimeHint("Tonight", false), "night");
  assert.equal(periodTimeHint("Monday", true), "day");
});
