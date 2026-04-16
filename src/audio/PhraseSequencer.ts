import type { AudioMixer } from "./AudioMixer";
import type { PhraseScript, PhraseSegment } from "./PhraseComposer";
import { shouldUseClip } from "./PhraseComposer";

/**
 * Plays audio clips from a PhraseScript through the mixer's voice bus,
 * ducking music while clips play. Clips only — no TTS. NVDA reads the
 * full scene text via the aria-live region independently.
 *
 * Segments without clips are skipped. Only one script at a time.
 *
 * Concurrency safety: each play() call captures a generation number.
 * stop() bumps the generation, so stale loops see a mismatch and bail.
 * This prevents the classic "old finally unducks after new duck" race
 * and the "old loop resumes after new play() resets aborted" overlap.
 */
export class PhraseSequencer {
  private playing = false;
  private currentAudio: HTMLAudioElement | null = null;
  /** Resolves the current playClip promise when stop() is called externally. */
  private abortResolve: (() => void) | null = null;
  /** Generation counter — bumped by stop() and play(). Only the current
   *  generation may continue playing or unduck. */
  private generation = 0;

  constructor(private readonly mixer: AudioMixer) {}

  async play(script: PhraseScript, confidenceThreshold: "confirmed" | "likely" | "guess" = "likely"): Promise<void> {
    // Always stop previous playback and unduck first.
    this.stop();

    const playable = script.filter((seg) => shouldUseClip(seg, confidenceThreshold));
    if (playable.length === 0) return;

    // Capture this invocation's generation. stop() increments it,
    // so if another play()/stop() fires while we're awaiting,
    // our generation will be stale and we bail.
    const gen = this.generation;
    this.playing = true;
    this.mixer.duck();
    try {
      for (const seg of playable) {
        if (this.generation !== gen) break;
        await this.playClip(seg);
        if (this.generation !== gen) break;
        if (playable.indexOf(seg) < playable.length - 1) {
          await sleep(80);
        }
      }
    } finally {
      // Only unduck if this is still the active generation.
      if (this.generation === gen) {
        this.playing = false;
        this.mixer.unduck();
      }
    }
  }

  /**
   * Play a single clip, stopping any current narration first.
   * Used by ClipLibrary and AlertTones so all voice audio is serialized
   * through one player and can't overlap.
   */
  async playOne(src: string): Promise<void> {
    this.stop();
    const gen = this.generation;
    this.playing = true;
    this.mixer.duck();
    try {
      await this.playClip({ clip: { src, text: "", confidence: "confirmed" }, fallbackText: "" });
    } finally {
      if (this.generation === gen) {
        this.playing = false;
        this.mixer.unduck();
      }
    }
  }

  /** Stop playback immediately and unduck music. */
  stop(): void {
    // Bump generation so any in-flight play() loop sees the mismatch
    // and stops iterating. This is the key to preventing overlap —
    // the old loop will check `this.generation !== gen` on its next
    // await resumption and bail, even though we can't cancel the
    // microtask that resumes it.
    this.generation++;

    // Resolve any pending playClip promise so the play() loop unblocks.
    if (this.abortResolve) {
      this.abortResolve();
      this.abortResolve = null;
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.removeAttribute("src");
      // Force the media element to reset — triggers error/abort events
      // in browsers where removeAttribute("src") alone doesn't.
      try { this.currentAudio.load(); } catch { /* ignore */ }
      this.currentAudio = null;
    }
    if (this.playing) {
      this.playing = false;
      this.mixer.unduck();
    }
  }

  /** @deprecated Use stop() instead. */
  abort(): void {
    this.stop();
  }

  isPlaying(): boolean {
    return this.playing;
  }

  private async playClip(seg: PhraseSegment): Promise<void> {
    if (!seg.clip) return;
    const ctx = this.mixer.context();
    const audio = new Audio(seg.clip.src);
    audio.crossOrigin = "anonymous";
    this.currentAudio = audio;
    const node = ctx.createMediaElementSource(audio);
    node.connect(this.mixer.voiceBus());
    try {
      await audio.play();
      await new Promise<void>((resolve) => {
        // Save the resolve function so stop() can unblock us.
        this.abortResolve = resolve;
        audio.onended = () => {
          this.abortResolve = null;
          this.currentAudio = null;
          resolve();
        };
        audio.onerror = () => {
          this.abortResolve = null;
          this.currentAudio = null;
          resolve();
        };
      });
    } catch {
      this.abortResolve = null;
      this.currentAudio = null;
    } finally {
      try { node.disconnect(); } catch { /* ignore */ }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
