import { test } from "node:test";
import assert from "node:assert/strict";
import { StormTracker } from "../src/core/radar/StormTracker";
import type { StormCell } from "../src/core/types";

const HOME = { lat: 36.16, lon: -82.83 };

function cell(partial: Partial<StormCell> & { centroid: StormCell["centroid"] }): StormCell {
  return {
    id: partial.id ?? "storm_1",
    centroid: partial.centroid,
    band: partial.band ?? "moderate",
    peakDbz: partial.peakDbz ?? 40,
    peakMmPerHour: partial.peakMmPerHour ?? 5,
    radiusMi: partial.radiusMi ?? 8,
    movementDeg: null,
    movementMph: null
  };
}

test("first frame: every storm is new with a minted stable id", () => {
  const tracker = new StormTracker();
  const result = tracker.track(
    { storms: [cell({ id: "storm_1", centroid: { lat: 36.5, lon: -82.5 } })], capturedAt: new Date(0) },
    HOME
  );
  assert.equal(result.storms.length, 1);
  assert.equal(result.storms[0].isNew, true);
  assert.match(result.storms[0].id, /^track_/);
});

test("matched storm keeps its id across frames even when positional rank shifts", () => {
  const tracker = new StormTracker();
  const first = tracker.track(
    { storms: [cell({ id: "storm_1", centroid: { lat: 36.5, lon: -82.5 } })], capturedAt: new Date(0) },
    HOME
  );
  const stableId = first.storms[0].id;

  // Ten minutes later the same storm has drifted slightly, and a NEW storm
  // appears closer to home — the clusterer would hand ours "storm_2" now.
  const second = tracker.track(
    {
      storms: [
        cell({ id: "storm_1", centroid: { lat: 36.2, lon: -82.8 } }), // the new, closer storm
        cell({ id: "storm_2", centroid: { lat: 36.55, lon: -82.45 } }) // ours, drifted NE
      ],
      capturedAt: new Date(10 * 60_000)
    },
    HOME
  );

  const ours = second.storms.find((s) => s.id === stableId);
  assert.ok(ours, "the original storm should keep its stable id");
  assert.equal(ours!.isNew, false);
  const fresh = second.storms.find((s) => s.id !== stableId);
  assert.ok(fresh, "the new storm exists");
  assert.equal(fresh!.isNew, true, "the genuinely new storm must report isNew");
  assert.notEqual(fresh!.id, stableId);
});

test("movement vector is derived from centroid drift", () => {
  const tracker = new StormTracker();
  tracker.track(
    { storms: [cell({ centroid: { lat: 36.5, lon: -83.0 } })], capturedAt: new Date(0) },
    HOME
  );
  // Move due east by ~0.2 degrees longitude over 10 minutes.
  const second = tracker.track(
    { storms: [cell({ centroid: { lat: 36.5, lon: -82.8 } })], capturedAt: new Date(10 * 60_000) },
    HOME
  );
  const s = second.storms[0];
  assert.ok(s.movementMph != null && s.movementMph > 0, "storm should be moving");
  // Due-east bearing is 90°; allow slack for the spherical math.
  assert.ok(Math.abs(s.movementDeg! - 90) < 10, `bearing ~90, got ${s.movementDeg}`);
});

test("stationary storm reports movementMph 0, not null", () => {
  const tracker = new StormTracker();
  const at = { lat: 36.5, lon: -82.5 };
  tracker.track({ storms: [cell({ centroid: at })], capturedAt: new Date(0) }, HOME);
  const second = tracker.track(
    { storms: [cell({ centroid: { ...at } })], capturedAt: new Date(10 * 60_000) },
    HOME
  );
  assert.equal(second.storms[0].movementMph, 0);
  assert.equal(second.storms[0].movementDeg, null);
});

test("two current storms cannot claim the same previous storm's id", () => {
  const tracker = new StormTracker();
  tracker.track(
    { storms: [cell({ centroid: { lat: 36.5, lon: -82.5 } })], capturedAt: new Date(0) },
    HOME
  );
  // One old cell splits into two nearby cells.
  const second = tracker.track(
    {
      storms: [
        cell({ id: "storm_1", centroid: { lat: 36.52, lon: -82.52 } }),
        cell({ id: "storm_2", centroid: { lat: 36.48, lon: -82.48 } })
      ],
      capturedAt: new Date(10 * 60_000)
    },
    HOME
  );
  const ids = second.storms.map((s) => s.id);
  assert.equal(new Set(ids).size, 2, `ids must be unique, got ${ids.join(", ")}`);
  assert.equal(second.storms.filter((s) => s.isNew).length, 1, "exactly one is the split-off new cell");
});

test("reset() forgets previous storms so nothing matches across a home change", () => {
  const tracker = new StormTracker();
  const first = tracker.track(
    { storms: [cell({ centroid: { lat: 36.5, lon: -82.5 } })], capturedAt: new Date(0) },
    HOME
  );
  tracker.reset();
  const second = tracker.track(
    { storms: [cell({ centroid: { lat: 36.5, lon: -82.5 } })], capturedAt: new Date(10 * 60_000) },
    HOME
  );
  assert.equal(second.storms[0].isNew, true);
  assert.notEqual(second.storms[0].id, first.storms[0].id);
});
