import { test } from "node:test";
import assert from "node:assert/strict";
import { DEVICES, getDevice, deviceSceneOrder, absentProducts, absentNote, resolveNarrator, canNarrate, isAuthenticVoice } from "../src/devices";
import { THEMES, getSceneOrder } from "../src/core/settings/themes";
import { pickBackground, listBackgrounds, getSceneBackground } from "../src/core/settings/backgroundCatalog";
import { THEME_PRODUCT_ERA } from "../src/audio/manifests/sceneSegments";
import { getNarrator, pickSceneIntro, NARRATORS } from "../src/audio/manifests/narratorSchema";

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
    ws3000: 3, wsjr: 3, "ws4000-v1": 3, "ws4000-v2": 3,
    weatherstarxl: 7, "weatherscan-local": 7, "weatherscan-v1": 7,
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

test("visuals live on the device and reach the theme unchanged", () => {
  // themes.ts is now only an adapter over the profiles. If a value stops
  // flowing through, the app silently renders in fallback fonts and colours —
  // which is exactly the failure mode that had every WS4000 theme in Arial
  // for months before the Star4000 path typo was found.
  for (const d of DEVICES) {
    const theme = THEMES.find((t) => t.id === d.id)!;
    assert.equal(theme.iconSet, d.visuals.iconSet, `${d.id} iconSet`);
    assert.equal(theme.backgroundImage, d.visuals.backgroundImage, `${d.id} background`);
    assert.equal(theme.extendedTitle, d.visuals.extendedTitle, `${d.id} extended title`);
    assert.equal(theme.defaultNarrator, d.voice, `${d.id} narrator`);
    assert.deepEqual(theme.vars, d.visuals.vars, `${d.id} CSS vars`);
    assert.equal(theme.extendedStyle, `${d.extendedDays}-day`, `${d.id} extended style`);
  }
});

test("every machine defines a complete visual identity", () => {
  const REQUIRED = [
    "--ws-bg-deep", "--ws-bg-mid", "--ws-bg-top", "--ws-accent",
    "--ws-text", "--ws-alert", "--ws-font-display", "--ws-font-led", "--ws-font-small"
  ];
  for (const d of DEVICES) {
    for (const key of REQUIRED) {
      const v = d.visuals.vars[key];
      assert.ok(v && v.length > 0, `${d.id} is missing ${key} — it would fall back to browser defaults`);
    }
    assert.ok(d.visuals.iconSet.startsWith("/assets/"), `${d.id} iconSet should be an asset path`);
  }
});

test("machines without graphical icons still declare an icon set", () => {
  // The 3000 and Jr were text-only, but WeatherIcon still needs a base to
  // resolve against for the LDL and any fallback rendering.
  for (const d of DEVICES.filter((x) => !x.capabilities.icons)) {
    assert.ok(d.visuals.iconSet, `${d.id} has no icon set to fall back on`);
  }
});

test("background pools resolve from the device profile", () => {
  // backgroundCatalog used to branch on themeId in three separate functions.
  // The machine now declares which pool it uses and the catalog just honours
  // it — these assertions are what keep that from creeping back.
  for (const d of DEVICES) {
    const list = listBackgrounds(d.id as never);
    if (d.visuals.backgroundPool) {
      assert.ok(list.length > 0, `${d.id} names pool "${d.visuals.backgroundPool}" but it resolved empty`);
      for (const src of list) {
        assert.ok(src.startsWith("/assets/"), `${d.id} pool entry is not an asset path: ${src}`);
      }
    } else {
      assert.deepEqual(list, [], `${d.id} has no pool but listBackgrounds returned entries`);
    }
  }
});

test("pickBackground stays inside the machine's own pool", () => {
  for (const d of DEVICES) {
    const allowed = new Set(listBackgrounds(d.id as never));
    for (let i = 0; i < 30; i++) {
      const pick = pickBackground(d.id as never);
      if (!d.visuals.backgroundPool) {
        assert.equal(pick, "", `${d.id} has no pool but produced "${pick}"`);
      } else {
        assert.ok(allowed.has(pick), `${d.id} picked "${pick}", which is not in its pool`);
      }
    }
  }
});

test("only IntelliStar 2 swaps art for severe weather", () => {
  // The LOT8 severe background set is an IS2 behaviour; every other machine
  // should render its normal background during an alert.
  for (const d of DEVICES) {
    const severe = pickBackground(d.id as never, true);
    if (d.id === "intellistar2") {
      assert.match(severe, /Severe/, "IS2 should draw from the LOT8 severe pool");
    } else if (d.visuals.backgroundPool) {
      assert.ok(
        listBackgrounds(d.id as never).includes(severe),
        `${d.id} produced an off-pool background under severe: ${severe}`
      );
    }
  }
});

test("per-scene background sets only exist where the machine varied art", () => {
  const WITH_SETS = ["ws4000-v1", "wsjr", "weatherscan-local"];
  for (const d of DEVICES) {
    const bg = getSceneBackground(d.id as never, "current");
    if (WITH_SETS.includes(d.id)) {
      assert.ok(bg, `${d.id} should have per-scene art for "current"`);
      assert.ok(bg!.startsWith("/assets/"));
    } else {
      assert.equal(bg, null, `${d.id} should defer to CSS / a single background`);
    }
  }
});

// ─── Narrator assignment ───
//
// These pin a historical fact that the code got wrong for a long time, in the
// only way that would have caught it: not by asserting the strings, but by
// asserting that a machine's voice can actually speak that machine's screens.

/**
 * Device/product pairs that are silent because the recording does not exist
 * in the library, not because the wiring is wrong. Each needs a reason, and
 * the test below fails if one of these starts working — a stale exemption
 * hides the next real regression just as effectively as no test at all.
 */
const KNOWN_SILENT = new Map<string, string>([
  [
    "intellistar2:radar",
    "Jim Cantore's library has no radar intro. Whether TWC recorded one for " +
    "the IntelliStar 2 is unresolved; the IS2 StarBundles on archive.org " +
    "would settle it. Until then the scene falls back to spoken text."
  ],
]);

test("known-silent exemptions are still actually silent", () => {
  for (const [key, reason] of KNOWN_SILENT) {
    const [deviceId, product] = key.split(":");
    const d = getDevice(deviceId);
    const clip = pickSceneIntro(d.voice, product, d.extendedDays === 7 ? "7-day" : "5-day");
    assert.equal(
      clip, null,
      `${key} is exempted as silent (${reason}) but now resolves a clip — ` +
      `delete the exemption so the coverage test guards it again`
    );
  }
});

test("every narrating device has a voice with clips for its core products", () => {
  // The general form of the IntelliStar 1 bug. IS1 declared radar as a core
  // product and narration as a capability, but pointed at a narrator with no
  // radar intro in his library, so Local Doppler and Storm Tracker played
  // silence for years. `docs/asset-gaps.md` recorded it as a missing
  // recording; it was a mis-assigned voice. Nothing failed, because nothing
  // checked that the two agreed.
  const NARRATED_PRODUCTS = ["current", "extended", "radar"] as const;
  for (const d of DEVICES) {
    if (!d.capabilities.narration) continue;
    const narrator = getNarrator(d.voice);
    for (const product of NARRATED_PRODUCTS) {
      if (d.products[product]?.availability !== "core") continue;
      // Amy Bargeron's nine clips are the complete set TWC ever recorded, so
      // Weatherscan legitimately has gaps. Everyone else must cover core.
      if (d.voice === "amy-bargeron") continue;
      if (KNOWN_SILENT.has(`${d.id}:${product}`)) continue;
      // Resolve exactly the way the app does, era included — a 5-day machine
      // asking a 7-day-only pool is the other way this fails silently.
      const clip = pickSceneIntro(d.voice, product, d.extendedDays === 7 ? "7-day" : "5-day");
      assert.ok(
        clip,
        `${d.id} shows "${product}" as a core product and claims narration, ` +
        `but its voice (${narrator.label}) has no intro clip for it`
      );
    }
  }
});

test("IntelliStar 1 speaks with Allen Jackson, IntelliStar 2 with Jim Cantore", () => {
  // TWC Archive's Vocal Local article: Jackson voiced the WeatherStar XL and
  // the IntelliStar, and stayed in service until the IntelliStar retired in
  // November 2015. Cantore was recorded for the IntelliStar 2 HD in 2008.
  // The IS1 drive dumps corroborate it — their Vocal Local tree carries the
  // same doppler/LRADAR_DEFAULT filenames as the Allen Jackson library.
  assert.equal(getDevice("intellistar1").voice, "allan-jackson");
  assert.equal(getDevice("intellistar2").voice, "jim-cantore");
});

test("no post-2004 machine is voiced by a pre-2004 narrator", () => {
  // Dan Chandler was TWC's voice from 1987 through the 1990s. His library
  // says so itself — "your local 36 hour forecast", "the five day forecast",
  // both retired in the September 2004 rename. Assigning him to a 2013+ unit
  // put a twenty-five year old voice on HD hardware and produced narration
  // that named products the machine did not have.
  for (const d of DEVICES) {
    if (d.era !== "post-2004") continue;
    assert.notEqual(
      d.voice, "chandler",
      `${d.id} is a post-2004 machine and cannot be voiced by Dan Chandler`
    );
  }
});

test("a machine with no voice track cannot be given one", () => {
  // The WeatherStar 3000 shipped with a warning tone and no narration. A
  // saved narrator preference used to survive a theme switch and put a voice
  // on it anyway, because Settings and App resolved the narrator separately
  // and neither asked the hardware. resolveNarrator is now the only answer.
  assert.equal(resolveNarrator("ws3000", "jim-cantore"), "silent");
  assert.equal(resolveNarrator("ws3000", null), "silent");
  assert.equal(canNarrate("ws3000"), false);
});

test("a narrating machine honours the user's pick, and defaults to its own voice", () => {
  assert.equal(resolveNarrator("intellistar1", null), "allan-jackson", "its own voice");
  assert.equal(resolveNarrator("intellistar1", "jim-cantore"), "jim-cantore", "explicit pick wins");
  assert.equal(resolveNarrator("intellistar2", null), "jim-cantore");
});

test("every narrating machine marks exactly one voice authentic", () => {
  // What the Settings dropdown groups on. Zero would leave the "authentic"
  // group empty; more than one would mean a device claimed two voices.
  for (const d of DEVICES) {
    if (!d.capabilities.narration) continue;
    const authentic = NARRATORS.filter((n) => n.id !== "silent" && isAuthenticVoice(d.id, n.id));
    assert.equal(authentic.length, 1, `${d.id} should have exactly one authentic voice`);
    assert.equal(authentic[0].id, d.voice);
  }
});
