import type { TtsService } from "./TtsService";

/**
 * Bridges the app's "say this now" intent with both TTS and a DOM aria-live
 * region. The aria-live region is the source of truth for assistive tech that
 * isn't using our built-in TTS (NVDA, JAWS, VoiceOver). The built-in TTS is
 * for users who run the app standalone without a screen reader.
 *
 * Most users will want one or the other, not both. The mode flag picks.
 */
export type AnnouncerMode = "tts" | "live-region" | "both" | "off";

export interface Announcement {
  id: string;
  text: string;
  priority: "polite" | "assertive";
}

export class AnnouncementQueue {
  private subscribers = new Set<(latest: Announcement | null) => void>();
  private latest: Announcement | null = null;
  private nextId = 0;

  constructor(
    private readonly tts: TtsService,
    private mode: AnnouncerMode = "both"
  ) {}

  setMode(mode: AnnouncerMode): void {
    this.mode = mode;
  }

  async announce(text: string, priority: "polite" | "assertive" = "polite"): Promise<void> {
    if (this.mode === "off") return;
    const ann: Announcement = { id: String(++this.nextId), text, priority };
    this.latest = ann;
    if (this.mode === "live-region" || this.mode === "both") {
      for (const fn of this.subscribers) fn(ann);
    }
    if (this.mode === "tts" || this.mode === "both") {
      await this.tts.speak(text, { priority });
    }
  }

  /**
   * Push text to the aria-live region only, without firing TTS. Use this
   * when the PhraseSequencer is handling audio — screen readers still need
   * the text, but TTS would fight the clip playback.
   */
  announceLiveRegionOnly(text: string, priority: "polite" | "assertive" = "polite"): void {
    const ann: Announcement = { id: String(++this.nextId), text, priority };
    this.latest = ann;
    for (const fn of this.subscribers) fn(ann);
  }

  cancel(): void {
    this.tts.cancel();
  }

  subscribe(fn: (latest: Announcement | null) => void): () => void {
    this.subscribers.add(fn);
    fn(this.latest);
    return () => this.subscribers.delete(fn);
  }
}
