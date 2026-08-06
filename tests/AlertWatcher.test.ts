import { test } from "node:test";
import assert from "node:assert/strict";
import { AlertWatcher, isSevereAlert } from "../src/core/alerts/AlertWatcher";
import type { WeatherService } from "../src/core/weather/WeatherService";
import type { Place, WeatherAlert } from "../src/core/types";

const HOME: Place = { id: "home", name: "Testville, TN", coord: { lat: 36, lon: -82 }, isHome: true };
const AWAY: Place = { id: "away", name: "Elsewhere, OH", coord: { lat: 40, lon: -83 }, isHome: false };

function alert(id: string, severity: WeatherAlert["severity"] = "Moderate"): WeatherAlert {
  return {
    id,
    event: "Test Alert",
    headline: `headline ${id}`,
    severity,
    urgency: "Expected",
    certainty: "Likely",
    onset: null,
    ends: null,
    description: "",
    instruction: null,
    affectedAreaDescription: "Test County",
    polygon: null,
    affectedZones: []
  } as unknown as WeatherAlert;
}

function makeWatcher(script: { current: WeatherAlert[] | Error }) {
  const weather = {
    getActiveAlerts: async () => {
      if (script.current instanceof Error) throw script.current;
      return script.current;
    }
  } as unknown as WeatherService;
  // Long poll interval — tests drive refresh() manually.
  return new AlertWatcher(weather, 60 * 60_000);
}

test("first poll reports all alerts as fresh; second poll reports none", async () => {
  const script = { current: [alert("a1"), alert("a2")] as WeatherAlert[] | Error };
  const w = makeWatcher(script);
  const updates: { fresh: number; total: number }[] = [];
  w.subscribe((u) => updates.push({ fresh: u.fresh.length, total: u.alerts.length }));
  w.start(HOME);
  await new Promise((r) => setTimeout(r, 10));
  await w.refresh();
  w.stop();
  assert.deepEqual(updates[0], { fresh: 2, total: 2 });
  assert.deepEqual(updates[1], { fresh: 0, total: 2 }, "already-seen alerts are not fresh");
});

test("a newly-appearing alert is fresh; severeActive tracks severity", async () => {
  const script = { current: [alert("a1")] as WeatherAlert[] | Error };
  const w = makeWatcher(script);
  const seen: { freshIds: string[]; severe: boolean }[] = [];
  w.subscribe((u) => seen.push({ freshIds: u.fresh.map((a) => a.id), severe: u.severeActive }));
  w.start(HOME);
  await new Promise((r) => setTimeout(r, 10));
  script.current = [alert("a1"), alert("tor", "Extreme")];
  await w.refresh();
  w.stop();
  assert.deepEqual(seen[1].freshIds, ["tor"]);
  assert.equal(seen[0].severe, false);
  assert.equal(seen[1].severe, true);
});

test("setPlace resets the seen-set so active alerts re-announce at the new home", async () => {
  const script = { current: [alert("a1", "Severe")] as WeatherAlert[] | Error };
  const w = makeWatcher(script);
  const freshCounts: number[] = [];
  w.subscribe((u) => freshCounts.push(u.fresh.length));
  w.start(HOME);
  await new Promise((r) => setTimeout(r, 10));
  w.setPlace(AWAY);
  await new Promise((r) => setTimeout(r, 10));
  w.stop();
  assert.deepEqual(freshCounts, [1, 1], "same alert id is fresh again after moving");
});

test("setPlace with the same place id is a no-op (no duplicate announcements)", async () => {
  const script = { current: [alert("a1")] as WeatherAlert[] | Error };
  const w = makeWatcher(script);
  let updates = 0;
  w.subscribe(() => updates++);
  w.start(HOME);
  await new Promise((r) => setTimeout(r, 10));
  w.setPlace({ ...HOME });
  await new Promise((r) => setTimeout(r, 10));
  w.stop();
  assert.equal(updates, 1);
});

test("a failed poll keeps previous state and emits nothing", async () => {
  const script = { current: [alert("a1")] as WeatherAlert[] | Error };
  const w = makeWatcher(script);
  let updates = 0;
  w.subscribe(() => updates++);
  w.start(HOME);
  await new Promise((r) => setTimeout(r, 10));
  script.current = new Error("NWS outage");
  await w.refresh();
  // Recovery: the alert is still known (not re-announced as fresh).
  script.current = [alert("a1")];
  const freshOnRecovery: number[] = [];
  w.subscribe((u) => freshOnRecovery.push(u.fresh.length));
  await w.refresh();
  w.stop();
  assert.equal(updates, 2, "error poll emitted nothing");
  assert.deepEqual(freshOnRecovery, [0], "seen-set survived the outage");
});

test("isSevereAlert covers Severe and Extreme only", () => {
  assert.equal(isSevereAlert(alert("x", "Severe")), true);
  assert.equal(isSevereAlert(alert("x", "Extreme")), true);
  assert.equal(isSevereAlert(alert("x", "Moderate")), false);
});
