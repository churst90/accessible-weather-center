/**
 * Derives the authentic product rundown from real IntelliStar market configs.
 *
 * `sources/i1-configs/I1-Configs.zip` holds ~4,400 per-headend configuration
 * files from deployed IntelliStar 1 units. Each carries playlists in the form
 *
 *     ('CurrentConditions', 0, 8, 11, 4, 1, 1, 0, [...children])
 *      name                     min max opt    prio
 *
 * — the product, how long it was allowed to hold in seconds, and where it sat
 * in the running order. Thousands of markets agreeing on a number is a far
 * better source for "what did this machine do" than any wiki, and unlike a
 * screenshot it covers ordering and timing, which no still can show.
 *
 * We take the modal value per product rather than the mean: these are
 * discrete authored choices, and markets that customised are outliers, not
 * error to be averaged in.
 *
 * A note on what this is NOT used for. Our scenes hold for `holdMs` AFTER
 * narration finishes, because a screen-reader user needs the words before the
 * dwell. Broadcast durations are the total time on screen. Substituting one
 * for the other directly would cut screens short for exactly the users this
 * application exists for, so the timings here are recorded as reference and
 * the ORDERING is what feeds back into the device profiles.
 *
 * Usage:
 *   node scripts/extract-rundowns.mjs
 *   node scripts/extract-rundowns.mjs --out docs/reference/rundowns.md
 */
import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };

const ZIP = path.resolve(ROOT, flag("src", "sources/i1-configs/I1-Configs.zip"));
const OUT = path.resolve(ROOT, flag("out", "docs/reference/rundowns.md"));
const MIN_SAMPLES = 50;

/** TWC product name -> our scene id. Only what we actually render. */
const TO_SCENE = {
  CurrentConditions: "current",
  TextForecast: "localforecast",
  MetroDopplerRadar: "radar",
  RegionalDopplerRadar: "radar",
  "7DayForecast": "extended",
  ExtendedForecast: "extended",
  "5DayForecast": "extended",
  "36HourForecast": "localforecast",
  DaypartForecast: "hourly",
  HourlyForecast: "hourly",
  GetawayForecast: "travel",
  TravelForecast: "travel",
  Almanac: "almanac",
  Climatology: "almanac",
  RecordHighLow: "almanac",
  LocalObservations: "detailed",
  AirQualityForecast: "airquality",
  TrafficFlow: "traffic",
  TrafficOverview: "traffic",
  TrafficReport: "traffic",
  NWSHeadlines: "alerts",
  AirportDelayConditions: "airport",
};

const ENTRY = /\('([A-Za-z0-9_]+)(?:\.\d+)?',\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)/g;

const mode = (arr) => {
  const counts = new Map();
  for (const v of arr) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
};

async function main() {
  if (!fs.existsSync(ZIP)) {
    console.error(`\nERROR: ${path.relative(ROOT, ZIP)} not found — run: node scripts/fetch-sources.mjs --only i1-configs\n`);
    process.exit(1);
  }
  const tmp = path.join(ROOT, ".rundown-extract");
  await fsp.rm(tmp, { recursive: true, force: true });
  await fsp.mkdir(tmp, { recursive: true });
  // bsdtar reads zip; it is present wherever tar is on the platforms we target.
  await run("bsdtar", ["-xf", ZIP, "-C", tmp]);

  const files = [];
  const walk = async (d) => {
    for (const e of await fsp.readdir(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.name.endsWith(".py")) files.push(full);
    }
  };
  await walk(tmp);

  const stats = new Map();
  for (const f of files) {
    let txt;
    try { txt = await fsp.readFile(f, "utf8"); } catch { continue; }
    for (const m of txt.matchAll(ENTRY)) {
      const name = m[1];
      if (!stats.has(name)) stats.set(name, { min: [], max: [], opt: [], prio: [] });
      const s = stats.get(name);
      s.min.push(Number(m[3])); s.max.push(Number(m[4]));
      s.opt.push(Number(m[5])); s.prio.push(Number(m[7]));
    }
  }

  const rows = [...stats.entries()]
    .filter(([, s]) => s.min.length >= MIN_SAMPLES)
    .map(([name, s]) => ({
      name, n: s.min.length,
      min: mode(s.min), max: mode(s.max), opt: mode(s.opt), prio: mode(s.prio),
      scene: TO_SCENE[name] ?? null,
    }))
    .sort((a, b) => a.prio - b.prio || b.n - a.n);

  // Our rundown, derived: first appearance of each scene by priority.
  const derived = [];
  for (const r of rows) if (r.scene && !derived.includes(r.scene)) derived.push(r.scene);

  const doc = [
    "# IntelliStar 1 — authentic product rundown and timings",
    "",
    `Extracted by \`npm run rundowns:extract\` from ${files.length} real per-headend`,
    "IntelliStar configuration files. Do not edit by hand.",
    "",
    "Durations are seconds, as the machine was configured. Modal across all",
    "markets — these are authored choices, so the most common value is the",
    "intended one and a market that customised is an outlier, not error to",
    "average away.",
    "",
    "**These timings are reference, not settings.** Our scenes hold for",
    "`holdMs` *after* narration completes, because a screen-reader user needs",
    "the words before the dwell; broadcast durations are total time on screen.",
    "Substituting one for the other would cut screens short for precisely the",
    "users this application exists for. The ORDERING is what feeds back into",
    "the device profiles.",
    "",
    `## Derived rundown order`,
    "",
    "Products mapped to our scene ids, in broadcast priority order:",
    "",
    "```",
    derived.join(" → "),
    "```",
    "",
    "## Full product table",
    "",
    "| priority | product | markets | min | max | optimal | our scene |",
    "|---:|---|---:|---:|---:|---:|---|",
    ...rows.map((r) =>
      `| ${r.prio} | ${r.name} | ${r.n} | ${r.min} | ${r.max} | ${r.opt} | ${r.scene ?? "—"} |`),
    "",
  ].join("\n");

  await fsp.mkdir(path.dirname(OUT), { recursive: true });
  await fsp.writeFile(OUT, doc, "utf8");
  await fsp.rm(tmp, { recursive: true, force: true });

  console.log(`\nparsed ${files.length} configs, ${rows.length} products above ${MIN_SAMPLES} samples`);
  console.log(`derived rundown: ${derived.join(" -> ")}`);
  console.log(`wrote ${path.relative(ROOT, OUT)}\n`);
}

main().catch((e) => { console.error(`\nERROR: ${e.message}`); process.exit(1); });
