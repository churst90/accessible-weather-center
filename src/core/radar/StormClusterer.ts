import type { LatLon, PrecipBand, RadarCell, RadarFrame, StormCell } from "../types";
import { haversineMiles } from "./TileMath";

/**
 * Cluster the sparse precipitation cells of a RadarFrame into discrete
 * StormCell objects so the rest of the app can talk about "storms" instead
 * of pixels.
 *
 * Algorithm
 * ---------
 * Spatial hash + flood fill:
 *   1. Bucket every RadarCell into an integer lat/lon grid (1/STEPS of a
 *      degree). Neighbors within ±1 grid step count as "touching".
 *   2. BFS from each unvisited cell to form a cluster.
 *   3. Drop clusters that are too small (< MIN_CELLS) as noise.
 *   4. Summarize each cluster into a StormCell.
 *
 * The grid step is driven by the radar sampler's pixel step — at zoom 7
 * with a 4-px pixel step, cells end up spaced roughly 0.05° apart, so a
 * 0.08° bucket (≈ 5.5 miles) lets adjacent samples touch with slack for
 * gaps in the sampling pattern.
 */

const DEFAULT_GRID_STEP = 0.08;  // degrees
const MIN_CELLS_IN_STORM = 3;

export interface StormFrame {
  capturedAt: Date;
  storms: StormCell[];
}

export function clusterStorms(
  frame: RadarFrame,
  home: LatLon,
  options: { gridStep?: number; minCells?: number } = {}
): StormFrame {
  const gridStep = options.gridStep ?? DEFAULT_GRID_STEP;
  const minCells = options.minCells ?? MIN_CELLS_IN_STORM;

  // Spatial hash keyed by rounded lat/lon bucket.
  const buckets = new Map<string, RadarCell[]>();
  const keyOf = (lat: number, lon: number) =>
    `${Math.round(lat / gridStep)}|${Math.round(lon / gridStep)}`;
  for (const c of frame.cells) {
    const k = keyOf(c.lat, c.lon);
    const arr = buckets.get(k);
    if (arr) arr.push(c);
    else buckets.set(k, [c]);
  }

  const visited = new Set<string>();
  const storms: StormCell[] = [];

  for (const startKey of buckets.keys()) {
    if (visited.has(startKey)) continue;
    const cluster: RadarCell[] = [];
    const queue: string[] = [startKey];
    visited.add(startKey);

    while (queue.length > 0) {
      const k = queue.shift()!;
      const cellsAtKey = buckets.get(k);
      if (!cellsAtKey) continue;
      for (const cell of cellsAtKey) cluster.push(cell);

      const [iStr, jStr] = k.split("|");
      const i = Number(iStr);
      const j = Number(jStr);
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (di === 0 && dj === 0) continue;
          const nk = `${i + di}|${j + dj}`;
          if (visited.has(nk)) continue;
          if (!buckets.has(nk)) continue;
          visited.add(nk);
          queue.push(nk);
        }
      }
    }

    if (cluster.length < minCells) continue;
    storms.push(summarize(cluster, home, storms.length));
  }

  // Sort by proximity to home so "storm 1" always means "the nearest one" —
  // this is what the user asked for ("is anything dangerous, how close").
  storms.sort((a, b) => {
    const da = haversineMiles(home, a.centroid);
    const db = haversineMiles(home, b.centroid);
    return da - db;
  });
  storms.forEach((s, i) => {
    s.id = `storm_${i + 1}`;
  });

  return { capturedAt: frame.capturedAt, storms };
}

function summarize(cluster: RadarCell[], _home: LatLon, _index: number): StormCell {
  let sumLat = 0;
  let sumLon = 0;
  let peakMm = 0;
  let peakDbz = 0;
  let peakBand: PrecipBand = "none";
  for (const c of cluster) {
    sumLat += c.lat;
    sumLon += c.lon;
    if (c.mmPerHour > peakMm) {
      peakMm = c.mmPerHour;
      peakBand = c.band;
      if (c.dbz != null) peakDbz = c.dbz;
    }
  }
  const centroid: LatLon = {
    lat: sumLat / cluster.length,
    lon: sumLon / cluster.length
  };
  const radiusMi = estimateRadius(cluster, centroid);
  return {
    id: "",               // assigned by caller after proximity sort
    centroid,
    peakDbz,
    peakMmPerHour: peakMm,
    band: peakBand,
    movementDeg: null,    // filled in by StormTracker, not here
    movementMph: null,
    radiusMi
  };
}

function estimateRadius(cluster: RadarCell[], centroid: LatLon): number {
  let maxD = 0;
  for (const c of cluster) {
    const d = haversineMiles(centroid, { lat: c.lat, lon: c.lon });
    if (d > maxD) maxD = d;
  }
  return Math.max(1, Math.round(maxD));
}
