import type { LatLon } from "../types";

/**
 * Slippy-tile math for Web Mercator (EPSG:3857). This is the same projection
 * OpenStreetMap, RainViewer, Mapbox, and basically every web tile server uses.
 *
 * Tile coordinates at zoom z span [0, 2^z) in both x and y. x is longitude,
 * y is latitude (top-down: y=0 is the north edge). Each tile is 256x256
 * pixels by convention.
 *
 * The math here is deliberately minimal — no dependencies, no framework.
 * Exports are pure functions so anything can call them.
 */

export const TILE_SIZE = 256;

/** Zoom level → tile count along one axis. */
export function tilesPerAxis(z: number): number {
  return 1 << z; // 2^z
}

/** Longitude (°) → tile X at zoom z. Returns a float so callers can get
 *  sub-tile precision when sampling specific pixels. */
export function lonToTileX(lon: number, z: number): number {
  return ((lon + 180) / 360) * tilesPerAxis(z);
}

/** Latitude (°) → tile Y at zoom z (float). Web Mercator clamps at ±85°. */
export function latToTileY(lat: number, z: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * tilesPerAxis(z);
}

/** Inverse: tile X (float) → longitude (°). */
export function tileXToLon(x: number, z: number): number {
  return (x / tilesPerAxis(z)) * 360 - 180;
}

/** Inverse: tile Y (float) → latitude (°). */
export function tileYToLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / tilesPerAxis(z);
  return (180 / Math.PI) * Math.atan((Math.exp(n) - Math.exp(-n)) / 2);
}

/** Convert a pixel position inside a specific tile to lat/lon. */
export function tilePixelToLatLon(
  tileX: number,
  tileY: number,
  pixelX: number,
  pixelY: number,
  z: number
): LatLon {
  const x = tileX + pixelX / TILE_SIZE;
  const y = tileY + pixelY / TILE_SIZE;
  return { lat: tileYToLat(y, z), lon: tileXToLon(x, z) };
}

/**
 * Great-circle distance between two lat/lon points in miles using the
 * Haversine formula. Fine for radar-scale distances; we don't need WGS-84
 * accuracy for "is that storm within 40 miles of home."
 */
export function haversineMiles(a: LatLon, b: LatLon): number {
  const R = 3958.7613;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Initial bearing (forward azimuth) in degrees from a → b, 0°=north, 90°=east.
 * Treats the earth as a sphere (good enough for the compass-rose announcements
 * we derive from it).
 */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Short compass: N / NE / E / SE / S / SW / W / NW. */
export function compassShort(deg: number): string {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];
}

/** Long compass: "north", "northeast", … */
export function compassLong(deg: number): string {
  return [
    "north", "northeast", "east", "southeast",
    "south", "southwest", "west", "northwest"
  ][Math.round(deg / 45) % 8];
}

/**
 * Build the inclusive set of integer tile (x, y) coordinates that cover a
 * lat/lon bounding box at zoom z. Use this before fetching tiles.
 */
export function tilesCoveringBox(
  bbox: { north: number; south: number; east: number; west: number },
  z: number
): Array<{ x: number; y: number }> {
  const x0 = Math.floor(lonToTileX(bbox.west, z));
  const x1 = Math.floor(lonToTileX(bbox.east, z));
  const y0 = Math.floor(latToTileY(bbox.north, z));
  const y1 = Math.floor(latToTileY(bbox.south, z));
  const tiles: Array<{ x: number; y: number }> = [];
  const n = tilesPerAxis(z);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const xi = ((x % n) + n) % n; // wrap antimeridian
      if (y < 0 || y >= n) continue;
      tiles.push({ x: xi, y });
    }
  }
  return tiles;
}

/**
 * Ray-casting point-in-polygon test. Polygon is an array of [lon, lat]
 * pairs (the order NWS GeoJSON uses). Returns true if the point is inside.
 *
 * Works for simple (non-self-intersecting) polygons. Fine for NWS alert
 * polygons which are always simple convex/concave boundaries.
 */
export function pointInPolygon(coord: LatLon, polygon: number[][]): boolean {
  const x = coord.lon;
  const y = coord.lat;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if (
      ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * A bounding box centered on a point, sized by a radius in miles. Uses a
 * flat approximation — fine for the ~150 mi radii we care about.
 */
export function boxAround(center: LatLon, radiusMi: number): {
  north: number; south: number; east: number; west: number;
} {
  const latDelta = radiusMi / 69;                                // °/mi
  const lonDelta = radiusMi / (69 * Math.cos((center.lat * Math.PI) / 180));
  return {
    north: center.lat + latDelta,
    south: center.lat - latDelta,
    east: center.lon + lonDelta,
    west: center.lon - lonDelta
  };
}
