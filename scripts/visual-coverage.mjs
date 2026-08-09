/**
 * Complete visual-asset coverage: every machine, every scene, including the
 * optional ones and the ones the hardware never had.
 *
 * `docs/asset-gaps.md` records what a human wrote down. This measures what is
 * on disk and what the code can actually resolve, per device and per product,
 * so the two can be compared. The gap list is a memory; this is an
 * observation, and where they disagree the observation wins.
 *
 * Per device x product it answers:
 *
 *   availability   core / optional / absent, from the device profile
 *   background     per-device art, or a shared pool this machine draws from
 *   icons          does the machine use condition icons, and do they resolve
 *   layout         do we hold TWC's own render script for this screen
 *   narration      can this machine's voice introduce this product
 *
 * A machine that never had a product is not a gap: `absent` rows are listed
 * so the table is complete, and left out of the totals.
 *
 * Usage:
 *   npm run visual:coverage
 *   node scripts/visual-coverage.mjs --device intellistar2
 */
import { build } from "esbuild";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };

const ASSETS = path.resolve(ROOT, flag("assets", "assets"));
const LAYOUT_DIR = path.resolve(ROOT, "docs/reference/layouts");
const OUT = path.resolve(ROOT, flag("out", "docs/visual-coverage.md"));
const ONLY_DEVICE = flag("device", null);

/** Every scene the app can render, so optional and absent ones are covered. */
const ALL_PRODUCTS = [
  "current", "localforecast", "extended", "hourly", "radar", "travel",
  "almanac", "detailed", "feelslike", "stormtracker", "overnight", "weekend",
  "precip", "temptrend", "traffic", "airport", "alerts",
];

/** Our scene id -> the product names TWC's render scripts use. */
const LAYOUT_ALIASES = {
  current: ["CurrentConditions", "LongCurrentConditions", "ShortCurrentConditions"],
  localforecast: ["TextForecast"],
  extended: ["ExtendedForecast"],
  hourly: ["DaypartForecast"],
  radar: ["LocalDoppler", "RadarSatelliteComposite"],
  almanac: ["Almanac"],
  travel: ["Destinations", "NationalTravelWeather", "InternationalDestinations"],
  traffic: ["TrafficFlow", "TrafficOverview", "TrafficReport"],
  airport: ["LocalAirportConditions", "NationalAirportConditions"],
  alerts: ["WeatherBulletin", "SevereWeatherMessage", "SevereWeatherCrawl"],
  detailed: ["LocalObservations", "RegionalForecastConditions"],
  precip: ["EstimatedPrecipitation", "PrecipitationQpfForecast", "SnowfallQpfForecast"],
  temptrend: ["Climatology"],
  feelslike: ["CurrentConditions"],
  weekend: ["ExtendedForecast"],
  overnight: ["TextForecast"],
  stormtracker: ["LocalDoppler"],
};

const outDir = path.join(ROOT, ".visual-coverage");
fs.rmSync(outDir, { recursive: true, force: true });
await build({
  stdin: {
    contents: `
      export { DEVICES, getDevice, resolveNarrator } from "./src/devices";
      export { pickSceneIntro, getNarrator } from "./src/audio/manifests/narratorSchema";
      export { listBackgrounds, getSceneBackground } from "./src/core/settings/backgroundCatalog";
    `,
    resolveDir: ROOT, sourcefile: "cov.ts", loader: "ts",
  },
  bundle: true, format: "esm", platform: "node", target: "node18",
  outfile: path.join(outDir, "m.mjs"), logLevel: "silent",
});
const m = await import(pathToFileURL(path.join(outDir, "m.mjs")).toString());

const countFiles = (dir) => {
  let n = 0;
  const walk = (d) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (e.name !== ".gitkeep") n++;
    }
  };
  walk(dir);
  return n;
};

/** Which products appear in the extracted TWC render scripts. */
const layoutProducts = new Set();
try {
  for (const f of fs.readdirSync(LAYOUT_DIR)) {
    if (!f.endsWith(".md")) continue;
    const text = fs.readFileSync(path.join(LAYOUT_DIR, f), "utf8");
    for (const mm of text.matchAll(/^### (.+)$/gm)) layoutProducts.add(mm[1].trim());
  }
} catch { /* layouts not extracted */ }

const devices = m.DEVICES.filter((d) => !ONLY_DEVICE || d.id === ONLY_DEVICE);
const lines = [];
let totalNeeded = 0, totalReady = 0;
const shortfalls = [];

for (const d of devices) {
  const deviceDir = path.join(ASSETS, "devices", d.id);
  const bgOwn = countFiles(path.join(deviceDir, "backgrounds"));
  const iconOwn = countFiles(path.join(deviceDir, "icons"));
  const chromeOwn = countFiles(path.join(deviceDir, "chrome"));
  let poolCount = 0;
  try { poolCount = m.listBackgrounds(d.id).length; } catch { /* no pool */ }
  const iconSetDir = path.join(ASSETS, d.visuals.iconSet.replace(/^\/assets\//, ""));
  const iconSetCount = countFiles(iconSetDir);
  const era = d.extendedDays === 7 ? "7-day" : "5-day";

  lines.push(`## ${d.label}`);
  lines.push("");
  lines.push(`\`${d.id}\` · ${d.years} · ${d.era} · voice ${m.resolveNarrator(d.id, null)}`);
  lines.push("");
  lines.push(`- own backgrounds: **${bgOwn}** · own icons: **${iconOwn}** · own chrome: **${chromeOwn}**`);
  lines.push(`- background pool: **${poolCount}** · icon set \`${d.visuals.iconSet}\`: **${iconSetCount}** files`);
  lines.push("");
  lines.push("| scene | availability | background | icons | layout ref | narration |");
  lines.push("|---|---|---|---|---|---|");

  for (const product of ALL_PRODUCTS) {
    const spec = d.products[product];
    const availability = spec?.availability ?? "absent";
    if (availability === "absent") {
      lines.push(`| ${product} | absent | — | — | — | — |`);
      continue;
    }
    totalNeeded++;

    // Four separate ways a machine can be dressed, and a scene only needs one
    // of them. Checking just the per-device folder and the rotating pool
    // reported every WeatherStar as having no art, when the 4000 v1 and the
    // Jr are dressed by a single theme-level plate plus a per-scene set.
    let sceneBg = null;
    try { sceneBg = m.getSceneBackground(d.id, product); } catch { /* none */ }
    const hasBg = bgOwn > 0 || poolCount > 0 || Boolean(d.visuals.backgroundImage) || Boolean(sceneBg);
    const needsIcons = d.capabilities.icons;
    const hasIcons = !needsIcons || iconSetCount > 0;
    const aliases = LAYOUT_ALIASES[product] ?? [];
    const hasLayout = aliases.some((a) => layoutProducts.has(a));
    const clip = m.pickSceneIntro(m.resolveNarrator(d.id, null), product, era);
    const hasNarration = !d.capabilities.narration ? null : Boolean(clip);

    const tick = (v) => (v === null ? "n/a" : v ? "yes" : "**NO**");
    lines.push(
      `| ${product} | ${availability} | ${tick(hasBg)} | ${needsIcons ? tick(hasIcons) : "n/a"} | ` +
      `${hasLayout ? "yes" : "—"} | ${tick(hasNarration)} |`
    );

    const missing = [];
    if (!hasBg) missing.push("background");
    if (needsIcons && !hasIcons) missing.push("icons");
    if (hasNarration === false) missing.push("narration");
    if (missing.length) shortfalls.push({ device: d.id, product, missing });
    else totalReady++;
  }
  lines.push("");
  if (d.gaps?.length) {
    lines.push("**Recorded gaps** (from the device profile):");
    lines.push("");
    for (const g of d.gaps) lines.push(`- ${g}`);
    lines.push("");
  }
}

const doc = [
  "# Visual asset coverage",
  "",
  "Generated by `npm run visual:coverage`. Do not edit by hand.",
  "",
  "Every machine against every scene it can show, optional ones included.",
  "`absent` rows are the hardware being honest about what it never had — they",
  "are listed for completeness and excluded from the totals.",
  "",
  "\"layout ref\" means we hold TWC's own render script for that screen under",
  "`docs/reference/layouts/`, with the real pixel coordinates, typefaces and",
  "point sizes. Where it says yes, the screen can be built exactly rather than",
  "measured off a screenshot.",
  "",
  `**${totalReady} of ${totalNeeded}** device/scene combinations have every visual`,
  `and audio prerequisite present. ${shortfalls.length} fall short.`,
  "",
  "---",
  "",
  ...lines,
  "## What is still missing",
  "",
  shortfalls.length ? "| device | scene | missing |\n|---|---|---|" : "_Nothing._",
  ...shortfalls.map((s) => `| ${s.device} | ${s.product} | ${s.missing.join(", ")} |`),
  "",
].join("\n");

await fsp.mkdir(path.dirname(OUT), { recursive: true });
await fsp.writeFile(OUT, doc, "utf8");
fs.rmSync(outDir, { recursive: true, force: true });
console.log(`\n${totalReady}/${totalNeeded} device/scene combinations complete; ${shortfalls.length} short`);
console.log(`wrote ${path.relative(ROOT, OUT)}\n`);
