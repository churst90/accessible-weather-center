import type { PrecipOutlookData } from "../../core/scenes/scenes/PrecipOutlookScene";
import { useArrowList } from "../../a11y/useArrowList";
import { useAnnouncer } from "../../a11y/AnnouncerContext";

export function PrecipOutlookView({ data }: { data: PrecipOutlookData }) {
  const { place, hours, summary } = data;
  const announcer = useAnnouncer();

  const { index } = useArrowList(
    hours,
    (h) => {
      const time = formatHour(h.time);
      return `${time}, ${h.precipPct} percent chance, ${h.forecast}.`;
    },
    announcer
  );

  if (hours.length === 0) {
    return <p>Precipitation outlook for {place.name} is not available.</p>;
  }

  return (
    <section aria-label={`Precipitation outlook for ${place.name}`}>
      <p style={{ color: "var(--ws-accent)", marginTop: 0, marginBottom: 12 }}>
        {summary}
      </p>
      <p style={{ color: "var(--ws-text-dim)", marginTop: 0 }}>
        Up and down arrows to walk through hours.
      </p>
      <table className="ws-readout-table" aria-label="Hourly precipitation outlook">
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Chance</th>
            <th scope="col">Forecast</th>
          </tr>
        </thead>
        <tbody>
          {hours.map((h, i) => {
            const highlight = h.precipPct > 50;
            return (
              <tr
                key={h.time.toISOString()}
                className="ws-readout-row"
                data-focused={i === index}
                aria-current={i === index ? "true" : undefined}
                style={highlight ? { color: "var(--ws-accent-warm)" } : undefined}
              >
                <th scope="row" className="ws-readout-label">
                  {formatHour(h.time)}
                </th>
                <td className="ws-readout-value">{h.precipPct}%</td>
                <td className="ws-readout-value">{h.forecast}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function formatHour(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    hour12: true,
  });
}
