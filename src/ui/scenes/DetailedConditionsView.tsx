import type { DetailedConditionsData } from "../../core/scenes/scenes/DetailedConditionsScene";
import { useArrowList } from "../../a11y/useArrowList";
import { useAnnouncer } from "../../a11y/AnnouncerContext";

export function DetailedConditionsView({ data }: { data: DetailedConditionsData }) {
  const { place, observation } = data;
  const announcer = useAnnouncer();

  // Hooks run unconditionally: a live refresh can flip `observation` from
  // null to a reading on the same mounted instance, and a hook call that
  // only happens on some renders makes React throw.
  const rows = observation
    ? [
        { label: "Wind", value: formatWind(observation.windSpeedMph, observation.windDirDeg, observation.windGustMph) },
        { label: "Humidity", value: observation.humidityPct != null ? `${observation.humidityPct}%` : "\u2014" },
        { label: "Dewpoint", value: observation.dewpointF != null ? `${observation.dewpointF}\u00B0F` : "\u2014" },
        { label: "Pressure", value: observation.pressureInHg != null ? `${observation.pressureInHg} inHg` : "\u2014" },
        { label: "Visibility", value: observation.visibilityMi != null ? `${observation.visibilityMi} mi` : "\u2014" },
      ]
    : [];

  const describeRow = (r: { label: string; value: string }) => `${r.label}: ${r.value}`;
  const { index } = useArrowList(rows, describeRow, announcer, observation != null);

  if (!observation) {
    return <p>Detailed conditions for {place.name} are not available.</p>;
  }

  return (
    <section aria-label={`Detailed conditions for ${place.name}`}>
      <p style={{ color: "var(--ws-text-dim)", marginTop: 0 }}>
        Up and down arrows to walk measurements.
      </p>
      <table className="ws-readout-table" aria-label={`Detailed conditions for ${place.name}`}>
        <caption className="sr-only">
          Detailed weather conditions. Use up and down arrows to walk the list.
        </caption>
        <thead>
          <tr>
            <th scope="col">Measurement</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.label}
              className="ws-readout-row"
              data-focused={i === index}
              aria-current={i === index ? "true" : undefined}
            >
              <th scope="row" className="ws-readout-label">{r.label}</th>
              <td className="ws-readout-value">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function formatWind(
  mph: number | null,
  deg: number | null,
  gust: number | null
): string {
  if (mph == null) return "\u2014";
  if (mph === 0) return "Calm";
  const dir = deg != null ? compass(deg) : "Variable";
  let text = `${dir} at ${mph} mph`;
  if (gust != null && gust > mph) {
    text += `, gusts to ${gust}`;
  }
  return text;
}

function compass(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}
