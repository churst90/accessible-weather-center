// Import the DOM shim before anything that touches React or `document`.
import { mount, pressKey, React } from "./dom";
import { test } from "node:test";
import assert from "node:assert/strict";
import { AnnouncerContext } from "../src/a11y/AnnouncerContext";
import { AnnouncementQueue } from "../src/a11y/AnnouncementQueue";
import { StormTrackerView } from "../src/ui/scenes/StormTrackerView";
import { DetailedConditionsView } from "../src/ui/scenes/DetailedConditionsView";
import { FeelsLikeView } from "../src/ui/scenes/FeelsLikeView";
import { AirportDelaysView } from "../src/ui/scenes/AirportDelaysView";
import type { Place } from "../src/core/types";
import type { TrackedStorm } from "../src/core/radar/StormTracker";

/**
 * Scene views, driven for real.
 *
 * Every one of these tests exists because of a bug that shipped. The theme
 * running through them is the same: a scene view is RECONCILED, not
 * remounted, when its data changes underneath it — the scheduler re-prepares
 * the on-screen scene every minute now — and code that is only correct on a
 * fresh mount breaks the moment the data shape flips.
 */

const PLACE: Place = { id: "p1", name: "Testville", state: "TN", coord: { lat: 36, lon: -82 }, isHome: true };

const STORM: TrackedStorm = {
  id: "track_1", band: "heavy", centroid: { lat: 36.4, lon: -82.2 },
  cells: [], peakMmPerHour: 12.4, radiusMi: 6.2, distanceFromHomeMi: 28.5,
  bearingFromHomeDeg: 315, movementDeg: 90, movementMph: 22, etaMinutes: 41,
  isNew: false, intensifiedBands: 0,
} as unknown as TrackedStorm;

function withAnnouncer(node: React.ReactElement, q: AnnouncementQueue) {
  return <AnnouncerContext.Provider value={q}>{node}</AnnouncerContext.Provider>;
}

test("StormTrackerView survives storms appearing under it", () => {
  // The crash: this view returned its "no storms" markup BEFORE calling
  // useArrowList. React counts hooks per render, so the first render with a
  // storm called one more hook than the render without, and threw
  // "Rendered more hooks than during the previous render".
  //
  // Latent until live refresh landed. Now the radar scanner re-prepares this
  // exact scene on every completed scan, so `storm` flips null -> object on a
  // mounted instance as a matter of course.
  const q = new AnnouncementQueue();
  const empty = { place: PLACE, storm: null, totalStorms: 0, summary: "No storms detected. All clear." };
  const view = mount(withAnnouncer(<StormTrackerView data={empty} />, q));
  assert.match(view.text(), /No storms detected/);

  view.rerender(withAnnouncer(
    <StormTrackerView data={{ place: PLACE, storm: STORM, totalStorms: 4, summary: "4 storms detected." }} />, q));
  assert.match(view.text(), /4 storms detected/);
  assert.match(view.text(), /28\.5 miles/, "the storm's own readings should render");

  // And back again — a storm clearing is just as ordinary.
  view.rerender(withAnnouncer(<StormTrackerView data={empty} />, q));
  assert.match(view.text(), /No storms detected/);
  view.unmount();
});

test("DetailedConditionsView survives an observation arriving under it", () => {
  const q = new AnnouncementQueue();
  const none = { place: PLACE, observation: null } as never;
  const view = mount(withAnnouncer(<DetailedConditionsView data={none} />, q));
  assert.match(view.text(), /not available/);

  view.rerender(withAnnouncer(<DetailedConditionsView data={{
    place: PLACE,
    observation: { windSpeedMph: 12, windDirDeg: 270, windGustMph: 20, humidityPct: 64,
                   dewpointF: 55, pressureInHg: 30.1, visibilityMi: 10 },
  } as never} />, q));
  assert.match(view.text(), /Humidity/);
  assert.match(view.text(), /64%/);
  view.unmount();
});

test("FeelsLikeView survives a temperature arriving under it", () => {
  const q = new AnnouncementQueue();
  const none = { place: PLACE, actualF: null, feelsLikeF: null,
                 windChillActive: false, heatIndexActive: false, advisory: null } as never;
  const view = mount(withAnnouncer(<FeelsLikeView data={none} />, q));
  assert.match(view.text(), /not available/);

  view.rerender(withAnnouncer(<FeelsLikeView data={{
    place: PLACE, actualF: 41, feelsLikeF: 33,
    windChillActive: true, heatIndexActive: false, advisory: null,
  } as never} />, q));
  assert.match(view.text(), /41/);
  assert.match(view.text(), /33/);
  view.unmount();
});

test("AirportDelaysView survives availability flipping under it", () => {
  const q = new AnnouncementQueue();
  const view = mount(withAnnouncer(
    <AirportDelaysView data={{ available: false, reason: "FAA feed unreachable", delays: [] } as never} />, q));
  assert.match(view.text(), /FAA feed unreachable/);

  view.rerender(withAnnouncer(<AirportDelaysView data={{
    available: true, reason: "", delays: [
      { iata: "BNA", name: "Nashville", kind: "ground-delay", avgDelayMinutes: 35, reason: "weather" },
    ],
  } as never} />, q));
  assert.match(view.text(), /Nashville/);
  view.unmount();
});

test("arrowing a scene speaks the item on the interrupting navigation channel", async () => {
  // Two bugs in one. Readouts used to go to the polite channel, which a
  // screen reader queues — walking a list quickly meant the middle items were
  // replaced in the DOM before they were ever spoken. And the announce only
  // fired when the index CHANGED, so a press that clamped at either end was
  // answered by silence, which is indistinguishable from a dropped key.
  const q = new AnnouncementQueue();
  const view = mount(withAnnouncer(
    <StormTrackerView data={{ place: PLACE, storm: STORM, totalStorms: 1, summary: "1 storm." }} />, q));

  pressKey("ArrowDown");
  const first = q.getState();
  assert.equal(first.polite, null, "navigation must not land on the queued polite channel");
  assert.ok(first.navigation, "the first arrow press must speak");
  assert.match(first.navigation!.text, /Intensity/);
  assert.match(first.navigation!.text, /1 of 7/, "position belongs in the readout");

  pressKey("ArrowDown");
  assert.match(q.getState().navigation!.text, /2 of 7/);

  // Clamp at the top: Home from row 2 lands on row 1 and must still speak.
  pressKey("Home");
  const atTop = q.getState().navigation!;
  assert.match(atTop.text, /1 of 7/);

  // Pressing Up at the boundary does not move — and must still answer.
  pressKey("ArrowUp");
  const again = q.getState().navigation!;
  assert.match(again.text, /1 of 7/);
  assert.notEqual(again.id, atTop.id, "a boundary press must still produce a fresh announcement");
  view.unmount();
});

test("a scene's arrow keys go quiet once it is unmounted", () => {
  // These hooks listen on window, not on a focused element. A listener that
  // outlived its scene would have the previous screen answering arrow keys
  // over the top of the current one.
  const q = new AnnouncementQueue();
  const view = mount(withAnnouncer(
    <StormTrackerView data={{ place: PLACE, storm: STORM, totalStorms: 1, summary: "1 storm." }} />, q));
  pressKey("ArrowDown");
  assert.ok(q.getState().navigation);
  view.unmount();

  q.cancel();
  pressKey("ArrowDown");
  assert.equal(q.getState().navigation, null, "an unmounted scene must not still be listening");
});
