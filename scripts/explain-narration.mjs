/**
 * Explain what a scene will say, and why.
 *
 * The narration layer is hard to debug by reading it: clip families live in
 * directories named by a fan archive rather than by product ("VocalLocal/
 * Default_Phrases_36_Hr_Fcast"), narrator intro keys are camelCase strings
 * that must match lowercase scene ids, TWC renamed two products in 2004 so
 * the right clip depends on which hardware the user picked, and every failure
 * mode is silence rather than an error. Four separate bugs in this area all
 * presented identically: "the narrator didn't say anything."
 *
 * This prints the whole resolution chain for a theme × scene × narrator:
 * the period-accurate product name, the intro keys tried in order, which one
 * won, and whether the file exists.
 *
 * Usage:
 *   node scripts/explain-narration.mjs                      # matrix overview
 *   node scripts/explain-narration.mjs --theme ws3000       # one theme
 *   node scripts/explain-narration.mjs --theme ws3000 --scene hourly
 *   node scripts/explain-narration.mjs --scene localforecast --all-themes
 */
import { build } from "esbuild";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};
const has = (n) => argv.includes(`--${n}`);
const ASSETS = path.resolve(ROOT, flag("assets", "assets"));

const outDir = path.join(ROOT, ".explain-dist");
fs.rmSync(outDir, { recursive: true, force: true });
await build({
  stdin: {
    contents: `
      export { pickSceneIntro, NARRATORS } from "./src/audio/manifests/narratorSchema";
      export { setProductEra, getProductEra, segmentLabel, eraIntroKeys, THEME_PRODUCT_ERA }
        from "./src/audio/manifests/sceneSegments";
      export { THEMES } from "./src/core/settings/themes";
    `,
    resolveDir: ROOT,
    sourcefile: "explain.ts",
    loader: "ts"
  },
  bundle: true, format: "esm", platform: "node", target: "node18",
  outfile: path.join(outDir, "m.mjs"), logLevel: "silent"
});
const m = await import(pathToFileURL(path.join(outDir, "m.mjs")).toString());

const SCENES = [
  "current", "localforecast", "radar", "extended", "hourly", "travel", "almanac",
  "detailed", "feelslike", "stormtracker", "overnight", "weekend", "precip",
  "temptrend", "traffic", "airport", "alerts"
];
const NARRATORS = m.NARRATORS.map((n) => n.id).filter((id) => id !== "silent");
const THEMES = (m.THEMES ?? []).map((t) => t.id);
const THEME_LIST = THEMES.length ? THEMES : Object.keys(m.THEME_PRODUCT_ERA);

const exists = (src) =>
  !fs.existsSync(path.join(ASSETS, "narration"))
    ? null // no media library — can't say
    : fs.existsSync(path.join(ASSETS, src.replace(/^\/assets\//, "")));

function explainOne(themeId, sceneId, narratorId) {
  m.setProductEra(themeId);
  const era = m.getProductEra();
  const label = m.segmentLabel(sceneId, era);
  const eraKeys = m.eraIntroKeys(sceneId);
  const intro = m.pickSceneIntro(narratorId, sceneId);
  return { era, label, eraKeys, intro };
}

const theme = flag("theme", null);
const scene = flag("scene", null);

if (theme && scene) {
  console.log(`\ntheme   : ${theme}`);
  for (const narratorId of NARRATORS) {
    const { era, label, eraKeys, intro } = explainOne(theme, scene, narratorId);
    console.log(`\nscene   : ${scene}`);
    console.log(`era     : ${era}${label ? `  (this unit called it "${label}")` : ""}`);
    console.log(`keys    : ${[...eraKeys, scene].join(" -> ") || scene}`);
    console.log(`narrator: ${narratorId}`);
    if (!intro) {
      console.log(`result  : NO CLIP — the narrator says nothing; the screen reader still reads the scene.`);
      continue;
    }
    const ok = exists(intro.file);
    console.log(`result  : "${intro.text}"`);
    console.log(`file    : ${intro.file}${ok === null ? "  (media library absent, not checked)" : ok ? "  [exists]" : "  [MISSING]"}`);
  }
  process.exit(0);
}

if (scene && has("all-themes")) {
  console.log(`\nscene: ${scene}\n`);
  console.log("theme                era         product name           " + NARRATORS.map((n) => n.slice(0, 9).padEnd(11)).join(""));
  console.log("-".repeat(60 + NARRATORS.length * 11));
  for (const t of THEME_LIST) {
    const cells = NARRATORS.map((n) => {
      const { intro } = explainOne(t, scene, n);
      return (intro ? intro.text.slice(0, 10) : "—").padEnd(11);
    });
    const { era, label } = explainOne(t, scene, NARRATORS[0]);
    console.log(`${t.padEnd(20)} ${era.padEnd(11)} ${(label ?? "—").padEnd(22)} ${cells.join("")}`);
  }
  process.exit(0);
}

// Default: matrix of every theme × scene, showing how many narrators can
// announce it, so gaps are obvious at a glance.
const themes = theme ? [theme] : THEME_LIST;
console.log("\nNarration coverage — narrators able to announce each scene\n");
console.log("scene            " + themes.map((t) => t.slice(0, 12).padEnd(14)).join(""));
console.log("-".repeat(17 + themes.length * 14));
for (const s of SCENES) {
  const cells = themes.map((t) => {
    const n = NARRATORS.filter((nid) => explainOne(t, s, nid).intro).length;
    return `${n}/${NARRATORS.length}`.padEnd(14);
  });
  console.log(`${s.padEnd(16)} ${cells.join("")}`);
}
console.log("\nProduct names that changed with the September 2004 TWC rename:");
for (const s of ["localforecast", "hourly"]) {
  const pre = m.segmentLabel(s, "pre-2004");
  const post = m.segmentLabel(s, "post-2004");
  console.log(`  ${s.padEnd(16)} "${pre}"  ->  "${post}"`);
}
console.log("\nRun with --theme <id> --scene <id> to see the full resolution chain.");
fs.rmSync(outDir, { recursive: true, force: true });
