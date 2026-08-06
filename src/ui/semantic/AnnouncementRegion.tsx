import { useEffect, useState } from "react";
import type { AnnouncementQueue, AnnouncementState, Announcement } from "../../a11y/AnnouncementQueue";

interface Props {
  queue: AnnouncementQueue;
}

/**
 * The aria-live regions screen readers consume. Two independent regions —
 * polite (scene narration, navigation readouts) and assertive (alerts,
 * mode changes) — each holding its own latest announcement, so one channel
 * updating never wipes the other's text out of the DOM.
 *
 * The element is positioned off-screen but readable to assistive tech.
 */
export function AnnouncementRegion({ queue }: Props) {
  const [state, setState] = useState<AnnouncementState>({ polite: null, assertive: null });

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
