import type { OvernightForecastData } from "../../core/scenes/scenes/OvernightForecastScene";
import { useArrowList } from "../../a11y/useArrowList";
import { useAnnouncer } from "../../a11y/AnnouncerContext";
import { WeatherIcon, chooseIcon } from "../weatherscan/WeatherIcon";

/**
 * Era-authentic Overnight Forecast — a single-period hero card with a
 * large icon, big low temp, conditions headline, and the detailed NWS
 * narrative below. Mirrors the TWC "Tonight's Forecast" / "Overnight"
 * presentation used from WSXL through IS2 HD. Per-theme styling lives in
 * .ws-hero-* CSS classes.
 */
export function OvernightForecastView({ data }: { data: OvernightForecastData }) {
  const { place, period, available } = data;
  const announcer = useAnnouncer();

  const details = period
    ? [
        { label: "Low", value: `${period.temperatureF}°` },
        { label: "Wind", value: `${period.windDirText} ${period.windSpeedText}`.trim() },
        ...(period.precipProbabilityPct != null && period.precipProbabilityPct > 0
          ? [{ label: "Precip Chance", value: `${period.precipProbabilityPct}%` }]
          : []),
      ]
    : [];

  const { index } = useArrowList(
    details,
    (d) => `${d.label}: ${d.value}`,
    announcer,
  );

  if (!available || !period) {
    return (
      <section aria-label={`Overnight forecast for ${place.name}`}>
        <p style={{ color: "var(--ws-text-dim)" }}>
          Overnight forecast not yet available.
        </p>
      </section>
    );
  }

  const icon = chooseIcon(period.shortForecast, false);

  return (
    <section aria-label={`Overnight forecast for ${place.name}`} className="ws-hero">
      <div className="ws-hero-head">
        <span className="ws-hero-period">{period.name.toUpperCase()}</span>
      </div>
      <div className="ws-hero-body">
        <div className="ws-hero-icon">
          <WeatherIcon name={icon} size={160} />
        </div>
        <div className="ws-hero-main">
          <div className="ws-hero-temp">{period.temperatureF}°</div>
          <div className="ws-hero-cond">{period.shortForecast}</div>
        </div>
      </div>
      <dl className="ws-hero-stats" role="list">
        {details.map((d, i) => (
          <div
            key={d.label}
            className="ws-hero-stat"
            role="listitem"
            data-focused={i === index}
            aria-current={i === index ? "true" : undefined}
          >
            <dt>{d.label}</dt>
            <dd>{d.value}</dd>
          </div>
        ))}
      </dl>
      <p className="ws-hero-narrative">{period.detailedForecast}</p>
    </section>
  );
}
