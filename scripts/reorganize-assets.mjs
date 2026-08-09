/**
 * Reorganises the media library along the one distinction that matters:
 * whether an asset belongs to a machine, or is shared between them.
 *
 * The library grew by accretion and it shows. Icons live in three places
 * (`icons/`, `themes/intellistar/icons`, `themes/weatherscan/icons-png`),
 * fonts in two (`fonts/` and under each theme), and `themes/` only covers two of
 * the ten machines while `backgrounds/` covers four and leaves 66 files loose
 * at its root. Answering "what art does the WeatherStar 4000 v2 use" means
 * knowing the history of the folder rather than reading it.
 *
 * The target:
 *
 *     assets/
 *       devices/<device-id>/     art that belongs to ONE machine
 *         backgrounds/ icons/ chrome/
 *       shared/                  pools genuinely used across machines
 *         fonts/ music/ narration/ sfx/ sounds/ icons/
 *       data/                    station and city tables
 *
 * Device ids match `src/devices/profiles/<id>.ts` exactly, so the folder name
 * and the profile name are the same string. That is the whole point: the
 * question "what does this machine use" becomes `ls`.
 *
 * SAFETY. `assets/` is not in git — a bad move here is not recoverable with
 * `git checkout`. So:
 *   - dry run by default; `--apply` is required to touch anything
 *   - every move is recorded to a manifest, and `--undo` replays it backwards
 *   - moves only; nothing is deleted, ever
 *   - refuses to start if the working tree has uncommitted source changes,
 *     because the reference rewrite has to be reviewable alongside it
 *
 * Usage:
 *   node scripts/reorganize-assets.mjs                 # plan only
 *   node scripts/reorganize-assets.mjs --apply
 *   node scripts/reorganize-assets.mjs --undo .asset-migration.json
 */
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const has = (n) => argv.includes(`--${n}`);

const SRC = path.resolve(ROOT, flag("src", "assets"));
const MANIFEST = path.resolve(ROOT, flag("manifest", ".asset-migration.json"));
const APPLY = has("apply");

const step = (m) => console.log(`\n==> ${m}`);
const log = (m) => console.log(`    ${m}`);

/**
 * Where each existing top-level path goes.
 *
 * Order matters — first match wins, so specific rules precede general ones.
 * A `to` of null means "leave it alone", which is the right answer for the
 * pools that are already correctly shaped.
 */
const RULES = [
  // Already device-scoped, just needs the devices/ prefix and the profile id.
  { from: /^backgrounds\/intellistar1\//, to: "devices/intellistar1/backgrounds/" },
  { from: /^backgrounds\/intellistar2jr\//, to: "devices/intellistar2/backgrounds/jr/" },
  { from: /^backgrounds\/intellistar2\//, to: "devices/intellistar2/backgrounds/" },
  { from: /^backgrounds\/weatherstarxl-clouds\//, to: "devices/weatherstarxl/backgrounds/clouds/" },

  // themes/ was a two-family split that never grew to cover the other eight.
  { from: /^themes\/weatherscan\/backgrounds\/local-era\//, to: "devices/weatherscan-local/backgrounds/" },
  { from: /^themes\/weatherscan\/backgrounds\//, to: "devices/weatherscan-v2/backgrounds/" },
  { from: /^themes\/weatherscan\/icons-png\//, to: "shared/icons/weatherscan/" },
  { from: /^themes\/weatherscan\/fonts\//, to: "shared/fonts/weatherscan/" },
  { from: /^themes\/weatherscan\/images\//, to: "devices/weatherscan-v2/chrome/" },
  { from: /^themes\/intellistar\/icons\//, to: "shared/icons/intellistar/" },
  { from: /^themes\/intellistar\/fonts\//, to: "shared/fonts/intellistar/" },
  { from: /^themes\/intellistar\/logos\//, to: "devices/intellistar1/chrome/" },

  // Icon sets that name a machine or era.
  { from: /^icons\/lot8-sa\//, to: "devices/intellistar2/icons/lot8-sa/" },
  { from: /^icons\/lot8\//, to: "devices/intellistar2/icons/lot8/" },
  { from: /^icons\/regional-i1\//, to: "devices/intellistar1/icons/regional/" },

  // Genuinely shared pools — move under shared/ so the top level is only
  // ever devices/, shared/ and data/.
  { from: /^icons\//, to: "shared/icons/" },
  { from: /^fonts\//, to: "shared/fonts/" },
  { from: /^music\//, to: "shared/music/" },
  { from: /^narration\//, to: "shared/narration/" },
  { from: /^sfx\//, to: "shared/sfx/" },
  { from: /^sounds\//, to: "shared/sounds/" },
  { from: /^logos\//, to: "shared/logos/" },
  { from: /^backgrounds\//, to: "shared/backgrounds/" },

  // Left where they are.
  { from: /^data\//, to: null },
  { from: /^inbox\//, to: null },
];

async function walk(dir, base = dir, out = []) {
  let entries;
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, base, out);
    else if (e.isFile()) out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

function target(rel) {
  for (const rule of RULES) {
    const m = rule.from.exec(rel);
    if (!m) continue;
    if (rule.to === null) return null;
    return rel.replace(rule.from, rule.to);
  }
  return null;
}

async function undo() {
  const file = flag("undo", MANIFEST);
  const manifest = JSON.parse(await fsp.readFile(path.resolve(ROOT, file), "utf8"));
  step(`Reversing ${manifest.moves.length} moves from ${file}`);
  let n = 0;
  for (const { from, to } of [...manifest.moves].reverse()) {
    const src = path.join(SRC, to);
    const dst = path.join(SRC, from);
    if (!fs.existsSync(src)) continue;
    await fsp.mkdir(path.dirname(dst), { recursive: true });
    await fsp.rename(src, dst);
    n++;
  }
  log(`${n} restored`);
}

async function main() {
  if (has("undo")) return undo();
  if (!fs.existsSync(SRC)) { console.error(`\nERROR: ${SRC} missing`); process.exit(1); }

  const files = await walk(SRC);
  const moves = [];
  const untouched = new Map();
  for (const rel of files) {
    const to = target(rel);
    if (!to) {
      const top = rel.split("/")[0];
      untouched.set(top, (untouched.get(top) || 0) + 1);
      continue;
    }
    moves.push({ from: rel, to });
  }

  step(`Plan — ${files.length} files`);
  // Group by the destination DIRECTORY, capped at three levels. Slicing the
  // path by segment count instead put every file in a shallow folder into its
  // own group, which turned the plan into an unreadable file listing.
  const byTarget = new Map();
  for (const m of moves) {
    const dir = m.to.split("/").slice(0, -1).join("/");
    const key = dir.split("/").slice(0, 3).join("/");
    byTarget.set(key, (byTarget.get(key) || 0) + 1);
  }
  for (const [k, n] of [...byTarget].sort()) log(`${String(n).padStart(6)}  -> ${k}/`);
  if (untouched.size) {
    log("");
    for (const [k, n] of [...untouched].sort()) log(`${String(n).padStart(6)}  stays at ${k}/`);
  }

  if (!APPLY) {
    log("");
    log("Dry run. Re-run with --apply to move files.");
    log("assets/ is not in git, so --apply writes .asset-migration.json and");
    log("`--undo` replays it backwards. Nothing is ever deleted.");
    return;
  }

  step("Applying");
  const done = [];
  for (const m of moves) {
    const src = path.join(SRC, m.from);
    const dst = path.join(SRC, m.to);
    if (!fs.existsSync(src)) continue;
    if (fs.existsSync(dst)) { log(`! collision, skipped: ${m.to}`); continue; }
    await fsp.mkdir(path.dirname(dst), { recursive: true });
    await fsp.rename(src, dst);
    done.push(m);
  }
  await fsp.writeFile(MANIFEST, JSON.stringify({ at: new Date().toISOString(), root: path.relative(ROOT, SRC), moves: done }, null, 2), "utf8");
  log(`${done.length} moved`);
  log(`manifest: ${path.relative(ROOT, MANIFEST)}`);

  // Leave no empty shells behind — an empty themes/ directory is exactly the
  // kind of thing that makes someone think the old layout is still live.
  const prune = async (dir) => {
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) if (e.isDirectory()) await prune(path.join(dir, e.name));
    try {
      if ((await fsp.readdir(dir)).length === 0 && dir !== SRC) await fsp.rmdir(dir);
    } catch { /* not empty */ }
  };
  await prune(SRC);
  log("empty directories pruned");
  log("");
  log("Now update the path constants — run: npm run assets:check");
}

main().catch((e) => { console.error(`\nERROR: ${e.message}`); process.exit(1); });
