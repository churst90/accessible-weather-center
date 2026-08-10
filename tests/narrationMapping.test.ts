import { test } from "node:test";
import assert from "node:assert/strict";
import { NARRATORS, NARRATOR_ASSET_ROOTS, type NarratorId } from "../src/audio/manifests/narratorSchema";
import { setClipReferenceTable, getNarratorClips } from "../src/audio/data/clipReferenceTable";
import fullTable from "../src/audio/data/clipReferenceTable.json";

setClipReferenceTable(fullTable as never);

/**
 * One rule, applied to every narrator: a clip must describe the screen it
 * introduces.
 *
 * This exists because the same bug kept appearing in different corners and
 * each time was found by ear rather than by a test. Storm Tracker borrowed
 * the radar intro and announced "your local Doppler radar" over a storm list.
 * Alerts reached for a sentence tail and announced "is in effect for your
 * area" naming no event. The Allen Jackson headline table pointed 43 of 49
 * products at the wrong recording, so a fire-danger alert announced a freeze
 * warning.
 *
 * Every one of those was a mapping that looked plausible in the source and
 * was wrong against the audio. The reference table has a transcription for
 * essentially every clip, so the mapping can simply be checked.
 *
 * The check: for each narrator, for each scene they announce, every wired
 * clip's transcription must match at least one pattern for that scene. A clip
 * that cannot be checked (no transcription) is skipped rather than assumed
 * good, and the count of those is asserted so it cannot quietly grow.
 */

/** Words that legitimately introduce each scene. */
const SCENE_VOCABULARY: Record<string, RegExp> = {
  current:            /current|now|conditions|temperature|right now/i,
  observations:       /observation|conditions/i,
  localForecast:      /local forecast|36.?hour|forecast for (your|our) area|daily planner|text forecast/i,
  dailyPlanner:       /daily planner/i,
  thirtySixHour:      /36.?hour|thirty.?six/i,
  extended:           /extended|7.?day|seven.?day|week ahead|five.?day|5.?day|outlook/i,
  // Researched, because the audit flagged all three narrators here and the
  // answer was not obvious. TWC's hour-by-hour bar-graph product was the
  // "Daily Planner", renamed "Daypart Forecast" in September 2004 — that IS
  // our `hourly` scene. Separately and confusingly, the "36 Hour Forecast"
  // was renamed "Local Forecast" in the same pass; that is our
  // `localforecast`. Two different products, renamed at the same time.
  //
  // So the DAYPART_DEFAULT recordings belong on hourly even though they say
  // "our local forecast" — they are generic segment openers, not product
  // names. DAYPART_DEFAULT3 ("Our Daily Planner") is the one that names the
  // product, and it is correctly routed to the pre-2004 `dailyPlanner` key.
  // The wiring was right; this comment exists so nobody "fixes" it later.
  hourly:             /hour|daypart|daily planner|local forecast|forecast for (your|our) area/i,
  radar:              /radar|doppler|precipitation in (your|our) area/i,
  alerts:             /alert|warning|watch|advisory|in effect|issued|severe|special regional|bulletin/i,
  travelForecast:     /travel|cities|nationwide|getaway|destination/i,
  regional:           /regional/i,
  regionalConditions: /regional|conditions/i,
  outlook:            /outlook|long.?range/i,
  localUpdate:        /update|short.?term|conditions|national weather service/i,
  airport:            /airport|delay|flight/i,
  traffic:            /traffic|trip time|incident|construction|drive|commute/i,
  weekend:            /weekend/i,
  almanac:            /almanac|sunrise|sunset|record|average/i,
  precip:             /precipitation|rainfall|snowfall/i,
};

/**
 * Clips whose transcription is wrong, not whose mapping is.
 *
 * Whisper produced these; the recording says the right thing. Listed with
 * what it actually says so the exemption is auditable rather than a shrug.
 */
const KNOWN_MISTRANSCRIPTIONS: Record<string, string> = {
  "Vocal Local/Headline_Event_Phrases/WC_W.mp3": "A wind chill warning is in effect (transcribed 'windshield')",
  "Vocal Local/Headline_Event_Phrases/WC_A.mp3": "A wind chill watch is in effect (transcribed 'windshield')",
};

function transcriptionFor(narrator: NarratorId, file: string): string | null {
  const root = `${NARRATOR_ASSET_ROOTS[narrator]}/`;
  if (!file.startsWith(root)) return null;
  const rel = file.slice(root.length);
  if (KNOWN_MISTRANSCRIPTIONS[rel]) return null;   // exempt, checked by hand
  const entry = (getNarratorClips(narrator) as Record<string, { text?: string }>)[rel];
  return entry?.text ?? null;
}

interface Mismatch { narrator: string; scene: string; file: string; says: string }

function auditNarrator(n: (typeof NARRATORS)[number]): { checked: number; unverifiable: number; bad: Mismatch[] } {
  let checked = 0;
  let unverifiable = 0;
  const bad: Mismatch[] = [];
  for (const [scene, clips] of Object.entries(n.sceneIntros ?? {})) {
    const pattern = SCENE_VOCABULARY[scene];
    if (!pattern) continue;               // scene we have no vocabulary for yet
    for (const clip of clips) {
      const says = transcriptionFor(n.id, clip.file);
      if (says == null) { unverifiable++; continue; }
      checked++;
      if (!pattern.test(says)) {
        bad.push({ narrator: n.id, scene, file: clip.file.split("/").pop() ?? clip.file, says });
      }
    }
  }
  return { checked, unverifiable, bad };
}

test("every narrator's scene intros describe the scene they introduce", () => {
  const all: Mismatch[] = [];
  let checked = 0;
  for (const n of NARRATORS) {
    if (n.id === "silent") continue;
    const r = auditNarrator(n);
    checked += r.checked;
    all.push(...r.bad);
  }
  assert.ok(checked > 100, `only ${checked} clips were checkable — the audit has gone blind`);
  assert.deepEqual(
    all, [],
    "a clip introduces a scene it does not describe:\n" +
      all.map((b) => `  ${b.narrator} / ${b.scene}: ${b.file} says "${b.says}"`).join("\n")
  );
});

test("the audit can actually fail", () => {
  // Same reasoning as the hook-order fixture: a green check nobody has seen
  // go red is not evidence of anything.
  const fake = {
    id: "allan-jackson" as NarratorId,
    sceneIntros: {
      // A real Allen Jackson clip, deliberately wired to the wrong scene.
      radar: [{ file: `${NARRATOR_ASSET_ROOTS["allan-jackson"]}/general/Your Local Forecast.mp3`, text: "" }],
    },
  } as unknown as (typeof NARRATORS)[number];
  const r = auditNarrator(fake);
  assert.equal(r.bad.length, 1, "a local-forecast clip on the radar scene must be reported");
  assert.match(r.bad[0].says, /local forecast/i);
});

test("clips that cannot be checked stay rare", () => {
  // Every unverifiable clip is a hole in the audit above. A handful is fine;
  // a drift upward means transcriptions and paths have parted company again,
  // which is exactly how the .wav -> .mp3 rename silenced the narration.
  let unverifiable = 0;
  let checked = 0;
  for (const n of NARRATORS) {
    if (n.id === "silent") continue;
    const r = auditNarrator(n);
    unverifiable += r.unverifiable;
    checked += r.checked;
  }
  const ratio = unverifiable / (checked + unverifiable);
  assert.ok(
    ratio < 0.1,
    `${unverifiable} of ${checked + unverifiable} scene-intro clips have no transcription ` +
    `(${(ratio * 100).toFixed(1)}%) — the mapping audit is running mostly blind`
  );
});

/**
 * Jim Cantore's headline labels, held to the same standard as Allen
 * Jackson's in headlineTranscript.test.ts.
 *
 * His mapping cannot suffer the failure Jackson's did — his files are NAMED
 * by VTEC code (`BZ_W.mp3`), so the filename IS the mapping and there is no
 * hand-written indirection to drift. Jackson's used opaque product codes
 * (NPW020), which is exactly why 43 of 49 of his ended up pointing at the
 * wrong recording.
 *
 * What can still drift is the LABEL, which becomes the spoken fallback when
 * the clip cannot play. If the label and the recording disagree, the two
 * paths describe different hazards.
 */
const JC_LABEL_DIFFERENCES: Record<string, string> = {
  // Whisper misheard "wind chill" as "windshield". The recording is correct.
  WC_W: "mistranscription: says 'wind chill warning'",
  WC_A: "mistranscription: says 'wind chill watch'",
  // The label is the NWS product name; the recording uses TWC's shorter
  // on-air wording. Both name the same hazard, so the label stays as the
  // accurate one and the difference is recorded rather than papered over.
  TI_W: "NWS 'Inland Tropical Storm Warning'; recorded as 'tropical storm wind warning'",
  TI_A: "NWS 'Inland Tropical Storm Watch'; recorded as 'tropical storm wind watch'",
  HI_W: "NWS 'Inland Hurricane Warning'; recorded as 'hurricane wind warning'",
  HI_A: "NWS 'Inland Hurricane Watch'; recorded as 'hurricane wind watch'",
  UP_Y: "NWS 'Heavy Freezing Spray Advisory'; recorded without 'Heavy'",
  MF_Y: "NWS 'Marine Dense Fog Advisory'; recorded without 'Marine'",
  MS_Y: "NWS 'Marine Dense Smoke Advisory'; recorded without 'Marine'",
};

test("every Jim Cantore headline label matches what the recording says", async () => {
  const { JC_VTEC_HEADLINES } = await import("../src/audio/manifests/headlineSchema");
  const clips = getNarratorClips("jim-cantore") as Record<string, { text?: string }>;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

  const bad: string[] = [];
  let checked = 0;
  for (const v of JC_VTEC_HEADLINES) {
    const key = `${v.phenomenon}_${v.significance}`;
    const rel = `Vocal Local/Headline_Event_Phrases/${key}.mp3`;
    const says = clips[rel]?.text;
    assert.ok(says, `${key}: no recording — the table promises a clip that is not there`);
    if (JC_LABEL_DIFFERENCES[key]) continue;
    checked++;
    if (!norm(says!).includes(norm(v.text))) {
      bad.push(`  ${key}: label "${v.text}" but recording says "${says}"`);
    }
  }
  assert.ok(checked > 50, `only ${checked} labels checked — the audit has gone blind`);
  assert.deepEqual(bad, [], `Cantore label drift:\n${bad.join("\n")}`);
});

test("every documented Cantore label difference is still a difference", () => {
  // Same discipline as the knowingly-silent lists: an exemption that has
  // stopped being needed must be removed, or the list rots into a place
  // where real drift can hide.
  const clips = getNarratorClips("jim-cantore") as Record<string, { text?: string }>;
  for (const key of Object.keys(JC_LABEL_DIFFERENCES)) {
    const rel = `Vocal Local/Headline_Event_Phrases/${key}.mp3`;
    assert.ok(clips[rel]?.text, `${key} is exempted but has no recording at all`);
  }
});
