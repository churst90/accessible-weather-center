import type { LocalRadarData } from "../../core/scenes/scenes/LocalRadarScene";
import type { TrackedStorm } from "../../core/radar/StormTracker";
import type { RainViewerClient } from "../../core/weather/RainViewerClient";
import type { WeatherAlert } from "../../core/types";
import { useArrowList } from "../../a11y/useArrowList";
import { useAnnouncer } from "../../a11y/AnnouncerContext";
import { bandInfo } from "../../core/radar/IntensityLegend";
import { WeatherIcon, chooseIcon } from "../weatherscan/WeatherIcon";
import { RadarMapCanvas } from "./RadarMapCanvas";

/**
 * Storm Scanner view. Renders a TV-style radar map (decorative) alongside
 * the live list of detected storms as a real HTML table for screen readers.
 * Arrow keys walk storms; each focus change announces a full descriptor.
 *
 * The canvas shows animated RainViewer radar tiles, NWS alert polygons,
 * storm movement arrows, and a precipitation legend over a dark base map.
 * All meaningful content is in the table — the map is aria-hidden.
 */
export function LocalRadarView({
  data,
  rainviewer,
  alerts = []
}: {
  data: LocalRadarData;
  rainviewer: RainViewerClient;
  alerts?: WeatherAlert[];
}) {
  const announcer = useAnnouncer();

  const onActivate = (storm: TrackedStorm, i: number) => {
    void announcer.announce(describeStormDetail(storm, i), "assertive");
  };

  const { index } = useArrowList(data.storms, describeStormRow, announcer, true, onActivate);

  const icon = chooseIcon(data.storms[0]?.band ?? null, true);
  const capturedText = data.capturedAt
    ? `Captured ${data.capturedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : "Waiting for first radar scan…";

  return (
    <section aria-label={`Local radar for ${data.place.name}`}>
      <RadarMapCanvas
        center={data.place.coord}
        storms={data.storms}
        rainviewer={rainviewer}
        alerts={alerts}
        className="ws-radar-map-scene"
      />

      <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 16 }}>
        <WeatherIcon name={icon} size={96} />
        <div>
          <p style={{ margin: 0, fontSize: 24, color: "var(--ws-text)" }}>{data.summary}</p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ws-text-dim)" }}>
            {capturedText}
            {data.error ? ` · last error: ${data.error}` : ""}
          </p>
        </div>
      </div>

      {data.storms.length === 0 ? (
        <p style={{ color: "var(--ws-text-dim)", fontSize: 18, marginTop: 24 }}>
          No precipitation within 150 miles. All clear.
        </p>
      ) : (
        <>
          <p style={{ color: "var(--ws-text-dim)", marginTop: 0 }}>
            Up and down arrows to walk through detected storms. Enter for details.
          </p>
          <table className="ws-readout-table" aria-label="Detected storms">
            <caption className="sr-only">
              Live radar storms near {data.place.name}. Sorted closest first.
              Use up and down arrows to walk the list.
            </caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Intensity</th>
                <th scope="col">Distance</th>
                <th scope="col">Bearing</th>
                <th scope="col">Movement</th>
                <th scope="col">ETA</th>
              </tr>
            </thead>
            <tbody>
              {data.storms.map((s, i) => (
                <tr
                  key={s.id}
                  className="ws-readout-row"
                  data-focused={i === index}
                  aria-current={i === index ? "true" : undefined}
                >
                  <th scope="row" className="ws-readout-label">{i + 1}</th>
                  <td className="ws-readout-value">{intensityLabel(s)}</td>
                  <td className="ws-readout-value">{Math.round(s.distanceFromHomeMi)} mi</td>
                  <td className="ws-readout-value">{bearingShort(s.bearingFromHomeDeg)}</td>
                  <td className="ws-readout-value">{movementText(s)}</td>
                  <td className="ws-readout-value">{etaText(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function describeStormDetail(storm: TrackedStorm, i: number): string {
  const intensity = intensityLabel(storm);
  const distance = `${Math.round(storm.distanceFromHomeMi)} miles`;
  const direction = bearingLong(storm.bearingFromHomeDeg);
  const parts: string[] = [
    `Storm ${i + 1} details.`,
    `${intensity} at ${distance} to the ${direction}.`,
  ];
  if (storm.peakMmPerHour > 0) {
    parts.push(`Peak rate ${storm.peakMmPerHour.toFixed(1)} millimeters per hour.`);
  }
  if (storm.radiusMi > 0) {
    parts.push(`Radius approximately ${storm.radiusMi.toFixed(1)} miles.`);
  }
  if (storm.movementMph != null && storm.movementMph > 0 && storm.movementDeg != null) {
    parts.push(`Moving ${bearingLong(storm.movementDeg)} at ${storm.movementMph} miles per hour.`);
  } else if (storm.movementMph === 0) {
    parts.push("Currently stationary. Not moving.");
  }
  if (storm.etaMinutes != null) {
    parts.push(`Estimated ${storm.etaMinutes} minutes to reach your location.`);
  } else if (storm.movementMph != null && storm.movementMph > 0) {
    parts.push("Not currently moving toward you.");
  }
  return parts.join(" ");
}

function describeStormRow(storm: TrackedStorm, i: number): string {
  const intensity = intensityLabel(storm);
  const distance = `${Math.round(storm.distanceFromHomeMi)} miles`;
  const direction = bearingLong(storm.bearingFromHomeDeg);
  let movement = "";
  if (storm.movementMph != null && storm.movementMph > 0 && storm.movementDeg != null) {
    movement = `, moving ${bearingLong(storm.movementDeg)} at ${storm.movementMph} miles per hour`;
  } else if (storm.movementMph === 0) {
    movement = ", stationary";
  }
  const eta = storm.etaMinutes != null ? `, estimated ${storm.etaMinutes} minutes to reach you` : "";
  // No "Storm N" prefix — useArrowList appends "N of M" to every readout,
  // so leading with the ordinal said the position twice.
  void i;
  return `${intensity}, ${distance} ${direction}${movement}${eta}.`;
}

function intensityLabel(storm: TrackedStorm): string {
  return bandInfo(storm.band).label;
}

function bearingShort(deg: number): string {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];
}

function bearingLong(deg: number): string {
  return [
    "north", "northeast", "east", "southeast",
    "south", "southwest", "west", "northwest"
  ][Math.round(deg / 45) % 8];
}

function movementText(storm: TrackedStorm): string {
  if (storm.movementMph == null) return "—";
  if (storm.movementMph === 0) return "Stationary";
  if (storm.movementDeg == null) return `${storm.movementMph} mph`;
  return `${bearingShort(storm.movementDeg)} ${storm.movementMph} mph`;
}

function etaText(storm: TrackedStorm): string {
  if (storm.etaMinutes == null) return "—";
  return `${storm.etaMinutes} min`;
}
