import type { StormTrackerData } from "../../core/scenes/scenes/StormTrackerScene";
import type { TrackedStorm } from "../../core/radar/StormTracker";
import { useArrowList } from "../../a11y/useArrowList";
import { useAnnouncer } from "../../a11y/AnnouncerContext";

import { bandInfo } from "../../core/radar/IntensityLegend";
import { describeStorm } from "../../core/radar/StormScanner";

function compassLabel(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function detailRows(storm: TrackedStorm): Array<{ label: string; value: string }> {
  return [
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
  ];
}

export function StormTrackerView({ data }: { data: StormTrackerData }) {
  const { place, storm, storms, summary, totalStorms } = data;
  const announcer = useAnnouncer();

  // Hooks run unconditionally. This scene's data is re-prepared live as the
  // radar scans, so `storm` flips between null and a reading on the same
  // mounted instance — a hook behind the early return below would make React
  // throw the moment the first storm appeared.
  //
  // Arrows walk the STORMS. They used to walk the seven measurement rows of
  // the single nearest storm, so on a screen listing "3 storms detected"
  // pressing Down read "Intensity", "Distance", "Direction" — parameters of
  // something the user had never been given the chance to choose.
  const list = storms ?? (storm ? [storm] : []);

  // useArrowList appends "N of M" itself, so the describe callback must not —
  // doing both reads "...ETA 41 minutes. 1 of 1 1 of 1."
  const describeStormRow = (s: TrackedStorm) => describeStorm(s, place.coord);

  // The aria-label has no such helper behind it, so it carries the position
  // itself — last, because leading with it buries the storm.
  const stormLabel = (s: TrackedStorm, i: number) =>
    `${describeStorm(s, place.coord)} ${i + 1} of ${list.length}`;

  // Enter reads the full measurement set for the selected storm. Without an
  // onActivate the key was simply swallowed: the list announced each storm in
  // one sentence and there was no way to hear radius, peak rate or ETA.
  const readFullDetails = (s: TrackedStorm, i: number) => {
    const detail = detailRows(s).map((r) => `${r.label}, ${r.value}`).join(". ");
    announcer.announce(
      `Storm ${i + 1} of ${list.length}. ${describeStorm(s, place.coord)} ${detail}.`,
      "assertive"
    );
  };

  const { index } = useArrowList(list, describeStormRow, announcer, list.length > 0, readFullDetails);

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

  // Before the first arrow press nothing is selected, so the table shows the
  // storm the scene led with — which is what the summary above it describes.
  const selected = list[index] ?? storm;
  const rows = detailRows(selected);
  const selectedPosition = list.indexOf(selected) + 1;

  return (
    <section aria-label={`Storm tracker for ${place.name}`}>
      <p style={{ margin: "0 0 12px", fontSize: 18, color: "var(--ws-text)" }}>
        {summary}
      </p>
      <p style={{ color: "var(--ws-text-dim)", marginTop: 0 }}>
        {totalStorms > 1
          ? `Up and down arrows to walk all ${totalStorms} storms; the table shows the selected one.`
          : "One storm on radar. Its measurements are below."}
      </p>

      {totalStorms > 1 && (
        <ul
          className="ws-storm-list"
          aria-label={`${totalStorms} storms on radar`}
          style={{ listStyle: "none", padding: 0, margin: "0 0 12px" }}
        >
          {list.map((s, i) => (
            <li
              key={s.id ?? i}
              className="ws-readout-row"
              data-focused={i === index}
              aria-current={i === index ? "true" : undefined}
              // Visible text is telegraphic; a reader walking the list needs
              // the whole sentence, not "Heavy Rain — 12 mi NE".
              aria-label={stormLabel(s, i)}
              style={{ color: "var(--ws-text)", padding: "2px 0" }}
            >
              {bandInfo(s.band).label} — {s.distanceFromHomeMi.toFixed(0)} mi{" "}
              {compassLabel(s.bearingFromHomeDeg)}
              {s.etaMinutes != null ? `, ETA ${Math.round(s.etaMinutes)} min` : ""}
            </li>
          ))}
        </ul>
      )}

      <table
        className="ws-readout-table"
        aria-label={
          totalStorms > 1
            ? `Details for storm ${selectedPosition} of ${totalStorms}`
            : "Nearest storm details"
        }
      >
        <caption className="sr-only">
          {totalStorms > 1
            ? `Measurements for the selected storm, ${selectedPosition} of ${totalStorms}. Use up and down arrows to change storms.`
            : "Detailed measurements for the detected storm."}
        </caption>
        <thead>
          <tr>
            <th scope="col">Measurement</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="ws-readout-row">
              <th scope="row" className="ws-readout-label">{r.label}</th>
              <td className="ws-readout-value">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
