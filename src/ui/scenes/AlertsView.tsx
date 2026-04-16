import type { AlertsData } from "../../core/scenes/scenes/AlertsScene";
import { useArrowList } from "../../a11y/useArrowList";
import { useAnnouncer } from "../../a11y/AnnouncerContext";

export function AlertsView({ data }: { data: AlertsData }) {
  const announcer = useAnnouncer();
  const { index } = useArrowList(
    data.alerts,
    (a) => {
      const expiresAt = a.expires.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const instr = a.instruction ? ` Instructions: ${a.instruction}.` : "";
      return `${a.event}. Severity ${a.severity}, urgency ${a.urgency}, expires ${expiresAt}. ${a.headline}.${instr}`;
    },
    announcer
  );

  if (data.alerts.length === 0) {
    return (
      <section aria-label={`Alerts for ${data.place.name}`}>
        <p>No active alerts for {data.place.name}.</p>
      </section>
    );
  }
  return (
    <section aria-label={`Active alerts for ${data.place.name}`}>
      <div className="ws-noaa-attribution">
        <img
          src="/assets/logos/noaa/NOAA-Logo-Transparent.png"
          alt=""
          aria-hidden="true"
          className="ws-noaa-logo"
        />
        <span>Alerts from the National Weather Service / NOAA</span>
      </div>
      <p style={{ color: "var(--ws-text-dim)", marginTop: 0 }}>
        Up and down arrows to walk through alerts.
      </p>
      <ul className="ws-list">
        {data.alerts.map((a, i) => (
          <li
            className="ws-list-row"
            key={a.id}
            data-focused={i === index}
            aria-current={i === index ? "true" : undefined}
          >
            <span className="ws-list-row-name">{a.event}</span>
            <span className="ws-list-row-detail">
              {a.severity} · {a.urgency} · expires {a.expires.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
