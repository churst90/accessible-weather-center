import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { Sem, getLibrary } from "../src/audio/manifests/semanticRegistry";
import { setClipReferenceTable } from "../src/audio/data/clipReferenceTable";
import fullTable from "../src/audio/data/clipReferenceTable.json";
import { getAccumulationClips } from "../src/audio/manifests/accumulationSchema";
import { parseEventToVtec, getHeadlineClips } from "../src/audio/manifests/headlineSchema";
import { composeExtendedForecast, composeHourlyForecast } from "../src/audio/PhraseComposer";
import type { ForecastPeriod, HourlyForecastPoint } from "../src/core/types";

setClipReferenceTable(fullTable as never);

const ROOT = path.resolve(import.meta.dirname, "..");

/** Assert a resolved src actually exists in the library on disk. */
function assertOnDisk(src: string, label: string) {
  const rel = src.replace(/^\//, "");
  assert.ok(fs.existsSync(path.join(ROOT, rel)), `${label}: missing on disk — ${src}`);
}

function period(over: Partial<ForecastPeriod>): ForecastPeriod {
  return {
    startTime: new Date(2026, 7, 10, 6),
    endTime: new Date(2026, 7, 10, 18),
    name: "Today",
    isDaytime: true,
    temperatureF: 70,
    windDirText: "SW",
    windSpeedText: "10 to 15 mph",
    precipProbabilityPct: 40,
    shortForecast: "Sunny",
    detailedForecast: "Sunny, with a high near 70.",
    ...over,
  };
}

// ───────────────────────────────────────────────────────────────────────────
//  Precip probability: three sets, not one
// ───────────────────────────────────────────────────────────────────────────

/**
 * The narrators recorded "chance of rain", "chance of snow" and "chance of
 * precipitation" as three parallel decile sets. Only the rain set was ever
 * reachable, so a snow forecast announced "chance of rain" — audible, wrong,
 * and invisible to every test that only checked that *a* clip resolved.
 */
test("each precip kind resolves to its own recorded set", () => {
  const lib = getLibrary("allan-jackson");
  const cases: Array<[Parameters<typeof Sem.precipProb>[1], number, string]> = [
    ["rain",   40, "P9041.mp3"],
    ["snow",   40, "P9141.mp3"],
    ["precip", 40, "P9241.mp3"],
  ];
  for (const [kind, pct, file] of cases) {
    const res = lib.resolve(Sem.precipProb(pct, kind));
    assert.ok(res, `${kind} ${pct}% should resolve`);
    assert.ok(res!.src.endsWith(file), `${kind} ${pct}% → expected ${file}, got ${res!.src}`);
    assertOnDisk(res!.src, `${kind} ${pct}%`);
  }
});

/**
 * P9101 ("chance of rain 100 percent") was excluded by a `rounded > 90`
 * guard for its whole life, so a certain forecast fell silently to text.
 */
test("100 percent resolves in every set for Allan Jackson", () => {
  const lib = getLibrary("allan-jackson");
  for (const [kind, file] of [["rain", "P9101.mp3"], ["snow", "P9201.mp3"], ["precip", "P9301.mp3"]] as const) {
    const res = lib.resolve(Sem.precipProb(100, kind));
    assert.ok(res, `100% ${kind} should resolve`);
    assert.ok(res!.src.endsWith(file), `100% ${kind} → expected ${file}`);
    assertOnDisk(res!.src, `100% ${kind}`);
  }
});

/**
 * Cantore's library starts at 20% and stops at 90%. Resolving outside that
 * must return null so it degrades to speech, not a 404.
 */
test("Cantore's narrower range degrades instead of 404ing", () => {
  const lib = getLibrary("jim-cantore");
  assert.equal(lib.resolve(Sem.precipProb(10, "rain")), null, "JC has no 10% take");
  assert.equal(lib.resolve(Sem.precipProb(100, "rain")), null, "JC has no 100% take");
  const mid = lib.resolve(Sem.precipProb(50, "snow"));
  assert.ok(mid, "JC 50% snow should resolve");
  assertOnDisk(mid!.src, "JC 50% snow");
});

/**
 * Freezing rain is liquid that freezes on contact. Calling it snow names the
 * wrong hazard, so anything mixed or ambiguous takes the generic set.
 */
test("forecast wording picks the right set", () => {
  const expectations: Array<[string, string]> = [
    ["Snow",            "chance of snow"],
    ["Snow Showers",    "chance of snow"],
    ["Scattered Showers", "chance of rain"],
    ["Thunderstorms",   "chance of rain"],
    ["Freezing Rain",   "chance of precipitation"],
    ["Rain and Snow",   "chance of precipitation"],
  ];
  for (const [shortForecast, phrase] of expectations) {
    const script = composeExtendedForecast(
      [period({ shortForecast, detailedForecast: shortForecast, precipProbabilityPct: 50 })],
      "Testville", "allan-jackson", "7-day"
    );
    const seg = script.find((s) => /percent chance of/.test(s.fallbackText));
    assert.ok(seg, `${shortForecast}: no precip segment emitted`);
    assert.ok(
      seg!.fallbackText.includes(phrase),
      `${shortForecast}: expected "${phrase}", got "${seg!.fallbackText}"`
    );
  }
});

// ───────────────────────────────────────────────────────────────────────────
//  The longform early return
// ───────────────────────────────────────────────────────────────────────────

/**
 * When a longform clip matches, the composer returns early to avoid stacking
 * clips. That is deliberate for conditions and wind, which longform covers —
 * but not one of the 2,083 longform recordings states a percentage or an
 * accumulation amount, so those were dropped outright. The 70% in "showers
 * and thunderstorms likely" was simply never spoken.
 */
test("longform periods still announce the precip chance", () => {
  const script = composeExtendedForecast(
    [period({
      name: "Sunday", temperatureF: 91, precipProbabilityPct: 60,
      shortForecast: "Thunderstorms",
      detailedForecast: "Showers and thunderstorms likely. High near 91. Chance of precipitation is 60%.",
    })],
    "Testville", "allan-jackson", "7-day"
  );
  const longform = script.find((s) => s.clip && /Wx_Phrases_Longform/.test(s.clip.src));
  assert.ok(longform, "this period is supposed to take the longform path");

  const precip = script.find((s) => /60 percent chance/.test(s.fallbackText));
  assert.ok(precip, "60% must be spoken even on the longform path");
  assert.ok(precip!.clip, "and it should use a clip, not fall to text");
  assertOnDisk(precip!.clip!.src, "longform-path precip");
});

test("longform periods still announce accumulation", () => {
  const script = composeExtendedForecast(
    [period({
      name: "Tuesday", isDaytime: false, temperatureF: 28, precipProbabilityPct: 90,
      shortForecast: "Snow",
      detailedForecast: "Snow. Low around 28. New snow accumulation of 3 to 5 inches possible.",
    })],
    "Testville", "allan-jackson", "7-day"
  );
  const accum = script.find((s) => /accumulating 3 to 5 inches/.test(s.fallbackText));
  assert.ok(accum, "the 3 to 5 inches must be spoken on the longform path");
  assert.ok(accum!.clip, "and should resolve to a clip");
  assertOnDisk(accum!.clip!.src, "longform-path accumulation");
});

// ───────────────────────────────────────────────────────────────────────────
//  Allan Jackson's accumulation library
// ───────────────────────────────────────────────────────────────────────────

/**
 * getAccumulationClips returned [] for everyone but Cantore, commented "only
 * narrator with accumulation clips". Jackson has 71 of them plus 4 rate
 * clips, sitting in his precip directory rather than an Accumulation folder.
 */
test("Allan Jackson resolves accumulation clips", () => {
  const cases: Array<[string, RegExp]> = [
    ["New snow accumulation of 3 to 5 inches possible.",        /3 to 5 inches/],
    ["Snow accumulation of 1 to 3 inches expected.",            /1 to 3 inches/],
    ["Total snow accumulation of 8 to 12 inches.",              /8 to 12 inches/],
    ["Little or no snow accumulation, less than an inch.",      /less than one inch/],
    ["Rainfall amounts around a quarter of an inch.",           /quarter of an inch/],
    ["Ice accumulation of around a tenth of an inch.",          /ice accumulation possible/],
  ];
  for (const [text, expect] of cases) {
    const clips = getAccumulationClips(text, "allan-jackson");
    assert.ok(clips.length > 0, `no clip for: ${text}`);
    assert.ok(expect.test(clips[0].text), `"${text}" → got "${clips[0].text}"`);
    assertOnDisk(clips[0].src, text);
  }
});

test("wet snow uses the slushy ladder, not the dry-snow one", () => {
  const clips = getAccumulationClips(
    "Wet snow accumulation of 2 to 4 inches expected.", "allan-jackson");
  assert.ok(clips.length > 0, "expected a wet-snow clip");
  assert.ok(/wet snow/.test(clips[0].text), `got "${clips[0].text}"`);
  assert.ok(clips[0].src.includes("/A3"), "wet snow lives in the A3xxx range");
});

test("narrators without accumulation recordings still return nothing", () => {
  for (const n of ["amy-bargeron", "chandler"] as const) {
    assert.deepEqual(
      getAccumulationClips("New snow accumulation of 3 to 5 inches possible.", n),
      [], `${n} should have no accumulation clips`);
  }
});

// ───────────────────────────────────────────────────────────────────────────
//  The 2025 NWS heat rename
// ───────────────────────────────────────────────────────────────────────────

/**
 * NWS renamed the heat products for the 2025 season. The recordings and the
 * VTEC mapping were both already in place; only the event string the API
 * sends had changed, so a real heat warning parsed to null and the scene
 * announced nothing at all.
 */
test("both the old and new heat product names parse", () => {
  const expectations: Array<[string, string, string]> = [
    ["Excessive Heat Warning", "EH", "W"],
    ["Extreme Heat Warning",   "EH", "W"],
    ["Excessive Heat Watch",   "EH", "A"],
    ["Extreme Heat Watch",     "EH", "A"],
    ["Heat Advisory",          "HT", "Y"],
  ];
  for (const [event, phenomenon, significance] of expectations) {
    const vtec = parseEventToVtec(event);
    assert.ok(vtec, `${event} should parse`);
    assert.equal(vtec!.phenomenon, phenomenon, `${event} phenomenon`);
    assert.equal(vtec!.significance, significance, `${event} significance`);

    const clips = getHeadlineClips(event, "allan-jackson");
    assert.ok(clips.length >= 1, `${event} should produce a headline clip`);
    assertOnDisk(clips[0].src, event);
  }
});

test("the spoken fallback uses the right article", () => {
  const clips = getHeadlineClips("Extreme Heat Warning", "allan-jackson");
  assert.ok(clips[0].text.startsWith("An "), `got "${clips[0].text}"`);
  const winter = getHeadlineClips("Winter Storm Warning", "allan-jackson");
  assert.ok(winter[0].text.startsWith("A "), `got "${winter[0].text}"`);
});

// ───────────────────────────────────────────────────────────────────────────
//  Hourly
// ───────────────────────────────────────────────────────────────────────────

test("hourly speaks precip with a clip, in the matching set", () => {
  const hours: HourlyForecastPoint[] = Array.from({ length: 10 }, (_, i) => ({
    time: new Date(2026, 7, 10, 9 + i),
    temperatureF: 30,
    precipProbabilityPct: 40,
    windSpeedMph: 12,
    windDirDeg: 220,
    shortForecast: "Snow Showers",
  }));
  const script = composeHourlyForecast(hours, "Testville", "allan-jackson");
  const precip = script.filter((s) => /percent chance/.test(s.fallbackText));
  assert.ok(precip.length > 0, "hourly must announce precip");
  for (const seg of precip) {
    assert.ok(seg.clip, "hourly precip should use a clip, not text");
    assert.ok(seg.fallbackText.includes("chance of snow"), `got "${seg.fallbackText}"`);
    assertOnDisk(seg.clip!.src, "hourly precip");
  }
});
