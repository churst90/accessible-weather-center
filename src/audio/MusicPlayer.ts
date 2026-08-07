import type { AudioMixer } from "./AudioMixer";
import { musicCatalog, type MusicTrack } from "./manifests/musicCatalog";

/**
 * Continuous-shuffle music player. Plays the catalog in random order
 * end-to-end, completely independent of the scene loop. When a track ends,
 * the next track in the shuffled queue starts. When the queue empties, it's
 * reshuffled and playback continues.
 *
 * The original Weatherscan music behavior was *exactly this*: a continuous
 * background shuffle that the on-screen flavor cycle had no influence over.
 * Don't reintroduce mood-per-scene without a real reason — it makes the
 * music feel scrubby on a cycle this short.
 *
 * Master enable/disable still applies. Calling start() again after stop()
 * resumes from a freshly shuffled queue.
 */
export class MusicPlayer {
  private element: HTMLAudioElement | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private currentTrack: MusicTrack | null = null;
  private enabled = true;
  private started = false;
  private readonly fullCatalog: MusicTrack[] = musicCatalog();
  private catalog: MusicTrack[] = [...this.fullCatalog];
  private queue: MusicTrack[] = [];
  private lastTagKey = "";
  // Increments on every playTrack / stop so a late-resolving play() from a
  // prior advance knows it's been superseded and should clean itself up
  // instead of overwriting this.element.
  private generation = 0;

  constructor(private readonly mixer: AudioMixer) {
    this.reshuffle();
  }

  /**
   * Filter the catalog to tracks matching the given mood tags.
   * Called when the theme changes. If tags haven't changed, no-op.
   */
  setMusicTags(tags: string[]): void {
    const key = tags.slice().sort().join(",");
    if (key === this.lastTagKey) return;
    this.lastTagKey = key;

    if (tags.length === 0) {
      this.catalog = [...this.fullCatalog];
    } else {
      const filtered = this.fullCatalog.filter((t) =>
        t.moods.some((m) => tags.includes(m))
      );
      this.catalog = filtered.length > 0 ? filtered : [...this.fullCatalog];
    }
    // Only rebuild the queue if we're not mid-playback. If we are, the
    // next advance() after the current track ends will pull from the
    // updated catalog automatically.
    if (!this.element || this.element.paused) {
      this.reshuffle();
    } else {
      // Drain current queue and re-fill from new catalog so the next
      // track comes from the right pool, without interrupting playback.
      this.queue = [...this.catalog];
      for (let i = this.queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
      }
    }
  }

  setEnabled(on: boolean): void {
    if (this.enabled === on) return;
    this.enabled = on;
    if (!on) {
      this.stop();
    } else if (this.started) {
      // If music was running before being muted, kick off a fresh track.
      void this.advance();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  list(): readonly MusicTrack[] {
    return this.catalog;
  }

  current(): MusicTrack | null {
    return this.currentTrack;
  }

  /**
   * Start the continuous shuffle. Call once after the audio context has been
   * unlocked by a user gesture. Subsequent calls are no-ops while music is
   * already playing.
   */
  async start(): Promise<void> {
    if (!this.enabled) {
      this.started = true;
      return;
    }
    if (this.element && !this.element.paused) return;
    this.started = true;
    await this.advance();
  }

  /** Stop playback entirely. The shuffle queue is preserved. */
  stop(): void {
    // Bumping generation invalidates any playTrack() still mid-await.
    this.generation++;
    if (this.element) {
      this.element.onended = null;
      this.element.onerror = null;
      this.element.pause();
      this.element.removeAttribute("src");
      try { this.element.load(); } catch { /* ignore */ }
    }
    // NOTE: the source node is deliberately NOT disconnected or discarded —
    // it is shared and permanent. See ensureElement().
    this.currentTrack = null;
  }

  /**
   * The one audio element and source node every track plays through.
   *
   * `createMediaElementSource()` permanently binds an element to the
   * AudioContext; the context retains it and `disconnect()` does not release
   * it. Creating a node per track therefore leaked an element and a decoded
   * stream on every song change — small per track, unbounded over a night.
   * Reuse is safe because only one track plays at a time.
   */
  private ensureElement(): HTMLAudioElement {
    if (this.element && this.source) return this.element;
    const ctx = this.mixer.context();
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.loop = false;
    audio.preload = "auto";
    const node = ctx.createMediaElementSource(audio);
    node.connect(this.mixer.musicBus());
    this.element = audio;
    this.source = node;
    return audio;
  }

  /** Release the shared element and node. Call on teardown. */
  dispose(): void {
    this.stop();
    try { this.source?.disconnect(); } catch { /* ignore */ }
    this.element = null;
    this.source = null;
  }

  /** Skip to the next shuffled track manually. */
  async skip(): Promise<void> {
    if (!this.enabled) return;
    await this.advance();
  }

  // ──────────── internals ────────────

  private async advance(): Promise<void> {
    if (this.queue.length === 0) this.reshuffle();
    const track = this.queue.shift();
    if (!track) return;
    await this.playTrack(track);
  }

  private reshuffle(): void {
    this.queue = [...this.catalog];
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
  }

  private async playTrack(track: MusicTrack): Promise<void> {
    this.stop();
    // Claim this generation AFTER stop() has bumped it. Any other playTrack
    // or stop() that runs while we're awaiting play() will bump again and
    // our `myGen` will no longer match, so we stand down.
    const myGen = ++this.generation;
    const audio = this.ensureElement();
    audio.src = track.src;
    this.currentTrack = track;
    audio.onended = () => {
      if (myGen !== this.generation) return;
      void this.advance();
    };
    audio.onerror = () => {
      if (myGen !== this.generation) return;
      void this.advance();
    };
    try {
      await audio.play();
      if (myGen !== this.generation) {
        // Superseded while awaiting. The shared element now belongs to a
        // newer track, so touch nothing.
        return;
      }
    } catch {
      // Autoplay blocked, or stop() invalidated us mid-await. The shared
      // element and node stay alive for the next attempt.
    }
  }
}
