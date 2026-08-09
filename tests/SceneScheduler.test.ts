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

test("refreshCurrent() re-prepares in place without counting as a scene entry", async () => {
  // The screen used to freeze on whatever the data looked like when the
  // scene was entered: refreshing the upstream caches changed nothing on
  // screen, because nobody asked the scene to re-read them. refreshCurrent
  // closes that gap — but it must stay SILENT, or App would stop the clips
  // and re-narrate the same scene once a minute, forever.
  let reading = 72;
  const scene: Scene = {
    id: "current",
    title: "Current Conditions",
    defaultHoldMs: 50,
    async prepare(): Promise<RenderedScene> {
      return { id: "current", title: "Current Conditions", data: { tempF: reading }, speech: `${reading} degrees`, holdMs: 50 };
    }
  };
  const sched = new SceneScheduler([scene, fakeScene("b")], CTX);
  sched.setAutoCycle(false);
  const seen: { id: string | null; token: number }[] = [];
  sched.subscribe((e) => seen.push({ id: e.scene?.id ?? null, token: e.sceneToken }));
  await sched.start();

  const entryToken = seen[seen.length - 1].token;
  assert.equal((sched.getCurrent()!.data as { tempF: number }).tempF, 72);

  reading = 68;
  assert.equal(await sched.refreshCurrent(), true);

  const after = seen[seen.length - 1];
  assert.equal((sched.getCurrent()!.data as { tempF: number }).tempF, 68, "new data reached the screen");
  assert.equal(sched.getCurrent()!.speech, "68 degrees");
  assert.equal(after.token, entryToken, "sceneToken must NOT advance — this was not an entry");
  assert.equal(sched.getStatus(), "running", "refresh must not disturb the loop");
  sched.stop();
});

test("entering a scene advances sceneToken; refreshing does not", async () => {
  const sched = new SceneScheduler([fakeScene("a"), fakeScene("b")], CTX);
  sched.setAutoCycle(false);
  const tokens: number[] = [];
  sched.subscribe((e) => tokens.push(e.sceneToken));
  await sched.start();
  const afterStart = tokens[tokens.length - 1];
  await sched.refreshCurrent();
  assert.equal(tokens[tokens.length - 1], afterStart, "refresh is silent");
  await sched.next();
  assert.ok(tokens[tokens.length - 1] > afterStart, "a real entry advances the token");
  sched.stop();
});

test("refreshCurrent() drops its result if the user moved on mid-prepare", async () => {
  // Same hazard enter() guards with the generation counter: a slow refresh
  // must never overwrite the scene the user has since tabbed to.
  const slow = fakeScene("slow", { prepareDelayMs: 40 });
  const sched = new SceneScheduler([slow, fakeScene("b")], CTX);
  sched.setAutoCycle(false);
  await sched.start();
  assert.equal(sched.getCurrent()?.id, "slow");
  const refreshing = sched.refreshCurrent();
  await sched.next(); // user tabs to "b" while the refresh is in flight
  assert.equal(await refreshing, false, "stale refresh reports that it dropped");
  assert.equal(sched.getCurrent()?.id, "b", "the scene the user chose stands");
  sched.stop();
});

test("a failed refresh leaves the good data on screen", async () => {
  // A weather display must never trade a real reading for an error card
  // because one background poll timed out.
  let shouldFail = false;
  const scene: Scene = {
    id: "current",
    title: "Current",
    defaultHoldMs: 50,
    async prepare(): Promise<RenderedScene> {
      if (shouldFail) throw new Error("NWS down");
      return { id: "current", title: "Current", data: { tempF: 72 }, speech: "72 degrees", holdMs: 50 };
    }
  };
  const sched = new SceneScheduler([scene], CTX);
  sched.setAutoCycle(false);
  await sched.start();
  shouldFail = true;
  assert.equal(await sched.refreshCurrent(), false);
  assert.equal((sched.getCurrent()!.data as { tempF: number }).tempF, 72, "still showing the last good reading");
  assert.equal(sched.getCurrent()!.speech, "72 degrees");
  sched.stop();
});

test("refreshCurrent() is a no-op before start and after stop", async () => {
  const sched = new SceneScheduler([fakeScene("a")], CTX);
  sched.setAutoCycle(false);
  assert.equal(await sched.refreshCurrent(), false, "nothing on screen yet");
  await sched.start();
  sched.stop();
  assert.equal(await sched.refreshCurrent(), false, "loop stopped");
});
