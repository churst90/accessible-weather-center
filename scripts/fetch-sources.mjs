/**
 * Downloads primary-source material for the emulator from the Internet Archive.
 *
 * This is NOT `fetch-assets.mjs`. That one pulls the finished media library
 * from our own GitHub Release. This one pulls the raw upstream material the
 * library is derived from: drive dumps off real WeatherStar and IntelliStar
 * units, and the TWC production packages that shipped to them.
 *
 * Why bother when simulators already publish extracted art: because they are
 * second-hand. A fan project's PNG has been through somebody's crop, resize
 * and re-encode, and when it disagrees with ours there is no way to tell
 * which drifted. A package straight off the hardware is the thing itself, and
 * it carries what screenshots never do — the layout definitions, the config,
 * the file names the machine used, and the audio at original bit depth.
 *
 * RIGHTS. Everything here is The Weather Channel's copyrighted material,
 * uploaded to the Archive by third parties. Fetching it for private study and
 * for a desktop build you run yourself is one thing. Publishing it, or
 * shipping it to weather.codyhurst.com, is another, and the two-tier asset
 * split exists precisely so that decision is made once, in the open, rather
 * than by accident. Anything landing here is `real` tier: it never reaches
 * the web build. See docs/asset-tiers.md.
 *
 * Downloads land in `sources/` (gitignored) and are left as-is. Nothing here
 * writes into `assets/` — extraction and classification are deliberate,
 * separate, reviewable steps.
 *
 * Usage:
 *   node scripts/fetch-sources.mjs --list
 *   node scripts/fetch-sources.mjs --only weatherscan-packages
 *   node scripts/fetch-sources.mjs --only is1-disk --dest /mnt/big/sources
 *   node scripts/fetch-sources.mjs --all            # ~200 GB, asks first
 *   node scripts/fetch-sources.mjs --only xl-resources --dry-run
 *
 * Sizes are checked against the Archive's own metadata before the transfer
 * starts, and every file is verified against the MD5 the Archive publishes.
 * A file already present with a matching digest is skipped, so an interrupted
 * run is resumed by repeating the command.
 */
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const DEST = path.resolve(ROOT, flag("dest", "sources"));
const ONLY = flag("only", "").split(",").map((s) => s.trim()).filter(Boolean);

const step = (m) => console.log(`\n==> ${m}`);
const log = (m) => console.log(`    ${m}`);
const die = (m) => { console.error(`\nERROR: ${m}`); process.exit(1); };
const gb = (n) => `${(n / 1e9).toFixed(2)} GB`;
const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;

/**
 * The catalogue.
 *
 * `files` narrows an Archive item to the members worth taking — several items
 * publish both a full drive image and a trimmed one, and there is no reason
 * to move 120 GB to get at the same filesystem. Omit `files` to take every
 * original file in the item.
 *
 * `priority` is honest about what earns its bandwidth. "high" is small and
 * directly answers an open question in docs/asset-gaps.md.
 */
const SOURCES = [
  {
    id: "weatherscan-packages",
    priority: "high",
    item: "twc_domestic_dynamic-2.10_p1",
    title: "IntelliStar 1 WATT dynamic packages + Weatherscan resources",
    why:
      "The production packages themselves. twc_wxscan_rsrc_main-1.24 and -2.5 " +
      "are the Weatherscan v1 and v2 resource sets, which is where the v2 " +
      "L-bar geometry lives — the single largest unbuilt item on our list. " +
      "Small enough to take without touching any disk image.",
    files: [
      "twc_wxscan_rsrc_main-1.24.tgz",
      "twc_wxscan_rsrc_main-2.5.tgz",
      "twc_wxscan_dynamic-1.2_p1.tgz",
      "twc_wxscan_dynamic-2.12_p1.tgz",
      "twc_wxscan_dynamic-2.13_p1.tgz",
      "twc_istar-1.5_p2.tgz",
      "twc_domestic_dynamic-2.10_p1.tgz",
      "twc_rsrc_maps_intl-1.0.tgz",
      "twc_lib-1.1_p1.tgz",
      "twc_imagesmooth-1.10.tgz",
      "I1 Configs.7z",
      "config.py",
    ],
  },
  {
    id: "weatherscan-local",
    priority: "high",
    item: "wsxl.7z",
    title: "Weatherscan Local, preinstalled copy",
    why:
      "35 MB. Our Weatherscan Local profile is missing four of its five " +
      "regional background packs (forest, ocean, mountain, southwest) and the " +
      "UDL strip.",
  },
  {
    id: "xl-resources",
    priority: "high",
    item: "wsxl_20260126",
    title: "WeatherSTAR XL resources, versions 1-3 + metro maps",
    why:
      "XL v1/v2 resource archives, metro maps, non-CONUS art, and the " +
      "wsp_upgrade_* tarballs. Our XL profile's only recorded gap is a dating " +
      "question these should answer.",
  },
  {
    id: "i1-configs",
    priority: "high",
    item: "i1-configs",
    title: "IntelliStar 1 config dump",
    why: "Rundown order, product naming and per-market config, direct from the unit.",
  },
  // ─── Music ───
  //
  // Worth knowing before you reach for a disk image: the units did not store
  // masters. They played compressed mediapacks, so for anything that started
  // life on a CD the retail disc is a BETTER source than the hardware. That
  // is why the Trammell Starks entry below is a CD rip and not a drive dump.
  // The reverse holds for the in-house and IntelliStar-era material, which
  // was never sold — there the device copy is the only copy.
  // NOT LISTED, deliberately: archive.org/details/music-for-local-forecast.-7z,
  // a lossless CD-DA restoration of the Trammell Starks discs. It was in this
  // catalogue as an upgrade and that was wrong — our copies were bought from
  // Trammell Starks directly at production quality, so there is nothing to
  // gain and 1.5 GB to lose. Recorded here so nobody re-adds it.
  {
    id: "music-weatherscan-local",
    priority: "high",
    item: "weatherscanlocalmusic",
    title: "Weatherscan Local music (28 tracks)",
    why:
      "Fills a real gap rather than duplicating one. Our Weatherscan Local " +
      "profile currently borrows the `weatherscan-inhouse` pool because we " +
      "have no Local-specific music; this is that music.",
  },
  {
    id: "music-intellistar1",
    priority: "high",
    item: "weatherscan_music_i1",
    title: "Weatherscan / IntelliStar 1 music (79 tracks)",
    why:
      "We hold six IntelliStar 1 tracks. This is 79, described as the full " +
      "IntelliStar-system package including the high-quality stereo set.",
  },
  {
    id: "music-2013",
    priority: "medium",
    item: "2013-twc-music",
    title: "2013 'Weather All The Time' rebrand music (Man Made Music)",
    why:
      "The IntelliStar 2 era pool. We hold 18 tracks; this is the 512 MB set.",
  },
  {
    id: "xl-icons",
    priority: "medium",
    item: "weather-star-xl-icons-twc-1998-2006-icons",
    title: "WeatherStar XL icon set, 1998-2006",
    why:
      "360 MB of the 1998-2006 icon library. We already hold .apng icons, so " +
      "this is corroboration and gap-filling rather than a first source.",
  },
  {
    id: "is2-bundles",
    priority: "medium",
    item: "bundles.-7z",
    title: "IntelliStar 2 StarBundles",
    why:
      "5.3 GB. Settles the one open narration question left: whether TWC ever " +
      "recorded a Jim Cantore radar intro for the IntelliStar 2. Also the " +
      "likely home of the LOT8s windowed frame art.",
  },
  {
    id: "is1-goodies",
    priority: "medium",
    item: "intellistar-1-goodies",
    title: "IntelliStar 1 packages, VM and layered source art",
    why:
      "Includes CoreBGTemplate.psd and CoreBGv2.psd — layered background " +
      "source, not flattened exports. `files` omits the 7 GB VMDK; add it " +
      "back if you want a bootable machine rather than the art.",
    files: [
      "IntelliStar 1 Packages.zip",
      "CoreBGTemplate.psd",
      "CoreBGv2.psd",
      "2026_01_25_0x6_Kleki.psd",
      "2026_01_26_09j_Kleki.psd",
    ],
  },
  {
    id: "xl-disk",
    priority: "low",
    item: "weatherstar-xl",
    title: "WeatherSTAR XL drive dump (2005)",
    why: "2.5 GB. A whole XL filesystem. Slower to mine than the resource pack above.",
  },
  {
    id: "is1-disk",
    priority: "low",
    item: "intellistar-1",
    title: "IntelliStar 1 drive dump, Perris CA (2007)",
    why:
      "The machine's whole filesystem — layouts, config, art. Take it for the " +
      "graphics and the product definitions, NOT for narration: our Allen " +
      "Jackson library is already high quality and is not to be replaced. " +
      "Nor for music; a unit only ever held compressed playout copies, so the " +
      "in-house tracks on it are no better than the ones we have (measured — " +
      "see music-review/README.md). `files` takes the 20 GB trimmed image, " +
      "not the 112 GB original; same filesystem, shrunk for this purpose.",
    files: ["i1 Perris 20G.vhd"],
  },
  {
    id: "is1-flatrock",
    priority: "low",
    item: "flat-rock",
    title: "IntelliStar 1 v2.5, Flat Rock IN",
    why: "39 GB. A second IS1 at a different software version — useful for diffing eras.",
  },
];

async function itemMetadata(item) {
  const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(item)}`);
  if (!res.ok) throw new Error(`archive.org metadata ${res.status} for ${item}`);
  const body = await res.json();
  if (!body.files) throw new Error(`no files listed for ${item} — is the identifier right?`);
  return body;
}

/** Original files only: skip the Archive's own generated metadata and torrents. */
function selectFiles(meta, wanted) {
  const originals = meta.files.filter(
    (f) => f.source === "original" && !/\.(xml|sqlite|torrent)$/i.test(f.name)
  );
  if (!wanted) return originals;
  const byName = new Map(originals.map((f) => [f.name, f]));
  const picked = [];
  for (const name of wanted) {
    const hit = byName.get(name);
    if (hit) picked.push(hit);
    else log(`! ${name} is no longer in the item — skipping`);
  }
  return picked;
}

async function md5(file) {
  const hash = createHash("md5");
  await pipeline(createReadStream(file), hash);
  return hash.digest("hex");
}

/**
 * Fetch one file, verifying against the Archive's published MD5.
 *
 * Writes to a .part file and renames on success, so an aborted transfer can
 * never be mistaken for a complete one by a later run.
 */
async function fetchFile(item, file, destDir) {
  const target = path.join(destDir, file.name);
  const part = `${target}.part`;

  if (fs.existsSync(target)) {
    if (!file.md5) { log(`= ${file.name} (present, item publishes no digest)`); return "skipped"; }
    process.stdout.write(`    = ${file.name} — verifying… `);
    const have = await md5(target);
    if (have === file.md5) { console.log("ok"); return "skipped"; }
    console.log("digest mismatch, refetching");
    await fsp.rm(target, { force: true });
  }

  const url = `https://archive.org/download/${encodeURIComponent(item)}/${encodeURIComponent(file.name)}`;
  const size = Number(file.size || 0);
  log(`↓ ${file.name} (${size ? mb(size) : "unknown size"})`);

  // The Archive serves these off rotating nodes and will hand back a 500 or
  // 503 on any given request without meaning it. On a transfer measured in
  // hours that is a certainty, not a risk, so retry before giving up — and
  // when we do give up, the caller records it and keeps going rather than
  // discarding an otherwise complete run over one file.
  let res;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      res = await fetch(url, { redirect: "follow" });
      if (res.ok && res.body) break;
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new Error(`download failed ${res.status}`);
      }
      throw new Error(`download failed ${res.status}`);
    } catch (err) {
      if (attempt === 4) throw new Error(`${file.name}: ${err.message} after 4 attempts`);
      const backoffSec = 2 ** attempt;
      log(`  ${err.message} — retrying in ${backoffSec}s (${attempt}/3)`);
      await new Promise((r) => setTimeout(r, backoffSec * 1000));
    }
  }

  await fsp.mkdir(path.dirname(part), { recursive: true });
  const hash = createHash("md5");
  let seen = 0;
  let lastReport = 0;
  const out = createWriteStream(part);
  const body = Readable.fromWeb(res.body);
  body.on("data", (chunk) => {
    hash.update(chunk);
    seen += chunk.length;
    // Progress on a long transfer, without a line per chunk.
    if (size && seen - lastReport > 25e6) {
      lastReport = seen;
      process.stdout.write(`      ${((seen / size) * 100).toFixed(0)}%\r`);
    }
  });
  await pipeline(body, out);
  if (size) process.stdout.write("            \r");

  const digest = hash.digest("hex");
  if (file.md5 && digest !== file.md5) {
    await fsp.rm(part, { force: true });
    throw new Error(`${file.name}: MD5 mismatch (got ${digest}, expected ${file.md5})`);
  }
  await fsp.rename(part, target);
  return "fetched";
}

async function main() {
  if (has("list") || (!ONLY.length && !has("all"))) {
    console.log("\nPrimary sources. Everything here is `real` tier — never published.\n");
    for (const p of ["high", "medium", "low"]) {
      const group = SOURCES.filter((s) => s.priority === p);
      if (!group.length) continue;
      console.log(`  ${p.toUpperCase()}`);
      for (const s of group) {
        console.log(`    ${s.id.padEnd(22)} ${s.title}`);
        console.log(`    ${"".padEnd(22)} archive.org/details/${s.item}`);
        console.log(`    ${"".padEnd(22)} ${s.why.replace(/\s+/g, " ").slice(0, 300)}`);
        console.log("");
      }
    }
    console.log("  node scripts/fetch-sources.mjs --only <id>[,<id>...]");
    console.log("  node scripts/fetch-sources.mjs --all        (roughly 70 GB with the");
    console.log("                                               default file selections)\n");
    return;
  }

  const chosen = ONLY.length ? SOURCES.filter((s) => ONLY.includes(s.id)) : SOURCES;
  const unknown = ONLY.filter((id) => !SOURCES.some((s) => s.id === id));
  if (unknown.length) die(`unknown source id: ${unknown.join(", ")} (try --list)`);

  await fsp.mkdir(DEST, { recursive: true });
  step(`Resolving ${chosen.length} source${chosen.length === 1 ? "" : "s"} from archive.org`);

  const plan = [];
  let total = 0;
  for (const s of chosen) {
    const meta = await itemMetadata(s.item);
    const files = selectFiles(meta, s.files);
    const bytes = files.reduce((n, f) => n + Number(f.size || 0), 0);
    total += bytes;
    plan.push({ source: s, files });
    log(`${s.id}: ${files.length} file(s), ${gb(bytes)}`);
  }
  log(`total: ${gb(total)}`);

  if (has("dry-run")) { log("dry run — nothing fetched"); return; }

  // A wrong --all on a laptop is a bad afternoon. Make the big ones deliberate.
  if (total > 50e9 && !has("yes")) {
    die(`${gb(total)} is a lot. Re-run with --yes if you meant it, or narrow it with --only.`);
  }

  const failed = [];
  let fetched = 0;
  let skipped = 0;
  for (const { source, files } of plan) {
    step(`${source.id} — ${source.title}`);
    const dir = path.join(DEST, source.id);
    await fsp.mkdir(dir, { recursive: true });
    // Provenance travels with the bytes. A folder of .tgz files with no record
    // of where it came from is worthless six months from now.
    await fsp.writeFile(
      path.join(dir, "SOURCE.txt"),
      [
        source.title,
        `archive.org item : ${source.item}`,
        `url              : https://archive.org/details/${source.item}`,
        `fetched          : ${new Date().toISOString()}`,
        `tier             : real (rights-encumbered, desktop only, never published)`,
        "",
        source.why.replace(/\s+/g, " "),
        "",
        "The Weather Channel's copyrighted material, uploaded to the Internet",
        "Archive by third parties. See docs/asset-tiers.md.",
        "",
      ].join("\n"),
      "utf8"
    );
    for (const f of files) {
      try {
        const outcome = await fetchFile(source.item, f, dir);
        if (outcome === "fetched") fetched++; else skipped++;
      } catch (err) {
        // One bad file must not discard hours of good transfer. Record it,
        // keep going, and report at the end — re-running the same command
        // picks up only what is missing.
        log(`! ${err.message}`);
        failed.push(`${source.id}/${f.name}`);
      }
    }
  }

  step("Done");
  log(`${fetched} fetched, ${skipped} already present, ${failed.length} failed`);
  log(`in ${path.relative(ROOT, DEST) || DEST}/`);
  if (failed.length) {
    log("");
    log("Failed — re-run the same command to retry just these:");
    for (const f of failed) log(`  ${f}`);
  }
  log("Nothing was written to assets/. Extraction is a separate, deliberate step.");
}

main().catch((err) => die(err.message));
