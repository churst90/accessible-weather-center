// Import the DOM shim before anything that touches React or `document`.
import { mount, React } from "./dom";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WeatherscanFrame } from "../src/ui/weatherscan/WeatherscanFrame";
import { PrecipLegend } from "../src/ui/scenes/PrecipLegend";
import { getDevice } from "../src/devices";

/**
 * The WeatherStar 4000 v2 header parallelogram.
 *
 * The shape is a clip-path, so it lives in CSS and cannot be asserted by
 * rendering — happy-dom has no layout. What CAN be asserted is that the
 * numbers in the stylesheet are still the measured ones, which is the failure
 * this is actually worried about: someone nudging a percentage to make
 * something line up on their monitor, leaving the comment above it claiming a
 * measurement that is no longer there.
 *
 * The measurement itself: the band is full-width with its RIGHT END cut on a
 * diagonal — the left edge reaches x=0 on every row, so it is a clip-path and
 * not a skewX on the element. Least-squares fit of the right edge against y,
 * extrapolated to the band's own top and bottom rows. Three independent
 * orange captures agreed to a tenth of a percent:
 *
 *     Current Conditions   83.86% -> 71.29%   band height 16.09%
 *     Latest Observations  83.89% -> 71.17%   band height 16.02%
 *     Travel Cities        same slope, same endpoints
 *     Local Radar (pink)   88.9%  -> 72.7%    band height 24.06%
 *
 * The pink band's bottom endpoint lands within 1.5% of the orange one, which
 * is what says it is the same diagonal carried further up rather than a
 * different shape.
 */

const CSS = readFileSync(
  new URL("../src/ui/weatherscan/weatherscan.css", import.meta.url),
  "utf8"
);

/** The clip-path declared for a selector, if any. */
function clipPathFor(selector: string): string | null {
  const at = CSS.indexOf(selector);
  if (at < 0) return null;
  const block = CSS.slice(at, CSS.indexOf("}", at));
  const m = block.match(/clip-path:\s*polygon\(([^)]*)\)/);
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}

test("the orange header keeps its measured diagonal", () => {
  const clip = clipPathFor('body[data-theme="ws4000-v2"] .ws-header::before');
  assert.ok(clip, "the orange header should declare a clip-path polygon");
  // 83.9% at the top edge, 71.2% at the bottom, left edge flush at 0.
  assert.match(clip!, /83\.9%/, `top-right corner moved: ${clip}`);
  assert.match(clip!, /71\.2%/, `bottom-right corner moved: ${clip}`);
  assert.match(clip!, /^0 0/, "the left edge must stay flush — it is not a skew");
});

test("the pink radar header is the same diagonal carried further up", () => {
  const clip = clipPathFor('body[data-theme="ws4000-v2"] .ws-header[data-variant="radar"]::before');
  assert.ok(clip, "the radar header should declare its own clip-path");
  assert.match(clip!, /88\.9%/, `top-right corner moved: ${clip}`);
  assert.match(clip!, /72\.7%/, `bottom-right corner moved: ${clip}`);
  // The two bands' bottom corners are within 1.5% of each other. That
  // closeness is the evidence they are one shape, so it is worth pinning.
  assert.ok(Math.abs(72.7 - 71.2) < 2);
});

test("the radar band is taller than the standard one, because it holds the ramp", () => {
  const std = CSS.match(/\.ws-header \{[^}]*min-height:\s*([\d.]+)%/);
  const radar = CSS.match(/\.ws-header\[data-variant="radar"\] \{[^}]*min-height:\s*([\d.]+)%/);
  assert.ok(std && radar, "both bands should declare a measured height");
  assert.equal(std![1], "16");    // 16.09 / 16.02 / 16.0 measured
  assert.equal(radar![1], "24");  // 24.06 measured
  assert.ok(Number(radar![1]) > Number(std![1]));
});

test("both ramps are declared, and they differ in kind", () => {
  // Orange darkens monotonically; pink is a symmetric V that returns to full
  // brightness at the bottom. Collapsing either into a two-stop gradient
  // would lose the streaking that makes the band read as WeatherStar chrome.
  const orange = CSS.slice(CSS.indexOf('body[data-theme="ws4000-v2"] .ws-header::before'));
  assert.match(orange.slice(0, 600), /#f58200/, "the orange highlight streak");
  assert.match(orange.slice(0, 600), /#7a391c/, "the orange bottom");
  const pink = CSS.slice(CSS.indexOf('.ws-header[data-variant="radar"]::before'));
  assert.match(pink.slice(0, 600), /#632635/, "the pink band's dark middle");
  assert.match(pink.slice(0, 600), /#f38fe5/, "...and its bright bottom, which the orange has not");
});

test("only the WeatherStar 4000 v2 declares the 2005 radar redesign", () => {
  assert.equal(getDevice("ws4000-v2").capabilities.radarRedesign, true);
  for (const id of ["ws4000-v1", "intellistar2", "weatherscan-v2", "weatherstarxl"]) {
    assert.notEqual(getDevice(id).capabilities.radarRedesign, true, `${id} should not`);
  }
});

test("the header carries the variant and the ramp when asked", () => {
  const m = mount(
    <WeatherscanFrame
      sceneTitle="Local Doppler Radar"
      alertCount={0}
      headerVariant="radar"
      headerExtra={<PrecipLegend />}
    >
      <p>scene</p>
    </WeatherscanFrame>
  );
  const header = m.container.querySelector(".ws-header")!;
  assert.equal(header.getAttribute("data-variant"), "radar");
  // The ramp belongs inside the band, not in the scene below it.
  assert.ok(m.container.querySelector(".ws4000-precip")?.closest(".ws-header"),
    "the PRECIP ramp should render inside the header");
  m.unmount();
});

test("every other scene leaves the header alone", () => {
  const m = mount(
    <WeatherscanFrame sceneTitle="Current Conditions" alertCount={0}><p>scene</p></WeatherscanFrame>
  );
  const header = m.container.querySelector(".ws-header")!;
  assert.equal(header.getAttribute("data-variant"), null);
  assert.equal(m.container.querySelector(".ws4000-precip"), null);
  m.unmount();
});
