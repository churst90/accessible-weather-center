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
  /** Bumped per clip. The shared audio element delivers ended/error events
   *  that may belong to a clip we've already moved past; the token is how a
   *  handler knows the event is its own. */
  private clipToken = 0;

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
      // Detach handlers BEFORE touching the element. The element is shared,
      // so any error/abort this teardown provokes would otherwise be
      // delivered to whatever clip starts next and settle it instantly.
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio.pause();
      // Deliberately no removeAttribute("src") + load() here. Both exist to
      // force a reset, and both fire a spurious error on a later task — which
      // was safe when every clip had its own element and is not now. Pausing
      // stops the audio; the next clip overwrites src anyway.
      this.currentAudio = null;
    }
    // Any in-flight clip's token is now stale, so its late events no-op.
    this.clipToken++;
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

  /**
   * The single audio element every clip plays through, and its single
   * source node. Created once, on first use, and reused forever.
   *
   * This must NOT be per-clip. `createMediaElementSource()` permanently
   * associates an element with the AudioContext — the context keeps a
   * reference, and `disconnect()` only detaches the node from the graph, it
   * does not release either object. Creating one per clip therefore leaks an
   * element plus a decoded stream every single time. Narration runs several
   * clips per scene and a scene every ~25 seconds, so an overnight session
   * accumulated thousands of them; the observed symptom was Chrome sitting
   * on 12 GB of RAM by morning.
   *
   * Reuse is safe here because playback is strictly serial by design — the
   * generation counter guarantees only one clip is in flight at a time.
   */
  private voiceEl: HTMLAudioElement | null = null;
  private voiceNode: MediaElementAudioSourceNode | null = null;

  private ensureVoiceElement(): HTMLAudioElement {
    if (this.voiceEl && this.voiceNode) return this.voiceEl;
    const ctx = this.mixer.context();
    const audio = new Audio();
    // Must be set before any src is assigned, and before the source node is
    // created, or WebAudio refuses cross-origin media.
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    const node = ctx.createMediaElementSource(audio);
    node.connect(this.mixer.voiceBus());
    this.voiceEl = audio;
    this.voiceNode = node;
    return audio;
  }

  private async playClip(seg: PhraseSegment): Promise<void> {
    if (!seg.clip) return;
    const audio = this.ensureVoiceElement();
    const gen = this.generation;
    const token = ++this.clipToken;
    const src = seg.clip.src;
    this.currentAudio = audio;

    await new Promise<void>((resolve) => {
      this.abortResolve = resolve;

      // Guarded by a per-clip token, not just by generation.
      //
      // A media element fires `error`/`abort` on a LATER task when its src is
      // replaced or reloaded. With one element per clip that stale event hit
      // the old, discarded element harmlessly. Now the element is shared, so
      // an event belonging to the PREVIOUS clip can arrive while the next one
      // is starting — and settling on it would cut that clip off before a
      // note played. The first segment of every scene is the narrator's
      // intro, so the visible symptom is intros disappearing.
      //
      // The token makes each clip only answerable to its own events, and the
      // src check rejects events fired for media we've already moved past.
      let settled = false;
      const settle = () => {
        if (settled || token !== this.clipToken) return; // stale or done
        settled = true;
        audio.onended = null;
        audio.onerror = null;
        if (this.abortResolve === resolve) this.abortResolve = null;
        if (this.generation === gen && this.currentAudio === audio) {
          this.currentAudio = null;
        }
        resolve();
      };

      // Attached BEFORE play() so a short clip cannot finish in the gap
      // between play() resolving and the handlers being wired up.
      audio.onended = settle;
      audio.onerror = settle;

      audio.src = src;
      audio.play().catch(() => {
        // Autoplay refused, or stop() invalidated us mid-call. Release the
        // loop rather than hanging on a clip that will never end.
        settle();
      });
    });
    // Deliberately no disconnect(): the node is permanent and shared. The
    // element is left holding the finished clip's src, which is harmless —
    // the next clip overwrites it, and stop() clears it.
  }

  /** Release the shared element and node. Call on teardown. */
  dispose(): void {
    this.stop();
    try { this.voiceNode?.disconnect(); } catch { /* ignore */ }
    if (this.voiceEl) {
      this.voiceEl.removeAttribute("src");
      try { this.voiceEl.load(); } catch { /* ignore */ }
    }
    this.voiceNode = null;
    this.voiceEl = null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
