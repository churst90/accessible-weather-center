/**
 * Downloads the media library from a GitHub Release and unpacks it.
 *
 * The library is not in the repository and is not bundled into the
 * installers (~1.3 GB). The application runs without it — system fonts, no
 * music, screen-reader narration only — so this is an enhancement step, not
 * a prerequisite.
 *
 * Usage:
 *   node scripts/fetch-assets.mjs                       # into ./assets
 *   node scripts/fetch-assets.mjs --app-data            # into the installed
 *                                                       # app's data dir
 *   node scripts/fetch-assets.mjs --dest /some/path
 *   node scripts/fetch-assets.mjs --only narration,fonts
 *   node scripts/fetch-assets.mjs --tag assets-v2
 *   node scripts/fetch-assets.mjs --list
 *
 * `--app-data` targets the directory the packaged Electron app checks at
 * startup (electron/main.ts, resolveAssetsDir):
 *   Windows  %APPDATA%\accessible-weather-center\assets
 *   macOS    ~/Library/Application Support/accessible-weather-center/assets
 *   Linux    ~/.config/accessible-weather-center/assets
 *
 * Downloads are verified against the SHA-256 recorded at packaging time, and
 * an archive already present with a matching digest is not re-downloaded, so
 * an interrupted run can simply be repeated.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
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

const REPO = flag("repo", "churst90/accessible-weather-center");
const TAG = flag("tag", "assets-v1");
const ONLY = flag("only", "").split(",").map((s) => s.trim()).filter(Boolean);
const LIST = has("list");

const step = (m) => console.log(`\n==> ${m}`);
const log = (m) => console.log(`    ${m}`);
const die = (m) => { console.error(`\nERROR: ${m}`); process.exit(1); };

/** Where the packaged Electron app looks for the library. */
function appDataAssets() {
  const name = "accessible-weather-center";
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), name, "assets");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", name, "assets");
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), name, "assets");
}

const DEST = path.resolve(
  ROOT,
  flag("dest", has("app-data") ? appDataAssets() : "assets")
);
const CACHE = path.join(os.tmpdir(), "awc-asset-download");

const human = (n) => (n / 1024 ** 3 >= 1 ? `${(n / 1024 ** 3).toFixed(2)} GB` : `${(n / 1024 ** 2).toFixed(0)} MB`);

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "inherit", "pipe"] });
    let err = "";
    child.stderr?.on("data", (d) => { err += d.toString(); });
    child.on("error", reject);
    child.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`${cmd} exited ${c}: ${err.trim().slice(-400)}`))));
  });
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(file).on("error", reject).on("data", (d) => h.update(d)).on("end", () => resolve(h.digest("hex")));
  });
}

async function download(url, dest) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

// ------------------------------------------------------------------ main ---
const base = `https://github.com/${REPO}/releases/download/${TAG}`;

step(`Fetching manifest from ${REPO} @ ${TAG}`);
const manifestPath = path.join(CACHE, "assets-manifest.json");
await fsp.mkdir(CACHE, { recursive: true });
try {
  await download(`${base}/assets-manifest.json`, manifestPath);
} catch (err) {
  die(
    `Could not fetch the manifest (${err.message}).\n` +
    `       Check that release '${TAG}' exists on ${REPO} and has assets-manifest.json attached.\n` +
    `       Pass --tag to select a different release.`
  );
}
const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf8"));

let archives = manifest.archives ?? [];
if (ONLY.length) {
  archives = archives.filter((a) => ONLY.includes(a.category));
  const missing = ONLY.filter((c) => !archives.some((a) => a.category === c));
  if (missing.length) die(`Unknown categor${missing.length === 1 ? "y" : "ies"}: ${missing.join(", ")}`);
}

if (LIST) {
  step("Available categories");
  for (const a of manifest.archives) log(`${a.category.padEnd(14)} ${human(a.bytes).padStart(9)}  (${human(a.rawBytes)} unpacked)`);
  log("");
  log(`total: ${human(manifest.archives.reduce((s, a) => s + a.bytes, 0))} download`);
  process.exit(0);
}

const totalBytes = archives.reduce((s, a) => s + a.bytes, 0);
step("Plan");
log(`destination: ${DEST}`);
log(`archives:    ${archives.length}`);
log(`download:    ${human(totalBytes)}`);

await fsp.mkdir(DEST, { recursive: true });

let done = 0;
for (const a of archives) {
  done++;
  const local = path.join(CACHE, a.file);

  // Reuse an already-verified download so a repeated run resumes rather
  // than starting the whole 1.3 GB over.
  let haveValid = false;
  if (fs.existsSync(local)) {
    process.stdout.write(`\n==> [${done}/${archives.length}] ${a.file}: checking cached copy\n`);
    haveValid = (await sha256(local)) === a.sha256;
    if (!haveValid) log("cached copy is corrupt or stale; re-downloading");
  }

  if (!haveValid) {
    step(`[${done}/${archives.length}] Downloading ${a.file} (${human(a.bytes)})`);
    await download(`${base}/${a.file}`, local).catch((err) => die(`Download failed: ${err.message}`));
    const got = await sha256(local);
    if (got !== a.sha256) {
      await fsp.rm(local, { force: true });
      die(`Checksum mismatch for ${a.file}.\n       expected ${a.sha256}\n       got      ${got}`);
    }
    log("checksum OK");
  }

  step(`[${done}/${archives.length}] Extracting ${a.category}`);
  // Each archive expands to its own category directory, so extracting them
  // all into one destination reconstructs the tree.
  await run("tar", ["-xzf", local, "-C", DEST]).catch((err) => die(`Extract failed: ${err.message}`));
  log(`-> ${path.join(DEST, a.category)}`);
}

step("Done");
log(`Media library installed to ${DEST}`);
log(`Cached archives left in ${CACHE} — delete that directory to reclaim ${human(totalBytes)}.`);
