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
 * There are three independent channels, each backed by its own live region
 * so one never erases another's text from the DOM:
 *
 *   polite      — background narration: scene text, storm nowcasts, status.
 *                 Queued by the screen reader; it waits its turn.
 *   assertive   — weather alerts and mode changes. Interrupts.
 *   navigation  — the readout for a key the user just pressed (arrowing a
 *                 list, moving the map cursor). Interrupts, and lives in its
 *                 own region so it is never stuck behind a 40-word scene
 *                 narration that a `polite` region is still working through.
 *
 * That last channel exists because of a specific failure: arrow-key
 * readouts used to share the polite region with scene narration. A screen
 * reader queues polite updates, so walking a four-item list quickly meant
 * hearing item one, then item four — the middle two were overwritten in the
 * DOM before they were ever spoken. Navigation feedback must be immediate
 * and interrupting or it is worse than useless.
 */

export type AnnouncementPriority = "polite" | "assertive" | "navigation";

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
  navigation: Announcement | null;
}

export class AnnouncementQueue {
  private subscribers = new Set<(state: AnnouncementState) => void>();
  private state: AnnouncementState = { polite: null, assertive: null, navigation: null };
  private nextId = 0;

  announce(text: string, priority: AnnouncementPriority = "polite"): void {
    const ann: Announcement = { id: ++this.nextId, text };
    this.state = { ...this.state, [priority]: ann };
    this.emit();
  }

  /** Clear every live region. Emptying the regions is the strongest
   *  interruption the web platform offers a screen reader — it prevents a
   *  queued announcement from being (re)read; the user's own screen-reader
   *  silence key handles anything already mid-utterance. */
  cancel(): void {
    if (!this.state.polite && !this.state.assertive && !this.state.navigation) return;
    this.state = { polite: null, assertive: null, navigation: null };
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
