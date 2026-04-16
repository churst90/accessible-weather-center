import type { FeelsLikeData } from "../../core/scenes/scenes/FeelsLikeScene";
import { useArrowGrid } from "../../a11y/useArrowGrid";
import { useAnnouncer } from "../../a11y/AnnouncerContext";

/**
 * Era-authentic Feels Like scene — two side-by-side hero temps
 * (Actual vs Feels Like), optionally a tinted advisory band below when
 * wind chill or heat index is driving the delta. Per-theme CSS controls
 * the panel chrome (.ws-feels-*).
 */
export function FeelsLikeView({ data }: { data: FeelsLikeData }) {
  const { place, actualF, feelsLikeF, windChillActive, heatIndexActive, advisory } = data;
  const announcer = useAnnouncer();

  if (actualF == null) {
    return <p>Feels like information for {place.name} is not available.</p>;
  }

  const cells = [
    { label: "Actual", value: `${actualF}°`, speech: `Actual temperature, ${actualF} degrees.` },
    { label: "Feels Like", value: feelsLikeF != null ? `${feelsLikeF}°` : "—", speech: feelsLikeF != null ? `Feels like ${feelsLikeF} degrees.` : "Feels like unavailable." },
  ];

  const { index } = useArrowGrid(cells, 2, (c) => c.speech, announcer);

  const driver = windChillActive ? "wind-chill" : heatIndexActive ? "heat-index" : "neutral";

  return (
    <section aria-label={`Feels like conditions for ${place.name}`} className="ws-feels">
      <p className="ws-feels-hint">
        Left and right arrows compare the actual and perceived temperature.
      </p>
      <div className="ws-feels-pair" data-driver={driver}>
        {cells.map((c, i) => (
          <div
            key={c.label}
            className="ws-feels-panel"
            role="listitem"
            data-focused={i === index}
            aria-current={i === index ? "true" : undefined}
            aria-label={c.speech}
            data-panel={i === 1 ? "feels" : "actual"}
          >
            <div className="ws-feels-label">{c.label}</div>
            <div className="ws-feels-value">{c.value}</div>
          </div>
        ))}
      </div>
      {advisory && (
        <p className="ws-feels-advisory" aria-live="polite">
          {advisory}
        </p>
      )}
    </section>
  );
}
