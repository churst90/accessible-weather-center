import { test } from "node:test";
import assert from "node:assert/strict";
import {
  guessCcefForecastCode,
  guessCcshForecastCode,
  guessConditionCode,
  periodTimeHint,
  composeAlerts
} from "../src/audio/PhraseComposer";
import { setClipReferenceTable } from "../src/audio/data/clipReferenceTable";
import fullTable from "../src/audio/data/clipReferenceTable.json";
import type { WeatherAlert } from "../src/core/types";

// Tooling wants the real transcriptions so clip text can be asserted on.
setClipReferenceTable(fullTable as never);

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

test("an alert never plays a sentence tail without naming the event", () => {
  // Reported from real use: four attention beeps, then Allen Jackson saying
  // "is in effect for your area" — naming nothing. The alerts "scene intro"
  // pool holds sentence TAILS ("is in effect for your area", "has been
  // issued for your area"), and the composer reached for one whenever no
  // per-event recording existed. Only 64 of the ~229 event strings the
  // parser recognises have an Allen Jackson event clip, so that was the
  // common path.
  //
  // A tone that says "something urgent happened" followed by a voice that
  // withholds what is worse than silence.
  const mk = (event: string): WeatherAlert => ({
    id: `t-${event}`, event, headline: `${event} in effect`, description: "",
    instruction: null, severity: "Severe", urgency: "Immediate", certainty: "Observed",
    effective: new Date(), expires: new Date(Date.now() + 3600_000),
    affectedAreaDescription: "Testville",
  } as unknown as WeatherAlert);

  const TAIL = /is in effect for your area|has been issued for your area/i;

  for (const event of [
    "Excessive Heat Warning", "Dense Fog Advisory", "High Surf Advisory",
    "Air Quality Alert", "Rip Current Statement", "Tornado Warning",
  ]) {
    const script = composeAlerts([mk(event)], "Testville", "allan-jackson");
    const clips = script.filter((s) => s.clip).map((s) => s.clip!);
    const tailIdx = clips.findIndex((c) => TAIL.test(c.text ?? ""));
    if (tailIdx === -1) continue;           // tail not used at all: fine
    assert.ok(
      tailIdx > 0,
      `${event}: a sentence tail is the first spoken clip — nothing names the event`
    );
    // Whatever precedes it must actually say something, not be a bare tone.
    const before = clips[tailIdx - 1];
    assert.ok(
      (before.text ?? "").trim().length > 0,
      `${event}: the clip before the tail is silent, so the tail still dangles`
    );
  }
});

test("a mapped event still gets its full spoken headline", () => {
  // The fix must not have cost the events that DO have recordings.
  const alert = {
    id: "t1", event: "Winter Storm Warning", headline: "Winter Storm Warning in effect",
    description: "", instruction: null, severity: "Severe", urgency: "Immediate",
    certainty: "Observed", effective: new Date(), expires: new Date(Date.now() + 3600_000),
    affectedAreaDescription: "Testville",
  } as unknown as WeatherAlert;
  const script = composeAlerts([alert], "Testville", "allan-jackson");
  const spoken = script.filter((s) => s.clip).map((s) => s.clip!.text ?? "").join(" ");
  assert.match(spoken, /winter storm warning/i, "the event must be named in the narrator's voice");
});
