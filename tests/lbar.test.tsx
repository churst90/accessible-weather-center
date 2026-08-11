// Import the DOM shim before anything that touches React or `document`.
import { mount, React } from "./dom";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WeatherscanLBar,
  LBAR_COLUMN_PX,
  LBAR_MAIN_PX,
  LBAR_RASTER_PX,
} from "../src/ui/weatherscan/WeatherscanLBar";
import { WeatherscanFrame } from "../src/ui/weatherscan/WeatherscanFrame";
import { DEVICES, getDevice } from "../src/devices";
import type { Observation, LatLon } from "../src/core/types";
import type { RainViewerClient } from "../src/core/weather/RainViewerClient";
import type { TrackedStorm } from "../src/core/radar/StormTracker";

/**
 * The Weatherscan V2 L-bar.
 *
 * Two things are worth guarding here and they are different in kind.
 *
 * The first is the geometry, because it is a DERIVATION and derivations rot.
 * 224 + 496 = 720 is the whole argument for the column width, and it came out
 * of two unrelated render scripts agreeing. If someone later "tidies" one of
 * those constants the argument silently stops holding, so the sum is asserted
 * rather than left as a comment.
 *
 * The second is that the sidebar stays quiet. It is persistent chrome sitting
 * beside every scene, updating every 60 seconds, in an application whose
 * entire premise is that the screen reader is the primary interface. One
 * `aria-live` in this subtree and every scene narration in the app gets
 * interrupted by a temperature. That is not a hypothetical: the announcer
 * queue exists because live-region starvation already broke this app once.
 */

const COORD: LatLon = { lat: 36, lon: -82 };
const PLACE = { name: "Testville", state: "TN", coord: COORD };
const RV = { getManifest: async () => ({ radar: { past: [] } }) } as unknown as RainViewerClient;

const OBS: Observation = {
  placeId: "p1",
  observedAt: new Date("2026-01-01T12:00:00Z"),
  temperatureF: 47,
  feelsLikeF: 41,
  dewpointF: 33,
  humidityPct: 58,
  windDirDeg: 315,
  windSpeedMph: 12,
  windGustMph: 24,
  pressureInHg: 30.11,
  visibilityMi: 10,
  conditionText: "Partly Cloudy",
  conditionIcon: null,
};

function render(obs: Observation | null, storms: TrackedStorm[] = []) {
  return mount(
    <WeatherscanLBar place={PLACE} observation={obs} rainviewer={RV} storms={storms} alerts={[]} />
  );
}

test("the column split adds up to the raster it was measured on", () => {
  // CityTicker.rs tickerWidth=496, LocalDoppler.prod gradientBox(224, 19).
  // Neither script knows about the other; that they sum to 720 is why the
  // split is treated as fact rather than as a guess from a screenshot.
  assert.equal(LBAR_COLUMN_PX + LBAR_MAIN_PX, LBAR_RASTER_PX);
  assert.equal(LBAR_RASTER_PX, 720);
});

test("only Weatherscan V2 declares an L-bar", () => {
  const withLbar = DEVICES.filter((d) => d.capabilities.lbar).map((d) => d.id);
  assert.deepEqual(withLbar, ["weatherscan-v2"]);
  // And it is genuinely on, rather than the filter matching an empty list.
  assert.equal(getDevice("weatherscan-v2").capabilities.lbar, true);
});

test("renders as a labelled complementary landmark, reachable without Tab", () => {
  const m = render(OBS);
  const aside = m.container.querySelector('[role="complementary"]');
  assert.ok(aside, "L-bar should be a complementary landmark");
  assert.match(aside!.getAttribute("aria-label") ?? "", /L bar/i);
  // Nothing in the sidebar may take a tab stop: Tab belongs to scene changes.
  assert.equal(m.container.querySelectorAll("[tabindex]").length, 0);
  assert.equal(m.container.querySelectorAll("a, button, input, select").length, 0);
  m.unmount();
});

test("nothing in the L-bar is a live region", () => {
  const m = render(OBS, []);
  const live = m.container.querySelectorAll("[aria-live], [role=alert], [role=status], [role=log]");
  assert.equal(
    live.length,
    0,
    "the L-bar must never speak — it updates every 60s and would talk over every scene"
  );
  m.unmount();
});

test("observations reach the column, with wind spoken as a compass direction", () => {
  const m = render(OBS);
  const t = m.text();
  assert.match(t, /47/);
  assert.match(t, /Partly Cloudy/);
  assert.match(t, /Testville, TN/);
  assert.match(t, /41°/);          // feels like
  assert.match(t, /58%/);          // humidity
  assert.match(t, /30\.11 inches/); // pressure, two decimals
  // 315° is northwest, and the gust is included rather than dropped.
  assert.match(t, /northwest 12 mph, gusting 24/);
  m.unmount();
});

test("compass bearings round to the nearest point, not down to it", () => {
  // 315 is a poor test of the rounding on its own: 315/22.5 is exactly 14, so
  // floor and round agree and a truncating bug survives. These bearings all
  // fall between two points, where the two differ.
  const cases: Array<[number, string]> = [
    [0,   "north "],
    [11,  "north "],            // 0.49 -> north, not calm-adjacent nonsense
    [12,  "north northeast "],  // 0.53 -> rounds up
    [90,  "east "],
    [330, "north northwest "],  // 14.67 -> 15; floor would say "northwest"
    [350, "north "],            // 15.56 -> 16 -> wraps to 0
  ];
  for (const [deg, expected] of cases) {
    const m = render({ ...OBS, windDirDeg: deg, windSpeedMph: 10, windGustMph: null });
    assert.match(
      m.text(),
      new RegExp(`${expected}10 mph`),
      `${deg}° should read as "${expected.trim()}"`
    );
    m.unmount();
  }
});

test("a calm wind does not get a direction glued to it", () => {
  const m = render({ ...OBS, windSpeedMph: 0, windDirDeg: 180, windGustMph: null });
  const t = m.text();
  assert.match(t, /Calm/);
  assert.doesNotMatch(t, /south 0 mph/);
  m.unmount();
});

test("missing values degrade to dashes instead of NaN or blank", () => {
  const sparse: Observation = {
    ...OBS,
    temperatureF: null, feelsLikeF: null, humidityPct: null,
    windSpeedMph: null, pressureInHg: null, visibilityMi: null,
  };
  const m = render(sparse);
  const t = m.text();
  assert.doesNotMatch(t, /NaN/);
  assert.match(t, /--/);
  // A null wind speed is not the same as a calm one, but both read as Calm
  // here rather than as an empty cell — an empty cell reads as nothing at all.
  assert.match(t, /Calm/);
  m.unmount();
});

test("no observation yet says so rather than rendering an empty column", () => {
  const m = render(null);
  assert.match(m.text(), /Observations loading/i);
  m.unmount();
});

test("the radar note counts storms without re-enumerating them", () => {
  const storm = (id: string): TrackedStorm => ({
    id, band: "heavy", centroid: { lat: 36.4, lon: -82.2 }, cells: [],
    peakMmPerHour: 12, radiusMi: 6, distanceFromHomeMi: 28,
    bearingFromHomeDeg: 315, movementDeg: 90, movementMph: 22, etaMinutes: 41,
  } as unknown as TrackedStorm);

  const none = render(OBS, []);
  assert.match(none.text(), /No precipitation within 150 miles/);
  none.unmount();

  const one = render(OBS, [storm("a")]);
  assert.match(one.text(), /1 area of precipitation/);
  one.unmount();

  const two = render(OBS, [storm("a"), storm("b")]);
  assert.match(two.text(), /2 areas of precipitation/);
  two.unmount();
});

test("reduced motion pins the radar loop and says so", () => {
  // The loop is drawn onto a canvas frame by frame, so the CSS media query
  // that freezes the ticker crawl cannot reach it — and in the L-bar it runs
  // for the whole session rather than for one scene.
  const real = window.matchMedia;
  const stub = (q: string) =>
    ({
      matches: q.includes("prefers-reduced-motion"),
      media: q,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }) as unknown as MediaQueryList;
  (window as unknown as { matchMedia: typeof stub }).matchMedia = stub;
  try {
    const m = render(OBS, []);
    assert.match(m.text(), /Loop paused; showing the latest frame/);
    m.unmount();
  } finally {
    (window as unknown as { matchMedia: unknown }).matchMedia = real;
  }
});

test("without the preference the loop is left running", () => {
  const m = render(OBS, []);
  assert.doesNotMatch(m.text(), /Loop paused/);
  m.unmount();
});

test("the frame only switches to the L-bar grid when an L-bar is passed", () => {
  const plain = mount(
    <WeatherscanFrame sceneTitle="Current Conditions" alertCount={0}>
      <p>scene</p>
    </WeatherscanFrame>
  );
  assert.equal(plain.container.querySelector(".ws-frame")?.classList.contains("ws-lbar"), false);
  plain.unmount();

  const withBar = mount(
    <WeatherscanFrame sceneTitle="Current Conditions" alertCount={0} lbar={<aside id="bar" />}>
      <p>scene</p>
    </WeatherscanFrame>
  );
  const frame = withBar.container.querySelector(".ws-frame");
  assert.equal(frame?.classList.contains("ws-lbar"), true);
  assert.ok(withBar.container.querySelector("#bar"), "the L-bar node should be rendered");
  withBar.unmount();
});

test("the L-bar follows the scene in the DOM so browse mode reaches main first", () => {
  const m = mount(
    <WeatherscanFrame sceneTitle="Current Conditions" alertCount={0} lbar={<aside id="bar" />}>
      <p>scene</p>
    </WeatherscanFrame>
  );
  const main = m.container.querySelector("main")!;
  const bar = m.container.querySelector("#bar")!;
  // DOCUMENT_POSITION_FOLLOWING === 4: the sidebar comes after the stage.
  assert.equal(main.compareDocumentPosition(bar) & 4, 4);
  m.unmount();
});
