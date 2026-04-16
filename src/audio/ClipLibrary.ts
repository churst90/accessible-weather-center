import { getNamedClip, type ClipResolution } from "./manifests/clipSchema";
import type { PhraseSequencer } from "./PhraseSequencer";

/**
 * Plays single voice clips by intent id (e.g. "current_intro", "warning_beep").
 *
 * All playback is routed through the PhraseSequencer so voice clips never
 * overlap with narration or other clips. The sequencer stops any current
 * playback before starting the new clip.
 */
export class ClipLibrary {
  constructor(private readonly sequencer: PhraseSequencer) {}

  has(intent: string): boolean {
    return getNamedClip(intent) != null;
  }

  resolve(intent: string): ClipResolution | null {
    return getNamedClip(intent);
  }

  async play(intent: string): Promise<void> {
    const clip = getNamedClip(intent);
    if (!clip) return;
    await this.sequencer.playOne(clip.src);
  }

  async playSrc(src: string): Promise<void> {
    await this.sequencer.playOne(src);
  }
}
