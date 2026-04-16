import type { LatLon, RadarCell, RadarFrame } from "../types";
import type { RainViewerClient, RainViewerFrame, RainViewerManifest } from "../weather/RainViewerClient";
import { decodePixel } from "./Palette";
import {
  TILE_SIZE,
  boxAround,
  haversineMiles,
  tilePixelToLatLon,
  tilesCoveringBox
} from "./TileMath";

/**
 * Fetch RainViewer tiles covering a bounding box, decode the pixels into
 * precipitation intensity cells, and hand back a sparse RadarFrame.
 *
 * Why the sampler lives here and not in the client: the client is the
 * framework-agnostic HTTP layer. Decoding needs a 2D canvas to read pixels,
 * which is a browser/renderer concern. This module bridges the two.
 *
 * Sampling strategy
 * -----------------
 * For every tile in the box, we walk pixels on a coarse grid (default: one
 * sample every 4 px). Each sample becomes a RadarCell iff the decoded pixel
 * has meaningful precipitation. The step size trades density for speed —
 * 4 px on a 256-px tile = 64x64 samples per tile ≈ 4096 samples. Four tiles
 * ≈ 16k samples, which a flood-fill clusterer handles in < 100 ms.
 *
 * The bounding box is applied twice: once to pick which tiles to fetch, and
 * again (as a radius filter) to drop samples outside the target circle.
 * This is cheaper than doing a precise polygon check per sample.
 */

export interface SampleOptions {
  /** Zoom level to fetch. 6 ≈ 100 km tile; 7 ≈ 50 km. 7 is a good default
   *  for a 150-mile box — 6-9 tiles, ~64 km each. */
  zoom: number;
  /** Pixel grid step. Smaller = denser = slower. Must divide 256 for clean
   *  coverage; 2, 4, 8, 16 all work. Default 4. */
  stepPx: number;
  /** Center of the target region (usually home). */
  center: LatLon;
  /** Radius in miles to keep. Samples outside this circle are discarded. */
  radiusMi: number;
}

/**
 * Sample a single RainViewer frame into a RadarFrame. The manifest is
 * passed in so the caller controls which frame (past[-1], nowcast[0], …)
 * and so we don't refetch it on every call.
 */
export async function sampleFrame(
  client: RainViewerClient,
  manifest: RainViewerManifest,
  frame: RainViewerFrame,
  opts: SampleOptions
): Promise<RadarFrame> {
  const bbox = boxAround(opts.center, opts.radiusMi);
  const tiles = tilesCoveringBox(bbox, opts.zoom);
  const cells: RadarCell[] = [];

  // Fetch tiles in parallel — the browser's connection pool takes care of
  // the concurrency ceiling. We don't retry: a missing tile just means that
  // slice of the map is unsampled this frame.
  const results = await Promise.all(
    tiles.map(async (t) => {
      try {
        const url = client.buildTileUrl(frame, manifest.host, opts.zoom, t.x, t.y);
        const pixels = await fetchTilePixels(url);
        return { tile: t, pixels };
      } catch {
        return { tile: t, pixels: null };
      }
    })
  );

  for (const res of results) {
    if (!res.pixels) continue;
    collectSamples(res.tile, res.pixels, opts, cells);
  }

  return {
    capturedAt: new Date(frame.time * 1000),
    source: "rainviewer",
    bounds: { west: bbox.west, south: bbox.south, east: bbox.east, north: bbox.north },
    cells
  };
}

/** Walk one tile's pixels on the configured grid, append hits to `cells`. */
function collectSamples(
  tile: { x: number; y: number },
  pixels: Uint8ClampedArray,
  opts: SampleOptions,
  out: RadarCell[]
): void {
  for (let py = 0; py < TILE_SIZE; py += opts.stepPx) {
    for (let px = 0; px < TILE_SIZE; px += opts.stepPx) {
      const i = (py * TILE_SIZE + px) * 4;
      const decoded = decodePixel(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]);
      if (!decoded) continue;
      const coord = tilePixelToLatLon(tile.x, tile.y, px, py, opts.zoom);
      if (haversineMiles(opts.center, coord) > opts.radiusMi) continue;
      out.push({
        lat: coord.lat,
        lon: coord.lon,
        dbz: decoded.dbz,
        mmPerHour: decoded.mmPerHour,
        band: decoded.band,
        colorName: colorNameForBand(decoded.band)
      });
    }
  }
}

function colorNameForBand(band: RadarCell["band"]): string {
  switch (band) {
    case "trace":      return "light cyan";
    case "light":      return "blue";
    case "moderate":   return "green to yellow";
    case "heavy":      return "orange";
    case "very-heavy": return "red";
    case "extreme":    return "magenta";
    default:           return "clear";
  }
}

/**
 * Fetch a PNG tile and return its decoded RGBA pixel buffer.
 *
 * We use the browser Image element + a 2D canvas rather than fetch+blob
 * because in Electron renderer this is the most compatible path for
 * cross-origin decoding. RainViewer serves `Access-Control-Allow-Origin: *`,
 * so setting `crossOrigin = "anonymous"` lets us read pixels without a
 * taint error.
 */
async function fetchTilePixels(url: string): Promise<Uint8ClampedArray> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`image load failed: ${url}`));
  });
  img.src = url;
  await loaded;

  // Prefer OffscreenCanvas where available; fall back to a detached
  // HTMLCanvasElement for older Electron versions.
  const canvas: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(TILE_SIZE, TILE_SIZE)
      : Object.assign(document.createElement("canvas"), {
          width: TILE_SIZE,
          height: TILE_SIZE
        });
  const ctx = (canvas as OffscreenCanvas).getContext("2d") as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error("no 2d context for tile decode");
  ctx.drawImage(img, 0, 0, TILE_SIZE, TILE_SIZE);
  const data = ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE).data;
  return data;
}
