import type { Scene, SceneContext, RenderedScene } from "./Scene";

export type SchedulerStatus = "running" | "paused" | "stopped";

export interface SchedulerEvent {
  status: SchedulerStatus;
  index: number;
  scene: RenderedScene | null;
  /** True when the current scene was forced via an interrupt (e.g. severe alert). */
  interrupted: boolean;
  /**
   * Bumped once per *entry* into a scene, never by a silent data refresh.
   *
   * `scene` is a fresh object whenever the scene's data is re-prepared, so
   * subscribers can't use its identity to tell "the user moved to a new
   * screen" from "the screen you're on just got newer numbers". The first
   * should stop clips and narrate; the second must stay silent. Compare
   * this token against the last one you narrated.
   */
  sceneToken: number;
}

/**
 * Cycles a list of scenes. Holds each for its hold time, prepares the next in
 * the background so transitions are crisp. The user can pause, step, or jump
 * to a specific scene by id or index.
 *
 * Flavors (scenes) can be enabled or disabled at runtime via the `isEnabled`
 * predicate passed at construction. Disabled flavors are skipped during
 * normal cycling but can still be reached by explicit jumpToId().
 *
 * No DOM, no React. Subscribers receive plain events and decide how to render.
 */
export class SceneScheduler {
  private status: SchedulerStatus = "stopped";
  private index = 0;
  private current: RenderedScene | null = null;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(e: SchedulerEvent) => void>();
  private isEnabled: (id: string) => boolean;
  private autoCycle = true;
  private interrupted = false;
  private preInterruptIndex = 0;
  private narrationPromise: Promise<void> | null = null;
  /** Seconds to wait after narration finishes before the hold timer starts. */
  private postNarrationDelaySec = 3;
  /** Monotonic generation counter — bumped on each enter() so stale
   *  prepare() resolutions can be detected and dropped. Without this,
   *  rapid Tab presses cause a "lag then catch-up" effect where the UI
   *  flashes through every transitional scene as each prepare resolves. */
  private generation = 0;
  /** Incremented on each scene entry only — see SchedulerEvent.sceneToken. */
  private sceneToken = 0;

  private ctx: SceneContext;

  constructor(
    private scenes: Scene[],
    ctx: SceneContext,
    isEnabled: (id: string) => boolean = () => true
  ) {
    this.ctx = ctx;
    this.isEnabled = isEnabled;
  }

  /**
   * Reorder scenes to match the given id order. Scenes not in the order
   * array are appended at the end in their original relative order.
   * The currently-playing scene id is preserved so the user doesn't see
   * a jarring jump.
   */
  setSceneOrder(order: string[]): void {
    const currentId = this.current?.id ?? null;
    const byId = new Map(this.scenes.map((s) => [s.id, s]));
    const ordered: Scene[] = [];
    for (const id of order) {
      const s = byId.get(id);
      if (s) {
        ordered.push(s);
        byId.delete(id);
      }
    }
    // Append any remaining scenes not in the explicit order
    for (const s of byId.values()) ordered.push(s);
    this.scenes = ordered;
    // Restore the index so we stay on the same scene
    if (currentId) {
      const newIdx = this.scenes.findIndex((s) => s.id === currentId);
      if (newIdx >= 0) this.index = newIdx;
    }
  }

  /** Replace the enabled-predicate. The next advance will honor it. */
  setEnabledPredicate(fn: (id: string) => boolean): void {
    this.isEnabled = fn;
  }

  /** Swap the active place (and/or weather service). The current scene is
   *  re-prepared so the UI reflects the new location immediately. */
  setContext(ctx: SceneContext): void {
    this.ctx = ctx;
    if (this.status !== "stopped") {
      void this.enter(this.index);
    }
  }

  /** Toggle automatic advance on the hold timer. Manual next/prev still work. */
  setAutoCycle(on: boolean): void {
    if (this.autoCycle === on) return;
    this.autoCycle = on;
    if (!on && this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    if (on && this.status === "running" && this.current && !this.holdTimer) {
      this.scheduleAdvance(this.current.holdMs);
    }
  }

  subscribe(fn: (e: SchedulerEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  async start(): Promise<void> {
    if (this.status === "running") return;
    this.status = "running";
    await this.enter(this.index);
  }

  pause(): void {
    if (this.status !== "running") return;
    this.status = "paused";
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    this.emit();
  }

  resume(): void {
    if (this.status !== "paused") return;
    this.status = "running";
    if (this.current) {
      if (this.autoCycle) this.scheduleAdvance(this.current.holdMs);
    } else {
      void this.enter(this.index);
    }
    this.emit();
  }

  stop(): void {
    this.status = "stopped";
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    this.emit();
  }

  async next(): Promise<void> {
    const i = this.findNextEnabled(this.index, +1);
    if (i < 0) return;
    await this.enter(i);
  }

  async prev(): Promise<void> {
    const i = this.findNextEnabled(this.index, -1);
    if (i < 0) return;
    await this.enter(i);
  }

  /**
   * Walk in the given direction until we find an enabled scene. Returns -1
   * if no scenes are enabled at all (in which case the scheduler should
   * pause and announce the empty state — caller decides).
   */
  private findNextEnabled(from: number, step: 1 | -1): number {
    const n = this.scenes.length;
    if (n === 0) return -1;
    for (let i = 1; i <= n; i++) {
      const idx = (from + step * i + n * i) % n;
      if (this.isEnabled(this.scenes[idx].id)) return idx;
    }
    return -1;
  }

  async jump(index: number): Promise<void> {
    if (index < 0 || index >= this.scenes.length) return;
    await this.enter(index);
  }

  async jumpToId(id: string): Promise<void> {
    const i = this.scenes.findIndex((s) => s.id === id);
    if (i >= 0) await this.enter(i);
  }

  /**
   * Interrupt the normal cycle and jump to a scene by id. The scheduler
   * remembers where it was so `clearInterrupt()` can resume. Used for
   * severe weather alerts that preempt the loop.
   */
  async interrupt(sceneId: string): Promise<void> {
    if (this.interrupted) return; // already in an interrupt
    this.preInterruptIndex = this.index;
    this.interrupted = true;
    const i = this.scenes.findIndex((s) => s.id === sceneId);
    if (i >= 0) await this.enter(i);
  }

  /**
   * End the interrupt and resume the normal cycle from where it was.
   */
  async clearInterrupt(): Promise<void> {
    if (!this.interrupted) return;
    this.interrupted = false;
    await this.enter(this.preInterruptIndex);
  }

  isInterrupted(): boolean {
    return this.interrupted;
  }

  getStatus(): SchedulerStatus {
    return this.status;
  }

  getCurrent(): RenderedScene | null {
    return this.current;
  }

  /**
   * Re-prepare the scene that is currently on screen and push the new data
   * to subscribers WITHOUT counting as a scene entry.
   *
   * This is what makes the display live. Scene data is a snapshot taken
   * when the scene was entered, so without this the temperature on screen
   * was frozen from the moment the scene came up until the cycle brought it
   * around again — and if the loop was paused, or the user was parked on
   * one screen, it was frozen indefinitely. Refreshing the upstream caches
   * alone did nothing; somebody had to ask the scene to re-read them.
   *
   * Deliberately does NOT: bump the generation, touch the hold timer, or
   * clear the narration promise. The scene keeps its place in the cycle and
   * whatever clips are playing keep playing; only `data` and `speech`
   * change underneath. `sceneToken` stays put so App knows not to re-narrate.
   */
  async refreshCurrent(): Promise<boolean> {
    if (this.status === "stopped" || !this.current) return false;
    const scene = this.scenes[this.index];
    if (!scene || scene.id !== this.current.id) return false;
    const myGen = this.generation;
    let prepared: RenderedScene;
    try {
      prepared = await scene.prepare(this.ctx);
    } catch {
      // A failed refresh must never replace good data with an error card.
      // Keep showing what we have; the next tick tries again.
      return false;
    }
    // The user moved (or the place/theme changed) while we were preparing.
    // enter() owns the screen now; dropping this result is the whole point
    // of the generation counter.
    if (myGen !== this.generation) return false;
    if (!this.current || this.current.id !== prepared.id) return false;
    this.current = prepared;
    this.emit();
    return true;
  }

  /** Set the post-narration delay in seconds. */
  setPostNarrationDelay(seconds: number): void {
    this.postNarrationDelaySec = Math.max(0, seconds);
  }

  /**
   * Tell the scheduler to wait for this promise before starting the hold
   * timer. Use this when clip narration is playing — the scene stays up
   * until clips finish, then a post-narration delay elapses, then the
   * hold timer starts its countdown.
   */
  setNarrationPromise(p: Promise<void>): void {
    this.narrationPromise = p;
  }

  private async enter(index: number): Promise<void> {
    this.index = index;
    const myGen = ++this.generation;
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    this.narrationPromise = null;
    const scene = this.scenes[index];
    let prepared: RenderedScene;
    try {
      prepared = await scene.prepare(this.ctx);
    } catch (err) {
      prepared = {
        id: scene.id,
        title: scene.title,
        data: { error: String(err) },
        speech: `${scene.title} is unavailable right now.`,
        holdMs: 5000
      };
    }
    // Stale-result guard: if a newer enter() has started (user pressed
    // Tab again before our prepare resolved), drop this result so the
    // UI doesn't flash through every transitional scene.
    if (myGen !== this.generation) return;
    this.current = prepared;
    // A real entry: publish a new token so App narrates this scene.
    this.sceneToken++;
    // Emit so the UI renders and the narration effect fires.
    this.emit();
    if (this.status === "running" && this.autoCycle) {
      // Defer scheduling to give the React effect a tick to call
      // setNarrationPromise(). Without this, the promise would always
      // be null because useEffect runs after the render commit.
      const holdMs = this.current.holdMs;
      setTimeout(() => {
        if (this.index !== index || this.status !== "running") return;
        if (this.narrationPromise) {
          this.narrationPromise.then(() => {
            if (this.index !== index || this.status !== "running" || !this.autoCycle) return;
            // Wait the configured post-narration delay before starting
            // the hold timer, so the screen lingers after clips finish.
            const delayMs = this.postNarrationDelaySec * 1000;
            if (delayMs > 0) {
              setTimeout(() => {
                if (this.index === index && this.status === "running" && this.autoCycle) {
                  this.scheduleAdvance(holdMs);
                }
              }, delayMs);
            } else {
              this.scheduleAdvance(holdMs);
            }
          });
        } else {
          this.scheduleAdvance(holdMs);
        }
      }, 0);
    }
  }

  private scheduleAdvance(ms: number): void {
    if (!this.autoCycle) return;
    this.holdTimer = setTimeout(() => {
      void this.next();
    }, ms);
  }

  private emit(): void {
    const event: SchedulerEvent = {
      status: this.status,
      index: this.index,
      scene: this.current,
      interrupted: this.interrupted,
      sceneToken: this.sceneToken
    };
    for (const fn of this.listeners) fn(event);
  }
}
