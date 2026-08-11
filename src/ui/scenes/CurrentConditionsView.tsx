import type { CurrentConditionsData } from "../../core/scenes/scenes/CurrentConditionsScene";
import type { PressureTrend } from "../../core/types";
import { WeatherIcon, chooseIcon } from "../weatherscan/WeatherIcon";
import { useArrowGrid } from "../../a11y/useArrowGrid";
import { useAnnouncer } from "../../a11y/AnnouncerContext";

interface Cell {
  label: string;
  value: string;
  speech: string;
  /** Hide the rendered value from assistive tech, where it carries a glyph
   *  the `speech` string already says in words. */
  valueAriaHidden?: boolean;
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
        pressureCell(observation.pressureInHg, observation.pressureTrend),
        cell("Visibility", observation.visibilityMi, " mi", "miles visibility"),
        cell("Dewpoint", observation.dewpointF ?? null, "°", "degrees dewpoint"),
        ceilingCell(observation.ceilingFt),
      ]
    : [];

  // 3-column readout grid.
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
            <div className="ws-cc-cell-value" aria-hidden={c.valueAriaHidden || undefined}>{c.value}</div>
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

/**
 * Pressure with the WeatherStar's trend arrow.
 *
 * The v2 capture shows "Pressure: 29.96↓" — a yellow glyph tucked against the
 * number. The arrow is `aria-hidden` and the direction is spoken as a word
 * instead: screen readers announce "↓" inconsistently, from "down arrow" to
 * silence, and a barometer falling is the part that matters.
 */
function pressureCell(inHg: number | null, trend: PressureTrend | null): Cell {
  if (inHg == null) return { label: "Pressure", value: "—", speech: "Pressure unavailable." };
  const glyph = trend === "rising" ? "↑" : trend === "falling" ? "↓" : trend === "steady" ? "→" : "";
  const spoken = trend ? ` and ${trend}` : "";
  return {
    label: "Pressure",
    value: `${inHg.toFixed(2)}${glyph}`,
    speech: `Pressure, ${inHg.toFixed(2)} inches of mercury${spoken}.`,
    // The glyph is decoration over a word the speech already carries.
    valueAriaHidden: glyph !== ""
  };
}

/**
 * Ceiling, in the units the WeatherStar printed them.
 *
 * "Unlimited" is a real answer, not a missing one — it means no broken or
 * overcast layer, which is why it is distinguished from the em-dash used for
 * data that failed to arrive.
 */
function ceilingCell(ft: number | null): Cell {
  if (ft == null) {
    return { label: "Ceiling", value: "Unlimited", speech: "Ceiling unlimited." };
  }
  const pretty = ft.toLocaleString("en-US");
  return { label: "Ceiling", value: `${pretty} ft`, speech: `Ceiling, ${pretty} feet.` };
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
