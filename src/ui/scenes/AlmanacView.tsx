import type { AlmanacData } from "../../core/scenes/scenes/AlmanacScene";
import { useArrowGrid } from "../../a11y/useArrowGrid";
import { useAnnouncer } from "../../a11y/AnnouncerContext";

/**
 * Era-authentic Almanac — two stacked panels (Sun on the left, Moon on
 * the right) matching the TWC Local on the 8s Almanac layout. Arrow-grid
 * nav walks left/right between panels and up/down between rows.
 */
export function AlmanacView({ data }: { data: AlmanacData }) {
  const { place } = data;
  const announcer = useAnnouncer();

  // Column-major layout: first 3 cells = Sun, next 2 = Moon.
  // Grid is 2 columns wide × 3 rows tall. Moon has 2 rows (3rd cell empty).
  const cells = [
    { panel: "sun", label: "Sunrise", value: data.sunrise, speech: `Sunrise at ${data.sunrise}` },
    { panel: "moon", label: "Moon Phase", value: data.moonPhase, speech: `Moon phase: ${data.moonPhase}` },
    { panel: "sun", label: "Sunset", value: data.sunset, speech: `Sunset at ${data.sunset}` },
    { panel: "moon", label: "Illumination", value: `${data.moonIllumination}%`, speech: `Moon ${data.moonIllumination} percent illuminated` },
    { panel: "sun", label: "Day Length", value: `${data.dayLengthHrs}h ${data.dayLengthMin}m`, speech: `Day length ${data.dayLengthHrs} hours ${data.dayLengthMin} minutes` },
    { panel: "moon", label: "", value: "", speech: "" },
  ];

  const { index } = useArrowGrid(cells, 2, (c) => c.speech, announcer);

  return (
    <section aria-label={`Almanac for ${place.name}`} className="ws-almanac">
      <p className="ws-extended-hint">
        Arrow keys walk Sun data on the left, Moon data on the right.
      </p>
      <div className="ws-almanac-grid" role="list">
        {cells.map((c, i) => {
          if (!c.label) return <div key={`spacer-${i}`} className="ws-almanac-spacer" />;
          return (
            <div
              key={`${c.panel}-${c.label}`}
              className={`ws-almanac-cell ws-almanac-${c.panel}`}
              role="listitem"
              data-focused={i === index}
              aria-current={i === index ? "true" : undefined}
              aria-label={c.speech}
            >
              <div className="ws-almanac-label">{c.label}</div>
              <div className="ws-almanac-value">{c.value}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
