/**
 * Full narration audit. Answers three questions the existing checks can't:
 *
 *   1. FORWARD  — of every clip the app can ask for, which resolve to a file
 *                 that actually exists, and at what confidence?
 *   2. QUALITY  — how many land below the playback threshold and are
 *                 therefore silently dropped at runtime?
 *   3. REVERSE  — which audio files exist in the library but no semantic ID
 *                 can ever reach? (i.e. clips we own but never play)
 *
 * Why this is needed: `check-asset-refs.mjs` only validates *static* string
 * literals in the source. The bulk of the narration is reached through
 * runtime-composed relative paths joined to a narrator root, so thousands of
 * clips were never covered by any check. That blind spot is what let the
 * clipReferenceTable extension mismatch ship — resolution kept returning
 * real files while every lookup quietly degraded to confidence "guess" and
 * got filtered out before playback.
 *
 * A clip failing here is not loud at runtime. It is silence.
 *
 * Usage:
 *   node scripts/sweep-clips.mjs                 # summary
 *   node scripts/sweep-clips.mjs --verbose       # list every miss
 *   node scripts/sweep-clips.mjs --narrator allan-jackson
 *   node scripts/sweep-clips.mjs --json out.json
 *
 * Exit code 1 if any resolvable clip points at a missing file.
 */
import { build } from "esbuild";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const has = (f) => argv.includes(`--${f}`);
const flag = (f, d) => {
  const i = argv.indexOf(`--${f}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};
const VERBOSE = has("verbose");
const ONLY_NARRATOR = flag("narrator", null);
const JSON_OUT = flag("json", null);
const ASSETS = path.resolve(ROOT, flag("assets", "assets"));

/**
 * Without the media library (CI, or a fresh clone — `assets/` is gitignored)
 * fall back to validating against the committed reference table instead of
 * the filesystem. That still catches the failure mode that matters most:
 * resolved paths drifting away from the names the library actually uses,
 * which is exactly how the .wav -> .mp3 rename broke narration silently.
 */
const HAVE_ASSETS = fs.existsSync(path.join(ASSETS, "narration"));
const TABLE_ONLY = has("table-only") || !HAVE_ASSETS;
if (TABLE_ONLY) {
  console.log(HAVE_ASSETS
    ? "Running in --table-only mode: validating against the reference table."
    : `No media library at ${ASSETS} — validating against the reference table only.`);
}

// The registry is TypeScript; bundle it to a temp ESM module so this script
// can import it directly. Same approach as scripts/run-tests.mjs — esbuild is
// already a Vite dependency, so no new packages.
const outDir = path.join(ROOT, ".sweep-dist");
fs.rmSync(outDir, { recursive: true, force: true });
await build({
  stdin: {
    contents: `
      export { Sem, getLibrary } from "./src/audio/manifests/semanticRegistry";
      export { getNarratorClips } from "./src/audio/data/clipReferenceTable";
      export { NARRATORS, NARRATOR_ASSET_ROOTS, getNarrator } from "./src/audio/manifests/narratorSchema";
      export { getNamedClip } from "./src/audio/manifests/clipSchema";
      export { findLongformMatch } from "./src/audio/manifests/longformSchema";
    `,
    resolveDir: ROOT,
    sourcefile: "sweep-entry.ts",
    loader: "ts"
  },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  outfile: path.join(outDir, "registry.mjs"),
  logLevel: "silent"
});
const reg = await import(pathToFileURL(path.join(outDir, "registry.mjs")).toString());
const { Sem, getLibrary, getNarratorClips, NARRATORS, getNarrator, getNamedClip, findLongformMatch } = reg;

// ───────────────────────── enumerable domains ─────────────────────────

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const PERIODS = [
  ...WEEKDAYS,
  ...WEEKDAYS.map((d) => `${d}_NIGHT`),
  "TODAY", "TONIGHT", "OVERNIGHT", "AFTERNOON"
];
const DIRS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
const WIND_RANGES = [
  "Below_5","5_10","10_15","10_20","15_25","20_30","25_35",
  "25_40","35_50","40_60","50_70","60_80","70_90","80_100","Over_100"
];
const TEMP_RANGES = [
  "BELOW", "WELL_BELOW", "SINGLE",
  ...["H","L","M"].flatMap((p) => ["10","20","30","40","50","60","70","80","90","100"].map((n) => `${p}${n}S`))
];
const NAMED = [
  "current_intro", "current_intro_alt", "mnemonic", "warning_beep",
  "alert_tornado", "alert_tstorm", "alert_flood"
];
const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

/**
 * Condition codes (cc / ccsh / ccef) are derived from NWS forecast text at
 * runtime, so their domain isn't a fixed list. Enumerating them from the
 * filenames on disk is the honest equivalent: every code we own a clip for
 * is a code the app could legitimately ask for.
 */
function codesFromDir(narratorRoot, relDir, transform = (s) => s) {
  const dir = path.join(ASSETS, "narration", narratorRoot, relDir);
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".mp3"))
      .map((f) => transform(path.basename(f, path.extname(f))))
      .filter((c) => c !== null);
  } catch {
    return [];
  }
}

function buildCases(narratorId, roots) {
  const root = roots[narratorId];
  const cases = [];
  const add = (family, id) => cases.push({ family, id });

  for (const p of PERIODS) add("period", Sem.period(p));
  for (const n of range(-99, 139)) add("temp", Sem.temp(n));
  for (const n of range(0, 130)) add("tempHigh", Sem.tempHigh(n));
  for (const n of range(0, 105)) add("tempLow", Sem.tempLow(n));
  for (const c of TEMP_RANGES) {
    add("tempRange", Sem.tempRange(c));
    add("tempHighRange", Sem.tempHighRange(c));
    add("tempRange2", Sem.tempRange2(c));
  }
  for (const d of DIRS) {
    add("windDir1", Sem.windDir1(d));
    add("windDir2", Sem.windDir2(d));
    add("windDir3", Sem.windDir3(d));
    add("windBecoming", Sem.windBecoming(d));
    add("windShifting", Sem.windShifting(d));
  }
  for (const r of WIND_RANGES) {
    add("windAtSpeed", Sem.windAtSpeed(r));
    add("windSpeed", Sem.windSpeed(r));
    add("windAndInc", Sem.windAndInc(r));
    add("windAndDim", Sem.windAndDim(r));
    add("windInc", Sem.windInc(r));
    add("windDim", Sem.windDim(r));
  }
  add("windCalm", Sem.windCalm());
  for (const pct of [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) add("precipProb", Sem.precipProb(pct));
  for (const i of NAMED) add("named", Sem.named(i));

  // Data-derived families.
  const isNum = (s) => /^\d+$/.test(s);
  for (const c of codesFromDir(root, "VocalLocal/Wx_Phrases_Curr_Cond").filter(isNum)) add("cc", Sem.cc(Number(c)));
  for (const c of codesFromDir(root, "Vocal Local/Wx_Phrases_Curr_Cond").filter(isNum)) add("cc", Sem.cc(Number(c)));
  for (const c of codesFromDir(root, "VocalLocal/Wx_Phrases_Shortcast").filter(isNum)) add("ccsh", Sem.ccsh(Number(c)));
  for (const c of codesFromDir(root, "Vocal Local/Wx_Phrases_Shortcast").filter(isNum)) add("ccsh", Sem.ccsh(Number(c)));
  for (const c of codesFromDir(root, "VocalLocal/Wx_Phrases_Ext_Fcast").filter(isNum)) add("ccef", Sem.ccef(Number(c)));
  for (const c of codesFromDir(root, "Vocal Local/Wx_Phrases_Ext_Fcast").filter(isNum)) add("ccef", Sem.ccef(Number(c)));
  for (const c of codesFromDir(root, "VocalLocal/Wx_Phrases_Qualifiers").filter(isNum)) add("qualifier", Sem.qualifier(Number(c)));
  for (const c of codesFromDir(root, "Vocal Local/Wx_Phrases_Qualifiers").filter(isNum)) add("qualifier", Sem.qualifier(Number(c)));
  for (const c of codesFromDir(root, "Vocal Local/Wx_Phrases_RateOP", (b) => (b.startsWith("R") ? b.slice(1) : null)).filter((c) => c && isNum(c))) {
    add("rateOp", Sem.rateOp(Number(c)));
  }

  return cases;
}

// Narrator roots, mirroring NARRATOR_ASSET_ROOTS in narratorSchema.ts.
const ROOTS = {
  "allan-jackson": "Alan Jackson",
  "jim-cantore": "Jim Cantore",
  "amy-bargeron": "Amy Bargeron",
  "chandler": "Chandler"
};

// ─────────────────────────── forward sweep ───────────────────────────

/** Does this clip exist? Filesystem when we have it, reference table when we
 *  don't. `relPath` is relative to assets/. */
function clipExists(relPath, narratorId) {
  if (!TABLE_ONLY) return fs.existsSync(path.join(ASSETS, relPath));
  const root = `narration/${ROOTS[narratorId]}/`;
  if (!relPath.startsWith(root)) return true; // outside the narrator tree
  return Boolean(getNarratorClips(narratorId)[relPath.slice(root.length)]);
}

const report = { narrators: {}, generatedAt: new Date().toISOString() };
const reachableExtra = new Set();
let anyMissing = false;

for (const narratorId of Object.keys(ROOTS)) {
  if (ONLY_NARRATOR && narratorId !== ONLY_NARRATOR) continue;
  const lib = getLibrary(narratorId);
  const table = getNarratorClips(narratorId);
  const cases = buildCases(narratorId, ROOTS);

  const fam = {};
  const missingFiles = [];
  const guessLevel = [];
  const reachable = new Set();

  for (const { family, id } of cases) {
    fam[family] ??= { asked: 0, unsupported: 0, missing: 0, guess: 0, ok: 0 };
    fam[family].asked++;

    const res = lib.resolve(id);
    if (!res) { fam[family].unsupported++; continue; }

    const rel = res.src.replace(/^\/assets\//, "");
    if (!clipExists(rel, narratorId)) {
      fam[family].missing++;
      missingFiles.push({ id: String(id), src: res.src });
      anyMissing = true;
      continue;
    }
    reachable.add(rel);
    if (res.confidence === "guess") {
      fam[family].guess++;
      guessLevel.push({ id: String(id), src: res.src });
    } else {
      fam[family].ok++;
    }
  }

  // ───────────────────────── reverse sweep ─────────────────────────
  // Which clips do we own but never reach?
  const narratorDir = path.join(ASSETS, "narration", ROOTS[narratorId]);
  const owned = [];
  const walk = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && e.name.toLowerCase().endsWith(".mp3")) {
        owned.push(path.relative(ASSETS, full).split(path.sep).join("/"));
      }
    }
  };
  if (!TABLE_ONLY) walk(narratorDir);
  const unreachable = owned.filter((f) => !reachable.has(f));

  // Group unreachable by directory — a whole directory unreached usually
  // means a missing resolver family rather than a handful of stray files.
  const byDir = {};
  for (const f of unreachable) {
    const d = path.dirname(f).replace(`narration/${ROOTS[narratorId]}/`, "");
    byDir[d] = (byDir[d] ?? 0) + 1;
  }

  report.narrators[narratorId] = {
    families: fam,
    ownedClips: owned.length,
    reachableClips: reachable.size,
    unreachableClips: unreachable.length,
    unreachableByDir: byDir,
    tableKeys: Object.keys(table).length,
    missingFiles,
    guessLevel: guessLevel.length,
    guessSamples: guessLevel.slice(0, 20)
  };
}

// ──────────────── paths outside the semantic registry ────────────────
//
// Scene intros, the clipSchema named singletons, and the longform pool are
// reached through their own resolvers, not through getLibrary(). Amy
// Bargeron and Chandler have NO registry resolvers at all — they are
// intro-only narrators — so without this section the sweep reported them as
// supporting nothing and never checked a single one of their clips.

const extra = { sceneIntros: {}, namedClips: {}, longform: {} };

for (const narratorId of Object.keys(ROOTS)) {
  if (ONLY_NARRATOR && narratorId !== ONLY_NARRATOR) continue;
  const def = getNarrator(narratorId);
  const root = `/assets/narration/${ROOTS[narratorId]}`;
  let checked = 0;
  const missing = [];
  for (const [sceneId, clips] of Object.entries(def.sceneIntros ?? {})) {
    for (const c of clips ?? []) {
      checked++;
      const src = c.file.startsWith("/assets/") ? c.file : `${root}/${c.file}`;
      if (!clipExists(src.replace(/^\/assets\//, ""), narratorId)) {
        missing.push({ scene: sceneId, src });
        anyMissing = true;
      }
      reachableExtra.add(src.replace(/^\/assets\//, ""));
    }
  }
  extra.sceneIntros[narratorId] = { checked, missing };
}

// clipSchema named singletons (shared across narrators).
{
  const NAMED_INTENTS = [
    "current_intro", "current_intro_alt", "mnemonic", "warning_beep",
    "alert_tornado", "alert_tstorm", "alert_flood"
  ];
  const missing = [];
  let checked = 0;
  for (const intent of NAMED_INTENTS) {
    const clip = getNamedClip(intent);
    if (!clip) continue;
    checked++;
    if (!TABLE_ONLY && !fs.existsSync(path.join(ASSETS, clip.src.replace(/^\/assets\//, "")))) {
      missing.push({ intent, src: clip.src }); anyMissing = true;
    }
    reachableExtra.add(clip.src.replace(/^\/assets\//, ""));
  }
  extra.namedClips = { checked, missing };
}

// Longform pool — sample real NWS-style forecast text through the matcher.
{
  const SAMPLES = [
    "A chance of showers and thunderstorms. Mostly cloudy, with a low around 71.",
    "Mostly sunny, with a high near 89. Southeast wind around 5 mph.",
    "Partly cloudy, with a low around 64. Chance of precipitation is 40%.",
    "Snow likely, mainly before noon. Cloudy, with a high near 31.",
    "Patchy fog before 9am. Otherwise, sunny, with a high near 75.",
    "Scattered showers and thunderstorms after 2pm. Windy, with gusts to 30 mph.",
    "Clear, with a low around 52.",
    "Rain and snow showers likely. Cloudy, with a high near 38."
  ];
  for (const narratorId of ["allan-jackson", "jim-cantore"]) {
    if (ONLY_NARRATOR && narratorId !== ONLY_NARRATOR) continue;
    let matched = 0;
    const missing = [];
    for (const text of SAMPLES) {
      const res = findLongformMatch(text, narratorId);
      if (!res) continue;
      matched++;
      if (!clipExists(res.src.replace(/^\/assets\//, ""), narratorId)) {
        missing.push({ text: text.slice(0, 40), src: res.src }); anyMissing = true;
      }
      reachableExtra.add(res.src.replace(/^\/assets\//, ""));
    }
    extra.longform[narratorId] = { samples: SAMPLES.length, matched, missing };
  }
}

console.log(`\n${"=".repeat(78)}\nPaths outside the semantic registry\n${"=".repeat(78)}`);
for (const [n, r] of Object.entries(extra.sceneIntros)) {
  const mark = r.missing.length ? ` <-- ${r.missing.length} MISSING` : "";
  console.log(`scene intros   ${n.padEnd(16)} ${String(r.checked).padStart(4)} clips${mark}`);
  for (const m of r.missing.slice(0, VERBOSE ? 200 : 5)) console.log(`     ${m.scene}: ${m.src}`);
}
console.log(`named clips    ${String(extra.namedClips.checked).padStart(21)} clips` +
  (extra.namedClips.missing.length ? ` <-- ${extra.namedClips.missing.length} MISSING` : ""));
for (const m of extra.namedClips.missing) console.log(`     ${m.intent}: ${m.src}`);
for (const [n, r] of Object.entries(extra.longform)) {
  const mark = r.missing.length ? ` <-- ${r.missing.length} MISSING` : "";
  console.log(`longform       ${n.padEnd(16)} ${String(r.matched).padStart(4)}/${r.samples} samples matched${mark}`);
  for (const m of r.missing.slice(0, VERBOSE ? 200 : 5)) console.log(`     ${m.src}`);
}
report.extra = extra;

// ─────────────────────────────── output ───────────────────────────────

const pct = (a, b) => (b === 0 ? "  n/a" : `${((a / b) * 100).toFixed(1).padStart(5)}%`);

for (const [narratorId, r] of Object.entries(report.narrators)) {
  console.log(`\n${"=".repeat(78)}\n${narratorId}\n${"=".repeat(78)}`);
  console.log("family            asked  unsupported  missing-file  guess-conf  playable");
  console.log("-".repeat(78));
  const totals = { asked: 0, unsupported: 0, missing: 0, guess: 0, ok: 0 };
  for (const [name, f] of Object.entries(r.families).sort()) {
    for (const k of Object.keys(totals)) totals[k] += f[k];
    const mark = f.missing > 0 ? " <-- MISSING FILES" : f.asked > 0 && f.ok === 0 ? " <-- NEVER PLAYS" : "";
    console.log(
      `${name.padEnd(16)} ${String(f.asked).padStart(6)} ${String(f.unsupported).padStart(12)} ` +
      `${String(f.missing).padStart(13)} ${String(f.guess).padStart(11)} ${String(f.ok).padStart(9)}${mark}`
    );
  }
  console.log("-".repeat(78));
  console.log(
    `${"TOTAL".padEnd(16)} ${String(totals.asked).padStart(6)} ${String(totals.unsupported).padStart(12)} ` +
    `${String(totals.missing).padStart(13)} ${String(totals.guess).padStart(11)} ${String(totals.ok).padStart(9)}`
  );
  console.log(
    `\nplayable at default "likely" threshold: ${totals.ok}/${totals.asked - totals.unsupported} ` +
    `(${pct(totals.ok, totals.asked - totals.unsupported)} of supported)`
  );
  console.log(`clips owned: ${r.ownedClips}   reachable: ${r.reachableClips}   never reached: ${r.unreachableClips}`);

  const top = Object.entries(r.unreachableByDir).sort((a, b) => b[1] - a[1]).slice(0, VERBOSE ? 100 : 12);
  if (top.length) {
    console.log(`\nlargest unreached directories:`);
    for (const [d, n] of top) console.log(`   ${String(n).padStart(5)}  ${d}`);
  }
  if (r.missingFiles.length) {
    console.log(`\nRESOLVES BUT FILE IS MISSING (${r.missingFiles.length}):`);
    for (const m of r.missingFiles.slice(0, VERBOSE ? 500 : 15)) console.log(`   ${m.id} -> ${m.src}`);
    if (!VERBOSE && r.missingFiles.length > 15) console.log(`   … ${r.missingFiles.length - 15} more (--verbose)`);
  }
  if (r.guessSamples.length) {
    console.log(`\nresolve at "guess" confidence — DROPPED at the default threshold (${r.guessLevel}):`);
    for (const g of r.guessSamples.slice(0, VERBOSE ? 500 : 10)) console.log(`   ${g.id} -> ${g.src}`);
  }
}

if (JSON_OUT) {
  await fsp.writeFile(path.resolve(ROOT, JSON_OUT), JSON.stringify(report, null, 2));
  console.log(`\nwrote ${JSON_OUT}`);
}

fs.rmSync(outDir, { recursive: true, force: true });
process.exit(anyMissing ? 1 : 0);
