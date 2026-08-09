import type { StormTrackerData } from "../../core/scenes/scenes/StormTrackerScene";
import { useArrowList } from "../../a11y/useArrowList";
import { useAnnouncer } from "../../a11y/AnnouncerContext";

import { bandInfo } from "../../core/radar/IntensityLegend";

function compassLabel(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function StormTrackerView({ data }: { data: StormTrackerData }) {
  const { place, storm, summary, totalStorms } = data;
  const announcer = useAnnouncer();

  // Hooks run unconditionally. This scene's data is re-prepared live as the
  // radar scans, so `storm` flips between null and a reading on the same
  // mounted instance — a hook behind the early return below would make React
  // throw the moment the first storm appeared.
  const rows = storm
    ? [
        { label: "Intensity", value: bandInfo(storm.band).label },
        { label: "Distance", value: `${storm.distanceFromHomeMi.toFixed(1)} miles` },
        { label: "Direction", value: compassLabel(storm.bearingFromHomeDeg) },
        {
          label: "Movement",
          value:
            storm.movementMph != null && storm.movementDeg != null && storm.movementMph > 0
              ? `${compassLabel(storm.movementDeg)} at ${Math.round(storm.movementMph)} mph`
              : "Stationary"
        },
        { label: "Peak Rate", value: `${storm.peakMmPerHour.toFixed(1)} mm/hr` },
        { label: "Radius", value: `${storm.radiusMi.toFixed(1)} miles` },
        {
          label: "ETA",
          value: storm.etaMinutes != null ? `${Math.round(storm.etaMinutes)} minutes` : "Not approaching"
        }
      ]
    : [];

  const describeRow = (r: { label: string; value: string }) => `${r.label}: ${r.value}`;
  const { index } = useArrowList(rows, describeRow, announcer, storm != null);

  if (!storm) {
    return (
      <section aria-label={`Storm tracker for ${place.name}`}>
        <p style={{ fontSize: 20, color: "var(--ws-text)" }}>
          No storms detected. All clear.
        </p>
        <p style={{ color: "var(--ws-text-dim)" }}>
          Skies are quiet in the {place.name} area. No precipitation detected on radar.
        </p>
      </section>
    );
  }

  return (
    <section aria-label={`Storm tracker for ${place.name}`}>
      <p style={{ margin: "0 0 12px", fontSize: 18, color: "var(--ws-text)" }}>
        {summary}
      </p>
      <p style={{ color: "var(--ws-text-dim)", marginTop: 0 }}>
        {totalStorms > 1
          ? `Nearest of ${totalStorms} storms on radar. Up and down arrows to walk its details; press N for map navigation to walk every storm.`
          : "Up and down arrows to walk storm details."}
      </p>
      <table
        className="ws-readout-table"
        aria-label="Nearest storm details"
      >
        <caption className="sr-only">
          Detailed measurements for the nearest detected storm. Use up and down arrows to walk the list.
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
