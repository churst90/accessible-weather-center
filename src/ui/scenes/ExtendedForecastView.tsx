import type { DayForecast, ExtendedForecastData } from "../../core/scenes/scenes/ExtendedForecastScene";
import { useArrowGrid } from "../../a11y/useArrowGrid";
import { useAnnouncer } from "../../a11y/AnnouncerContext";
import { WeatherIcon, chooseIcon } from "../weatherscan/WeatherIcon";

/**
 * Era-authentic columnar Extended Forecast: one column per day with day
 * name, icon, condition, and the daytime high + overnight low stacked
 * together — exactly the way every WeatherStar / IntelliStar unit rendered
 * the 5-day or 7-day outlook. Leading "TONIGHT" column (low-only) appears
 * when the feed starts after sunset.
 */
export function ExtendedForecastView({ data }: { data: ExtendedForecastData }) {
  const announcer = useAnnouncer();
  const cols = data.days.length;
  const { index } = useArrowGrid(
    data.days,
    cols,
    (d) => `${d.name}. ${d.detailedForecast}`,
    announcer,
  );

  return (
    <section
      aria-label={`${data.title} for ${data.place.name}`}
      className="ws-extended"
    >
      <p className="ws-extended-hint">
        Left and right arrows walk through the days. Each column shows the
        day, conditions, and the high and low temperatures.
      </p>
      <div
        className="ws-extended-grid"
        role="list"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {data.days.map((d, i) => (
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
    .replace(/ with /gi, " w/ ")
    .replace(/thunderstorms?/gi, "T-Storms")
    .replace(/\s+/g, " ")
    .trim();
}
