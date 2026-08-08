import { test } from "node:test";
import assert from "node:assert/strict";
import { Sem, getLibrary } from "../src/audio/manifests/semanticRegistry";
import {
  setClipReferenceTable, setClipIndex, isClipIndexLoaded
} from "../src/audio/data/clipReferenceTable";
import fullTable from "../src/audio/data/clipReferenceTable.json";

/**
 * The clip metadata is now fetched rather than bundled, which introduces a
 * window where it is not there yet — and a real possibility it never arrives
 * (404, offline, slow link).
 *
 * The failure mode that must NOT happen: treating "no metadata" as "nothing
 * is known about this clip", which resolves everything to confidence "guess"
 * and drops the entire narration at the default "likely" threshold. That is
 * precisely the silent failure that took a week to find when the reference
 * table's keys drifted. Missing metadata degrades to "play it".
 */

test("with no index loaded, clips still resolve as playable", () => {
  // Fresh module state is the unloaded state; assert it explicitly rather
  // than relying on test ordering.
  const lib = getLibrary("allan-jackson");
  if (!isClipIndexLoaded()) {
    const res = lib.resolve(Sem.period("FRI"));
    assert.ok(res, "resolution should still produce a clip without the index");
    assert.notEqual(
      res!.confidence,
      "guess",
      "an unloaded index must not silence narration — it is metadata, not permission"
    );
  }
});

test("once the index loads, verification is honoured", () => {
  setClipIndex({
    schemaVersion: 1,
    narrators: {
      "allan-jackson": {
        v: ["VocalLocal/Periods2/FRI.mp3"],
        k: ["VocalLocal/Periods2/MON.mp3"]
      }
    }
  });
  assert.equal(isClipIndexLoaded(), true);
  const lib = getLibrary("allan-jackson");
  assert.equal(lib.resolve(Sem.period("FRI"))?.confidence, "confirmed");
  assert.equal(lib.resolve(Sem.period("MON"))?.confidence, "likely");
  // Present in the library but absent from a loaded index = genuinely unknown.
  assert.equal(lib.resolve(Sem.period("SUN"))?.confidence, "guess");
});

test("resolved text stays useful even when the index carries none", () => {
  // The compact index has no transcription text; derived text must fill in
  // rather than leaving an empty string.
  setClipIndex({
    schemaVersion: 1,
    narrators: { "allan-jackson": { v: ["VocalLocal/Temps_Specific/72.mp3"], k: [] } }
  });
  const res = getLibrary("allan-jackson").resolve(Sem.temp(72));
  assert.ok(res);
  assert.ok((res!.text ?? "").length > 0, "text should fall back to a derived phrase");
});

test("the full table still works for tooling", () => {
  setClipReferenceTable(fullTable as never);
  const res = getLibrary("allan-jackson").resolve(Sem.temp(72));
  assert.match(res!.text.toLowerCase(), /72/);
});
