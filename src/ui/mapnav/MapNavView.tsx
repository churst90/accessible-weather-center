import { useEffect, useRef, useState, useCallback } from "react";
import type { Place, WeatherAlert, LatLon, LocationInfo } from "../../core/types";
import type { TrackedStorm } from "../../core/radar/StormTracker";
import type { StormScanner, RadarProbeResult } from "../../core/radar/StormScanner";
import type { RainViewerClient } from "../../core/weather/RainViewerClient";
import type { WeatherService } from "../../core/weather/WeatherService";
import type { AnnouncementQueue } from "../../a11y/AnnouncementQueue";
import { GRID_STEP_PRESETS_MI, type SettingsStore } from "../../core/settings/SettingsStore";
import { pointInPolygon } from "../../core/radar/TileMath";
import { bandInfo } from "../../core/radar/IntensityLegend";
import { isModalOpen } from "../../a11y/modality";
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
  /**
   * The authoritative grid cursor.
   *
   * Not derived from state: the key handler both reads and writes it, and a
   * React state value read from the handler's closure is only as fresh as
   * the last committed render. Holding an arrow key fires far faster than
   * React commits, so successive presses all stepped off the same stale
   * origin — the cursor crawled while the announcements repeated the same
   * position ("at home, at home, at home" long after leaving home). The ref
   * moves synchronously with the keystroke; `gridCursor` state exists only
   * to re-render the panel and the map highlight.
   */
  const gridCursorRef = useRef<LatLon>({ ...place.coord });
  const gridCtxRef = useRef(gridCtx);
  gridCtxRef.current = gridCtx;
  const geoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Last location name spoken, so the geocode follow-up stays quiet when
   *  the cursor moved but is still in the same town. */
  const lastSpokenPlaceRef = useRef<string | null>(null);
  // Selection indices, same reasoning as the cursor: read and written from
  // the key handler, so they cannot live behind a render commit.
  const stormIdxRef = useRef(0);
  stormIdxRef.current = stormIdx;
  const alertIdxRef = useRef(0);
  alertIdxRef.current = alertIdx;

  // Live storm list: subscribe to the scanner instead of reading a one-shot
  // snapshot at render — otherwise the list, canvas markers, and announced
  // data freeze at whatever the radar looked like when the mode opened.
  const [storms, setStorms] = useState<TrackedStorm[]>(() => stormScanner.getSnapshot().storms);
  useEffect(() => {
    if (!active) return;
    setStorms(stormScanner.getSnapshot().storms);
    return stormScanner.subscribe((e) => {
      if (e.kind === "updated" && e.all) setStorms(e.all);
    });
  }, [active, stormScanner]);

  // Keep the selection valid when the list shrinks between scans.
  useEffect(() => {
    setStormIdx((i) => (storms.length === 0 ? 0 : Math.min(i, storms.length - 1)));
  }, [storms.length]);

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
    gridCursorRef.current = { ...place.coord };
    lastSpokenPlaceRef.current = null;
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
   *
   * This used to re-speak the ENTIRE context when the geocode landed —
   * position, precipitation and alerts a second time, on top of the brief
   * readout the keypress had already given. Every arrow press said
   * everything twice, 400ms apart. The lookup only ever adds one fact the
   * keypress couldn't know (which town the cursor is over), so that is the
   * only thing it announces now, and only when the town actually changed.
   * Enter still reads the complete picture on demand.
   */
  const scheduleGeocode = useCallback(
    (cursor: LatLon, { silent = false }: { silent?: boolean } = {}) => {
      if (geoTimerRef.current) clearTimeout(geoTimerRef.current);
      setGridCtx((prev) => ({ ...prev, locationLoading: true }));
      geoTimerRef.current = setTimeout(async () => {
        try {
          const loc = await weather.reverseGeocode(cursor);
          // Only apply if the cursor hasn't moved since we started.
          const current = gridCursorRef.current;
          if (
            Math.abs(current.lat - cursor.lat) >= 0.001 ||
            Math.abs(current.lon - cursor.lon) >= 0.001
          ) {
            return;
          }
          setGridCtx((p) => ({ ...p, location: loc, locationLoading: false }));
          const spoken = describeLocation(loc);
          if (!silent && spoken && spoken !== lastSpokenPlaceRef.current) {
            lastSpokenPlaceRef.current = spoken;
            announcer.announce(spoken, "navigation");
          } else if (spoken) {
            lastSpokenPlaceRef.current = spoken;
          }
        } catch {
          setGridCtx((prev) => ({ ...prev, locationLoading: false }));
        }
      }, 400);
    },
    [weather, announcer]
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
      if (isModalOpen()) return;
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

    /**
     * Walk a list and speak the landing item.
     *
     * The announcement deliberately happens HERE and not inside the
     * setState updater it used to live in. React may invoke an updater more
     * than once for a single call — StrictMode does so on every render in
     * development — which meant one arrow press queued the same sentence
     * twice, and the second copy replaced the first in the live region
     * before a screen reader had finished the first word.
     *
     * Readouts go to the `navigation` channel, which interrupts. On the
     * polite channel they queued behind scene narration and each other, so
     * walking four storms spoke storm one, then storm four.
     */
    const walkList = <T,>(
      e: KeyboardEvent,
      items: T[],
      idxRef: { current: number },
      setIdx: (i: number) => void,
      describeNav: (item: T, i: number, total: number) => string,
      describeDetail: (item: T, i: number) => string,
      emptyMessage: string
    ): void => {
      const nav = ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key);
      if (!nav && e.key !== "Enter") return;
      e.preventDefault();
      if (items.length === 0) {
        // Silence here is indistinguishable from a dropped keystroke.
        announcer.announce(emptyMessage, "navigation");
        return;
      }
      if (e.key === "Enter") {
        const i = Math.min(Math.max(idxRef.current, 0), items.length - 1);
        announcer.announce(describeDetail(items[i], i), "assertive");
        return;
      }
      const cur = Math.min(Math.max(idxRef.current, 0), items.length - 1);
      const next =
        e.key === "ArrowDown" ? Math.min(cur + 1, items.length - 1)
        : e.key === "ArrowUp" ? Math.max(cur - 1, 0)
        : e.key === "Home" ? 0
        : items.length - 1;
      idxRef.current = next;
      setIdx(next);
      // Speaks even when the press clamped at an end — an unmoved cursor
      // still needs to confirm where it is.
      announcer.announce(describeNav(items[next], next, items.length), "navigation");
    };

    const handleStormKeys = (e: KeyboardEvent) => {
      walkList(
        e, storms, stormIdxRef, setStormIdx,
        describeStormNav, describeStormDetail,
        "No storms detected within radar range. All clear."
      );
    };

    const handleAlertKeys = (e: KeyboardEvent) => {
      walkList(
        e, alerts, alertIdxRef, setAlertIdx,
        describeAlertNav, (a) => describeAlertDetail(a),
        "No active weather alerts for this area."
      );
    };

    const handleGridKeys = (e: KeyboardEvent) => {
      // Read the cursor from the ref, never from render state — see the
      // gridCursorRef comment. `cursor` here is always where the previous
      // keystroke actually left us, even if React hasn't re-rendered yet.
      const cursor = gridCursorRef.current;
      // Convert the mile step to degrees at the cursor's latitude so a
      // "5 mile" press really moves ~5 miles east-west too (a fixed degree
      // step stretches with latitude).
      const latStep = gridStepMi / 69;
      const lonStep = gridStepMi / (69.172 * Math.max(0.2, Math.cos((cursor.lat * Math.PI) / 180)));
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
        announcer.announce(
          `Grid step: ${next} mile${next === 1 ? "" : "s"} per press.`,
          "navigation"
        );
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        newCursor = { lat: cursor.lat + latStep, lon: cursor.lon };
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        newCursor = { lat: cursor.lat - latStep, lon: cursor.lon };
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        newCursor = { lat: cursor.lat, lon: cursor.lon - lonStep };
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        newCursor = { lat: cursor.lat, lon: cursor.lon + lonStep };
      } else if (e.key === "Home") {
        e.preventDefault();
        newCursor = { ...place.coord };
      } else if (e.key === "Enter") {
        // Re-announce full context at current position.
        e.preventDefault();
        const { probe, alertsHere } = probeAtCursor(cursor);
        announcer.announce(
          buildFullGridAnnouncement(cursor, place, gridCtxRef.current.location, probe, alertsHere),
          "assertive"
        );
        return;
      }

      if (newCursor) {
        // Ref first, synchronously: the next keystroke may arrive before
        // React has committed this render.
        gridCursorRef.current = newCursor;
        setGridCursor(newCursor);
        // Immediate: probe radar + alerts (no API call, no debounce).
        const { probe, alertsHere } = probeAtCursor(newCursor);
        // Exactly one readout per press. The geocode follow-up adds the
        // town name later, and only if it changed.
        announcer.announce(
          buildBriefGridAnnouncement(newCursor, place, probe, alertsHere),
          "navigation"
        );
        scheduleGeocode(newCursor);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // The cursor and both selection indices are read from refs, so they are
    // deliberately absent from this list — re-attaching the listener on
    // every cursor move was churn, and the closure it captured was stale
    // for exactly as long as it took React to commit.
  }, [active, storms, alerts, gridStepMi, settings, place, announcer, probeAtCursor, scheduleGeocode]);

  // Announce mode on activation. This is the ONLY entry announcement — the
  // N shortcut in App.tsx deliberately stays silent so the two don't stack.
  useEffect(() => {
    if (!active) return;
    const stormCount = storms.length;
    const alertCount = alerts.length;
    announcer.announce(
      `Map navigation for ${place.name}. ${stormCount} storm${stormCount === 1 ? "" : "s"}, ` +
      `${alertCount} alert${alertCount === 1 ? "" : "s"}. ` +
      `Currently in ${MODE_LABELS[mode]} mode. Tab to switch modes. ` +
      `Arrow keys to navigate. Escape or N to return to scenes.`,
      "assertive"
    );
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Probe the initial cursor position when entering grid mode. Silent: the
  // Tab handler has just announced "Grid Explorer mode" and the cursor is
  // at home, which the user already knows — speaking the town name on top
  // of the mode change is the kind of pile-up that makes the mode sound
  // like it's repeating itself.
  useEffect(() => {
    if (mode === "grid" && active) {
      probeAtCursor(gridCursorRef.current);
      scheduleGeocode(gridCursorRef.current, { silent: true });
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
          <GridNavPanel cursor={gridCursor} place={place} ctx={gridCtx} stepMi={gridStepMi} />
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
          // The visible text is telegraphic ("Heavy Rain — 12 mi NE"), which
          // is all a sighted user needs next to the map but leaves a screen
          // reader reading the list itself with nothing but the position
          // ("1 of 4"). The label carries the same sentence the arrow-key
          // readout speaks.
          aria-label={describeStormNav(s, i, storms.length)}
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
          aria-label={describeAlertNav(a, i, alerts.length)}
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
  ctx,
  stepMi
}: {
  cursor: LatLon;
  place: Place;
  ctx: GridContext;
  stepMi: number;
}) {
  const { location, locationLoading, probe, alertsAtCursor } = ctx;

  return (
    <div className="ws-map-nav-grid">
      <p style={{ color: "var(--ws-text-dim)", margin: "0 0 12px" }}>
        Arrow keys move {stepMi} mile{stepMi === 1 ? "" : "s"} per press; left and right
        bracket change the step. Home returns to your location. Enter repeats full context.
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
 * The one readout every arrow keypress produces. Immediate — no API call,
 * no debounce. Distance and direction from home, what's falling there, and
 * any alert covering the spot. The town name arrives separately once the
 * reverse geocode settles, and only when it changed.
 */
function buildBriefGridAnnouncement(
  cursor: LatLon,
  place: Place,
  probe: RadarProbeResult,
  alertsHere: WeatherAlert[]
): string {
  const parts: string[] = [];
  parts.push(positionPhrase(cursor, place) + ".");

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
 * Everything known about the cursor's position. Spoken only on demand
 * (Enter) — it is far too long to fire on every arrow press, which is what
 * it used to do on a 400ms delay, on top of the brief readout.
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
  const spokenLocation = describeLocation(location);
  if (spokenLocation) parts.push(spokenLocation);

  // Distance from home.
  parts.push(positionPhrase(cursor, place) + ".");

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

/**
 * What a storm sounds like when you land on it.
 *
 * The position goes at the END, after the content. Leading with "Storm 2 of
 * 4" means a user walking the list hears the ordinal — the one part they
 * already know — before anything that distinguishes one storm from another,
 * and has to sit through it on every press.
 */
function describeStormNav(storm: TrackedStorm, i: number, total: number): string {
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
  return `${intensity}, ${distance} to the ${direction}${movement}${eta}. ${i + 1} of ${total}.`;
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

function describeAlertNav(alert: WeatherAlert, i: number, total: number): string {
  return `${alert.event}. ${alert.headline}. Areas: ${alert.affectedAreaDescription}. ${i + 1} of ${total}.`;
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

/**
 * Where the cursor is, relative to home.
 *
 * The "at home" answer used to cover everything inside two miles, which on
 * the 1-mile grid step meant the first press off home — and, going back and
 * forth, several presses in a row — all reported "at home". The cursor was
 * moving and the readout insisted it wasn't. Now only a cursor genuinely on
 * top of home says so; anything else gets a distance, rounded to a tenth of
 * a mile when it's under ten miles so small steps are visibly different.
 */
function describeRelativePosition(a: LatLon, b: LatLon): string {
  const dlat = a.lat - b.lat;
  const dlon = a.lon - b.lon;
  const nsMiles = Math.abs(dlat) * 69;
  const ewMiles = Math.abs(dlon) * 69 * Math.cos((b.lat * Math.PI) / 180);
  const totalMiles = Math.sqrt(nsMiles ** 2 + ewMiles ** 2);
  if (totalMiles < 0.3) return "At home";
  const ns = dlat > 0 ? "north" : "south";
  const ew = dlon > 0 ? "east" : "west";
  // Only name an axis the cursor has actually travelled along, so a purely
  // northward walk says "north", not "north-east" from float dust.
  const dir = [nsMiles >= 0.2 ? ns : "", ewMiles >= 0.2 ? ew : ""].filter(Boolean).join("-") || "nearby";
  const distance =
    totalMiles < 10
      ? `${totalMiles.toFixed(1)} mile${totalMiles.toFixed(1) === "1.0" ? "" : "s"}`
      : `${Math.round(totalMiles)} miles`;
  return `${distance} ${dir}`;
}

/**
 * The position phrase, with home named. Kept separate from
 * describeRelativePosition because "At home" needs to read as a state, not
 * as a distance with a preposition bolted on — the old wording produced
 * "At home of Springfield."
 */
function positionPhrase(cursor: LatLon, place: Place): string {
  const rel = describeRelativePosition(cursor, place.coord);
  return rel === "At home" ? `At ${place.name}` : `${rel} of ${place.name}`;
}

/** The one fact a reverse geocode adds that the keypress couldn't know. */
function describeLocation(loc: LocationInfo | null): string | null {
  if (!loc) return null;
  const county = loc.county ? `, ${loc.county} County` : "";
  return `Near ${loc.city}${county}, ${loc.state}.`;
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

// Band labels/colors come from IntensityLegend — the one source of truth —
// so the spoken words, panel text, dots, and canvas legend can never drift
// apart again.
function intensityLabel(band: string): string {
  return bandInfo(band).label;
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
  return bandInfo(band).color;
}

function precipColor(band: string): string {
  return band === "none" ? "var(--ws-text-dim)" : bandInfo(band).color;
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
