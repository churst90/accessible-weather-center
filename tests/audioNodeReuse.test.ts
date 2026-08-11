import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { PhraseSequencer } from "../src/audio/PhraseSequencer";
import { MusicPlayer } from "../src/audio/MusicPlayer";
import type { AudioMixer } from "../src/audio/AudioMixer";
import type { PhraseScript } from "../src/audio/PhraseComposer";

/**
 * Guards the unbounded audio leak.
 *
 * `createMediaElementSource()` permanently associates a media element with
 * the AudioContext: the context retains it, and `disconnect()` only detaches
 * the node from the graph — it releases neither object. Creating one per clip
 * therefore leaks an element plus a decoded stream every single time.
 *
 * Narration plays several clips per scene and a scene starts every ~25
 * seconds, so an overnight run accumulated thousands. Observed in the field
 * as Chrome holding 12 GB of RAM by morning.
 *
 * These tests count constructions. They fail if either player goes back to
 * per-clip elements or per-clip source nodes.
 */

interface Counters {
  audioElements: number;
  sourceNodes: number;
}
let counts: Counters;

/**
 * Every MusicPlayer a test starts, so it can be torn down again.
 *
 * This is not tidiness. `FakeAudio.play()` fires `ended` on the next tick, and
 * MusicPlayer's `ended` handler advances to the next track — which plays,
 * ends, and advances again, as fast as the event loop will go. A real element
 * makes that loop harmless by taking three minutes over each track; this one
 * makes it a spin that never stops.
 *
 * Left running it kept the process alive forever, which is why the whole
 * suite needed `--test-force-exit`, which in turn is what let the runner kill
 * files mid-execution and silently drop ten tests a run. One unstopped
 * playlist in one test file cost the suite its trustworthiness.
 */
const startedPlayers: MusicPlayer[] = [];
function makeMusic(): MusicPlayer {
  const m = new MusicPlayer(makeMixer());
  startedPlayers.push(m);
  return m;
}

afterEach(() => {
  for (const m of startedPlayers.splice(0)) m.dispose();
});

/** Minimal HTMLAudioElement stand-in. Resolves playback immediately. */
class FakeAudio {
  src = "";
  crossOrigin: string | null = null;
  preload = "";
  loop = false;
  paused = true;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    counts.audioElements++;
  }
  async play(): Promise<void> {
    this.paused = false;
    // Fire `ended` on a later turn, the way a real element would.
    setTimeout(() => this.onended?.(), 0);
  }
  pause(): void { this.paused = true; }
  load(): void { /* no-op */ }
  removeAttribute(_name: string): void { this.src = ""; }
}

function makeMixer(): AudioMixer {
  const node = { connect: () => {}, disconnect: () => {} };
  const ctx = {
    state: "running",
    createMediaElementSource: () => {
      counts.sourceNodes++;
      return node;
    }
  };
  return {
    context: () => ctx,
    voiceBus: () => node,
    musicBus: () => node,
    radioBus: () => node,
    duck: () => {},
    unduck: () => {}
  } as unknown as AudioMixer;
}

beforeEach(() => {
  counts = { audioElements: 0, sourceNodes: 0 };
  (globalThis as { Audio?: unknown }).Audio = FakeAudio;
});

const script = (n: number): PhraseScript =>
  Array.from({ length: n }, (_, i) => ({
    clip: { src: `/assets/narration/clip${i}.mp3`, text: "", confidence: "confirmed" as const },
    fallbackText: ""
  }));

test("PhraseSequencer reuses one element and one source node across many clips", async () => {
  const seq = new PhraseSequencer(makeMixer());
  await seq.play(script(12));
  assert.equal(counts.sourceNodes, 1, `created ${counts.sourceNodes} source nodes for 12 clips`);
  assert.equal(counts.audioElements, 1, `created ${counts.audioElements} audio elements for 12 clips`);
});

test("PhraseSequencer reuses the node across separate play() calls", async () => {
  const seq = new PhraseSequencer(makeMixer());
  for (let i = 0; i < 8; i++) await seq.play(script(3));
  assert.equal(counts.sourceNodes, 1, "a new scene must not mint a new source node");
  assert.equal(counts.audioElements, 1);
});

test("PhraseSequencer.playOne shares the same node as play()", async () => {
  const seq = new PhraseSequencer(makeMixer());
  await seq.play(script(2));
  await seq.playOne("/assets/shared/sounds/TWC_Mnemonic.mp3");
  await seq.playOne("/assets/shared/sounds/severe_weather_tone.mp3");
  assert.equal(counts.sourceNodes, 1);
});

test("stop() does not discard the shared node", async () => {
  const seq = new PhraseSequencer(makeMixer());
  await seq.play(script(2));
  seq.stop();
  await seq.play(script(2));
  assert.equal(counts.sourceNodes, 1, "stop() must not force a rebuild");
});

test("MusicPlayer reuses one element and node across track changes", async () => {
  const music = makeMusic();
  await music.start();
  for (let i = 0; i < 10; i++) await music.skip();
  assert.equal(counts.sourceNodes, 1, `created ${counts.sourceNodes} source nodes across 11 tracks`);
  assert.equal(counts.audioElements, 1);
});

test("MusicPlayer stop/start cycles do not leak nodes", async () => {
  const music = makeMusic();
  await music.start();
  for (let i = 0; i < 5; i++) {
    music.setEnabled(false);
    music.setEnabled(true);
  }
  assert.equal(counts.sourceNodes, 1, "Ctrl+M toggling must not mint nodes");
});

test("dispose() releases the shared node so a new one can be built", async () => {
  const seq = new PhraseSequencer(makeMixer());
  await seq.play(script(2));
  assert.equal(counts.sourceNodes, 1);
  seq.dispose();
  await seq.play(script(2));
  assert.equal(counts.sourceNodes, 2, "after dispose the next play rebuilds exactly once");
});
