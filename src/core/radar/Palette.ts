import type { PrecipBand } from "../types";

/**
 * RainViewer "color scheme 4" approximate palette.
 *
 * RainViewer serves pre-colored radar tiles as PNGs; there's no raw dBZ
 * grid to fetch. To get intensity per pixel we have to reverse the palette:
 * match the pixel's RGB to the nearest palette band and look up the
 * corresponding mm/hour.
 *
 * The palette below is color scheme 4 (the "original NWS-ish" one). RGB
 * values are approximate centers of each band; the decoder uses nearest-
 * neighbor matching in RGB space, which tolerates the small amount of
 * smoothing RainViewer applies with smooth=1.
 *
 * If the decoder ever misclassifies a region, the fix is to tune these
 * centers against a sample tile using a pixel picker — not to throw more
 * layers at it. Keep this table as the one source of truth.
 *
 * References:
 *   - RainViewer public tile docs (color scheme 4)
 *   - NWS standard reflectivity scale for the rough dBZ bands
 */

export interface PaletteBand {
  /** Approximate center RGB for nearest-neighbor matching. */
  rgb: [number, number, number];
  /** Precipitation rate in millimeters per hour for this band. */
  mmPerHour: number;
  /** Reflectivity in dBZ, if meaningful. */
  dbz: number;
  /** Plain-language classification used by the rest of the app. */
  band: PrecipBand;
}

// Rough color-scheme-4 palette centers. Order doesn't matter — decoder scans
// all of them and returns the nearest match.
export const COLOR_SCHEME_4: readonly PaletteBand[] = Object.freeze([
  { rgb: [  4, 233, 231], mmPerHour:  0.3, dbz: 10, band: "trace" },       // light cyan
  { rgb: [  1, 159, 244], mmPerHour:  0.6, dbz: 15, band: "light" },       // blue
  { rgb: [  3,   0, 244], mmPerHour:  1.2, dbz: 20, band: "light" },       // deep blue
  { rgb: [  2, 253,   2], mmPerHour:  2.5, dbz: 25, band: "moderate" },    // green
  { rgb: [  1, 197,   1], mmPerHour:  5.0, dbz: 30, band: "moderate" },    // mid green
  { rgb: [  0, 142,   0], mmPerHour:  8.0, dbz: 35, band: "moderate" },    // dark green
  { rgb: [253, 248,   2], mmPerHour: 12.0, dbz: 40, band: "heavy" },       // yellow
  { rgb: [229, 188,   0], mmPerHour: 18.0, dbz: 45, band: "heavy" },       // amber
  { rgb: [253, 149,   0], mmPerHour: 25.0, dbz: 50, band: "very-heavy" },  // orange
  { rgb: [253,   0,   0], mmPerHour: 35.0, dbz: 55, band: "very-heavy" },  // red
  { rgb: [212,   0,   0], mmPerHour: 50.0, dbz: 60, band: "extreme" },     // dark red
  { rgb: [188,   0,   0], mmPerHour: 75.0, dbz: 65, band: "extreme" },     // darker red
  { rgb: [248,   0, 253], mmPerHour:100.0, dbz: 70, band: "extreme" },     // magenta
  { rgb: [152,  84, 198], mmPerHour:150.0, dbz: 75, band: "extreme" }      // purple
]);

export interface DecodedPixel {
  mmPerHour: number;
  dbz: number;
  band: PrecipBand;
}

/** Euclidean distance in RGB space is a bad color model but a perfectly
 *  good "nearest palette entry" metric when the palette is this coarse. */
function sqDist(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

/**
 * Decode a single RGBA pixel into precipitation intensity.
 *
 * Returns null for transparent, near-transparent, or near-black pixels —
 * those represent "no precipitation" on a RainViewer tile. Alpha is the
 * primary signal; RGB is secondary.
 */
export function decodePixel(r: number, g: number, b: number, a: number): DecodedPixel | null {
  if (a < 20) return null;                   // transparent = no precip
  if (r + g + b < 12) return null;           // near-black sentinel

  let best = COLOR_SCHEME_4[0];
  let bestDist = sqDist([r, g, b], best.rgb);
  for (let i = 1; i < COLOR_SCHEME_4.length; i++) {
    const d = sqDist([r, g, b], COLOR_SCHEME_4[i].rgb);
    if (d < bestDist) {
      bestDist = d;
      best = COLOR_SCHEME_4[i];
    }
  }
  // If the closest palette band is still implausibly far away, treat as
  // noise (the tile has some anti-aliased edges that don't match anything).
  if (bestDist > 20_000) return null;
  return { mmPerHour: best.mmPerHour, dbz: best.dbz, band: best.band };
}
