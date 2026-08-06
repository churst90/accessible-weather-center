/**
 * The app's single channel for "say this to the user".
 *
 * All speech reaches the user through exactly two paths, by design:
 *   1. The user's screen reader (NVDA, JAWS, Orca, VoiceOver) reading the
 *      aria-live regions this store feeds (see AnnouncementRegion).
 *   2. Recorded narrator clips played by the PhraseSequencer.
 *
 * There is deliberately NO built-in TTS. The application's accessibility
 * contract is to cooperate with whatever screen reader the user runs, not
 * to bring its own voice.
 *
 * The polite and assertive channels are independent slots: an assertive
 * alert no longer erases a polite scene announcement from the DOM (and
 * vice versa), which the old single-slot implementation did.
 */

export interface Announcement {
  /** Monotonic — also used by the region to force a DOM mutation when the
   *  same text is announced twice in a row (aria-live only fires on
   *  mutation, so identical repeats used to be silent). */
  id: number;
  text: string;
}

export interface AnnouncementState {
  polite: Announcement | null;
  assertive: Announcement | null;
}

export class AnnouncementQueue {
  private subscribers = new Set<(state: AnnouncementState) => void>();
  private state: AnnouncementState = { polite: null, assertive: null };
  private nextId = 0;

  announce(text: string, priority: "polite" | "assertive" = "polite"): void {
    const ann: Announcement = { id: ++this.nextId, text };
    this.state = { ...this.state, [priority]: ann };
    this.emit();
  }

  /** Clear both live regions. Emptying the regions is the strongest
   *  interruption the web platform offers a screen reader — it prevents a
   *  queued announcement from being (re)read; the user's own screen-reader
   *  silence key handles anything already mid-utterance. */
  cancel(): void {
    if (!this.state.polite && !this.state.assertive) return;
    this.state = { polite: null, assertive: null };
    this.emit();
  }

  getState(): AnnouncementState {
    return this.state;
  }

  subscribe(fn: (state: AnnouncementState) => void): () => void {
    this.subscribers.add(fn);
    fn(this.state);
    return () => this.subscribers.delete(fn);
  }

  private emit(): void {
    for (const fn of this.subscribers) fn(this.state);
  }
}
