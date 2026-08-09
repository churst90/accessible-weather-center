/**
 * Reports how the library splits between the `real` and `clean` tiers, and
 * fails if anything encumbered would reach a published build.
 *
 * Two modes:
 *
 *   node scripts/check-asset-tiers.mjs
 *       Inventory. Counts and bytes per tier, per category, plus the reason
 *       each category landed where it did.
 *
 *   node scripts/check-asset-tiers.mjs --guard <dir>
 *       Gate. Classifies everything in <dir> — normally the web staging
 *       directory — and exits non-zero if a single `real` asset is present.
 *       Wire this ahead of any deploy. It is the whole point of the split:
 *       the rule stops being something you have to remember.
 *
 * Flags:
 *   --json            machine-readable output
 *   --list-clean      print every publishable asset
 *   --src <dir>       library root (default: assets)
 */
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { classify } from "./asset-tiers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const SRC = path.resolve(ROOT, flag("src", "assets"));
const GUARD = flag("guard", null);
const TARGET = GUARD ? path.resolve(ROOT, GUARD) : SRC;

const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;

async function walk(dir, base = dir, out = []) {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, base, out);
    else if (e.isFile() && e.name !== ".gitkeep") {
      out.push({ rel: path.relative(base, full).split(path.sep).join("/"), full });
    }
  }
  return out;
}

async function main() {
  if (!fs.existsSync(TARGET)) {
    console.error(`\nERROR: ${path.relative(ROOT, TARGET) || TARGET} does not exist`);
    process.exit(1);
  }

  const files = await walk(TARGET);
  const rows = [];
  for (const f of files) {
    const verdict = classify(f.rel);
    let size = 0;
    try { size = (await fsp.stat(f.full)).size; } catch { /* raced deletion */ }
    rows.push({ ...f, ...verdict, size });
  }

  const real = rows.filter((r) => r.tier === "real");
  const clean = rows.filter((r) => r.tier === "clean");
  const bytes = (rs) => rs.reduce((n, r) => n + r.size, 0);

  if (has("json")) {
    console.log(JSON.stringify({
      root: path.relative(ROOT, TARGET),
      real: { count: real.length, bytes: bytes(real) },
      clean: { count: clean.length, bytes: bytes(clean) },
      files: rows.map(({ rel, tier, why }) => ({ path: rel, tier, why })),
    }, null, 2));
    return;
  }

  // ── Guard mode ────────────────────────────────────────────────────────
  if (GUARD) {
    console.log(`\nGuarding ${path.relative(ROOT, TARGET) || TARGET} — ${rows.length} files`);
    if (real.length === 0) {
      console.log(`\n  OK. ${clean.length} publishable assets, nothing encumbered.\n`);
      return;
    }
    console.error(`\n  BLOCKED. ${real.length} rights-encumbered asset(s) would be published:\n`);
    const byReason = new Map();
    for (const r of real) {
      if (!byReason.has(r.why)) byReason.set(r.why, []);
      byReason.get(r.why).push(r.rel);
    }
    for (const [why, paths] of byReason) {
      console.error(`  ${why}`);
      for (const p of paths.slice(0, 8)) console.error(`      ${p}`);
      if (paths.length > 8) console.error(`      … and ${paths.length - 8} more`);
      console.error("");
    }
    console.error(
      "  Either remove them from the staging directory, or — if one is genuinely\n" +
      "  publishable — add a CLEAN_RULES entry in scripts/asset-tiers.mjs saying why.\n"
    );
    process.exit(1);
  }

  // ── Inventory mode ────────────────────────────────────────────────────
  console.log(`\nAsset tiers in ${path.relative(ROOT, TARGET) || TARGET}\n`);
  console.log(`  real   ${String(real.length).padStart(6)} files  ${mb(bytes(real)).padStart(10)}   desktop only, never published`);
  console.log(`  clean  ${String(clean.length).padStart(6)} files  ${mb(bytes(clean)).padStart(10)}   safe for weather.codyhurst.com`);
  console.log(`  ${"".padEnd(7)}${String(rows.length).padStart(6)} files  ${mb(bytes(rows)).padStart(10)}   total\n`);

  const cats = new Map();
  for (const r of rows) {
    const cat = r.rel.split("/")[0];
    if (!cats.has(cat)) cats.set(cat, { real: 0, clean: 0, bytes: 0, why: r.why });
    const c = cats.get(cat);
    c[r.tier]++;
    c.bytes += r.size;
  }
  console.log("  By category:\n");
  for (const [cat, c] of [...cats].sort((a, b) => b[1].bytes - a[1].bytes)) {
    const mix = c.real && c.clean ? "mixed" : c.clean ? "clean" : "real";
    console.log(`    ${cat.padEnd(14)} ${String(c.real + c.clean).padStart(5)} files  ${mb(c.bytes).padStart(10)}  ${mix}`);
    if (mix !== "mixed") console.log(`    ${"".padEnd(14)} ${c.why}`);
  }

  if (has("list-clean")) {
    console.log(`\n  Publishable assets (${clean.length}):\n`);
    for (const r of clean) console.log(`    ${r.rel}`);
  }

  if (clean.length === 0) {
    console.log(
      "\n  Nothing is publishable yet. That is the honest starting position:\n" +
      "  every asset currently in the library came from TWC hardware. Building\n" +
      "  the clean tier is a content project — recreated icons, generated\n" +
      "  backgrounds, open fonts — not a packaging one. See docs/asset-tiers.md.\n"
    );
  }
  console.log("");
}

main().catch((err) => { console.error(`\nERROR: ${err.message}`); process.exit(1); });
