import type { WeekendForecastData } from "../../core/scenes/scenes/WeekendForecastScene";
import type { DayForecast } from "../../core/scenes/scenes/ExtendedForecastScene";
import { useArrowGrid } from "../../a11y/useArrowGrid";
import { useAnnouncer } from "../../a11y/AnnouncerContext";
import { WeatherIcon, chooseIcon } from "../weatherscan/WeatherIcon";

/**
 * Era-authentic Weekend Forecast: Saturday + Sunday, day columns only,
 * each showing the daytime high with the overnight low stacked below —
 * the exact shape every TWC Weekend Outlook used on-air.
 */
export function WeekendForecastView({ data }: { data: WeekendForecastData }) {
  const { place, days, available } = data;
  const announcer = useAnnouncer();
  const cols = days.length;

  const { index } = useArrowGrid(
    days,
    cols,
    (d) => `${d.name}. ${d.detailedForecast}`,
    announcer,
  );

  if (!available || days.length === 0) {
    return (
      <section aria-label={`Weekend forecast for ${place.name}`}>
        <p style={{ color: "var(--ws-text-dim)" }}>
          Weekend forecast not yet available.
        </p>
      </section>
    );
  }

  return (
    <section aria-label={`Weekend forecast for ${place.name}`} className="ws-extended">
      <p className="ws-extended-hint">
        Left and right arrows walk through Saturday and Sunday.
      </p>
      <div
        className="ws-extended-grid"
        role="list"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {days.map((d, i) => (
          <DayColumn key={d.key} day={d} focused={i === index} />
        ))}
      </div>
    </section>
  );
}

function DayColumn({ day, focused }: { day: DayForecast; focused: boolean }) {
  const icon = chooseIcon(day.shortForecast, day.isDaytime);
  return (
    <div
      className="ws-extended-cell"
      role="listitem"
      data-focused={focused}
      aria-current={focused ? "true" : undefined}
      aria-label={ariaFor(day)}
    >
      <div className="ws-extended-day">{day.label}</div>
      <div className="ws-extended-icon">
        <WeatherIcon name={icon} size={80} />
      </div>
      <div className="ws-extended-cond">{shortCond(day.shortForecast)}</div>
      <div className="ws-extended-temps">
        {day.highF != null && <span className="ws-extended-hi">{day.highF}°</span>}
        {day.lowF != null && <span className="ws-extended-lo">{day.lowF}°</span>}
      </div>
    </div>
  );
}

function ariaFor(d: DayForecast): string {
  const parts = [d.name, d.shortForecast];
  if (d.highF != null) parts.push(`high ${d.highF}°`);
  if (d.lowF != null) parts.push(`low ${d.lowF}°`);
  return parts.join(", ");
}

function shortCond(text: string): string {
  return text
    .replace(/ and /gi, " / ")
    .replace(/thunderstorms?/gi, "T-Storms")
    .replace(/\s+/g, " ")
    .trim();
}
