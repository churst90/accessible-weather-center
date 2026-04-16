import type { CurrentConditionsData } from "../../core/scenes/scenes/CurrentConditionsScene";
import { WeatherIcon, chooseIcon } from "../weatherscan/WeatherIcon";
import { useArrowGrid } from "../../a11y/useArrowGrid";
import { useAnnouncer } from "../../a11y/AnnouncerContext";

interface Cell {
  label: string;
  value: string;
  speech: string;
}

/**
 * Era-authentic Current Conditions hero layout. Every TWC unit rendered
 * this as a big central icon + huge temperature + conditions headline,
 * with a 2-row readout grid of supplementary values (humidity, wind,
 * pressure, visibility, etc.) below. Arrow-grid nav walks the readouts;
 * per-theme CSS gives each era its period-correct chrome.
 */
export function CurrentConditionsView({ data }: { data: CurrentConditionsData }) {
  const { place, observation } = data;
  const announcer = useAnnouncer();

  const cells: Cell[] = observation
    ? [
        cell("Feels Like", observation.feelsLikeF, "°", "degrees"),
        cell("Humidity", observation.humidityPct, "%", "percent humidity"),
        windCell(observation.windSpeedMph, observation.windDirDeg),
        cell("Pressure", observation.pressureInHg, " inHg", "inches of mercury"),
        cell("Visibility", observation.visibilityMi, " mi", "miles visibility"),
        cell("Dewpoint", observation.dewpointF ?? null, "°", "degrees dewpoint"),
      ]
    : [];

  // 3-column readout grid (2 rows of 3 cells each).
  const { index } = useArrowGrid(cells, 3, (c) => c.speech, announcer);

  if (!observation) {
    return <p>Observations for {place.name} are not available right now.</p>;
  }

  const icon = chooseIcon(observation.conditionText, isDaytime());

  return (
    <section aria-label={`Current conditions for ${place.name}`} className="ws-cc">
      <div className="ws-cc-hero">
        <div className="ws-cc-icon">
          <WeatherIcon name={icon} size={180} />
        </div>
        <div className="ws-cc-main">
          <div className="ws-cc-temp" aria-label={`${observation.temperatureF} degrees`}>
            {observation.temperatureF}
            <span className="ws-cc-deg">°</span>
          </div>
          {observation.conditionText && (
            <div className="ws-cc-cond">{observation.conditionText}</div>
          )}
          <div className="ws-cc-place">{place.name}</div>
        </div>
      </div>
      <p className="ws-cc-hint">
        Arrow keys walk through observation values.
      </p>
      <div className="ws-cc-grid" role="list">
        {cells.map((c, i) => (
          <div
            key={c.label}
            className="ws-cc-cell"
            role="listitem"
            data-focused={i === index}
            aria-current={i === index ? "true" : undefined}
            aria-label={c.speech}
          >
            <div className="ws-cc-cell-label">{c.label}</div>
            <div className="ws-cc-cell-value">{c.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function cell(label: string, n: number | null, suffix: string, speechSuffix: string): Cell {
  if (n == null) return { label, value: "—", speech: `${label} unavailable.` };
  return { label, value: `${n}${suffix}`, speech: `${label}, ${n} ${speechSuffix}.` };
}

function windCell(mph: number | null, deg: number | null): Cell {
  if (mph == null) return { label: "Wind", value: "—", speech: "Wind unavailable." };
  if (mph === 0) return { label: "Wind", value: "Calm", speech: "Winds calm." };
  const dirShort = deg != null ? compassShort(deg) : "";
  const dirLong = deg != null ? compassLong(deg) : "";
  return {
    label: "Wind",
    value: `${dirShort} ${mph} mph`.trim(),
    speech: `Wind ${dirLong} at ${mph} miles per hour.`,
  };
}

function compassShort(deg: number): string {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];
}
function compassLong(deg: number): string {
  return ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"][Math.round(deg / 45) % 8];
}
function isDaytime(): boolean {
  const h = new Date().getHours();
  return h >= 6 && h < 19;
}
