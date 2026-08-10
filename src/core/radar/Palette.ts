import type { PrecipBand } from "../types";
import { classifyMmPerHour, dbzToMmPerHour } from "./IntensityLegend";

/**
 * RainViewer tile decoding.
 *
 * RainViewer serves pre-coloured PNGs; there is no raw dBZ grid to fetch, so
 * intensity has to be recovered from the pixel colour. This used to be done
 * by nearest-neighbour matching against a hand-approximated "colour scheme 4"
 * (the NWS green/yellow/red/purple ramp). Three things were wrong with that:
 *
 *   1. The tiles are NOT scheme 4. The `{color}` path segment is ignored by
 *      the tile server — tiles for schemes 0 through 8 come back byte for
 *      byte identical — and what it actually serves is scheme 2, "Universal
 *      Blue". Verified by md5 across all nine values.
 *   2. Nearest-neighbour against the wrong ramp puts blue rain and the warm
 *      low-dBZ colours on arbitrary bands. Universal Blue renders dBZ 0-14
 *      as a semi-transparent tan; the closest entry in the old table was
 *      purple, i.e. "extreme, 150 mm/h". A drizzle tile decoded as a field of
 *      extreme cells, which the clusterer then reported as a dozen severe
 *      storms.
 *   3. The rejection threshold was a squared distance of 20,000 — a distance
 *      of 141 in RGB space, which accepts essentially anything. Nothing was
 *      ever rejected, so there was no failure mode, only wrong answers. That
 *      also let the "Zoom Level Not Supported" placeholder tile — white text
 *      on grey, served for any zoom above 7 — decode as extreme precipitation.
 *
 * The table below is RainViewer's own, lifted from the colour-scheme table
 * they publish, so matching is EXACT rather than nearest: a pixel is either a
 * known palette colour or it is not precipitation data. Against real tiles
 * every one of 61,529 opaque pixels matched exactly, so exactness costs no
 * coverage — and an unrecognised colour now returns null instead of being
 * snapped to whatever happened to be closest.
 *
 * Tiles must therefore be requested with smooth=0: smoothing blends adjacent
 * palette entries and produces colours that are in no table. See
 * RainViewerClient.buildTileUrl.
 *
 * Rain vs snow: RainViewer has a parallel snow ramp, and 49 of its colours
 * collide with rain colours at a different dBZ. Tiles are requested with
 * snow=0 so only the rain ramp appears and the mapping stays unambiguous.
 * Reflectivity is reflectivity either way for a storm scanner.
 */

export interface DecodedPixel {
  mmPerHour: number;
  dbz: number;
  band: PrecipBand;
}

/**
 * RainViewer colour scheme 2 ("Universal Blue"), rain ramp.
 * Each row is [r, g, b, a, dBZ]. Generated from RainViewer's published table.
 */
const UNIVERSAL_BLUE_RAIN: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [99,97,89,20,-10],
  [102,99,90,25,-9],
  [105,102,92,30,-8],
  [108,104,93,36,-7],
  [111,107,95,41,-6],
  [114,110,97,46,-5],
  [117,112,98,52,-4],
  [120,115,100,57,-3],
  [124,117,101,62,-2],
  [127,120,103,68,-1],
  [130,123,105,73,0],
  [133,125,106,78,1],
  [136,128,108,84,2],
  [139,130,109,89,3],
  [142,133,111,94,4],
  [146,136,113,100,5],
  [158,147,117,110,6],
  [170,158,121,120,7],
  [182,169,126,130,8],
  [194,180,130,140,9],
  [206,192,135,150,10],
  [210,196,139,160,11],
  [214,200,143,170,12],
  [218,204,147,180,13],
  [222,208,151,190,14],
  [136,221,238,255,15],
  [108,209,235,255,16],
  [81,197,232,255,17],
  [54,186,229,255,18],
  [27,174,226,255,19],
  [0,163,224,255,20],
  [0,154,213,255,21],
  [0,145,202,255,22],
  [0,136,191,255,23],
  [0,127,180,255,24],
  [0,119,170,255,25],
  [0,112,163,255,26],
  [0,105,156,255,27],
  [0,98,149,255,28],
  [0,91,142,255,29],
  [0,85,136,255,30],
  [0,81,128,255,31],
  [0,78,120,255,32],
  [0,74,112,255,33],
  [0,71,104,255,34],
  [255,238,0,255,35],
  [255,224,0,255,36],
  [255,210,0,255,37],
  [255,197,0,255,38],
  [255,183,0,255,39],
  [255,170,0,255,40],
  [255,159,0,255,41],
  [255,149,0,255,42],
  [255,139,0,255,43],
  [255,129,0,255,44],
  [255,68,0,255,45],
  [242,54,0,255,46],
  [230,40,0,255,47],
  [217,27,0,255,48],
  [205,13,0,255,49],
  [193,0,0,255,50],
  [168,0,0,255,51],
  [143,0,0,255,52],
  [118,0,0,255,53],
  [93,0,0,255,54],
  [255,170,255,255,55],
  [255,159,255,255,56],
  [255,149,255,255,57],
  [255,139,255,255,58],
  [255,129,255,255,59],
  [255,119,255,255,60],
  [255,108,255,255,61],
  [255,98,255,255,62],
  [255,88,255,255,63],
  [255,78,255,255,64],
  [255,255,255,255,65],
  [255,255,255,255,66],
  [255,255,255,255,67],
  [255,255,255,255,68],
  [255,255,255,255,69],
  [255,255,255,255,70],
  [255,255,255,255,71],
  [255,255,255,255,72],
  [255,255,255,255,73],
  [255,255,255,255,74],
  [0,255,0,255,75],
  [0,255,0,255,76],
  [0,255,0,255,77],
  [0,255,0,255,78],
  [0,255,0,255,79],
  [0,255,0,255,80],
  [0,255,0,255,81],
  [0,255,0,255,82],
  [0,255,0,255,83],
  [0,255,0,255,84],
  [0,255,0,255,85],
  [0,255,0,255,86],
  [0,255,0,255,87],
  [0,255,0,255,88],
  [0,255,0,255,89],
  [0,255,0,255,90],
  [0,255,0,255,91],
  [0,255,0,255,92],
  [0,255,0,255,93],
  [0,255,0,255,94],
  [0,255,0,255,95],
];

/** Pack RGBA into one integer key so lookup is a single Map hit per pixel. */
function key(r: number, g: number, b: number, a: number): number {
  return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
}

const DBZ_BY_COLOR = new Map<number, number>();
for (const [r, g, b, a, dbz] of UNIVERSAL_BLUE_RAIN) DBZ_BY_COLOR.set(key(r, g, b, a), dbz);

/**
 * Decode a single RGBA pixel into precipitation intensity.
 *
 * Returns null for transparent pixels and for any colour that is not in the
 * palette — an unknown colour means the tile is not carrying radar data at
 * that pixel (an error placeholder, a basemap bleed, a smoothed edge), and
 * guessing at it is how a drizzle became fourteen extreme storms.
 */
export function decodePixel(r: number, g: number, b: number, a: number): DecodedPixel | null {
  if (a < 20) return null;

  const dbz = DBZ_BY_COLOR.get(key(r, g, b, a));
  if (dbz == null) return null;

  const mmPerHour = dbzToMmPerHour(dbz);
  return { mmPerHour, dbz, band: classifyMmPerHour(mmPerHour).band };
}

/** Exposed for tests and tooling that want to assert palette coverage. */
export const PALETTE_SIZE = UNIVERSAL_BLUE_RAIN.length;
