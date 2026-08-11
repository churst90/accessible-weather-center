// Import the DOM shim before anything that touches React or `document`.
import { mount, pressKey, React } from "./dom";
import { test } from "node:test";
import assert from "node:assert/strict";
import { AnnouncerContext } from "../src/a11y/AnnouncerContext";
import { AnnouncementQueue } from "../src/a11y/AnnouncementQueue";
import { LocalRadarView } from "../src/ui/scenes/LocalRadarView";
import type { RainViewerClient } from "../src/core/weather/RainViewerClient";
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

/** Three storms, ordered as the scene orders them: soonest ETA first. */
const STORMS: TrackedStorm[] = [
  STORM,
  { ...STORM, id: "track_2", band: "moderate", distanceFromHomeMi: 41.2,
    bearingFromHomeDeg: 180, etaMinutes: 77 } as unknown as TrackedStorm,
  { ...STORM, id: "track_3", band: "light", distanceFromHomeMi: 55.9,
    bearingFromHomeDeg: 45, movementMph: 0, etaMinutes: null } as unknown as TrackedStorm,
];

const RV = { getManifest: async () => ({ radar: { past: [] } }) } as unknown as RainViewerClient;

function radar(data: Record<string, unknown>) {
  return <LocalRadarView data={data as never} rainviewer={RV} />;
}

function withAnnouncer(node: React.ReactElement, q: AnnouncementQueue) {
  return <AnnouncerContext.Provider value={q}>{node}</AnnouncerContext.Provider>;
}

test("LocalRadarView survives storms appearing under it", () => {
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
  const view = mount(withAnnouncer(radar({ place: PLACE, capturedAt: null, storms: [], summary: "No precipitation within 150 miles. All clear.", error: null }), q));
  assert.match(view.text(), /No precipitation within 150 miles/);

  view.rerender(withAnnouncer(
    radar({ place: PLACE, capturedAt: new Date(), storms: STORMS, summary: "4 storms detected.", error: null }), q));
  assert.match(view.text(), /storms detected/);
  assert.match(view.text(), /29 mi/, "the storm's distance should render");

  // And back again — a storm clearing is just as ordinary.
  view.rerender(withAnnouncer(radar({ place: PLACE, capturedAt: null, storms: [], summary: "No precipitation within 150 miles. All clear.", error: null }), q));
  assert.match(view.text(), /No precipitation within 150 miles/);
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
    radar({ place: PLACE, capturedAt: new Date(), storms: STORMS,
      summary: `${STORMS.length} storms detected.`, error: null }), q));

  pressKey("ArrowDown");
  const first = q.getState();
  assert.equal(first.polite, null, "navigation must not land on the queued polite channel");
  assert.ok(first.navigation, "the first arrow press must speak");
  // Arrows walk the storms, not one storm's measurement rows: a screen called
  // Storm Tracker that answers Down with "Intensity" has told the user about
  // a parameter of something they were never offered a choice of.
  assert.match(first.navigation!.text, /miles/, "the readout should describe a storm");
  assert.doesNotMatch(first.navigation!.text, /^Intensity/);
  assert.match(first.navigation!.text, /1 of 3/, "position belongs in the readout");

  pressKey("ArrowDown");
  assert.match(q.getState().navigation!.text, /2 of 3/);

  // Clamp at the top: Home from storm 2 lands on storm 1 and must still speak.
  pressKey("Home");
  const atTop = q.getState().navigation!;
  assert.match(atTop.text, /1 of 3/);

  // Pressing Up at the boundary does not move — and must still answer.
  pressKey("ArrowUp");
  const again = q.getState().navigation!;
  assert.match(again.text, /1 of 3/);
  assert.notEqual(again.id, atTop.id, "a boundary press must still produce a fresh announcement");

  // The position must be announced exactly once. The view supplies the storm
  // sentence and useArrowList appends "N of M"; having both do it read
  // "...ETA 41 minutes. 1 of 1 1 of 1."
  assert.equal((again.text.match(/1 of 3/g) ?? []).length, 1, "position announced twice");
  view.unmount();
});

test("a scene's arrow keys go quiet once it is unmounted", () => {
  // These hooks listen on window, not on a focused element. A listener that
  // outlived its scene would have the previous screen answering arrow keys
  // over the top of the current one.
  const q = new AnnouncementQueue();
  const view = mount(withAnnouncer(
    radar({ place: PLACE, capturedAt: new Date(), storms: [STORM], summary: "1 storm.", error: null }), q));
  pressKey("ArrowDown");
  assert.ok(q.getState().navigation);
  view.unmount();

  q.cancel();
  pressKey("ArrowDown");
  assert.equal(q.getState().navigation, null, "an unmounted scene must not still be listening");
});

test("arrowing the radar screen walks storms, not measurement rows", () => {
  // Reported from use: "arrowing through the storm tracker doesn't work —
  // instead of a list of the storms to arrow through it reads one parameter
  // per line, radius, speed, etc."
  //
  // The scene kept only the nearest storm and threw the rest away, so the
  // only list the view had to offer arrow keys was that one storm's seven
  // measurement rows.
  const q = new AnnouncementQueue();
  const view = mount(withAnnouncer(
    radar({ place: PLACE, capturedAt: new Date(), storms: STORMS,
      summary: `${STORMS.length} storms detected.`, error: null }), q));

  // Every storm is listed, not just the nearest.
  assert.match(view.text(), /41 mi/, "the second storm should be on screen");
  assert.match(view.text(), /56 mi/, "the third storm should be on screen");

  // Walking speaks storms.
  pressKey("ArrowDown");
  const one = q.getState().navigation!.text;
  assert.match(one, /29 miles northwest/, "first storm");
  assert.match(one, /1 of 3/);

  pressKey("ArrowDown");
  const two = q.getState().navigation!.text;
  assert.match(two, /41 miles south/, "second storm");
  assert.match(two, /2 of 3/);

  // The per-selection measurement table belonged to the Storm Tracker screen,
  // which is gone — the radar screen lists every storm and gives the full
  // measurements on Enter instead. Nothing to assert about a table here.
  view.unmount();
});

test("Enter on a storm reads its full measurements", () => {
  // Reported from use: "i can't press enter on them to hear details about
  // them." useArrowList has an onActivate hook for exactly this and the view
  // never passed one, so the key was swallowed.
  const q = new AnnouncementQueue();
  const view = mount(withAnnouncer(
    radar({ place: PLACE, capturedAt: new Date(), storms: STORMS,
      summary: `${STORMS.length} storms detected.`, error: null }), q));

  pressKey("ArrowDown");
  pressKey("ArrowDown");        // land on storm 2
  pressKey("Enter");

  // Details go to the assertive channel: the user asked for them, so they
  // must not sit behind whatever the scene is narrating.
  const said = q.getState().assertive;
  assert.ok(said, "Enter must announce something");
  assert.match(said!.text, /Storm 2 details/);
  assert.match(said!.text, /Peak rate/i, "the full measurement set, not the one-line summary");
  assert.match(said!.text, /Radius/i);
  assert.match(said!.text, /minutes to reach your location/);
  assert.match(said!.text, /41 miles/, "the SELECTED storm's readings");
  view.unmount();
});
