// Import the DOM shim before anything that touches React or `document`.
import { mount, React } from "./dom";
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrecipLegend, PRECIP_RAMP, INCOMPLETE_DATA_COLOR } from "../src/ui/scenes/PrecipLegend";
import { MapTileCache } from "../src/core/radar/MapTileCache";
import { resolveSceneView } from "../src/ui/scenes/sceneRegistry";

/**
 * The WeatherStar 4000 v2 radar chrome.
 *
 * The eight-step assertion is the point of this file. The device profile said
 * seven, and seven is what anybody counting quickly from the capture would
 * say, because the fourth block is so dark it reads as a gap between the dark
 * green and the yellow rather than as a swatch of its own. Averaged across
 * its interior it is #071506 and it is exactly as wide as its neighbours.
 *
 * A near-black step in the middle of a green-to-red ramp looks like a
 * mistake, which makes it the single most likely thing here to be "fixed" by
 * someone acting in good faith. Hence the test.
 */

test("the ramp has eight steps, not the seven the profile claimed", () => {
  assert.equal(PRECIP_RAMP.length, 8);
});

test("the fourth step really is near-black, and is not an artifact", () => {
  // Measured as the mean over a ~30x46 interior region of the capture. If
  // this is ever changed to a green because it "looks wrong", the ramp no
  // longer matches the hardware.
  assert.equal(PRECIP_RAMP[3], "#071506");
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(PRECIP_RAMP[3].slice(i, i + 2), 16));
  assert.ok(r + g + b < 60, `expected near-black, got rgb(${r},${g},${b})`);
});

test("the ramp runs light to heavy, and the ends are the measured extremes", () => {
  assert.equal(PRECIP_RAMP[0], "#33f339", "brightest green first");
  assert.equal(PRECIP_RAMP[PRECIP_RAMP.length - 1], "#86300c", "dark red last");
  // Every entry is a full six-digit hex — a truncated one would silently
  // render as black and be invisible against the near-black step.
  for (const c of PRECIP_RAMP) assert.match(c, /^#[0-9a-f]{6}$/);
  assert.equal(new Set(PRECIP_RAMP).size, PRECIP_RAMP.length, "no duplicated steps");
});

test("Incomplete Data is a separate swatch, not part of the ramp", () => {
  // It means "no return here", which is a different statement from "a return
  // of zero". Folding it into the ramp would make missing data look like
  // light precipitation.
  assert.ok(!PRECIP_RAMP.includes(INCOMPLETE_DATA_COLOR as never));
  assert.match(INCOMPLETE_DATA_COLOR, /^#[0-9a-f]{6}$/);
});

test("the legend renders every step, and hides them from assistive tech", () => {
  const m = mount(<PrecipLegend />);
  const swatches = m.container.querySelectorAll(".ws4000-precip-ramp i");
  assert.equal(swatches.length, 8);
  // The canvas it labels is aria-hidden and the storm list names intensities
  // in words, so the colours are decoration. What is exposed is the sense of
  // the scale, which the words do not carry.
  assert.equal(m.container.querySelector(".ws4000-precip-ramp")!.getAttribute("aria-hidden"), "true");
  assert.match(
    m.container.querySelector(".ws4000-precip")!.getAttribute("aria-label") ?? "",
    /light to heavy/i
  );
  m.unmount();
});

test("base tiles default to dark and switch to positron on request", () => {
  const dark = MapTileCache.baseUrl(7, 33, 44);
  const light = MapTileCache.baseUrl(7, 33, 44, "light");
  assert.match(dark, /dark_all/);
  assert.match(light, /light_all/);
  // Only the tile set differs — same host pattern, same z/x/y.
  assert.equal(dark.replace("dark_all", "X"), light.replace("light_all", "X"));
  assert.match(light, /\/7\/33\/44\.png$/);
});

test("only the WeatherStar 4000 v2 overrides the radar view", () => {
  // The override exists to give that one machine light tiles and the PRECIP
  // ramp. Every other theme must fall through to the shared view, or a
  // rendering change would silently apply to one machine and not the rest.
  const overridden = resolveSceneView("ws4000-v2" as never, "radar");
  const standard = resolveSceneView("ws4000-v1" as never, "radar");
  const is2 = resolveSceneView("intellistar2" as never, "radar");
  assert.ok(overridden && standard && is2);
  assert.notEqual(overridden, standard, "ws4000-v2 should get its own renderer");
  assert.equal(standard, is2, "every other machine shares the default renderer");
});

test("the override still resolves non-radar scenes to the shared views", () => {
  // A per-theme table entry must not shadow the whole theme.
  assert.equal(
    resolveSceneView("ws4000-v2" as never, "current"),
    resolveSceneView("ws4000-v1" as never, "current")
  );
});
