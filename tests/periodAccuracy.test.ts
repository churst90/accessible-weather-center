import { test } from "node:test";
import assert from "node:assert/strict";
import { pickSceneIntro } from "../src/audio/manifests/narratorSchema";
import {
  setProductEra, getProductEra, segmentLabel, THEME_PRODUCT_ERA
} from "../src/audio/manifests/sceneSegments";
import { isEraStrict } from "../src/audio/manifests/sceneSegments";
import { THEMES } from "../src/core/settings/themes";
import type { NarratorId } from "../src/audio/manifests/narratorSchema";
import { setClipReferenceTable } from "../src/audio/data/clipReferenceTable";
import fullTable from "../src/audio/data/clipReferenceTable.json";

// The runtime loads a compact index over the network; tests install the
// full table directly so transcription text is available for assertions.
setClipReferenceTable(fullTable as never);

/**
 * Period accuracy for the September 2004 TWC product rename.
 *
 * Source: the IntelliStar timeline in docs/reference/is1/handwiki/page.html
 * (mirrored at docs/reference/is1/fandom/page.html), September 2004:
 *
 *   "36 Hour Forecast" is renamed "Local Forecast" when it switches to a
 *   48-hour Local Forecast product...
 *   The hour-by-hour forecast, referred to as "Daily Planner" is now renamed
 *   the "Daypart Forecast".
 *
 * Both names exist in the clip libraries, so without gating a WeatherStar
 * 3000 could announce a product name that did not exist until fourteen years
 * after that unit shipped — or an IntelliStar 2 could use one retired nine
 * years before it launched.
 */

const CLIP_NARRATORS: NarratorId[] = ["allan-jackson", "jim-cantore", "amy-bargeron", "chandler"];
const PRE = Object.entries(THEME_PRODUCT_ERA).filter(([, e]) => e === "pre-2004").map(([t]) => t);
const POST = Object.entries(THEME_PRODUCT_ERA).filter(([, e]) => e === "post-2004").map(([t]) => t);

/** Collect every intro a narrator might pick for a scene (the pool is random). */
function possibleTexts(themeId: string, sceneId: string, narratorId: NarratorId, tries = 60): Set<string> {
  setProductEra(themeId);
  const out = new Set<string>();
  for (let i = 0; i < tries; i++) {
    const intro = pickSceneIntro(narratorId, sceneId);
    if (intro) out.add(intro.text.toLowerCase());
  }
  return out;
}

test("every theme has a declared product era", () => {
  for (const theme of THEMES) {
    assert.ok(
      THEME_PRODUCT_ERA[theme.id],
      `theme "${theme.id}" has no product era — it would silently default to post-2004`
    );
  }
});

test("post-2004 hardware never says 'Daily Planner'", () => {
  // Renamed to "Daypart Forecast" in September 2004. Only enforced for
  // narrators whose library holds both namings — see ERA_STRICT_NARRATORS.
  for (const themeId of POST) {
    for (const n of CLIP_NARRATORS.filter((x) => isEraStrict(x))) {
      for (const text of possibleTexts(themeId, "hourly", n)) {
        assert.ok(
          !text.includes("daily planner"),
          `${themeId} / ${n} can say "${text}" on the hourly scene — that name was retired in 2004`
        );
      }
    }
  }
});

test("post-2004 hardware never says '36-hour forecast'", () => {
  // Renamed to "Local Forecast" in September 2004. Chandler's whole pool uses
  // the older phrasing and Amy has only the newer one, so neither can be held
  // to this — enforcing it would mute them entirely.
  for (const themeId of POST) {
    for (const n of CLIP_NARRATORS.filter((x) => isEraStrict(x))) {
      for (const text of possibleTexts(themeId, "localforecast", n)) {
        assert.ok(
          !text.includes("36"),
          `${themeId} / ${n} can say "${text}" on the local forecast — that name was retired in 2004`
        );
      }
    }
  }
});

test("pre-2004 hardware uses the period-correct names where clips exist", () => {
  // Allan Jackson is the narrator with both namings in his library.
  const planner = [...possibleTexts("ws3000", "hourly", "allan-jackson")];
  assert.ok(
    planner.some((t) => t.includes("daily planner")),
    `WeatherStar 3000 should be able to say "Daily Planner"; got: ${planner.join(" | ")}`
  );
  const thirtySix = [...possibleTexts("ws3000", "localforecast", "allan-jackson")];
  assert.ok(
    thirtySix.some((t) => t.includes("36")),
    `WeatherStar 3000 should announce the "36 Hour Forecast"; got: ${thirtySix.join(" | ")}`
  );
});

test("the 36-hour and Daily Planner clips never reach the Extended Forecast", () => {
  // Both are frequently misremembered as extended-forecast phrases. They are
  // not: one is the Local Forecast under its pre-2004 name, the other is the
  // hour-by-hour forecast under its pre-2004 name. The extended scene has its
  // own families, selected by the 5-day / 7-day era tag.
  for (const themeId of [...PRE, ...POST]) {
    for (const n of CLIP_NARRATORS) {
      for (const era of ["5-day", "7-day"] as const) {
        setProductEra(themeId);
        for (let i = 0; i < 40; i++) {
          const intro = pickSceneIntro(n, "extended", era);
          if (!intro) continue;
          const t = intro.text.toLowerCase();
          assert.ok(!t.includes("36"), `${themeId}/${n}/${era}: extended said "${intro.text}"`);
          assert.ok(!t.includes("daily planner"), `${themeId}/${n}/${era}: extended said "${intro.text}"`);
        }
      }
    }
  }
});

test("extended keeps its own era split: 5-day says Extended, 7-day says week/outlook", () => {
  setProductEra("ws4000-v2");
  const fiveDay = new Set<string>();
  const sevenDay = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const a = pickSceneIntro("allan-jackson", "extended", "5-day");
    if (a) fiveDay.add(a.text.toLowerCase());
    const b = pickSceneIntro("allan-jackson", "extended", "7-day");
    if (b) sevenDay.add(b.text.toLowerCase());
  }
  for (const t of fiveDay) {
    assert.ok(t.includes("extended"), `5-day era should say "extended forecast", got "${t}"`);
  }
  assert.ok(
    [...sevenDay].some((t) => t.includes("week") || t.includes("outlook")),
    `7-day era should offer "week ahead" / "7-day outlook", got: ${[...sevenDay].join(" | ")}`
  );
});

test("segment labels report the era-correct product name", () => {
  assert.equal(segmentLabel("localforecast", "pre-2004"), "36 Hour Forecast");
  assert.equal(segmentLabel("localforecast", "post-2004"), "Local Forecast");
  assert.equal(segmentLabel("hourly", "pre-2004"), "Daily Planner");
  assert.equal(segmentLabel("hourly", "post-2004"), "Daypart Forecast");
});

test("setProductEra resolves unknown themes to the modern naming", () => {
  setProductEra("some-future-theme");
  assert.equal(getProductEra(), "post-2004");
});
