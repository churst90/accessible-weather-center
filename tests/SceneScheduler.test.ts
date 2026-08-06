import { test } from "node:test";
import assert from "node:assert/strict";
import { SceneScheduler } from "../src/core/scenes/SceneScheduler";
import type { Scene, SceneContext, RenderedScene } from "../src/core/scenes/Scene";
import type { Place } from "../src/core/types";
import type { WeatherService } from "../src/core/weather/WeatherService";

const PLACE: Place = { id: "p1", name: "Testville, TN", coord: { lat: 36, lon: -82 }, isHome: true };
const CTX: SceneContext = { place: PLACE, weather: {} as WeatherService };

function fakeScene(
  id: string,
  opts: { failWith?: string; prepareDelayMs?: number } = {}
): Scene {
  return {
    id,
    title: id,
    defaultHoldMs: 50,
    async prepare(): Promise<RenderedScene> {
      if (opts.prepareDelayMs) await new Promise((r) => setTimeout(r, opts.prepareDelayMs));
      if (opts.failWith) throw new Error(opts.failWith);
      return { id, title: id, data: { ok: id }, speech: `${id} speech`, holdMs: 50 };
    }
  };
}

test("start() prepares and emits the first scene", async () => {
  const sched = new SceneScheduler([fakeScene("a"), fakeScene("b")], CTX);
  sched.setAutoCycle(false);
  await sched.start();
  const cur = sched.getCurrent();
  assert.equal(cur?.id, "a");
  assert.equal(cur?.speech, "a speech");
  sched.stop();
});

test("prepare() failure produces the documented error fallback shape", async () => {
  const sched = new SceneScheduler([fakeScene("broken", { failWith: "NWS down" })], CTX);
  sched.setAutoCycle(false);
  await sched.start();
  const cur = sched.getCurrent()!;
  assert.equal(cur.id, "broken", "keeps the real scene id");
  assert.match((cur.data as { error: string }).error, /NWS down/);
  assert.match(cur.speech, /unavailable/);
  sched.stop();
});

test("next() skips disabled flavors", async () => {
  const sched = new SceneScheduler(
    [fakeScene("a"), fakeScene("b"), fakeScene("c")],
    CTX,
    (id) => id !== "b"
  );
  sched.setAutoCycle(false);
  await sched.start();
  await sched.next();
  assert.equal(sched.getCurrent()?.id, "c", "b is disabled, so a → c");
  sched.stop();
});

test("wrap-around: prev() from the first scene lands on the last enabled", async () => {
  const sched = new SceneScheduler([fakeScene("a"), fakeScene("b"), fakeScene("c")], CTX);
  sched.setAutoCycle(false);
  await sched.start();
  await sched.prev();
  assert.equal(sched.getCurrent()?.id, "c");
  sched.stop();
});

test("generation guard: a slow stale prepare cannot overwrite a newer scene", async () => {
  const sched = new SceneScheduler(
    [fakeScene("a"), fakeScene("slow", { prepareDelayMs: 60 }), fakeScene("c")],
    CTX
  );
  sched.setAutoCycle(false);
  await sched.start();
  // Kick off the slow scene, then immediately jump past it.
  const slowEnter = sched.next(); // → "slow", resolves in ~60ms
  await sched.next();             // → "c", resolves immediately
  await slowEnter;                // stale result must be dropped
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(sched.getCurrent()?.id, "c");
  sched.stop();
});

test("interrupt() jumps to the target and clearInterrupt() returns", async () => {
  const sched = new SceneScheduler([fakeScene("a"), fakeScene("b"), fakeScene("alerts")], CTX);
  sched.setAutoCycle(false);
  await sched.start();
  await sched.next(); // on "b"
  await sched.interrupt("alerts");
  assert.equal(sched.getCurrent()?.id, "alerts");
  assert.equal(sched.isInterrupted(), true);
  await sched.clearInterrupt();
  assert.equal(sched.getCurrent()?.id, "b", "resumes where it left off");
  assert.equal(sched.isInterrupted(), false);
  sched.stop();
});

test("setSceneOrder reorders while preserving the current scene", async () => {
  const sched = new SceneScheduler([fakeScene("a"), fakeScene("b"), fakeScene("c")], CTX);
  await sched.start(); // on "a"
  sched.setSceneOrder(["c", "b", "a"]);
  assert.equal(sched.getCurrent()?.id, "a", "current scene unchanged");
  await sched.next();
  assert.equal(sched.getCurrent()?.id, "c", "wraps to the new order's start");
  sched.stop();
});
