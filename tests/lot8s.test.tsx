// Import the DOM shim before anything that touches React or `document`.
import { mount, React } from "./dom";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Lot8sFrame, LOT8S, toCssRect } from "../src/ui/weatherscan/Lot8sFrame";
import { WeatherscanFrame } from "../src/ui/weatherscan/WeatherscanFrame";
import { DEVICES, getDevice } from "../src/devices";
import { SceneScheduler } from "../src/core/scenes/SceneScheduler";
import type { Scene, RenderedScene, SceneContext } from "../src/core/scenes/Scene";

/**
 * The IntelliStar 2 LOT8s frame.
 *
 * The thing worth guarding hardest is the coordinate flip. TWC's render
 * scripts count y UP from the bottom of a 720x480 raster, and every number in
 * `_LOT8Setup.rs` is in that space. Read top-down instead — which is the
 * natural reading, and what CSS wants — and the content window lands off the
 * bottom of the screen while the "top bar" at y=401 sits near the floor.
 *
 * It would not throw. It would render a plausible-looking wrong layout, which
 * is the failure mode this project has hit twice before: a coordinate read in
 * the wrong frame of reference, believed because the result looked fine.
 *
 * So `toCssRect` is tested against hand-computed conversions rather than
 * against itself, and the window's numbers are pinned as the script states
 * them.
 */

test("the window is exactly what _LOT8Setup.rs declares", () => {
  //     blur_filter = GaussianBlurImageFilter(50, 117, 620, 263)
  //     blur_bg.setPosition(50, 117); blur_bg.setSize(620, 263)
  //     darkLayer2.setSize(620, 263); darkLayer2.setPosition(50, 117)
  assert.deepEqual({ ...LOT8S.window }, { x: 50, y: 117, w: 620, h: 263 });
  //     topBarPos = ( 50, 401 )
  assert.deepEqual({ ...LOT8S.barOrigin }, { x: 50, y: 401 });
  //     clkBkg.setSize(100, ...)
  assert.equal(LOT8S.clockChipW, 100);
  //     menuBackground.setPosition(0,22); .setSize(720,16)   [LdlMenu]
  assert.deepEqual({ ...LOT8S.ldl }, { x: 0, y: 22, w: 720, h: 16 });
  //     headline.setPosition(60, 356)
  assert.deepEqual({ ...LOT8S.headline }, { x: 60, y: 356 });
});

test("bottom-up render coordinates convert to top-down CSS", () => {
  // Hand-computed, deliberately not by reusing the function's own arithmetic.
  // The window's bottom edge is 117 up from the floor of a 480 raster and it
  // is 263 tall, so its top edge is 480 - 117 - 263 = 100 down from the top.
  const w = toCssRect(LOT8S.window);
  assert.equal(w.leftPct, (50 / 720) * 100);
  assert.equal(w.topPct, (100 / 480) * 100);
  assert.equal(w.widthPct, (620 / 720) * 100);
  assert.equal(w.heightPct, (263 / 480) * 100);

  // And sanity: ~6.9% / ~20.8% / ~86.1% / ~54.8%.
  assert.ok(Math.abs(w.leftPct - 6.944) < 0.01, `${w.leftPct}`);
  assert.ok(Math.abs(w.topPct - 20.833) < 0.01, `${w.topPct}`);
  assert.ok(Math.abs(w.widthPct - 86.111) < 0.01, `${w.widthPct}`);
  assert.ok(Math.abs(w.heightPct - 54.792) < 0.01, `${w.heightPct}`);
});

test("the bar sits ABOVE the window, which is the whole point of the flip", () => {
  // If y were read top-down, the bar (y=401 of 480) would be near the floor
  // and the window would start below the screen. In the real bottom-up space
  // the bar is near the ceiling and the window hangs under it.
  const bar = toCssRect({ ...LOT8S.barOrigin, w: LOT8S.window.w, h: LOT8S.barHeight });
  const win = toCssRect(LOT8S.window);
  assert.ok(bar.topPct < win.topPct, `bar ${bar.topPct}% should be above window ${win.topPct}%`);
  // The bar's bottom edge must clear the window's top edge.
  assert.ok(bar.topPct + bar.heightPct <= win.topPct,
    `bar bottom ${bar.topPct + bar.heightPct}% overlaps window top ${win.topPct}%`);
  // And everything must land on screen.
  assert.ok(bar.topPct >= 0, "the bar must not run off the top");
  assert.ok(win.topPct + win.heightPct <= 100, "the window must not run off the bottom");
});

test("the LDL lands at the bottom, below the window", () => {
  const ldl = toCssRect(LOT8S.ldl);
  const win = toCssRect(LOT8S.window);
  assert.ok(Math.abs(ldl.topPct - 92.083) < 0.01, `${ldl.topPct}`);
  assert.ok(Math.abs(ldl.heightPct - 3.333) < 0.01, `${ldl.heightPct}`);
  assert.ok(ldl.topPct > win.topPct + win.heightPct, "the LDL belongs under the window");
  assert.ok(ldl.topPct + ldl.heightPct <= 100);
});

test("the inferred bar height stays inside the bound the raster imposes", () => {
  // It is logo.size()[1] from a TIFF that is not in the package. The bar sits
  // at y=401 on a 480 raster, so anything over 79 runs off the top. If this
  // ever needs raising past 79, the reading of the layout is wrong.
  assert.ok(LOT8S.barHeight > 0);
  assert.ok(LOT8S.barHeight <= 480 - LOT8S.barOrigin.y,
    `${LOT8S.barHeight} exceeds the ${480 - LOT8S.barOrigin.y}px the raster leaves`);
});

test("only the IntelliStar 2 declares the LOT8s frame", () => {
  assert.deepEqual(DEVICES.filter((d) => d.capabilities.lot8s).map((d) => d.id), ["intellistar2"]);
  assert.equal(getDevice("intellistar2").capabilities.lot8s, true);
});

test("the scene renders inside the window, not beside it", () => {
  const m = mount(
    <Lot8sFrame placeName="Testville" rundown={["Current Conditions", "Local Doppler Radar"]}>
      <p id="scene">the scene</p>
    </Lot8sFrame>
  );
  const scene = m.container.querySelector("#scene");
  assert.ok(scene, "the scene should be rendered");
  assert.ok(scene!.closest(".lot8s-window"), "the scene must be inside the window element");
  m.unmount();
});

test("the bar is decoration — the location and clock are already spoken elsewhere", () => {
  const m = mount(<Lot8sFrame placeName="Testville"><p>scene</p></Lot8sFrame>);
  const bar = m.container.querySelector(".lot8s-bar");
  assert.ok(bar);
  assert.equal(bar!.getAttribute("aria-hidden"), "true");
  // No live region anywhere: the clock re-renders every 30s under every scene.
  assert.equal(m.container.querySelectorAll("[aria-live], [role=status]").length, 0);
  m.unmount();
});

test("the rundown shows what is on air and what is next, and no more", () => {
  const m = mount(
    <Lot8sFrame placeName="X" rundown={["Current Conditions", "Local Forecast", "Radar", "Almanac"]}>
      <p>scene</p>
    </Lot8sFrame>
  );
  const items = [...m.container.querySelectorAll(".lot8s-rundown-item")].map((e) => e.textContent);
  assert.deepEqual(items, ["Current Conditions", "Local Forecast"],
    "the script showed the current headline and the next one, not the whole rotation");
  m.unmount();
});

test("no rundown renders no strip rather than an empty one", () => {
  const m = mount(<Lot8sFrame placeName="X"><p>scene</p></Lot8sFrame>);
  assert.equal(m.container.querySelector(".lot8s-rundown"), null);
  m.unmount();
});

test("the frame only goes windowed when a wrapper is supplied", () => {
  const plain = mount(
    <WeatherscanFrame sceneTitle="Current Conditions" alertCount={0}><p id="s">x</p></WeatherscanFrame>
  );
  assert.equal(plain.container.querySelector(".ws-frame")!.classList.contains("ws-windowed"), false);
  assert.equal(plain.container.querySelector(".lot8s"), null);
  plain.unmount();

  const win = mount(
    <WeatherscanFrame
      sceneTitle="Current Conditions"
      alertCount={0}
      windowed={(scene) => <Lot8sFrame placeName="X">{scene}</Lot8sFrame>}
    >
      <p id="s">x</p>
    </WeatherscanFrame>
  );
  assert.equal(win.container.querySelector(".ws-frame")!.classList.contains("ws-windowed"), true);
  assert.ok(win.container.querySelector("#s")!.closest(".lot8s-window"),
    "the scene should end up inside the LOT8s window");
  win.unmount();
});

// ------------------------------------------------------ scheduler.upcoming

function fakeScene(id: string, title: string): Scene {
  return {
    id,
    title,
    defaultHoldMs: 1000,
    async prepare(_ctx: SceneContext): Promise<RenderedScene> {
      return { id, title, data: null, speech: "", holdMs: 1000 };
    }
  } as unknown as Scene;
}

test("upcoming() reports the scene on air first, then the queue", () => {
  const s = new SceneScheduler(
    [fakeScene("a", "Alpha"), fakeScene("b", "Bravo"), fakeScene("c", "Charlie")],
    { place: null as never, weather: null as never, themeId: "intellistar2" }
  );
  assert.deepEqual(s.upcoming(2), ["Alpha", "Bravo"]);
  assert.deepEqual(s.upcoming(3), ["Alpha", "Bravo", "Charlie"]);
});

test("upcoming() skips scenes the user switched off", () => {
  // This is why it lives on the scheduler rather than being derived from the
  // configured order in the UI: only the scheduler knows the enabled set, and
  // a rundown promising a product that never arrives is worse than none.
  const s = new SceneScheduler(
    [fakeScene("a", "Alpha"), fakeScene("b", "Bravo"), fakeScene("c", "Charlie")],
    { place: null as never, weather: null as never, themeId: "intellistar2" }
  );
  s.setSceneOrder(["a", "c"]);
  const got = s.upcoming(2);
  assert.ok(!got.includes("Bravo"), `disabled scene leaked into the rundown: ${JSON.stringify(got)}`);
});

test("upcoming() wraps rather than running off the end", () => {
  const s = new SceneScheduler(
    [fakeScene("a", "Alpha"), fakeScene("b", "Bravo")],
    { place: null as never, weather: null as never, themeId: "intellistar2" }
  );
  // Asking for more than exist must terminate, not spin or repeat forever.
  const got = s.upcoming(10);
  assert.ok(got.length <= 2, `expected at most 2 entries, got ${JSON.stringify(got)}`);
});

test("upcoming() on an empty rotation is empty, not a crash", () => {
  const s = new SceneScheduler([], { place: null as never, weather: null as never, themeId: "intellistar2" });
  assert.deepEqual(s.upcoming(2), []);
  assert.deepEqual(s.upcoming(0), []);
});
