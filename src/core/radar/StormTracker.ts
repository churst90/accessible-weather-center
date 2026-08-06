import type { LatLon, StormCell } from "../types";
import { bearingDeg, haversineMiles } from "./TileMath";

/**
 * Match storms between two consecutive radar frames and derive movement
 * vectors for each current storm.
 *
 * The matching is a greedy nearest-neighbor pass with two sanity filters:
 *   1. The candidate's centroid must be within MAX_MATCH_MI of the current
 *      storm. Above that, we assume they're different systems.
 *   2. Peak intensity must be within one band (storms don't go from light
 *      to extreme in two minutes; if they do it's a new cell).
 *
 * This is not a scientific storm tracker — ground-truth ones use optical
 * flow on dBZ grids with ensembles. But for "where is the thing moving,
 * should I worry," greedy matching is plenty. We accept occasional
 * misidentification in exchange for a 20-line algorithm.
 */

const MAX_MATCH_MI = 40;
const BAND_ORDER = [
  "none", "trace", "light", "moderate", "heavy", "very-heavy", "extreme"
] as const;

export interface TrackedStorm extends StormCell {
  /** True on the first frame a storm appears — feeds "new storm" announcements. */
  isNew: boolean;
  /** Intensified by one or more bands since the previous frame. */
  intensifiedBands: number;
  /** Distance from home in miles at this frame. */
  distanceFromHomeMi: number;
  /** Bearing from home in degrees (0 = north, clockwise). */
  bearingFromHomeDeg: number;
  /** Estimated minutes to reach home, or null if not moving toward home or stationary. */
  etaMinutes: number | null;
}

export interface TrackResult {
  capturedAt: Date;
  storms: TrackedStorm[];
}

export class StormTracker {
  private previous: { storms: TrackedStorm[]; capturedAt: Date } | null = null;
  /** Monotonic counter for minting persistent storm ids. The clusterer's
   *  positional ids (storm_1 = nearest) shift every time a new storm appears
   *  closer to home, which broke announcement dedup — a genuinely new storm
   *  could inherit an already-announced id and be silently skipped. Ids
   *  minted here follow the storm across frames instead. */
  private nextTrackId = 0;

  /** Wipe the tracker's memory. Use this when home changes so we don't
   *  accidentally match storms across two different bounding boxes. */
  reset(): void {
    this.previous = null;
  }

  track(
    current: { storms: StormCell[]; capturedAt: Date },
    home: LatLon
  ): TrackResult {
    const prev = this.previous;
    const dtMin = prev
      ? Math.max(0.1, (current.capturedAt.getTime() - prev.capturedAt.getTime()) / 60_000)
      : 0;

    // Each previous storm may match at most one current storm; without this
    // two current cells splitting off one old cell would share an id.
    const claimed = new Set<string>();

    const tracked: TrackedStorm[] = current.storms.map((s) => {
      const match = prev ? findMatch(s, prev.storms, claimed) : null;
      if (match) claimed.add(match.id);
      let movementDeg: number | null = null;
      let movementMph: number | null = null;
      let intensifiedBands = 0;
      if (match && prev) {
        const mi = haversineMiles(match.centroid, s.centroid);
        if (mi > 0.3) {
          movementDeg = bearingDeg(match.centroid, s.centroid);
          movementMph = Math.round((mi / dtMin) * 60);
        } else {
          movementDeg = null;
          movementMph = 0;
        }
        intensifiedBands = bandIndex(s.band) - bandIndex(match.band);
      }

      const distanceFromHomeMi = haversineMiles(home, s.centroid);
      const bearingFromHomeDeg = bearingDeg(home, s.centroid);
      const eta = etaToHome(home, s.centroid, movementDeg, movementMph);

      return {
        ...s,
        id: match ? match.id : `track_${++this.nextTrackId}`,
        movementDeg,
        movementMph,
        isNew: !match,
        intensifiedBands: Math.max(0, intensifiedBands),
        distanceFromHomeMi: round1(distanceFromHomeMi),
        bearingFromHomeDeg: Math.round(bearingFromHomeDeg),
        etaMinutes: eta
      };
    });

    this.previous = { storms: tracked, capturedAt: current.capturedAt };
    return { capturedAt: current.capturedAt, storms: tracked };
  }
}

function findMatch(
  target: StormCell,
  candidates: TrackedStorm[],
  claimed: Set<string>
): TrackedStorm | null {
  let best: TrackedStorm | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    if (claimed.has(c.id)) continue;
    const d = haversineMiles(target.centroid, c.centroid);
    if (d > MAX_MATCH_MI) continue;
    if (Math.abs(bandIndex(target.band) - bandIndex(c.band)) > 1) continue;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

function bandIndex(band: StormCell["band"]): number {
  const i = BAND_ORDER.indexOf(band);
  return i < 0 ? 0 : i;
}

/**
 * Rough ETA from a storm to home, based on its current movement vector and
 * distance. Returns null if the storm is stationary, moving away, or moving
 * perpendicular to the home direction.
 */
function etaToHome(
  home: LatLon,
  centroid: LatLon,
  movementDeg: number | null,
  movementMph: number | null
): number | null {
  if (movementDeg == null || movementMph == null || movementMph <= 0) return null;
  const distance = haversineMiles(home, centroid);
  const bearingToHome = bearingDeg(centroid, home);
  const diff = Math.abs(((movementDeg - bearingToHome + 540) % 360) - 180);
  // Within ±60° of "pointing at home" counts as approaching.
  if (diff > 60) return null;
  // Component of movement along the home direction.
  const alongTrack = Math.cos((diff * Math.PI) / 180) * movementMph;
  if (alongTrack <= 0) return null;
  return Math.max(1, Math.round((distance / alongTrack) * 60));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
