import { test } from "node:test";
import assert from "node:assert/strict";
import {
  haversineMiles,
  bearingDeg,
  pointInPolygon,
  latToTileY,
  tileYToLat,
  lonToTileX,
  tileXToLon
} from "../src/core/radar/TileMath";

test("haversine: New York to Los Angeles is ~2450 miles", () => {
  const nyc = { lat: 40.7128, lon: -74.006 };
  const la = { lat: 34.0522, lon: -118.2437 };
  const mi = haversineMiles(nyc, la);
  assert.ok(Math.abs(mi - 2450) < 30, `expected ~2450, got ${mi}`);
});

test("haversine: zero distance to self", () => {
  const p = { lat: 36.1, lon: -82.8 };
  assert.ok(haversineMiles(p, p) < 0.001);
});

test("bearing: due north is 0, due east is 90", () => {
  const origin = { lat: 36, lon: -82 };
  assert.ok(Math.abs(bearingDeg(origin, { lat: 37, lon: -82 })) < 1);
  assert.ok(Math.abs(bearingDeg(origin, { lat: 36, lon: -81 }) - 90) < 1);
});

test("tile conversions round-trip at zoom 7", () => {
  const lat = 36.1627;
  const lon = -82.831;
  const z = 7;
  const backLat = tileYToLat(latToTileY(lat, z), z);
  const backLon = tileXToLon(lonToTileX(lon, z), z);
  assert.ok(Math.abs(backLat - lat) < 0.0001, `lat round-trip drifted: ${backLat}`);
  assert.ok(Math.abs(backLon - lon) < 0.0001, `lon round-trip drifted: ${backLon}`);
});

test("pointInPolygon: inside, outside, and a concave notch", () => {
  // GeoJSON-style [lon, lat] square around (36, -82).
  const square = [[-83, 35], [-81, 35], [-81, 37], [-83, 37], [-83, 35]];
  assert.equal(pointInPolygon({ lat: 36, lon: -82 }, square), true);
  assert.equal(pointInPolygon({ lat: 40, lon: -82 }, square), false);

  // U-shaped concave polygon; the notch is outside.
  const u = [[0, 0], [4, 0], [4, 4], [3, 4], [3, 1], [1, 1], [1, 4], [0, 4], [0, 0]];
  assert.equal(pointInPolygon({ lat: 3, lon: 2 }, u), false, "the notch is outside the U");
  assert.equal(pointInPolygon({ lat: 0.5, lon: 2 }, u), true, "the base of the U is inside");
});
