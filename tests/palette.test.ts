import { test } from "node:test";
import assert from "node:assert/strict";
import { decodePixel, PALETTE_SIZE } from "../src/core/radar/Palette";

/**
 * Reported from use: "storm tracker reports 14 storms in my 63108 area, all
 * extreme rain."
 *
 * There was light rain over St. Louis at the time. The decoder was matching
 * pixels by nearest RGB against a hand-approximated NWS palette, but the tile
 * server ignores the colour-scheme parameter and serves "Universal Blue" —
 * whose low-dBZ end is a semi-transparent tan. The nearest entry in the old
 * table to that tan was purple, i.e. "extreme, 150 mm/h", and the rejection
 * threshold (squared distance 20,000 — a distance of 141) was loose enough
 * that nothing was ever rejected.
 *
 * The palette below is RainViewer's own published table, so matching is exact.
 * These fixtures are real RGBA values sampled from live tiles.
 */

test("the low-dBZ tan ramp decodes as light precipitation, not extreme", () => {
  // Every one of these was decoding as "extreme, 150 mm/h".
  const tanRamp: Array<[number, number, number, number]> = [
    [130, 123, 105, 73],
    [182, 169, 126, 130],
    [194, 180, 130, 140],
    [206, 192, 135, 150],
    [210, 196, 139, 160],
    [214, 200, 143, 170],
    [218, 204, 147, 180],
    [222, 208, 151, 190],
  ];
  for (const [r, g, b, a] of tanRamp) {
    const px = decodePixel(r, g, b, a);
    assert.ok(px, `rgba(${r},${g},${b},${a}) should decode — it is a real palette colour`);
    assert.ok(px!.dbz <= 15, `dBZ should be low, got ${px!.dbz}`);
    assert.notEqual(px!.band, "extreme", `rgba(${r},${g},${b},${a}) decoded as extreme`);
    assert.ok(px!.mmPerHour < 2, `should be a trace rate, got ${px!.mmPerHour} mm/h`);
  }
});

test("the blue ramp decodes in increasing intensity order", () => {
  // Sampled from a live tile: light cyan through to deep blue.
  const blues: Array<[number, number, number]> = [
    [136, 221, 238],
    [108, 209, 235],
    [81, 197, 232],
    [54, 186, 229],
    [27, 174, 226],
    [0, 163, 224],
    [0, 154, 213],
    [0, 145, 202],
    [0, 136, 191],
  ];
  let previous = -Infinity;
  for (const [r, g, b] of blues) {
    const px = decodePixel(r, g, b, 255);
    assert.ok(px, `rgb(${r},${g},${b}) should be a known palette colour`);
    assert.ok(px!.dbz > previous, `dBZ should increase down the ramp, got ${px!.dbz} after ${previous}`);
    previous = px!.dbz;
  }
});

/**
 * The tile server answers any zoom above 7 with a "Zoom Level Not Supported"
 * placeholder — white text on dark grey, served as a normal 200. Under
 * nearest-neighbour matching the white glyphs decoded as extreme precip and
 * the letterforms clustered into "storms". Exact matching rejects them.
 */
test("the zoom-unsupported placeholder decodes as no data at all", () => {
  const placeholderGreys: Array<[number, number, number, number]> = [
    [255, 255, 255, 200],
    [242, 242, 242, 197],
    [222, 222, 222, 192],
    [203, 203, 203, 188],
    [177, 177, 177, 182],
    [146, 146, 146, 174],
    [110, 110, 110, 166],
    [75, 75, 75, 158],
    [38, 38, 38, 149],
  ];
  for (const [r, g, b, a] of placeholderGreys) {
    assert.equal(
      decodePixel(r, g, b, a), null,
      `rgba(${r},${g},${b},${a}) is placeholder text, not weather`
    );
  }
});

test("transparent and unknown colours are not precipitation", () => {
  assert.equal(decodePixel(0, 0, 0, 0), null, "fully transparent");
  assert.equal(decodePixel(136, 221, 238, 5), null, "below the alpha floor");
  // A colour from the OLD assumed NWS palette. If this ever decodes, the
  // tile server has switched schemes and the table needs regenerating.
  assert.equal(decodePixel(152, 84, 198, 255), null, "NWS purple is not in Universal Blue");
  assert.equal(decodePixel(253, 248, 2, 255), null, "NWS yellow is not in Universal Blue");
});

test("the palette is fully populated", () => {
  // 106 rain entries in RainViewer's published scheme-2 table. A truncated
  // generation would silently shrink coverage rather than fail.
  assert.equal(PALETTE_SIZE, 106);
});
