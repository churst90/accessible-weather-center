import { test } from "node:test";
import assert from "node:assert/strict";
import { groupDaySpans, getSpanClip, spanConditionFor } from "../src/audio/manifests/extendedSpanSchema";
import { composeExtendedForecast } from "../src/audio/PhraseComposer";
import { setClipReferenceTable } from "../src/audio/data/clipReferenceTable";
import fullTable from "../src/audio/data/clipReferenceTable.json";
import type { ForecastPeriod } from "../src/core/types";

setClipReferenceTable(fullTable as never);

/**
 * The three-day extended, read as prose.
 *
 * 399 recordings for this sat unreferenced for the life of the project. The
 * risk in wiring them is not that they fail to play — it is that they play
 * the WRONG DAY, because the filename index is the last day of the span
 * rather than the first, and getting that backwards would announce Friday's
 * sky for Sunday with no outward sign anything was wrong.
 */

/** A Sunday, so weekday arithmetic in the tests is easy to read. */
const SUN = new Date("2026-08-16T12:00:00Z");
const day = (offset: number, shortForecast: string, temperatureF = 70): ForecastPeriod => {
  const d = new Date(SUN);
  d.setUTCDate(d.getUTCDate() + offset);
  return {
    name: d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
    isDaytime: true, temperatureF, shortForecast, detailedForecast: shortForecast,
    precipProbabilityPct: 0, windSpeedText: "", windDirText: "", icon: "",
    startTime: d, endTime: d,
  } as unknown as ForecastPeriod;
};

test("condition bucketing puts precipitation ahead of sky cover", () => {
  // "Rain and cloudy" is a rain day. Sky-first ordering would bucket it as
  // cloudy and lose the rain entirely.
  assert.equal(spanConditionFor("Rain and cloudy"), "RAIN");
  assert.equal(spanConditionFor("Snow showers"), "WINTER");
  assert.equal(spanConditionFor("Showers and thunderstorms"), "TSTORM");
  assert.equal(spanConditionFor("Mostly cloudy"), "MCLOUDY");
  assert.equal(spanConditionFor("Partly sunny"), "PCLOUDY");
  assert.equal(spanConditionFor("Sunny"), "SUNNY");
  assert.equal(spanConditionFor(null), null);
});

test("three matching days collapse into one span ending on the last day", () => {
  // Sun/Mon/Tue all cloudy -> one span, lastWeekday = Tuesday (2).
  const spans = groupDaySpans([
    { weekday: 0, shortForecast: "Cloudy" },
    { weekday: 1, shortForecast: "Cloudy" },
    { weekday: 2, shortForecast: "Cloudy" },
  ]);
  assert.deepEqual(spans, [{ lastWeekday: 2, length: 3, condition: "CLOUDY" }]);
});

test("a differing day breaks the span", () => {
  const spans = groupDaySpans([
    { weekday: 0, shortForecast: "Cloudy" },
    { weekday: 1, shortForecast: "Cloudy" },
    { weekday: 2, shortForecast: "Sunny" },
  ]);
  assert.deepEqual(spans, [
    { lastWeekday: 1, length: 2, condition: "CLOUDY" },
    { lastWeekday: 2, length: 1, condition: "SUNNY" },
  ]);
});

test("non-consecutive days never collapse", () => {
  // A gap would make "Friday through Sunday" a false statement.
  const spans = groupDaySpans([
    { weekday: 0, shortForecast: "Cloudy" },
    { weekday: 3, shortForecast: "Cloudy" },
  ]);
  assert.equal(spans.length, 2);
  assert.ok(spans.every((s) => s.length === 1));
});

test("the span clip names the right days — the index is the LAST day", () => {
  // The failure this guards: reading D{n} as the first day would resolve
  // Sunday's phrase for a span that ends on Tuesday, and the app would
  // confidently announce the wrong three days.
  const three = getSpanClip({ lastWeekday: 0, length: 3, condition: "CLOUDY" });
  assert.ok(three, "a three-day cloudy span ending Sunday should resolve");
  assert.match(three!.text, /Friday through Sunday/i);

  const two = getSpanClip({ lastWeekday: 0, length: 2, condition: "CLOUDY" });
  assert.ok(two);
  assert.match(two!.text, /Saturday and Sunday/i);

  const one = getSpanClip({ lastWeekday: 0, length: 1, condition: "CLOUDY" });
  assert.ok(one);
  assert.match(one!.text, /Sunday/i);
});

test("every weekday and condition combination resolves for all three lengths", () => {
  // If a combination is missing, composeExtendedSpans falls back wholesale —
  // so a hole here silently disables the feature rather than breaking it.
  const CONDS = ["SUNNY", "PCLOUDY", "MCLOUDY", "CLOUDY", "RAIN", "TSTORM", "WINTER"] as const;
  const missing: string[] = [];
  for (let wd = 0; wd < 7; wd++) {
    for (const c of CONDS) {
      for (const len of [1, 2, 3] as const) {
        if (!getSpanClip({ lastWeekday: wd, length: len, condition: c })) {
          missing.push(`D${wd} ${c} len=${len}`);
        }
      }
    }
  }
  assert.deepEqual(missing, [], `unrecorded span combinations:\n  ${missing.join("\n  ")}`);
});

test("the extended forecast narrates as prose when every span resolves", () => {
  const script = composeExtendedForecast(
    [day(0, "Cloudy", 71), day(1, "Cloudy", 73), day(2, "Sunny", 78)],
    "Testville", "allan-jackson", "5-day"
  );
  const spoken = script.filter((s) => s.clip).map((s) => s.clip!.text).join(" | ");
  assert.match(spoken, /Sunday and Monday/i, "the two agreeing days collapse into one phrase");
  assert.match(spoken, /Tuesday/i, "the differing day gets its own");
  // Temperatures still come through, as separate spoken text.
  const all = script.map((s) => s.clip?.text ?? s.fallbackText).join(" | ");
  assert.match(all, /71 degrees/);
  assert.match(all, /78 degrees/);
});

test("a narrator without the recordings still gets per-period narration", () => {
  // The span pool is Allen Jackson's alone. Everyone else must be unaffected.
  const script = composeExtendedForecast(
    [day(0, "Cloudy"), day(1, "Cloudy"), day(2, "Cloudy")],
    "Testville", "jim-cantore", "7-day"
  );
  assert.ok(script.length > 0);
  const spoken = script.map((s) => s.clip?.text ?? s.fallbackText).join(" ");
  assert.doesNotMatch(spoken, /through Sunday/i, "Cantore has no span recordings to reach for");
});
