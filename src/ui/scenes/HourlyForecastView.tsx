import type { HourlyForecastData } from "../../core/scenes/scenes/HourlyForecastScene";
import { useArrowGrid } from "../../a11y/useArrowGrid";
import { useAnnouncer } from "../../a11y/AnnouncerContext";
import { WeatherIcon, chooseIcon } from "../weatherscan/WeatherIcon";

/**
 * Era-authentic columnar Hourly Forecast. Every WeatherStar era from
 * WSXL onward ran an hourly daypart scene as a row of columns — time
 * header, weather icon, temp, precip chance. We render 6 columns at a
 * time to match the on-air presentation (WSXL/IS1/IS2 typically showed
 * 6 hours in a frame).
 */
export function HourlyForecastView({ data }: { data: HourlyForecastData }) {
  const announcer = useAnnouncer();
  // On-air TWC showed 6 hours per frame. We render up to 8 for desktop
  // widths; the column count caps at whatever fits.
  const MAX_COLS = 8;
  const hours = data.hours.slice(0, MAX_COLS);
  const cols = hours.length;

  const { index } = useArrowGrid(
    hours,
    cols,
    (h) => {
      const time = h.time.toLocaleTimeString([], { hour: "numeric" });
      const precip = h.precipProbabilityPct > 0
        ? `, ${h.precipProbabilityPct} percent chance of precipitation`
        : "";
      return `At ${time}, ${h.temperatureF} degrees, ${h.shortForecast}${precip}.`;
    },
    announcer,
  );

  return (
    <section
      aria-label={`Hourly forecast for ${data.place.name}`}
      className="ws-extended"
    >
      <p className="ws-extended-hint">
        Left and right arrows walk through hours. Each column shows the time,
        conditions, temperature, and precipitation chance.
      </p>
      <div
        className="ws-extended-grid"
        role="list"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {hours.map((h, i) => {
          const icon = chooseIcon(h.shortForecast, isDaytime(h.time));
          const time = h.time.toLocaleTimeString([], { hour: "numeric" }).replace(" ", "");
          return (
            <div
              key={h.time.toISOString()}
              className="ws-extended-cell"
              role="listitem"
              data-focused={i === index}
              aria-current={i === index ? "true" : undefined}
              aria-label={`${time}, ${h.shortForecast}, ${h.temperatureF}°${h.precipProbabilityPct > 0 ? `, ${h.precipProbabilityPct} percent precipitation` : ""}`}
            >
              <div className="ws-extended-day">{time}</div>
              <div className="ws-extended-icon">
                <WeatherIcon name={icon} size={72} />
              </div>
              <div className="ws-extended-cond">{shortCond(h.shortForecast)}</div>
              <div className="ws-extended-temps">
                <span className="ws-extended-hi">{h.temperatureF}°</span>
                {h.precipProbabilityPct > 0 && (
                  <span className="ws-extended-precip">{h.precipProbabilityPct}%</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function isDaytime(t: Date): boolean {
  const h = t.getHours();
  return h >= 6 && h < 19;
}

function shortCond(text: string): string {
  return text
    .replace(/ and /gi, " / ")
    .replace(/thunderstorms?/gi, "T-Storms")
    .replace(/\s+/g, " ")
    .trim();
}
