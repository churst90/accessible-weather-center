import { test } from "node:test";
import assert from "node:assert/strict";
import { DEVICES, getDevice, deviceSceneOrder, absentProducts, absentNote } from "../src/devices";
import { THEMES, getSceneOrder } from "../src/core/settings/themes";
import { THEME_PRODUCT_ERA } from "../src/audio/manifests/sceneSegments";

/**
 * The device layer is the emulator's machine definitions. These tests hold it
 * to the historical record rather than to whatever the code happens to do.
 */

test("every theme has a device profile and vice versa", () => {
  const themeIds = THEMES.map((t) => t.id).sort();
  const deviceIds = DEVICES.map((d) => d.id).sort();
  assert.deepEqual(deviceIds, themeIds, "theme list and device list have drifted apart");
});

test("scene order comes from the device profile", () => {
  for (const d of DEVICES) {
    assert.deepEqual(getSceneOrder(d.id as never), deviceSceneOrder(d.id));
  }
});

test("every rotation ends with alerts and contains no duplicates", () => {
  for (const d of DEVICES) {
    const order = deviceSceneOrder(d.id);
    assert.equal(order[order.length - 1], "alerts", `${d.id} does not end on alerts`);
    assert.equal(new Set(order).size, order.length, `${d.id} has a duplicated scene`);
  }
});

test("a machine never offers a product it did not have", () => {
  for (const d of DEVICES) {
    const order = deviceSceneOrder(d.id);
    for (const absent of absentProducts(d.id)) {
      assert.ok(
        !order.includes(absent),
        `${d.id} offers "${absent}", which that hardware never had`
      );
    }
  }
});

test("the WeatherStar 3000 has no radar, no hourly and no narration", () => {
  // The three defining constraints of the machine. Sources in the profile.
  const ws3000 = getDevice("ws3000");
  assert.equal(ws3000.capabilities.radar, false);
  assert.equal(ws3000.capabilities.icons, false);
  assert.equal(ws3000.capabilities.narration, false, "the 3000 had a warning tone and no voice track");
  assert.equal(ws3000.voice, "silent");
  assert.equal(ws3000.extendedDays, 3, "the 3000 never had a 5-day extended");
  const order = deviceSceneOrder("ws3000");
  assert.ok(!order.includes("radar"));
  assert.ok(!order.includes("hourly"));
  assert.ok(absentNote("ws3000", "radar"), "absent products should explain themselves");
});

test("the WeatherStar Jr mirrors the 3000, not the 4000", () => {
  // docs/legacy-eras.md Era 3: a WS3000 product set in the 4000-era typeface.
  const jr = getDevice("wsjr");
  const ws3000 = getDevice("ws3000");
  assert.equal(jr.capabilities.radar, false, "the Jr had no on-unit radar");
  assert.equal(jr.capabilities.icons, false);
  assert.deepEqual([...jr.rundown], [...ws3000.rundown], "Jr should share the 3000 rotation");
});

test("only the WeatherStar 4000 v2 has the persistent footer bar", () => {
  for (const d of DEVICES) {
    assert.equal(
      d.capabilities.footer,
      d.id === "ws4000-v2",
      `${d.id} footer capability is wrong — the always-on footer is the defining v2 chrome`
    );
  }
});

test("extended day counts match the hardware", () => {
  const expected: Record<string, 3 | 5 | 7> = {
    ws3000: 3, wsjr: 3, "ws4000-v1": 3, "ws4000-v2": 5,
    weatherstarxl: 7, "weatherscan-local": 5, "weatherscan-v1": 7,
    "weatherscan-v2": 7, intellistar1: 7, intellistar2: 7
  };
  for (const d of DEVICES) {
    assert.equal(d.extendedDays, expected[d.id], `${d.id} extended day count`);
  }
});

test("product era is declared by the device, not duplicated elsewhere", () => {
  for (const d of DEVICES) {
    assert.equal(THEME_PRODUCT_ERA[d.id], d.era, `${d.id} era disagrees with its profile`);
  }
});

test("pre-2004 machines are exactly the ones that predate the rename", () => {
  const pre = DEVICES.filter((d) => d.era === "pre-2004").map((d) => d.id).sort();
  assert.deepEqual(pre, [
    "weatherscan-local", "weatherstarxl", "ws3000", "ws4000-v1", "wsjr"
  ], "product-era assignment changed — confirm against the September 2004 rename");
});

test("machines that predate the rename call the products by their old names", () => {
  for (const d of DEVICES.filter((x) => x.era === "pre-2004")) {
    const lf = d.products.localforecast;
    if (lf?.availability === "absent") continue;
    assert.equal(lf?.name, "36 Hour Forecast", `${d.id} should call it the 36 Hour Forecast`);
  }
});

test("every absent product explains itself", () => {
  for (const d of DEVICES) {
    for (const p of absentProducts(d.id)) {
      const note = absentNote(d.id, p);
      assert.ok(note && note.length > 10, `${d.id}/${p} has no explanation for the user`);
    }
  }
});

test("optional products are genuinely optional, not core", () => {
  for (const d of DEVICES) {
    for (const [id, spec] of Object.entries(d.products)) {
      if (spec.availability !== "optional") continue;
      assert.ok(
        !d.rundown.includes(id as never),
        `${d.id}: "${id}" is marked optional but sits in the base rundown`
      );
    }
  }
});

test("every machine records its outstanding work, or explicitly has none", () => {
  // Keeps docs/asset-gaps.md honest — it is generated from this field.
  for (const d of DEVICES) {
    assert.ok(Array.isArray(d.gaps ?? []), `${d.id} gaps should be an array when present`);
  }
});
