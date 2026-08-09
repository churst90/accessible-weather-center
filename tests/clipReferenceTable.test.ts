import { test } from "node:test";
import assert from "node:assert/strict";
import { Sem, getLibrary } from "../src/audio/manifests/semanticRegistry";
import { getNarratorClips } from "../src/audio/data/clipReferenceTable";
import { NARRATOR_ASSET_ROOTS } from "../src/audio/manifests/narratorSchema";
import { setClipReferenceTable } from "../src/audio/data/clipReferenceTable";
import fullTable from "../src/audio/data/clipReferenceTable.json";

// The runtime loads a compact index over the network; tests install the
// full table directly so transcription text is available for assertions.
setClipReferenceTable(fullTable as never);

/**
 * Guards the clip-resolution chain end to end.
 *
 * The regression these exist for: the media library was re-encoded to MP3 and
 * every path in the resolver code was rewritten .wav -> .mp3, but the
 * reference table is a separate JSON file and was missed. Resolution still
 * "worked" — it returned a path to a real file — so nothing threw and no
 * asset check failed. What broke was invisible: `getClipText` no longer
 * matched, every clip fell back to `confidence: "guess"`, and the default
 * "likely" threshold silently filtered them out. The app played a handful of
 * clips and went quiet for the rest, with no error anywhere.
 *
 * The invariant that catches it: every table key must name a file that is
 * actually served, and resolution must find the table entry.
 */

const NARRATORS = ["allan-jackson", "jim-cantore", "amy-bargeron", "chandler"] as const;

test("every reference-table key uses the served .mp3 extension", () => {
  for (const narrator of NARRATORS) {
    const clips = getNarratorClips(narrator);
    const keys = Object.keys(clips);
    if (keys.length === 0) continue;
    const wrong = keys.filter((k) => !k.toLowerCase().endsWith(".mp3"));
    assert.equal(
      wrong.length,
      0,
      `${narrator}: ${wrong.length} table key(s) don't end in .mp3, e.g. ${wrong.slice(0, 3).join(", ")}`
    );
  }
});

test("resolved clip paths match reference-table keys", () => {
  // If these drift apart again, confidence silently degrades to "guess".
  const lib = getLibrary("allan-jackson");
  const clips = getNarratorClips("allan-jackson");
  // Read the root from the code that owns it rather than repeating the
  // string. Hardcoding it here meant the library could be reorganised and
  // this test would fail for the path rather than for the drift it exists to
  // catch — which is exactly what happened when assets/ moved to
  // devices/ + shared/.
  const root = `${NARRATOR_ASSET_ROOTS["allan-jackson"]}/`;

  const ids = [
    Sem.period("FRI"),
    Sem.period("MON"),
    Sem.period("SUN"),
    Sem.period("TONIGHT"),
    Sem.temp(72),
    Sem.tempHigh(89),
    Sem.tempLow(71)
  ];

  for (const id of ids) {
    const res = lib.resolve(id);
    assert.ok(res, `no resolution for ${String(id)}`);
    assert.ok(res!.src.startsWith(root), `unexpected root for ${String(id)}: ${res!.src}`);
    const rel = res!.src.slice(root.length);
    assert.ok(
      rel in clips,
      `${String(id)} resolves to "${rel}", which is not a reference-table key — ` +
        `this clip would degrade to confidence "guess" and be filtered out at the default threshold`
    );
  }
});

test("day-name and temperature clips resolve above the default confidence threshold", () => {
  // The default clipConfidence setting is "likely". Anything that lands on
  // "guess" never plays, which is exactly how the extended forecast lost
  // "on Friday" and current conditions lost the temperature.
  const lib = getLibrary("allan-jackson");
  for (const id of [Sem.period("FRI"), Sem.period("SUN"), Sem.temp(72), Sem.tempHigh(89)]) {
    const res = lib.resolve(id);
    assert.ok(res, `no resolution for ${String(id)}`);
    assert.notEqual(
      res!.confidence,
      "guess",
      `${String(id)} resolved at "guess" confidence — it would be silently dropped`
    );
  }
});
