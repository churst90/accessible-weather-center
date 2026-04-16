import type { LatLon, Place, RadarCell, RadarFrame } from "../types";
import type { RainViewerClient } from "../weather/RainViewerClient";
import { sampleFrame, type SampleOptions } from "./RainViewerSampler";
import { clusterStorms } from "./StormClusterer";
import { StormTracker, type TrackedStorm, type TrackResult } from "./StormTracker";
import { haversineMiles } from "./TileMath";

/**
 * Live radar + storm observer.
 *
 * Responsibilities
 * ----------------
 *   1. Poll RainViewer's manifest on a schedule.
 *   2. Sample the latest past frame into a RadarFrame.
 *   3. Cluster cells into storms and track them across frames.
 *   4. Maintain "what storms exist near home right now" as observable state.
 *   5. Emit events the rest of the app can subscribe to:
 *        - "updated"         every successful scan
 *        - "storm-new"       a storm we didn't see last frame
 *        - "storm-approaching" storm within announce radius + ETA
 *        - "storm-intensified" storm stepped up one or more bands
 *
 * This service is deliberately the ONLY caller of the sampler, clusterer,
 * and tracker. Scenes read its latest state; they never start their own
 * fetches. That way the whole app agrees on one "current radar world" and
 * we don't hammer RainViewer once per scene entry.
 *
 * NOTE on "alerts": this is a Tier 2 source (nowcasts). Official NWS
 * warnings (tornado, severe thunderstorm, flash flood) still come from the
 * NWS alerts API in App.tsx. Those are authoritative and legally required;
 * these are the eyes-on-the-radar companion.
 */

export type StormEventKind =
  | "updated"
  | "storm-new"
  | "storm-approaching"
  | "storm-intensified";

export interface StormEvent {
  kind: StormEventKind;
  storm?: TrackedStorm;
  /** Present on "updated" — the full tracked list after this scan. */
  all?: TrackedStorm[];
  /** Non-null if the scan failed with a recoverable error. */
  error?: string;
}

export interface StormScannerSnapshot {
  capturedAt: Date | null;
  storms: TrackedStorm[];
  /** The most recent raw radar frame — used for point-level precipitation queries. */
  lastFrame: RadarFrame | null;
  /** ISO timestamp of the most recent failed fetch, if any. */
  lastError: { at: Date; message: string } | null;
}

/** Result of probing a specific point on the radar. */
export interface RadarProbeResult {
  /** The nearest radar cell within the search radius, or null if clear. */
  cell: RadarCell | null;
  /** Distance from the probe point to the nearest cell, in miles. */
  distanceMi: number | null;
  /** The nearest tracked storm, if one is within range. */
  nearestStorm: TrackedStorm | null;
  /** Distance to the nearest storm centroid. */
  stormDistanceMi: number | null;
}

export interface StormScannerOptions {
  /** Ms between scans. Default 2 minutes. */
  pollMs?: number;
  /** Radius around home we care about, in miles. Default 150. */
  radiusMi?: number;
  /** Sampling zoom. Default 7 (≈ 50 km tile). */
  zoom?: number;
  /** Sampling pixel step. Default 4. */
  stepPx?: number;
  /**
   * Only announce approaching storms that reach this proximity. Default 80
   * miles. "Approaching" requires a movement vector pointed at home.
   */
  approachRadiusMi?: number;
}

export class StormScanner {
  private place: Place | null = null;
  private opts: Required<StormScannerOptions>;
  private tracker = new StormTracker();
  private snapshot: StormScannerSnapshot = {
    capturedAt: null,
    storms: [],
    lastFrame: null,
    lastError: null
  };
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(e: StormEvent) => void>();
  private lastAnnouncedIds = new Set<string>();
  private inflight: Promise<void> | null = null;

  constructor(
    private readonly client: RainViewerClient,
    options: StormScannerOptions = {}
  ) {
    this.opts = {
      pollMs: options.pollMs ?? 2 * 60_000,
      radiusMi: options.radiusMi ?? 150,
      zoom: options.zoom ?? 7,
      stepPx: options.stepPx ?? 4,
      approachRadiusMi: options.approachRadiusMi ?? 80
    };
  }

  /** Current observable snapshot. Safe to call from React render code. */
  getSnapshot(): StormScannerSnapshot {
    return this.snapshot;
  }

  /**
   * Probe the last radar frame at a specific point. Returns the nearest
   * radar cell (precipitation data) and the nearest tracked storm.
   * Search radius for cells is 10 miles; for storms, 30 miles.
   */
  probeAt(coord: LatLon): RadarProbeResult {
    const snap = this.snapshot;
    let nearestCell: RadarCell | null = null;
    let cellDist: number | null = null;

    if (snap.lastFrame) {
      let bestDist = Infinity;
      for (const cell of snap.lastFrame.cells) {
        const d = haversineMiles(coord, { lat: cell.lat, lon: cell.lon });
        if (d < bestDist && d <= 10) {
          bestDist = d;
          nearestCell = cell;
          cellDist = Math.round(d * 10) / 10;
        }
      }
    }

    let nearestStorm: TrackedStorm | null = null;
    let stormDist: number | null = null;
    let bestStormDist = Infinity;
    for (const storm of snap.storms) {
      const d = haversineMiles(coord, storm.centroid);
      if (d < bestStormDist && d <= 30) {
        bestStormDist = d;
        nearestStorm = storm;
        stormDist = Math.round(d * 10) / 10;
      }
    }

    return {
      cell: nearestCell,
      distanceMi: cellDist,
      nearestStorm,
      stormDistanceMi: stormDist
    };
  }

  subscribe(fn: (e: StormEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Swap the active home place. Wipes the tracker so storms from the old
   * box don't get incorrectly matched to the new one, clears the snapshot,
   * and triggers a fresh scan.
   */
  setPlace(place: Place): void {
    if (this.place && place.id === this.place.id) return;
    this.place = place;
    this.tracker.reset();
    this.lastAnnouncedIds.clear();
    this.snapshot = { capturedAt: null, storms: [], lastFrame: null, lastError: null };
    void this.refresh();
  }

  /** Begin the polling loop. Safe to call repeatedly; it no-ops if running. */
  start(place: Place): void {
    if (this.timer) return;
    this.place = place;
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), this.opts.pollMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Force an immediate scan. Safe to call while the timer is running; the
   *  scanner collapses concurrent refreshes into one in-flight scan. */
  async refresh(): Promise<void> {
    if (this.inflight) return this.inflight;
    if (!this.place) return;
    this.inflight = this.runScan().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async runScan(): Promise<void> {
    if (!this.place) return;
    try {
      const manifest = await this.client.getManifest();
      const past = manifest.radar.past;
      if (!past || past.length === 0) {
        this.emit({ kind: "updated", all: [] });
        return;
      }
      const frame = past[past.length - 1];

      const sampleOpts: SampleOptions = {
        zoom: this.opts.zoom,
        stepPx: this.opts.stepPx,
        center: this.place.coord,
        radiusMi: this.opts.radiusMi
      };
      const radarFrame = await sampleFrame(this.client, manifest, frame, sampleOpts);
      const clustered = clusterStorms(radarFrame, this.place.coord);
      const tracked: TrackResult = this.tracker.track(clustered, this.place.coord);

      this.snapshot = {
        capturedAt: tracked.capturedAt,
        storms: tracked.storms,
        lastFrame: radarFrame,
        lastError: null
      };
      this.emit({ kind: "updated", all: tracked.storms });
      this.emitPerStormEvents(tracked.storms);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.snapshot = {
        ...this.snapshot,
        lastError: { at: new Date(), message }
      };
      this.emit({ kind: "updated", all: this.snapshot.storms, error: message });
    }
  }

  /**
   * Fan out the per-storm events. We dedupe on storm id + event kind so
   * the same storm doesn't generate a "new" announcement on every scan.
   */
  private emitPerStormEvents(storms: TrackedStorm[]): void {
    const seen = new Set<string>();
    for (const storm of storms) {
      seen.add(storm.id);

      // "new storm": only if we've never announced this id before AND it's
      // above the noise floor (moderate+ or close enough to matter).
      const announceKey = (kind: string) => `${kind}|${storm.id}`;
      const newKey = announceKey("new");
      if (storm.isNew && !this.lastAnnouncedIds.has(newKey)) {
        if (
          bandRank(storm.band) >= bandRank("moderate") ||
          storm.distanceFromHomeMi <= this.opts.approachRadiusMi
        ) {
          this.lastAnnouncedIds.add(newKey);
          this.emit({ kind: "storm-new", storm });
        }
      }

      // "intensified": any step up counts, but only announce once per
      // intensity band so we don't chatter.
      if (storm.intensifiedBands > 0) {
        const intKey = `intensified|${storm.id}|${storm.band}`;
        if (!this.lastAnnouncedIds.has(intKey)) {
          this.lastAnnouncedIds.add(intKey);
          this.emit({ kind: "storm-intensified", storm });
        }
      }

      // "approaching": close enough + moving at us + ETA under 60 min.
      if (
        storm.etaMinutes != null &&
        storm.etaMinutes <= 60 &&
        storm.distanceFromHomeMi <= this.opts.approachRadiusMi
      ) {
        const appKey = `approaching|${storm.id}`;
        if (!this.lastAnnouncedIds.has(appKey)) {
          this.lastAnnouncedIds.add(appKey);
          this.emit({ kind: "storm-approaching", storm });
        }
      }
    }

    // Forget ids for storms that no longer exist so a returning storm can
    // re-announce cleanly.
    for (const key of Array.from(this.lastAnnouncedIds)) {
      const id = key.split("|")[1];
      if (!seen.has(id)) this.lastAnnouncedIds.delete(key);
    }
  }

  private emit(event: StormEvent): void {
    for (const fn of this.listeners) fn(event);
  }
}

function bandRank(band: string): number {
  return ["none", "trace", "light", "moderate", "heavy", "very-heavy", "extreme"].indexOf(band);
}

/** Plain-text line a scene or announcer can speak for a storm. */
export function describeStorm(storm: TrackedStorm, home: LatLon): string {
  void home;
  const intensityWord = bandPhrase(storm.band);
  const distance = `${Math.round(storm.distanceFromHomeMi)} miles`;
  const direction = compassLongForDeg(storm.bearingFromHomeDeg);
  let movement = "";
  if (storm.movementMph != null && storm.movementMph > 0 && storm.movementDeg != null) {
    movement = `, moving ${compassLongForDeg(storm.movementDeg)} at ${storm.movementMph} miles per hour`;
  } else if (storm.movementMph === 0) {
    movement = ", stationary";
  }
  const eta = storm.etaMinutes != null ? `, ETA ${storm.etaMinutes} minutes` : "";
  return `${intensityWord}, ${distance} ${direction} of you${movement}${eta}.`;
}

function bandPhrase(band: string): string {
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

function compassLongForDeg(deg: number): string {
  return [
    "north", "northeast", "east", "southeast",
    "south", "southwest", "west", "northwest"
  ][Math.round(deg / 45) % 8];
}
