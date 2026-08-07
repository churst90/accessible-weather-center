/**
 * Packs the media library into per-category archives for a GitHub Release.
 *
 * Why a Release and not the repo: the library is ~1.3 GB across ~13,650
 * files. Git would handle that badly, and Git LFS bills for it. GitHub
 * Releases allow up to 2 GB per file with no limit on the number of files
 * and no bandwidth charge — which fits this exactly, provided each archive
 * stays under 2 GB. Splitting by top-level category also means someone who
 * only wants fonts and icons doesn't download 500 MB of music.
 *
 * Compression is gzip level 1 on purpose. The contents are already
 * compressed (MP3, WebP, WOFF2), so higher levels spend a lot of CPU to save
 * almost nothing.
 *
 * Output lands in dist-assets/:
 *   assets-narration.tar.gz, assets-backgrounds.tar.gz, ...
 *   SHA256SUMS
 *   assets-manifest.json   <- consumed by scripts/fetch-assets.mjs
 *
 * Usage:
 *   node scripts/package-assets.mjs [--src assets] [--out dist-assets]
 *                                   [--max-bytes N]
 *
 * Then attach everything in dist-assets/ to a release:
 *   gh release create assets-v1 dist-assets/* --title "Media library v1"
 *
 * NOTE ON RIGHTS: this library is fan-sourced material — TWC narration,
 * production music, background art and typefaces. Bundling it privately for
 * your own use is one thing; publishing it as a public download is a
 * redistribution decision with real copyright exposure, and it is yours to
 * make. See the README's attribution section.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};

const SRC = path.resolve(ROOT, flag("src", "assets"));
const OUT = path.resolve(ROOT, flag("out", "dist-assets"));
/** GitHub's hard per-file limit for release assets is 2 GiB. Stay clear of it. */
const MAX_BYTES = Number(flag("max-bytes", String(1.8 * 1024 ** 3)));

const log = (m) => console.log(m);
const step = (m) => console.log(`\n==> ${m}`);
const die = (m) => { console.error(`\nERROR: ${m}`); process.exit(1); };

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "inherit", "pipe"], ...opts });
    let err = "";
    child.stderr?.on("data", (d) => { err += d.toString(); });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.trim().slice(-500)}`))
    );
  });
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("error", reject)
      .on("data", (d) => hash.update(d))
      .on("end", () => resolve(hash.digest("hex")));
  });
}

async function dirBytes(dir) {
  let total = 0;
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await dirBytes(full);
    else if (entry.isFile()) total += (await fsp.stat(full)).size;
  }
  return total;
}

const human = (n) => (n / 1024 ** 3 >= 1 ? `${(n / 1024 ** 3).toFixed(2)} GB` : `${(n / 1024 ** 2).toFixed(0)} MB`);

fs.existsSync(SRC) || die(`Source directory not found: ${SRC}`);
await fsp.mkdir(OUT, { recursive: true });

step("Scanning categories");
const categories = (await fsp.readdir(SRC, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
categories.length || die(`No category directories under ${SRC}`);

const manifest = {
  createdAt: new Date().toISOString(),
  source: path.relative(ROOT, SRC),
  note: "Unpack every archive into the same target directory; each expands to its own category folder.",
  archives: []
};

let grandRaw = 0;
let grandPacked = 0;

for (const category of categories) {
  const raw = await dirBytes(path.join(SRC, category));
  if (raw === 0) {
    log(`  skip ${category} (empty)`);
    continue;
  }
  grandRaw += raw;

  const name = `assets-${category}.tar.gz`;
  const out = path.join(OUT, name);

  step(`Packing ${category} (${human(raw)} raw)`);
  // -C so paths inside the archive start at the category name, which is what
  // makes "extract every archive into one directory" reconstruct the tree.
  await run("tar", [
    "--use-compress-program", "gzip -1",
    "-cf", out,
    "-C", SRC,
    category
  ]);

  const packed = (await fsp.stat(out)).size;
  grandPacked += packed;
  const digest = await sha256(out);

  if (packed > MAX_BYTES) {
    log(`  WARNING: ${name} is ${human(packed)}, over the ${human(MAX_BYTES)} limit.`);
    log(`  GitHub rejects release assets above 2 GiB. Split this category by hand.`);
  }

  log(`  ${name}  ${human(packed)}  sha256 ${digest.slice(0, 16)}…`);
  manifest.archives.push({ category, file: name, bytes: packed, rawBytes: raw, sha256: digest });
}

step("Writing manifest and checksums");
await fsp.writeFile(path.join(OUT, "assets-manifest.json"), JSON.stringify(manifest, null, 2));
await fsp.writeFile(
  path.join(OUT, "SHA256SUMS"),
  manifest.archives.map((a) => `${a.sha256}  ${a.file}`).join("\n") + "\n"
);

step("Done");
log(`  ${manifest.archives.length} archives in ${path.relative(ROOT, OUT)}/`);
log(`  ${human(grandRaw)} raw -> ${human(grandPacked)} packed`);
log("");
log("  Attach to a release with:");
log(`      gh release create assets-v1 ${path.relative(ROOT, OUT)}/* \\`);
log(`          --title "Media library" --notes "Unpack all archives into one directory."`);
