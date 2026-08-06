import { useEffect, useRef, useState, useCallback } from "react";
import type { Place, WeatherAlert, LatLon, LocationInfo } from "../../core/types";
import type { TrackedStorm } from "../../core/radar/StormTracker";
import type { StormScanner, RadarProbeResult } from "../../core/radar/StormScanner";
import type { RainViewerClient } from "../../core/weather/RainViewerClient";
import type { WeatherService } from "../../core/weather/WeatherService";
import type { AnnouncementQueue } from "../../a11y/AnnouncementQueue";
import { GRID_STEP_PRESETS_MI, type SettingsStore } from "../../core/settings/SettingsStore";
import { pointInPolygon } from "../../core/radar/TileMath";
import { RadarMapCanvas } from "../scenes/RadarMapCanvas";

/**
 * Map Navigation view — a dedicated mode for spatially exploring weather
 * features on the radar map. Activated by pressing N.
 *
 * Sub-modes (switch with Tab):
 *   1. Storms  — walk detected storms by distance/bearing from home
 *   2. Alerts  — walk active NWS alerts with area descriptions
 *   3. Grid    — pan a virtual cursor around the map with arrow keys
 *              — announces: location (city/county), precipitation,
 *                nearby storms, active alerts, and position from home
 *
 * Each mode renders a panel below the radar map canvas. Arrow keys
 * navigate items within the mode; all changes are announced via the
 * announcer for screen reader users.
 */

type NavMode = "storms" | "alerts" | "grid";
const NAV_MODES: NavMode[] = ["storms", "alerts", "grid"];
const MODE_LABELS: Record<NavMode, string> = {
  storms: "Storms",
  alerts: "Alerts",
  grid: "Grid Explorer"
};

/** Snap an arbitrary mile value to the closest allowed grid-step preset. */
function nearestPreset(mi: number): number {
  let best: number = GRID_STEP_PRESETS_MI[0];
  for (const p of GRID_STEP_PRESETS_MI) {
    if (Math.abs(p - mi) < Math.abs(best - mi)) best = p;
  }
  return best;
}

/** Collected context about the grid cursor position. */
interface GridContext {
  location: LocationInfo | null;
  locationLoading: boolean;
  probe: RadarProbeResult;
  alertsAtCursor: WeatherAlert[];
}

interface Props {
  place: Place;
  stormScanner: StormScanner;
  rainviewer: RainViewerClient;
  weather: WeatherService;
  announcer: AnnouncementQueue;
  settings: SettingsStore;
  active: boolean;
}

export function MapNavView({
  place,
  stormScanner,
  rainviewer,
  weather,
  announcer,
  settings,
  active
}: Props) {
  const [mode, setMode] = useState<NavMode>("storms");
  const [stormIdx, setStormIdx] = useState(0);
  const [alertIdx, setAlertIdx] = useState(0);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [gridCursor, setGridCursor] = useState<LatLon>({ ...place.coord });
  // Miles moved per arrow press in grid mode. Snap the persisted value to
  // the nearest preset in case an old/edited settings blob has an odd one.
  const [gridStepMi, setGridStepMi] = useState<number>(() =>
    nearestPreset(settings.get().mapGridStepMi)
  );
  const [highlightCoord, setHighlightCoord] = useState<LatLon | null>(null);
  const [gridCtx, setGridCtx] = useState<GridContext>({
    location: null,
    locationLoading: false,
    probe: { cell: null, distanceMi: null, nearestStorm: null, stormDistanceMi: null },
    alertsAtCursor: []
  });

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const gridCursorRef = useRef(gridCursor);
  gridCursorRef.current = gridCursor;
  const gridCtxRef = useRef(gridCtx);
  gridCtxRef.current = gridCtx;
  const geoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snap = stormScanner.getSnapshot();
  const storms = snap.storms;

  // Fetch alerts for the alert nav mode.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    weather.getActiveAlerts(place).then((a) => {
      if (!cancelled) setAlerts(a);
    });
    return () => { cancelled = true; };
  }, [active, place, weather]);

  // Reset indices when mode changes.
  useEffect(() => {
    setStormIdx(0);
    setAlertIdx(0);
    setGridCursor({ ...place.coord });
  }, [mode, place.coord]);

  // Update highlight when selection changes.
  useEffect(() => {
    if (!active) return;
    if (mode === "storms" && storms[stormIdx]) {
      setHighlightCoord(storms[stormIdx].centroid);
    } else if (mode === "grid") {
      setHighlightCoord(gridCursor);
    } else if (mode === "alerts" && alerts[alertIdx]?.polygon) {
      const poly = alerts[alertIdx].polygon!;
      const centroid = polygonCentroid(poly);
      setHighlightCoord(centroid);
    } else {
      setHighlightCoord(null);
    }
  }, [active, mode, stormIdx, alertIdx, gridCursor, storms, alerts]);

  /**
   * Probe the radar and check alert polygons at the current cursor.
   * This runs immediately on every cursor move (no API call needed).
   */
  const probeAtCursor = useCallback(
    (cursor: LatLon) => {
      const probe = stormScanner.probeAt(cursor);
      const alertsHere = alerts.filter(
        (a) => a.polygon && pointInPolygon(cursor, a.polygon)
      );
      setGridCtx((prev) => ({
        ...prev,
        probe,
        alertsAtCursor: alertsHere
      }));
      return { probe, alertsHere };
    },
    [stormScanner, alerts]
  );

  /**
   * Debounced reverse geocode. Fires 400ms after the last cursor move
   * to avoid hammering the NWS API on rapid arrow presses.
   */
  const scheduleGeocode = useCallback(
    (cursor: LatLon) => {
      if (geoTimerRef.current) clearTimeout(geoTimerRef.current);
      setGridCtx((prev) => ({ ...prev, locationLoading: true }));
      geoTimerRef.current = setTimeout(async () => {
        try {
          const loc = await weather.reverseGeocode(cursor);
          // Only apply if cursor hasn't moved since we started.
          const current = gridCursorRef.current;
          if (
            Math.abs(current.lat - cursor.lat) < 0.001 &&
            Math.abs(current.lon - cursor.lon) < 0.001
          ) {
            setGridCtx((p) => ({
              ...p,
              location: loc,
              locationLoading: false
            }));
            // Announce the full context now that we have location.
            const ctx = gridCtxRef.current;
            void announcer.announce(
              buildFullGridAnnouncement(cursor, place, loc, ctx.probe, ctx.alertsAtCursor),
              "polite"
            );
          }
        } catch {
          setGridCtx((prev) => ({ ...prev, locationLoading: false }));
        }
      }, 400);
    },
    [weather, announcer, place]
  );

  // Clean up geocode timer.
  useEffect(() => {
    return () => {
      if (geoTimerRef.current) clearTimeout(geoTimerRef.current);
    };
  }, []);

  // Keyboard handler.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      if (e.key === "Tab") {
        e.preventDefault();
        const dir = e.shiftKey ? -1 : 1;
        const curIdx = NAV_MODES.indexOf(modeRef.current);
        const nextIdx = ((curIdx + dir) % NAV_MODES.length + NAV_MODES.length) % NAV_MODES.length;
        const next = NAV_MODES[nextIdx];
        setMode(next);
        const gridHint = next === "grid"
          ? ` Arrow keys move ${gridStepMi} mile${gridStepMi === 1 ? "" : "s"}; press left or right bracket to change the step.`
          : "";
        void announcer.announce(`Map navigation: ${MODE_LABELS[next]} mode.${gridHint}`, "assertive");
        return;
      }

      switch (modeRef.current) {
        case "storms":
          handleStormKeys(e);
          break;
        case "alerts":
          handleAlertKeys(e);
          break;
        case "grid":
          handleGridKeys(e);
          break;
      }
    };

    const handleStormKeys = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setStormIdx((i) => {
          const next = Math.min(i + 1, storms.length - 1);
          if (storms[next]) void announcer.announce(describeStormNav(storms[next], next), "polite");
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setStormIdx((i) => {
          const next = Math.max(i - 1, 0);
          if (storms[next]) void announcer.announce(describeStormNav(storms[next], next), "polite");
          return next;
        });
      } else if (e.key === "Home") {
        e.preventDefault();
        setStormIdx(0);
        if (storms[0]) void announcer.announce(describeStormNav(storms[0], 0), "polite");
      } else if (e.key === "End") {
        e.preventDefault();
        const last = Math.max(0, storms.length - 1);
        setStormIdx(last);
        if (storms[last]) void announcer.announce(describeStormNav(storms[last], last), "polite");
      } else if (e.key === "Enter" && storms[stormIdx]) {
        e.preventDefault();
        void announcer.announce(describeStormDetail(storms[stormIdx], stormIdx), "assertive");
      }
    };

    const handleAlertKeys = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAlertIdx((i) => {
          const next = Math.min(i + 1, alerts.length - 1);
          if (alerts[next]) void announcer.announce(describeAlertNav(alerts[next], next), "polite");
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setAlertIdx((i) => {
          const next = Math.max(i - 1, 0);
          if (alerts[next]) void announcer.announce(describeAlertNav(alerts[next], next), "polite");
          return next;
        });
      } else if (e.key === "Enter" && alerts[alertIdx]) {
        e.preventDefault();
        void announcer.announce(describeAlertDetail(alerts[alertIdx]), "assertive");
      }
    };

    const handleGridKeys = (e: KeyboardEvent) => {
      // Convert the mile step to degrees at the cursor's latitude so a
      // "5 mile" press really moves ~5 miles east-west too (a fixed degree
      // step stretches with latitude).
      const latStep = gridStepMi / 69;
      const lonStep = gridStepMi / (69.172 * Math.max(0.2, Math.cos((gridCursor.lat * Math.PI) / 180)));
      let newCursor: LatLon | null = null;

      if (e.key === "[" || e.key === "]") {
        // Cycle the step through the presets. Announced, persisted.
        e.preventDefault();
        const dir = e.key === "]" ? 1 : -1;
        const presets = GRID_STEP_PRESETS_MI;
        const idx = presets.indexOf(nearestPreset(gridStepMi) as (typeof presets)[number]);
        const next = presets[Math.min(presets.length - 1, Math.max(0, idx + dir))];
        if (next !== gridStepMi) {
          setGridStepMi(next);
          settings.update({ mapGridStepMi: next });
        }
        void announcer.announce(
          `Grid step: ${next} mile${next === 1 ? "" : "s"} per press.`,
          "polite"
        );
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        newCursor = { lat: gridCursor.lat + latStep, lon: gridCursor.lon };
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        newCursor = { lat: gridCursor.lat - latStep, lon: gridCursor.lon };
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        newCursor = { lat: gridCursor.lat, lon: gridCursor.lon - lonStep };
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        newCursor = { lat: gridCursor.lat, lon: gridCursor.lon + lonStep };
      } else if (e.key === "Home") {
        e.preventDefault();
        newCursor = { ...place.coord };
      } else if (e.key === "Enter") {
        // Re-announce full context at current position.
        e.preventDefault();
        const { probe, alertsHere } = probeAtCursor(gridCursor);
        void announcer.announce(
          buildFullGridAnnouncement(gridCursor, place, gridCtx.location, probe, alertsHere),
          "assertive"
        );
        return;
      }

      if (newCursor) {
        setGridCursor(newCursor);
        // Immediate: probe radar + alerts (no API call).
        const { probe, alertsHere } = probeAtCursor(newCursor);
        // Brief announcement on each keypress.
        void announcer.announce(
          buildBriefGridAnnouncement(newCursor, place, probe, alertsHere),
          "polite"
        );
        // Debounced: reverse geocode for full location context.
        scheduleGeocode(newCursor);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, storms, alerts, stormIdx, alertIdx, gridCursor, gridStepMi, settings, gridCtx.location, place, announcer, probeAtCursor, scheduleGeocode]);

  // Announce mode on activation.
  useEffect(() => {
    if (!active) return;
    const stormCount = storms.length;
    const alertCount = alerts.length;
    void announcer.announce(
      `Map navigation for ${place.name}. ${stormCount} storm${stormCount === 1 ? "" : "s"}, ` +
      `${alertCount} alert${alertCount === 1 ? "" : "s"}. ` +
      `Currently in ${MODE_LABELS[mode]} mode. Tab to switch modes. ` +
      `Arrow keys to navigate. Escape or N to return to scenes.`,
      "polite"
    );
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Probe initial cursor position when entering grid mode.
  useEffect(() => {
    if (mode === "grid" && active) {
      probeAtCursor(gridCursor);
      scheduleGeocode(gridCursor);
    }
  }, [mode, active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section aria-label={`Map navigation for ${place.name}`}>
      <RadarMapCanvas
        center={place.coord}
        storms={storms}
        rainviewer={rainviewer}
        alerts={alerts}
        highlightCoord={highlightCoord}
        className="ws-radar-map-nav"
      />

      <div className="ws-map-nav-panel">
        <div className="ws-map-nav-tabs" aria-hidden="true">
          {NAV_MODES.map((m) => (
            <span
              key={m}
              className={`ws-map-nav-tab ${m === mode ? "ws-map-nav-tab-active" : ""}`}
            >
              {MODE_LABELS[m]}
            </span>
          ))}
        </div>

        {mode === "storms" && (
          <StormNavPanel storms={storms} focusIdx={stormIdx} />
        )}
        {mode === "alerts" && (
          <AlertNavPanel alerts={alerts} focusIdx={alertIdx} />
        )}
        {mode === "grid" && (
          <GridNavPanel cursor={gridCursor} place={place} ctx={gridCtx} />
        )}
      </div>
    </section>
  );
}

// ─── Sub-panels ───

function StormNavPanel({ storms, focusIdx }: { storms: TrackedStorm[]; focusIdx: number }) {
  if (storms.length === 0) {
    return (
      <p className="ws-map-nav-empty">
        No storms detected within radar range. All clear.
      </p>
    );
  }
  return (
    <div className="ws-map-nav-list" role="listbox" aria-label="Storms near you">
      <p style={{ color: "var(--ws-text-dim)", margin: "0 0 8px" }}>
        {storms.length} storm{storms.length === 1 ? "" : "s"} detected. Up/down to navigate, Enter for details.
      </p>
      {storms.map((s, i) => (
        <div
          key={s.id}
          className="ws-map-nav-item"
          role="option"
          aria-selected={i === focusIdx}
          data-focused={i === focusIdx}
        >
          <span className="ws-map-nav-item-primary">
            <span className="ws-map-nav-dot" style={{ background: stormDotColor(s.band) }} />
            {intensityLabel(s.band)} — {Math.round(s.distanceFromHomeMi)} mi {bearingShort(s.bearingFromHomeDeg)}
          </span>
          <span className="ws-map-nav-item-secondary">
            {s.movementMph != null && s.movementMph > 0 && s.movementDeg != null
              ? `Moving ${bearingShort(s.movementDeg)} at ${s.movementMph} mph`
              : s.movementMph === 0
              ? "Stationary"
              : ""}
            {s.etaMinutes != null ? ` · ETA ${s.etaMinutes} min` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function AlertNavPanel({ alerts, focusIdx }: { alerts: WeatherAlert[]; focusIdx: number }) {
  if (alerts.length === 0) {
    return (
      <p className="ws-map-nav-empty">
        No active weather alerts for this area.
      </p>
    );
  }
  return (
    <div className="ws-map-nav-list" role="listbox" aria-label="Active weather alerts">
      <p style={{ color: "var(--ws-text-dim)", margin: "0 0 8px" }}>
        {alerts.length} active alert{alerts.length === 1 ? "" : "s"}. Up/down to navigate, Enter for full description.
      </p>
      {alerts.map((a, i) => (
        <div
          key={a.id}
          className="ws-map-nav-item"
          role="option"
          aria-selected={i === focusIdx}
          data-focused={i === focusIdx}
        >
          <span className="ws-map-nav-item-primary">
            <span className="ws-map-nav-dot" style={{ background: severityColor(a.severity) }} />
            {a.event}
          </span>
          <span className="ws-map-nav-item-secondary">
            {a.affectedAreaDescription}
            {" · Expires "}
            {a.expires.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>
        </div>
      ))}
    </div>
  );
}

function GridNavPanel({
  cursor,
  place,
  ctx
}: {
  cursor: LatLon;
  place: Place;
  ctx: GridContext;
}) {
  const { location, locationLoading, probe, alertsAtCursor } = ctx;

  return (
    <div className="ws-map-nav-grid">
      <p style={{ color: "var(--ws-text-dim)", margin: "0 0 12px" }}>
        Arrow keys move ~10 miles per press. Home returns to your location. Enter repeats full context.
      </p>

      <div className="ws-map-nav-grid-rows">
        {/* Location */}
        <div className="ws-map-nav-grid-row">
          <span className="ws-map-nav-grid-label">Location</span>
          <span className="ws-map-nav-grid-value">
            {locationLoading
              ? "Locating…"
              : location
              ? `Near ${location.city}, ${location.state}`
              : "—"}
          </span>
        </div>

        {/* County */}
        {location?.county && (
          <div className="ws-map-nav-grid-row">
            <span className="ws-map-nav-grid-label">County</span>
            <span className="ws-map-nav-grid-value ws-map-nav-grid-value-sm">
              {location.county}
            </span>
          </div>
        )}

        {/* From home */}
        <div className="ws-map-nav-grid-row">
          <span className="ws-map-nav-grid-label">From {place.name}</span>
          <span className="ws-map-nav-grid-value">
            {describeRelativePosition(cursor, place.coord)}
          </span>
        </div>

        {/* Precipitation */}
        <div className="ws-map-nav-grid-row">
          <span className="ws-map-nav-grid-label">Precipitation</span>
          <span className="ws-map-nav-grid-value" style={{ color: probe.cell ? precipColor(probe.cell.band) : "var(--ws-text-dim)" }}>
            {probe.cell
              ? `${intensityLabel(probe.cell.band)} — ${probe.cell.mmPerHour.toFixed(1)} mm/hr`
              : "Clear"}
          </span>
        </div>

        {/* Nearest storm */}
        {probe.nearestStorm && (
          <div className="ws-map-nav-grid-row">
            <span className="ws-map-nav-grid-label">Nearest Storm</span>
            <span className="ws-map-nav-grid-value ws-map-nav-grid-value-sm">
              {intensityLabel(probe.nearestStorm.band)} — {probe.stormDistanceMi} mi away
              {probe.nearestStorm.movementMph != null && probe.nearestStorm.movementMph > 0 && probe.nearestStorm.movementDeg != null
                ? `, moving ${bearingShort(probe.nearestStorm.movementDeg)} at ${probe.nearestStorm.movementMph} mph`
                : ""}
            </span>
          </div>
        )}

        {/* Alerts at cursor */}
        <div className="ws-map-nav-grid-row">
          <span className="ws-map-nav-grid-label">Alerts Here</span>
          <span
            className="ws-map-nav-grid-value"
            style={{ color: alertsAtCursor.length > 0 ? "var(--ws-alert)" : "var(--ws-text-dim)" }}
          >
            {alertsAtCursor.length === 0
              ? "None"
              : alertsAtCursor.map((a) => a.event).join(", ")}
          </span>
        </div>

        {/* Coordinates */}
        <div className="ws-map-nav-grid-row">
          <span className="ws-map-nav-grid-label">Coordinates</span>
          <span className="ws-map-nav-grid-value ws-map-nav-grid-value-sm">
            {Math.abs(cursor.lat).toFixed(2)}°{cursor.lat >= 0 ? "N" : "S"},{" "}
            {Math.abs(cursor.lon).toFixed(2)}°{cursor.lon >= 0 ? "E" : "W"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Grid announcements ───

/**
 * Brief announcement on every arrow keypress. Immediate — no API call.
 * Tells the user direction from home + precipitation + alerts.
 */
function buildBriefGridAnnouncement(
  cursor: LatLon,
  place: Place,
  probe: RadarProbeResult,
  alertsHere: WeatherAlert[]
): string {
  const parts: string[] = [];
  parts.push(describeRelativePosition(cursor, place.coord) + ".");

  if (probe.cell) {
    parts.push(`${intensityLabel(probe.cell.band)}.`);
  } else {
    parts.push("Clear.");
  }

  if (alertsHere.length > 0) {
    parts.push(alertsHere.map((a) => a.event).join(", ") + ".");
  }

  return parts.join(" ");
}

/**
 * Full announcement after the geocode settles (~400ms after last keypress).
 * Includes city/county, precipitation rate, nearby storm details, and alerts.
 */
function buildFullGridAnnouncement(
  cursor: LatLon,
  place: Place,
  location: LocationInfo | null,
  probe: RadarProbeResult,
  alertsHere: WeatherAlert[]
): string {
  const parts: string[] = [];

  // Location.
  if (location) {
    const countyPart = location.county ? `, ${location.county} County` : "";
    parts.push(`Near ${location.city}${countyPart}, ${location.state}.`);
  }

  // Distance from home.
  parts.push(`${describeRelativePosition(cursor, place.coord)} of ${place.name}.`);

  // Precipitation.
  if (probe.cell) {
    parts.push(
      `${intensityLabel(probe.cell.band)} at ${probe.cell.mmPerHour.toFixed(1)} millimeters per hour.`
    );
  } else {
    parts.push("No precipitation at this location.");
  }

  // Nearest storm.
  if (probe.nearestStorm && probe.stormDistanceMi != null) {
    const s = probe.nearestStorm;
    let stormDesc = `Nearest storm: ${intensityLabel(s.band)}, ${probe.stormDistanceMi} miles away`;
    if (s.movementMph != null && s.movementMph > 0 && s.movementDeg != null) {
      stormDesc += `, moving ${bearingLong(s.movementDeg)} at ${s.movementMph} miles per hour`;
    } else if (s.movementMph === 0) {
      stormDesc += ", stationary";
    }
    parts.push(stormDesc + ".");
  }

  // Alerts.
  if (alertsHere.length > 0) {
    const alertText = alertsHere
      .map((a) => `${a.event}: ${a.headline}`)
      .join(". ");
    parts.push(`Active alerts: ${alertText}.`);
  } else {
    parts.push("No active alerts at this location.");
  }

  return parts.join(" ");
}

// ─── Storm/Alert description helpers ───

function describeStormNav(storm: TrackedStorm, i: number): string {
  const intensity = intensityLabel(storm.band);
  const distance = `${Math.round(storm.distanceFromHomeMi)} miles`;
  const direction = bearingLong(storm.bearingFromHomeDeg);
  let movement = "";
  if (storm.movementMph != null && storm.movementMph > 0 && storm.movementDeg != null) {
    movement = `, moving ${bearingLong(storm.movementDeg)} at ${storm.movementMph} miles per hour`;
  } else if (storm.movementMph === 0) {
    movement = ", stationary";
  }
  const eta = storm.etaMinutes != null ? `, ${storm.etaMinutes} minutes away` : "";
  return `Storm ${i + 1}. ${intensity}, ${distance} to the ${direction}${movement}${eta}.`;
}

function describeStormDetail(storm: TrackedStorm, i: number): string {
  const parts: string[] = [`Storm ${i + 1} details.`];
  parts.push(`${intensityLabel(storm.band)} at ${Math.round(storm.distanceFromHomeMi)} miles to the ${bearingLong(storm.bearingFromHomeDeg)}.`);
  if (storm.peakMmPerHour > 0) {
    parts.push(`Peak rate ${storm.peakMmPerHour.toFixed(1)} millimeters per hour.`);
  }
  if (storm.radiusMi > 0) {
    parts.push(`Radius approximately ${storm.radiusMi.toFixed(1)} miles.`);
  }
  if (storm.movementMph != null && storm.movementMph > 0 && storm.movementDeg != null) {
    parts.push(`Moving ${bearingLong(storm.movementDeg)} at ${storm.movementMph} miles per hour.`);
  } else if (storm.movementMph === 0) {
    parts.push("Stationary.");
  }
  if (storm.etaMinutes != null) {
    parts.push(`Estimated ${storm.etaMinutes} minutes to reach your location.`);
  }
  return parts.join(" ");
}

function describeAlertNav(alert: WeatherAlert, i: number): string {
  return `Alert ${i + 1}. ${alert.event}. ${alert.headline}. Areas: ${alert.affectedAreaDescription}.`;
}

function describeAlertDetail(alert: WeatherAlert): string {
  const parts: string[] = [];
  parts.push(`${alert.event}.`);
  parts.push(alert.headline);
  parts.push(`Severity: ${alert.severity}. Urgency: ${alert.urgency}. Certainty: ${alert.certainty}.`);
  parts.push(`Areas affected: ${alert.affectedAreaDescription}.`);
  parts.push(`Effective: ${alert.effective.toLocaleString()}.`);
  parts.push(`Expires: ${alert.expires.toLocaleString()}.`);
  if (alert.instruction) {
    parts.push(`Instructions: ${alert.instruction}`);
  } else {
    parts.push(alert.description.slice(0, 300));
  }
  return parts.join(" ");
}

function describeRelativePosition(a: LatLon, b: LatLon): string {
  const dlat = a.lat - b.lat;
  const dlon = a.lon - b.lon;
  const nsMiles = Math.abs(dlat) * 69;
  const ewMiles = Math.abs(dlon) * 69 * Math.cos((b.lat * Math.PI) / 180);
  const totalMiles = Math.round(Math.sqrt(nsMiles ** 2 + ewMiles ** 2));
  if (totalMiles < 2) return "At home";
  const ns = dlat > 0.01 ? "north" : dlat < -0.01 ? "south" : "";
  const ew = dlon > 0.01 ? "east" : dlon < -0.01 ? "west" : "";
  const dir = [ns, ew].filter(Boolean).join("-") || "nearby";
  return `${totalMiles} miles ${dir}`;
}

function polygonCentroid(poly: number[][]): LatLon {
  let latSum = 0;
  let lonSum = 0;
  for (const pt of poly) {
    lonSum += pt[0];
    latSum += pt[1];
  }
  return { lat: latSum / poly.length, lon: lonSum / poly.length };
}

// ─── Formatting ───

function intensityLabel(band: string): string {
  switch (band) {
    case "trace":      return "Drizzle";
    case "light":      return "Light rain";
    case "moderate":   return "Moderate rain";
    case "heavy":      return "Heavy rain";
    case "very-heavy": return "Very heavy rain";
    case "extreme":    return "Extreme rain";
    default:           return "Precipitation";
  }
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

function stormDotColor(band: string): string {
  switch (band) {
    case "trace":      return "#90ee90";
    case "light":      return "#00cc00";
    case "moderate":   return "#ffcc00";
    case "heavy":      return "#ff6600";
    case "very-heavy": return "#ff0000";
    case "extreme":    return "#cc00cc";
    default:           return "#aaaaaa";
  }
}

function precipColor(band: string): string {
  switch (band) {
    case "trace":      return "#90ee90";
    case "light":      return "#66dd66";
    case "moderate":   return "#ffcc00";
    case "heavy":      return "#ff6600";
    case "very-heavy": return "#ff3333";
    case "extreme":    return "#cc00cc";
    default:           return "var(--ws-text-dim)";
  }
}

function severityColor(severity: string): string {
  switch (severity) {
    case "Extreme": return "#ff0000";
    case "Severe":  return "#ff6600";
    case "Moderate": return "#ffcc00";
    case "Minor":   return "#66cc00";
    default:        return "#aaaaaa";
  }
}
