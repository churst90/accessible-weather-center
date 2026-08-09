/**
 * Promotes art out of the fetched primary-source packages into the library.
 *
 * `scripts/fetch-sources.mjs` deliberately never writes into `assets/` —
 * downloading and adopting are separate decisions, and adoption is the one
 * that needs a human to have looked. This is that step, made repeatable.
 *
 * What it does per file: extract from the package, convert TIFF to WebP with
 * the same encoder settings the web pipeline uses (cwebp, best of lossy q92
 * and lossless), and land it under the device that owns it. Files already
 * present are skipped, so re-running is safe and cheap.
 *
 * TIFFs matter here specifically. The simulator projects publish PNGs that
 * have been through somebody's crop, resize and re-encode; these are TWC's
 * originals at full resolution, which is the difference between reproducing a
 * screen and reproducing a photograph of a screen.
 *
 * Usage:
 *   node scripts/promote-sources.mjs --list
 *   node scripts/promote-sources.mjs --only weatherscan-backgrounds
 *   node scripts/promote-sources.mjs --all
 *   node scripts/promote-sources.mjs --all --dry-run
 */
import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const has = (n) => argv.includes(`--${n}`);

const SOURCES = path.resolve(ROOT, flag("sources", "sources"));
const ASSETS = path.resolve(ROOT, flag("assets", "assets"));
const ONLY = flag("only", "").split(",").map((s) => s.trim()).filter(Boolean);
const DRY = has("dry-run");

const step = (m) => console.log(`\n==> ${m}`);
const log = (m) => console.log(`    ${m}`);

/**
 * Promotion jobs.
 *
 * `dest` is relative to assets/. Device directories are the profile ids in
 * src/devices/profiles, so a job's destination says which machine claims the
 * art without a lookup table.
 */
const JOBS = [
  {
    id: "weatherscan-v2-backgrounds",
    archive: "weatherscan-packages/twc_wxscan_rsrc_main-2.5.tgz",
    match: /^backgrounds\/.*\.tif$/i,
    dest: "devices/weatherscan-v2/backgrounds/twc-original",
    why: "Weatherscan v2 background plates, TWC originals. Includes the core_* regional packs (forest, ocean, mountain, southwest, city, neighborhood) our profile records as missing.",
  },
  {
    id: "weatherscan-v2-chrome",
    archive: "weatherscan-packages/twc_wxscan_rsrc_main-2.5.tgz",
    match: /^images\/.*\.tif$/i,
    dest: "devices/weatherscan-v2/chrome/twc-original",
    why: "L-bar strips (middle_*, bottom_*), severe tabs, map curves, promo plates and the pressure-trend arrows.",
  },
  {
    id: "weatherscan-v1-backgrounds",
    archive: "weatherscan-packages/twc_wxscan_rsrc_main-1.24.tgz",
    match: /^backgrounds\/.*\.tif$/i,
    dest: "devices/weatherscan-v1/backgrounds",
    why: "Weatherscan v1 plates, including the regional set the Local-era profile shares.",
  },
  {
    id: "weatherscan-v1-chrome",
    archive: "weatherscan-packages/twc_wxscan_rsrc_main-1.24.tgz",
    match: /^(images|logos)\/.*\.tif$/i,
    dest: "devices/weatherscan-v1/chrome",
    why: "v1 chrome and partner logos.",
  },
  {
    id: "weatherscan-fonts",
    archive: "weatherscan-packages/twc_wxscan_rsrc_main-2.5.tgz",
    match: /^fonts\/.*\.ttf$/i,
    dest: "shared/fonts/weatherscan-original",
    copy: true,
    why: "The complete Interstate (37 weights) and Frutiger (14) families as TWC shipped them. Shared, not per-device — several machines drew with both.",
  },
];

/**
 * Convert one image to WebP, mirroring build-web-assets.mjs settings.
 *
 * TIFF goes through ffmpeg to PNG first. cwebp is *documented* as reading
 * TIFF, but only when it was built against libtiff, and the common packaged
 * build is not — it fails with "TIFF support not compiled". Decoding with
 * ffmpeg and handing cwebp a PNG keeps the encoder settings identical to the
 * web pipeline while removing the dependency on how cwebp happened to be
 * compiled. The intermediate is lossless, so nothing is given away.
 */
async function toWebp(src, dst) {
  const tmpLossy = `${dst}.lossy.tmp`;
  const tmpLossless = `${dst}.lossless.tmp`;
  let input = src;
  let intermediate = null;
  if (/\.tiff?$/i.test(src)) {
    // Must END in .png: ffmpeg picks the output muxer from the extension, and
    // a trailing .tmp makes it "Unable to find a suitable output format".
    intermediate = `${dst}.tmp.png`;
    await run("ffmpeg", ["-nostdin", "-v", "error", "-y", "-i", src, intermediate]);
    input = intermediate;
  }
  try {
    await Promise.all([
      run("cwebp", ["-quiet", "-q", "92", "-m", "6", "-alpha_q", "100", input, "-o", tmpLossy]),
      run("cwebp", ["-quiet", "-lossless", "-m", "6", input, "-o", tmpLossless]),
    ]);
  } finally {
    if (intermediate) await fsp.rm(intermediate, { force: true });
  }
  const [a, b] = await Promise.all([fsp.stat(tmpLossy), fsp.stat(tmpLossless)]);
  // Keep whichever encoding is smaller — broadcast plates are often flat
  // gradients where lossless wins outright.
  const keep = a.size <= b.size ? tmpLossy : tmpLossless;
  const drop = keep === tmpLossy ? tmpLossless : tmpLossy;
  await fsp.rename(keep, dst);
  await fsp.rm(drop, { force: true });
}

async function main() {
  if (has("list") || (!ONLY.length && !has("all"))) {
    console.log("\nPromotion jobs — source package -> library destination\n");
    for (const j of JOBS) {
      console.log(`  ${j.id}`);
      console.log(`    from  ${j.archive}  (${j.match})`);
      console.log(`    to    assets/${j.dest}/`);
      console.log(`    ${j.why.replace(/\s+/g, " ")}\n`);
    }
    console.log("  node scripts/promote-sources.mjs --only <id>[,<id>]   |   --all\n");
    return;
  }

  const chosen = ONLY.length ? JOBS.filter((j) => ONLY.includes(j.id)) : JOBS;
  const unknown = ONLY.filter((id) => !JOBS.some((j) => j.id === id));
  if (unknown.length) { console.error(`\nERROR: unknown job: ${unknown.join(", ")}`); process.exit(1); }

  let converted = 0, copied = 0, skipped = 0;
  for (const job of chosen) {
    const archive = path.join(SOURCES, job.archive);
    if (!fs.existsSync(archive)) { log(`skip ${job.id} — ${job.archive} not fetched`); continue; }
    step(`${job.id} -> assets/${job.dest}/`);

    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "awc-promote-"));
    try {
      await run("tar", ["xzf", archive, "-C", tmp]).catch(() => { /* trailing-block warnings */ });
      const files = [];
      const walk = async (d, base) => {
        for (const e of await fsp.readdir(d, { withFileTypes: true })) {
          const full = path.join(d, e.name);
          if (e.isDirectory()) await walk(full, base);
          else files.push(path.relative(base, full).split(path.sep).join("/"));
        }
      };
      await walk(tmp, tmp);
      const wanted = files.filter((f) => job.match.test(f));
      if (!wanted.length) { log("nothing matched"); continue; }

      const outDir = path.join(ASSETS, job.dest);
      if (!DRY) await fsp.mkdir(outDir, { recursive: true });

      for (const rel of wanted) {
        const src = path.join(tmp, rel);
        const base = path.basename(rel);
        const out = path.join(outDir, job.copy ? base : base.replace(/\.tiff?$/i, ".webp"));
        if (fs.existsSync(out)) { skipped++; continue; }
        if (DRY) { converted++; continue; }
        if (job.copy) { await fsp.copyFile(src, out); copied++; }
        else {
          try { await toWebp(src, out); converted++; }
          catch (err) { log(`! ${base}: ${String(err.message).split("\n")[0]}`); }
        }
      }
      log(`${wanted.length} matched`);
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true });
    }
  }

  step(DRY ? "Dry run" : "Done");
  log(`${converted} converted, ${copied} copied, ${skipped} already present`);
  if (!DRY) log("Run `npm run assets:tiers` to see where they landed.");
}

main().catch((e) => { console.error(`\nERROR: ${e.message}`); process.exit(1); });
