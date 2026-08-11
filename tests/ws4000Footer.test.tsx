// Import the DOM shim before anything that touches React or `document`.
import { mount, React } from "./dom";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Ws4000Footer,
  footerItems,
  FOOTER_HEIGHT_PCT,
  FOOTER_TEXT_INSET_PCT,
  FOOTER_BG,
} from "../src/ui/weatherscan/Ws4000Footer";
import { WeatherscanFrame } from "../src/ui/weatherscan/WeatherscanFrame";
import { DEVICES, getDevice } from "../src/devices";
import type { Observation } from "../src/core/types";

/**
 * The WeatherStar 4000 v2 footer bar.
 *
 * Two things under guard, and they matter for different reasons.
 *
 * The measurements, because they came from reading four JPEGs and that is
 * exactly the kind of number that gets "tidied" later by someone who assumes
 * it was a guess. It was not: four captures at three different resolutions
 * agreed on the band height to within a fifth of a percent and on the colour
 * exactly.
 *
 * And the honesty of the content. One of the four confirmed footer strings is
 * "May Precipitation: 1.20 in", and this application does not know that
 * number — no observation, no almanac, nothing. The temptation to render the
 * string anyway with a plausible-looking decimal is real, and it would put a
 * fabricated measurement on a weather display. The last test here exists to
 * make that regression loud.
 */

const OBS: Observation = {
  placeId: "p1",
  observedAt: new Date("2026-05-10T20:59:00Z"),
  temperatureF: 66,
  feelsLikeF: 66,
  dewpointF: 52,
  humidityPct: 60,
  windDirDeg: null,
  windSpeedMph: 0,
  windGustMph: null,
  pressureInHg: 29.96,
  visibilityMi: 10,
  conditionText: "Sunny",
  conditionIcon: null,
};

test("the measured geometry is what the captures said", () => {
  // Band height 14.9 / 14.9 / 15.1 / 15.2 %, text inset 11.0 % on three
  // reads, colour identical in all four. See docs/reference/ws4000/.
  assert.equal(FOOTER_HEIGHT_PCT, 15);
  assert.equal(FOOTER_TEXT_INSET_PCT, 11);
  assert.equal(FOOTER_BG, "rgb(44, 62, 144)");
});

test("only the WeatherStar 4000 v2 declares a footer", () => {
  assert.deepEqual(DEVICES.filter((d) => d.capabilities.footer).map((d) => d.id), ["ws4000-v2"]);
  assert.equal(getDevice("ws4000-v2").capabilities.footer, true);
});

test("the confirmed strings come out in the captured wording", () => {
  const items = footerItems(OBS, "Bellingham");
  // Verbatim from docs/reference/ws4000/WS4000_Simulator_v2_-_Current_Conditions.jpg
  assert.ok(items.includes("Conditions at Bellingham"));
  // ...and from Extended_Forecast.jpg, which showed the bare condition text.
  assert.ok(items.includes("Sunny"));
  // ...and Latest_Observations.jpg: both fields, one line, humidity first.
  assert.ok(
    items.includes("Humidity: 60%   Dewpoint: 52°F"),
    `humidity/dewpoint line missing or reworded: ${JSON.stringify(items)}`
  );
});

test("month-to-date precipitation is never printed, because it is not known", () => {
  // "May Precipitation: 1.20 in" is a confirmed footer string, and the only
  // one of the four this app cannot source. Printing it would mean inventing
  // a rainfall total. If a precipitation feed is ever added, delete this test
  // deliberately — do not let it start passing by accident.
  const items = footerItems(OBS, "Bellingham");
  for (const item of items) {
    assert.doesNotMatch(item, /precipitation/i, `fabricated precipitation total: "${item}"`);
  }
});

test("missing fields drop their stop rather than printing a dash", () => {
  // A rotation with a gap is one fewer stop. A dash is the display asserting
  // that it measured something and got nothing, which is a different claim.
  const sparse: Observation = {
    ...OBS,
    conditionText: null, humidityPct: null, dewpointF: null,
    windSpeedMph: null, pressureInHg: null,
  };
  const items = footerItems(sparse, "Bellingham");
  assert.deepEqual(items, ["Conditions at Bellingham"]);
  for (const item of items) assert.doesNotMatch(item, /--|NaN|undefined|null/);
});

test("no observation at all still names the place, and never crashes", () => {
  assert.deepEqual(footerItems(null, "Bellingham"), ["Conditions at Bellingham"]);
  assert.deepEqual(footerItems(null, null), []);
});

test("a calm wind reads Calm, a real wind gets a compass point", () => {
  assert.ok(footerItems(OBS, "X").includes("Wind: Calm"));
  const windy = footerItems({ ...OBS, windSpeedMph: 12, windDirDeg: 315 }, "X");
  assert.ok(windy.includes("Wind: NW 12 mph"), JSON.stringify(windy));
  // 330 is between points: rounds to NNW, and must not truncate to NW.
  const between = footerItems({ ...OBS, windSpeedMph: 9, windDirDeg: 330 }, "X");
  assert.ok(between.includes("Wind: NNW 9 mph"), JSON.stringify(between));
});

test("the whole rotation is published statically, and nothing is a live region", () => {
  const m = mount(<Ws4000Footer observation={OBS} placeName="Bellingham" />);
  // Every item reachable at once, rather than a carousel the user must wait out.
  const listed = [...m.container.querySelectorAll("li")].map((li) => li.textContent);
  assert.deepEqual(listed, footerItems(OBS, "Bellingham"));
  // The band sits under every scene; a live region here would interrupt
  // every narration in the app.
  assert.equal(m.container.querySelectorAll("[aria-live], [role=status], [role=alert]").length, 0);
  // And it takes no tab stop — Tab changes scenes.
  assert.equal(m.container.querySelectorAll("[tabindex], a, button, input").length, 0);
  m.unmount();
});

test("the visible rotating text is hidden from assistive tech", () => {
  const m = mount(<Ws4000Footer observation={OBS} placeName="Bellingham" />);
  const text = m.container.querySelector(".ws4000-footer-text");
  assert.ok(text, "the visible band text should exist");
  assert.equal(text!.getAttribute("aria-hidden"), "true");
  m.unmount();
});

test("an empty rotation renders an empty band rather than nothing at all", () => {
  // The bar is chrome: it must hold its 15% of the frame even with no data,
  // or the layout jumps when the first observation lands.
  const m = mount(<Ws4000Footer observation={null} placeName={null} />);
  const bar = m.container.querySelector(".ws4000-footer");
  assert.ok(bar, "the band should still be in the DOM");
  assert.equal(bar!.getAttribute("aria-hidden"), "true");
  m.unmount();
});

test("the footer takes the bottom slot from the hotkey status bar", () => {
  const withFooter = mount(
    <WeatherscanFrame sceneTitle="Current Conditions" alertCount={0} footer={<footer id="f" />}>
      <p>scene</p>
    </WeatherscanFrame>
  );
  assert.ok(withFooter.container.querySelector("#f"));
  assert.equal(withFooter.container.querySelector(".ws-status-bar"), null);
  withFooter.unmount();

  const without = mount(
    <WeatherscanFrame sceneTitle="Current Conditions" alertCount={0}>
      <p>scene</p>
    </WeatherscanFrame>
  );
  assert.ok(without.container.querySelector(".ws-status-bar"), "other machines keep the hints");
  without.unmount();
});

test("a severe interrupt takes the bottom slot back from the footer", () => {
  // The emergency crawl must beat persistent chrome; it is the one thing on
  // screen that cannot be allowed to lose its slot to a humidity reading.
  const m = mount(
    <WeatherscanFrame
      sceneTitle="Severe Weather"
      alertCount={1}
      severeInterrupt
      tickerText="TORNADO WARNING"
      footer={<footer id="f" />}
    >
      <p>scene</p>
    </WeatherscanFrame>
  );
  assert.equal(m.container.querySelector("#f"), null, "the footer must yield to the alert crawl");
  assert.ok(m.container.querySelector(".ws-ticker"));
  m.unmount();
});
