import type { AirportDelaysData } from "../../core/scenes/scenes/AirportDelaysScene";
import type { AirportDelay } from "../../core/weather/FaaClient";
import { SceneUnavailable } from "./SceneUnavailable";
import { useArrowList } from "../../a11y/useArrowList";
import { useAnnouncer } from "../../a11y/AnnouncerContext";

export function AirportDelaysView({ data }: { data: AirportDelaysData }) {
  if (!data.available) {
    return <SceneUnavailable title="Airport Delays" reason={data.reason} />;
  }
  if (data.delays.length === 0) {
    return <SceneUnavailable title="Airport Delays" reason="No delays reported nationwide." />;
  }

  const announcer = useAnnouncer();
  const describe = (d: AirportDelay) => {
    if (d.kind === "closure") {
      const window = [d.closureStart && `from ${d.closureStart}`, d.closureReopen && `reopens ${d.closureReopen}`]
        .filter(Boolean).join(", ");
      return `${d.name}. Airport closed. ${window}. ${d.reason || "no reason reported"}`;
    }
    const mins = d.avgDelayMinutes != null ? `${d.avgDelayMinutes}-minute delay` : "delay (duration unspecified)";
    return `${d.name}. ${d.kind.replace("-", " ")}. ${mins}. ${d.reason || "no reason reported"}`;
  };
  const { index } = useArrowList(data.delays, describe, announcer);

  return (
    <section aria-label="Airport delays">
      <p style={{ color: "var(--ws-text-dim)", marginTop: 0 }}>
        Up and down arrows to walk through delayed airports.
      </p>
      <ul className="ws-list">
        {data.delays.map((d, i) => (
          <li
            key={`${d.iata}-${d.kind}`}
            className="ws-list-row"
            data-focused={i === index}
            aria-current={i === index ? "true" : undefined}
          >
            <span className="ws-list-row-name">
              {d.iata} — {d.name}
            </span>
            <span className="ws-list-row-detail">
              {kindLabel(d.kind)} · {formatDelayDetail(d)}
              {d.reason ? ` · ${d.reason}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatDelayDetail(d: AirportDelay): string {
  if (d.kind === "closure") {
    if (d.closureReopen) return `reopens ${d.closureReopen}`;
    if (d.closureStart) return `since ${d.closureStart}`;
    return "closed";
  }
  return d.avgDelayMinutes != null ? `${d.avgDelayMinutes} min` : "—";
}

function kindLabel(k: AirportDelay["kind"]): string {
  switch (k) {
    case "ground-delay": return "Ground Delay";
    case "ground-stop":  return "Ground Stop";
    case "arrival":      return "Arrival Delay";
    case "departure":    return "Departure Delay";
    case "closure":      return "Airport Closed";
    default:             return "Delay";
  }
}
