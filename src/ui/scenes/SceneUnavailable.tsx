/**
 * Shared placeholder for scenes that don't have data to render — either
 * because there's no data source (Traffic) or the source is temporarily
 * unreachable (Airport Delays during an FAA outage, Overnight before
 * sunset, Weekend mid-week, etc.). Use this instead of hand-rolling a
 * dim <p> in each view so the unavailable state stays visually consistent
 * across themes.
 */
export function SceneUnavailable({
  title,
  placeName,
  reason,
}: {
  /** Scene title, e.g. "Airport Delays". */
  title: string;
  /** Location to name in the announcement, if relevant. */
  placeName?: string;
  /** Optional custom sub-line shown under the headline. */
  reason?: string;
}) {
  const label = placeName ? `${title} for ${placeName}` : title;
  const sub = reason ?? "This scene is not available right now.";
  return (
    <section aria-label={label} className="ws-unavailable">
      <h2 className="ws-unavailable-title">{title}</h2>
      <p className="ws-unavailable-reason">{sub}</p>
    </section>
  );
}
