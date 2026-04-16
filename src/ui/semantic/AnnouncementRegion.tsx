import { useEffect, useState } from "react";
import type { AnnouncementQueue, Announcement } from "../../a11y/AnnouncementQueue";

interface Props {
  queue: AnnouncementQueue;
}

/**
 * The single source of truth for screen readers. Every time a new
 * announcement comes through the queue, this region's text content is
 * replaced. NVDA/JAWS/VoiceOver pick it up via aria-live.
 *
 * The element is positioned off-screen but kept readable to assistive tech.
 * Visual users see content via the WeatherscanFrame above; audio users
 * hear it via TTS or their screen reader announcing this region.
 */
export function AnnouncementRegion({ queue }: Props) {
  const [latest, setLatest] = useState<Announcement | null>(null);

  useEffect(() => {
    return queue.subscribe(setLatest);
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
        {latest?.priority === "polite" ? latest.text : ""}
      </div>
      <div
        className="sr-only"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        data-testid="awc-live-assertive"
      >
        {latest?.priority === "assertive" ? latest.text : ""}
      </div>
    </>
  );
}
