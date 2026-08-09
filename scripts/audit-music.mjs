/**
 * Reports what the music library actually IS, as opposed to what its file
 * headers claim.
 *
 * The distinction matters because an MP3 tagged "2 channels" tells you
 * nothing about whether there is stereo information in it. A mono master
 * encoded to a stereo stream, or a device playback copy that folded the image
 * down, both come back as `channels=2` from ffprobe while carrying identical
 * left and right. The only way to know is to measure: subtract the channels
 * and look at what is left.
 *
 *   side RMS < -60 dBFS   left and right are identical — mono in a stereo wrapper
 *   -60 to -40 dBFS       trace difference, effectively mono (encoder noise)
 *   > -40 dBFS            genuine stereo image
 *
 * Usage:
 *   node scripts/audit-music.mjs                  # the whole library
 *   node scripts/audit-music.mjs --dir <path>     # anywhere, e.g. sources/
 *   node scripts/audit-music.mjs --json
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
const has = (n) => argv.includes(`--${n}`);

const DIR = path.resolve(ROOT, flag("dir", "assets/music"));
const AUDIO = /\.(mp3|m4a|wav|flac|aiff?|ogg|mp2)$/i;

async function walk(dir, out = []) {
  let entries;
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (AUDIO.test(e.name)) out.push(full);
  }
  return out;
}

async function probe(file) {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-select_streams", "a:0",
    "-show_entries", "stream=channels,sample_rate,bit_rate,codec_name",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=0", file,
  ]);
  const get = (k) => (stdout.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1] || "";
  return {
    codec: get("codec_name"),
    channels: Number(get("channels")) || 0,
    rate: Number(get("sample_rate")) || 0,
    // Some MP3s report no stream bitrate; fall back to size/duration later.
    kbps: Math.round((Number(get("bit_rate")) || 0) / 1000),
    seconds: Number(get("duration")) || 0,
  };
}

/** RMS of (L-R)/2 in dBFS. -inf (silence) means the channels are identical. */
async function sideRms(file) {
  // -nostdin matters: without it ffmpeg consumes the caller's stdin, which is
  // how the first version of this check ate its own input loop.
  // -v info, not error: astats reports at info level, so suppressing it also
  // suppresses the measurement this function exists to take.
  const { stderr } = await run("ffmpeg", [
    "-nostdin", "-v", "info", "-i", file,
    "-af", "pan=mono|c0=0.5*c0-0.5*c1,astats=metadata=1:reset=0",
    "-f", "null", "-",
  ], { maxBuffer: 32 * 1024 * 1024 });
  const m = stderr.match(/RMS level dB:\s*(-?[\d.]+|-inf)/);
  if (!m) return null;
  return m[1] === "-inf" ? -Infinity : Number(m[1]);
}

function verdict(rms, channels) {
  if (channels < 2) return "mono";
  if (rms === null) return "?";
  if (rms < -60) return "mono";
  if (rms < -40) return "near-mono";
  return "stereo";
}

async function main() {
  if (!fs.existsSync(DIR)) { console.error(`\nERROR: ${DIR} does not exist`); process.exit(1); }
  const files = (await walk(DIR)).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  if (!files.length) { console.log(`\nNo audio under ${path.relative(ROOT, DIR)}\n`); return; }

  const rows = [];
  for (const f of files) {
    let info, rms = null;
    try { info = await probe(f); } catch { continue; }
    if (info.channels >= 2) { try { rms = await sideRms(f); } catch { /* leave null */ } }
    const size = (await fsp.stat(f)).size;
    if (!info.kbps && info.seconds) info.kbps = Math.round((size * 8) / info.seconds / 1000);
    rows.push({
      rel: path.relative(DIR, f),
      group: path.dirname(path.relative(DIR, f)).split(path.sep)[0] || ".",
      ...info, rms, verdict: verdict(rms, info.channels), size,
    });
  }

  if (has("json")) { console.log(JSON.stringify(rows, null, 2)); return; }

  console.log(`\nMusic audit — ${path.relative(ROOT, DIR) || DIR}  (${rows.length} tracks)\n`);
  let lastGroup = null;
  for (const r of rows) {
    if (r.group !== lastGroup) { console.log(`  ${r.group}`); lastGroup = r.group; }
    const rms = r.rms === null ? "  n/a" : r.rms === -Infinity ? " -inf" : r.rms.toFixed(1).padStart(6);
    console.log(
      `    ${path.basename(r.rel).padEnd(28)} ${String(r.kbps).padStart(4)}k ` +
      `${String(r.rate).padStart(6)}Hz ${r.channels}ch  side ${rms} dB  ${r.verdict}`
    );
  }

  const tally = rows.reduce((m, r) => (m[r.verdict] = (m[r.verdict] || 0) + 1, m), {});
  console.log(`\n  ${rows.length} tracks: ${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(", ")}`);

  const upgradeable = rows.filter((r) => r.verdict === "mono" || r.kbps < 192);
  if (upgradeable.length) {
    console.log(`\n  ${upgradeable.length} worth re-sourcing (mono, or under 192 kbps):`);
    for (const r of upgradeable) {
      const reasons = [r.verdict === "mono" ? "mono" : null, r.kbps < 192 ? `${r.kbps}k` : null]
        .filter(Boolean).join(", ");
      console.log(`    ${r.rel}  (${reasons})`);
    }
  }
  console.log("");
}

main().catch((e) => { console.error(`\nERROR: ${e.message}`); process.exit(1); });
