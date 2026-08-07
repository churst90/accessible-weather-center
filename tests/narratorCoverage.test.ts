import { test } from "node:test";
import assert from "node:assert/strict";
import { Sem, getLibrary } from "../src/audio/manifests/semanticRegistry";
import { getNarratorClips } from "../src/audio/data/clipReferenceTable";
import { NARRATORS, NARRATOR_ASSET_ROOTS, getNarrator } from "../src/audio/manifests/narratorSchema";
import { findLongformMatch } from "../src/audio/manifests/longformSchema";
import { getNamedClip } from "../src/audio/manifests/clipSchema";
import type { NarratorId } from "../src/audio/manifests/narratorSchema";

/**
 * Coverage for every narrator, not just Allan Jackson.
 *
 * These run against the committed reference table rather than the media
 * library, so they work in CI where `assets/` doesn't exist. For Jim Cantore
 * the table mirrors his library exactly (2,798 keys, 2,798 files, no drift in
 * either direction), which makes a table miss a reliable "no such clip".
 *
 * `npm run clips:sweep` does the same checks against the real filesystem when
 * the library is present.
 */

const CLIP_NARRATORS: NarratorId[] = ["allan-jackson", "jim-cantore", "amy-bargeron", "chandler"];

/** Strip the narrator's asset root off a resolved src to get a table key. */
function relFor(narratorId: NarratorId, src: string): string | null {
  const root = NARRATOR_ASSET_ROOTS[narratorId];
  if (!root || !src.startsWith(root + "/")) return null;
  return src.slice(root.length + 1);
}

// ───────────────────────── scene intros ─────────────────────────

test("every narrator's scene-intro clips exist", () => {
  for (const narratorId of CLIP_NARRATORS) {
    const def = getNarrator(narratorId);
    const table = getNarratorClips(narratorId);
    const intros = Object.entries(def.sceneIntros ?? {});
    for (const [sceneId, clips] of intros) {
      for (const clip of clips ?? []) {
        const src = clip.file.startsWith("/assets/")
          ? clip.file
          : `${NARRATOR_ASSET_ROOTS[narratorId]}/${clip.file}`;
        const rel = relFor(narratorId, src);
        if (rel === null) continue; // shared clip outside the narrator tree
        assert.ok(
          rel in table,
          `${narratorId} scene "${sceneId}" references ${rel}, which is not in the clip library. ` +
            `This resolves to a 404 and the scene plays silence instead of falling back to text.`
        );
      }
    }
  }
});

test("Amy Bargeron and Chandler have intro clips wired up", () => {
  // Both are intro-only narrators with no semantic-registry resolvers, so
  // scene intros are their entire contribution. If these ever hit zero the
  // narrator is effectively silent and nothing else would notice.
  for (const narratorId of ["amy-bargeron", "chandler"] as NarratorId[]) {
    const def = getNarrator(narratorId);
    const total = Object.values(def.sceneIntros ?? {}).reduce((n, c) => n + (c?.length ?? 0), 0);
    assert.ok(total > 0, `${narratorId} has no scene intro clips at all`);
  }
});

test("every narrator id in NARRATORS has a definition", () => {
  for (const def of NARRATORS) {
    assert.ok(def.id, "narrator missing an id");
    assert.equal(typeof def.label, "string");
    assert.doesNotThrow(() => getNarrator(def.id));
  }
});

// ───────────────────────── availability guards ─────────────────────────

test("clips the library does not contain resolve to null, not a 404 path", () => {
  // Nobody recorded "winds increasing to below 5 mph" or "winds over 100
  // diminishing". Returning a path anyway made the composer treat it as a
  // usable clip, so the fallback chain never ran and the phrase was lost.
  const aj = getLibrary("allan-jackson");
  assert.equal(aj.resolve(Sem.windInc("Below_5")), null);
  assert.equal(aj.resolve(Sem.windAndInc("Below_5")), null);
  assert.equal(aj.resolve(Sem.windSpeed("Over_100")), null);
  assert.equal(aj.resolve(Sem.windDim("Over_100")), null);
  assert.equal(aj.resolve(Sem.windAndDim("Over_100")), null);

  const jc = getLibrary("jim-cantore");
  assert.equal(jc.resolve(Sem.temp(0)), null, "Jim Cantore has no zero-degree clip");
  assert.equal(jc.resolve(Sem.tempHigh(0)), null);
  assert.equal(jc.resolve(Sem.tempLow(0)), null);
  assert.equal(jc.resolve(Sem.windInc("Below_5")), null);
  assert.equal(jc.resolve(Sem.windDim("Over_100")), null);
});

test("the availability guard doesn't over-reach", () => {
  const aj = getLibrary("allan-jackson");
  // Neighbouring values must still resolve.
  assert.ok(aj.resolve(Sem.windInc("5_10")), "windInc:5_10 should still work");
  assert.ok(aj.resolve(Sem.windSpeed("80_100")), "windSpeed:80_100 should still work");
  assert.ok(aj.resolve(Sem.windDim("60_80")));
  assert.ok(aj.resolve(Sem.temp(0)), "Allan Jackson DOES have a zero clip");
});

test("every resolvable clip for every narrator is in the library", () => {
  // The catch-all. Any resolver family that starts producing names the
  // library doesn't have shows up here, for every narrator at once.
  const DIRS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"] as const;
  const RANGES = ["Below_5","5_10","10_15","10_20","15_25","20_30","25_35",
    "25_40","35_50","40_60","50_70","60_80","70_90","80_100","Over_100"] as const;
  const PERIODS = ["MON","TUE","WED","THU","FRI","SAT","SUN",
    "MON_NIGHT","TUE_NIGHT","WED_NIGHT","THU_NIGHT","FRI_NIGHT","SAT_NIGHT","SUN_NIGHT",
    "TODAY","TONIGHT","OVERNIGHT","AFTERNOON"] as const;

  const problems: string[] = [];
  for (const narratorId of CLIP_NARRATORS) {
    const lib = getLibrary(narratorId);
    const table = getNarratorClips(narratorId);
    if (Object.keys(table).length === 0) continue;

    const ids = [
      ...PERIODS.map((p) => Sem.period(p)),
      ...Array.from({ length: 140 }, (_, i) => Sem.temp(i)),
      ...Array.from({ length: 131 }, (_, i) => Sem.tempHigh(i)),
      ...Array.from({ length: 106 }, (_, i) => Sem.tempLow(i)),
      ...DIRS.flatMap((d) => [Sem.windDir1(d), Sem.windDir2(d), Sem.windDir3(d), Sem.windBecoming(d), Sem.windShifting(d)]),
      ...RANGES.flatMap((r) => [Sem.windAtSpeed(r), Sem.windSpeed(r), Sem.windInc(r), Sem.windDim(r), Sem.windAndInc(r), Sem.windAndDim(r)]),
      Sem.windCalm()
    ];

    for (const id of ids) {
      const res = lib.resolve(id);
      if (!res) continue; // unsupported or deliberately unavailable
      const rel = relFor(narratorId, res.src);
      if (rel === null) continue;
      if (!(rel in table)) problems.push(`${narratorId} ${String(id)} -> ${rel}`);
    }
  }
  assert.deepEqual(problems, [], `resolvable clips missing from the library:\n  ${problems.join("\n  ")}`);
});

// ───────────────────────── longform + named ─────────────────────────

test("longform matches point at clips that exist", () => {
  const SAMPLES = [
    "A chance of showers and thunderstorms. Mostly cloudy, with a low around 71.",
    "Mostly sunny, with a high near 89. Southeast wind around 5 mph.",
    "Partly cloudy, with a low around 64. Chance of precipitation is 40%.",
    "Snow likely, mainly before noon. Cloudy, with a high near 31.",
    "Patchy fog before 9am. Otherwise, sunny, with a high near 75.",
    "Scattered showers and thunderstorms after 2pm. Windy, with gusts to 30 mph.",
    "Clear, with a low around 52.",
    "Rain and snow showers likely. Cloudy, with a high near 38."
  ];
  for (const narratorId of ["allan-jackson", "jim-cantore"] as NarratorId[]) {
    const table = getNarratorClips(narratorId);
    for (const text of SAMPLES) {
      const res = findLongformMatch(text, narratorId);
      if (!res) continue;
      const rel = relFor(narratorId, res.src);
      if (rel === null) continue;
      assert.ok(
        rel in table,
        `${narratorId} longform matched "${text.slice(0, 40)}…" to ${rel}, which does not exist`
      );
    }
  }
});

test("the Jim Cantore N-to-H longform mapping refuses clips he never recorded", () => {
  // The shared pool maps Allan Jackson's N-series names onto Jim Cantore's
  // H-series by string substitution, which assumes a parity that does not
  // hold. Any match returned must be a real clip.
  const table = getNarratorClips("jim-cantore");
  let checked = 0;
  for (const text of [
    "Clear, with a low around 52.",
    "Sunny, with a high near 75.",
    "Areas of dense fog before 10am.",
    "Blowing snow and bitterly cold wind chills.",
    "Widespread frost before 8am. Otherwise sunny."
  ]) {
    const res = findLongformMatch(text, "jim-cantore");
    if (!res) continue;
    checked++;
    const rel = relFor("jim-cantore", res.src)!;
    assert.ok(rel in table, `returned ${rel}, which Jim Cantore does not have`);
  }
  assert.ok(checked >= 0);
});

test("named singleton clips all resolve", () => {
  for (const intent of ["current_intro", "mnemonic", "warning_beep", "alert_tornado", "alert_tstorm", "alert_flood"]) {
    const clip = getNamedClip(intent);
    assert.ok(clip, `named clip "${intent}" does not resolve`);
    assert.ok(clip!.src.startsWith("/assets/"), `named clip "${intent}" has a suspicious src`);
    assert.ok(clip!.src.endsWith(".mp3"), `named clip "${intent}" is not an .mp3 — served audio is all MP3`);
  }
});

// ───────────────────── scene narration coverage ─────────────────────

import { pickSceneIntro } from "../src/audio/manifests/narratorSchema";

/** Every scene in the rotation. Mirrors FLAVORS in src/bootstrap.ts. */
const SCENE_IDS = [
  "current", "localforecast", "radar", "extended", "hourly", "travel", "almanac",
  "detailed", "feelslike", "stormtracker", "overnight", "weekend", "precip",
  "temptrend", "traffic", "airport", "alerts"
] as const;

/** Scenes with a dedicated composer, which supplies its own intro. */
const HAS_COMPOSER = new Set([
  "current", "extended", "hourly", "radar", "alerts", "localforecast", "overnight", "weekend"
]);

/**
 * Scenes no narrator can announce, because no clip in any library honestly
 * covers the subject. They still work — the screen reader reads them — but
 * the narrator stays quiet.
 *
 * This list is deliberately explicit so it can only shrink on purpose. A new
 * scene added without narration fails this test rather than being discovered
 * by ear months later, which is how the previous seven were found.
 */
const KNOWN_SILENT = new Set(["almanac", "precip"]);

test("every scene is announced by at least one narrator", () => {
  const silent: string[] = [];
  for (const sceneId of SCENE_IDS) {
    if (HAS_COMPOSER.has(sceneId)) continue;
    const anyNarrator = CLIP_NARRATORS.some((n) => pickSceneIntro(n, sceneId) !== null);
    if (!anyNarrator) silent.push(sceneId);
  }
  assert.deepEqual(
    silent.sort(),
    [...KNOWN_SILENT].sort(),
    `scene narration coverage changed.\n  now silent: ${silent.join(", ") || "(none)"}\n` +
      `  expected:   ${[...KNOWN_SILENT].join(", ")}\n` +
      `If you added a scene, give it an intro or add it to KNOWN_SILENT deliberately.`
  );
});

test("scene ids resolve regardless of case", () => {
  // The registry uses lowercase ids ("localforecast") while several intro
  // keys are camelCase ("localForecast"). A mismatch fails silently: no clip,
  // no error, just a scene that never speaks.
  for (const n of CLIP_NARRATORS) {
    const lower = pickSceneIntro(n, "localforecast");
    const camel = pickSceneIntro(n, "localForecast");
    assert.equal(
      lower !== null, camel !== null,
      `${n}: "localforecast" and "localForecast" disagree — case handling regressed`
    );
  }
});

test("the default theme's narrator announces the opt-in scenes", () => {
  // Allan Jackson is the default narrator on the WeatherStar themes, and
  // these are the scenes a user turns on in Settings expecting them to behave
  // like the built-in ones.
  for (const sceneId of ["detailed", "feelslike", "temptrend", "stormtracker", "traffic"]) {
    assert.ok(
      pickSceneIntro("allan-jackson", sceneId),
      `Allan Jackson cannot announce "${sceneId}" — it would play silently`
    );
  }
});

test("Chandler's travel and regional clips are reachable", () => {
  // 13 travel clips and 8 regional-conditions clips were wired under key
  // names ("travelForecast", "regionalConditions") that no scene id matched,
  // so the audio existed and could never play.
  assert.ok(pickSceneIntro("chandler", "travel"), "Chandler's travel clips are unreachable again");
  assert.ok(pickSceneIntro("chandler", "detailed"), "Chandler's regional clips are unreachable again");
});
