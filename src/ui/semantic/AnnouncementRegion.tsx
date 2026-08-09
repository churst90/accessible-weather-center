import { useEffect, useState } from "react";
import type { AnnouncementQueue, AnnouncementState, Announcement } from "../../a11y/AnnouncementQueue";

interface Props {
  queue: AnnouncementQueue;
}

/**
 * The aria-live regions screen readers consume. Three independent regions —
 * polite (scene narration, background status), assertive (alerts, mode
 * changes), and navigation (the readout for the key the user just pressed) —
 * each holding its own latest announcement, so one channel updating never
 * wipes another's text out of the DOM.
 *
 * Navigation gets its own assertive region rather than sharing the polite
 * one: a screen reader queues polite updates, so arrowing through a list
 * faster than it could speak meant the middle items were replaced in the
 * DOM before they were ever read aloud.
 *
 * The elements are positioned off-screen but readable to assistive tech.
 */
export function AnnouncementRegion({ queue }: Props) {
  const [state, setState] = useState<AnnouncementState>({ polite: null, assertive: null, navigation: null });

  useEffect(() => {
    return queue.subscribe(setState);
  }, [queue]);

  return (
    <>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="awc-live-polite"
      >
        {renderText(state.polite)}
      </div>
      <div
        className="sr-only"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        data-testid="awc-live-assertive"
      >
        {renderText(state.assertive)}
      </div>
      {/* Navigation readouts. Deliberately NOT role="alert": this is
          keypress feedback, not an emergency, and role="alert" makes some
          screen readers prefix every item with "alert". aria-live
          "assertive" still gets the interrupting delivery navigation
          needs. */}
      <div
        className="sr-only"
        aria-live="assertive"
        aria-atomic="true"
        data-testid="awc-live-navigation"
      >
        {renderText(state.navigation)}
      </div>
    </>
  );
}

/**
 * aria-live only fires when the DOM actually mutates, so announcing the
 * same text twice in a row used to say nothing the second time. Suffixing
 * a zero-width space on alternating announcement ids guarantees a mutation
 * without changing what the screen reader speaks.
 */
function renderText(ann: Announcement | null): string {
  if (!ann) return "";
  return ann.id % 2 === 0 ? `${ann.text}​` : ann.text;
}
