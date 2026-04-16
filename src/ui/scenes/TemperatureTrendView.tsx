import type { TemperatureTrendData } from "../../core/scenes/scenes/TemperatureTrendScene";
import { useArrowGrid } from "../../a11y/useArrowGrid";
import { useAnnouncer } from "../../a11y/AnnouncerContext";

function formatHour(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric" }).replace(" ", "");
}

/**
 * Era-authentic Temperature Trend — LED-style Current/High/Low/Trend
 * readout on top, then a horizontal bar chart of upcoming hours. Columnar
 * bars walkable left/right with arrow-grid.
 */
export function TemperatureTrendView({ data }: { data: TemperatureTrendData }) {
  const { place, hours, currentF, highF, lowF, trend, summary } = data;
  const announcer = useAnnouncer();

  const { index } = useArrowGrid(
    hours,
    hours.length || 1,
    (h) => `At ${formatHour(h.time)}, ${h.tempF} degrees.`,
    announcer,
  );

  if (hours.length === 0) {
    return (
      <section aria-label={`Temperature trend for ${place.name}`}>
        <p style={{ color: "var(--ws-text-dim)" }}>
          Temperature trend data is not available.
        </p>
      </section>
    );
  }

  const range = (highF - lowF) || 1;
  const trendArrow = trend === "rising" ? "\u2191" : trend === "falling" ? "\u2193" : "\u2192";
  const trendLabel = trend === "rising" ? "Rising" : trend === "falling" ? "Falling" : "Steady";

  const readouts = [
    { label: "Current", value: currentF != null ? `${currentF}°` : "—", tone: "led" },
    { label: "High", value: `${highF}°`, tone: "warm" },
    { label: "Low", value: `${lowF}°`, tone: "cool" },
    { label: "Trend", value: trendArrow, tone: "neutral", speech: trendLabel },
  ];

  return (
    <section aria-label={`Temperature trend for ${place.name}`} className="ws-trend">
      <p className="ws-trend-summary">{summary}</p>
      <div className="ws-trend-readouts">
        {readouts.map((r) => (
          <div key={r.label} className="ws-trend-readout" data-tone={r.tone}>
            <div className="ws-trend-label">{r.label}</div>
            <div className="ws-trend-value" aria-label={r.speech ?? r.value}>{r.value}</div>
          </div>
        ))}
      </div>
      <p className="ws-extended-hint">Left and right arrows walk through upcoming hours.</p>
      <div className="ws-trend-bars" role="list">
        {hours.map((h, i) => {
          const pct = ((h.tempF - lowF) / range) * 100;
          return (
            <div
              className="ws-trend-bar"
              role="listitem"
              key={h.time.toISOString()}
              data-focused={i === index}
              aria-current={i === index ? "true" : undefined}
              aria-label={`At ${formatHour(h.time)}, ${h.tempF} degrees`}
            >
              <div className="ws-trend-bar-hour">{formatHour(h.time)}</div>
              <div className="ws-trend-bar-track" aria-hidden="true">
                <div
                  className="ws-trend-bar-fill"
                  style={{ height: `${Math.max(pct, 8)}%` }}
                />
              </div>
              <div className="ws-trend-bar-temp">{h.tempF}°</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
