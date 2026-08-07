import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PhraseSequencer } from "../src/audio/PhraseSequencer";
import type { AudioMixer } from "../src/audio/AudioMixer";
import type { PhraseScript } from "../src/audio/PhraseComposer";

/**
 * Regression guard for the intro-swallowing bug.
 *
 * A real HTMLAudioElement fires `error`/`abort` on a LATER task when its src
 * is cleared or reloaded. With one element per clip that stale event landed
 * on the old, discarded element and did no harm. Once the element became
 * shared, the event from the previous scene's teardown arrived while the NEXT
 * scene's first clip was starting and settled it instantly — so every scene
 * lost segment 0, which is the narrator's scene intro.
 *
 * FakeAudio models that timing deliberately.
 */

let played: string[] = [];
let completed: string[] = [];

class FakeAudio {
  private _src = "";
  crossOrigin: string | null = null;
  preload = "";
  paused = true;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;

  get src(): string { return this._src; }
  set src(v: string) {
    // Changing src on a loaded element queues an abort/error for the
    // PREVIOUS media, delivered on a later task — exactly like a browser.
    if (this._src && this._src !== v) setTimeout(() => this.onerror?.(), 0);
    this._src = v;
  }
  async play(): Promise<void> {
    this.paused = false;
    const mine = this._src;
    played.push(mine);
    // Real clips take time; end on a later task.
    setTimeout(() => { if (this._src === mine) { completed.push(mine); this.onended?.(); } }, 5);
  }
  pause(): void { this.paused = true; }
  load(): void {
    // load() on a cleared element fires an error on a later TASK — browsers
    // use the media element task source, not a microtask. Modelling it as a
    // microtask lets it slip through before handlers are attached and hides
    // the bug entirely.
    setTimeout(() => this.onerror?.(), 0);
  }
  removeAttribute(_n: string): void { this._src = ""; }
}

function makeMixer(): AudioMixer {
  const node = { connect: () => {}, disconnect: () => {} };
  const ctx = { state: "running", createMediaElementSource: () => node };
  return { context: () => ctx, voiceBus: () => node, musicBus: () => node,
    radioBus: () => node, duck: () => {}, unduck: () => {} } as unknown as AudioMixer;
}

beforeEach(() => {
  played = []; completed = [];
  (globalThis as { Audio?: unknown }).Audio = FakeAudio;
});

const script = (...srcs: string[]): PhraseScript =>
  srcs.map((src) => ({ clip: { src, text: "", confidence: "confirmed" as const }, fallbackText: "" }));

test("every segment plays, in order, including the first", async () => {
  const seq = new PhraseSequencer(makeMixer());
  await seq.play(script("/intro.mp3", "/temp72.mp3", "/cond.mp3"));
  assert.deepEqual(played, ["/intro.mp3", "/temp72.mp3", "/cond.mp3"]);
});

test("the scene intro is not swallowed on a second scene", async () => {
  // The failing case: scene A finishes, scene B starts, and B's intro is cut
  // off by the stale event from A's teardown.
  const seq = new PhraseSequencer(makeMixer());
  await seq.play(script("/introA.mp3", "/a1.mp3"));
  await seq.play(script("/introB.mp3", "/b1.mp3"));
  assert.deepEqual(played, ["/introA.mp3", "/a1.mp3", "/introB.mp3", "/b1.mp3"]);
  assert.ok(completed.includes("/introB.mp3"), "the second scene's intro must play to completion, not be cut off");
});

test("an explicit stop() before play() does not swallow the next intro", async () => {
  // This is what App.tsx does on every scene change: stop(), then play().
  const seq = new PhraseSequencer(makeMixer());
  await seq.play(script("/introA.mp3", "/a1.mp3"));
  seq.stop();
  await seq.play(script("/YourCurrentConditions.mp3", "/72.mp3"));
  assert.ok(
    completed.includes("/YourCurrentConditions.mp3"),
    "intro was cut short by the stale error from stop()'s teardown"
  );
});

test("ten consecutive scenes all keep their intro", async () => {
  const seq = new PhraseSequencer(makeMixer());
  for (let i = 0; i < 10; i++) {
    seq.stop();
    await seq.play(script(`/intro${i}.mp3`, `/body${i}.mp3`));
  }
  for (let i = 0; i < 10; i++) {
    assert.ok(completed.includes(`/intro${i}.mp3`), `scene ${i} lost its intro`);
  }
});
