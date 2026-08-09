/**
 * Finds the same recording across two music directories, by listening to it
 * rather than by trusting its length.
 *
 * The reason this exists: matching on duration alone is worthless here. The
 * in-house library is full of ~190s and ~300s cues, so a naive length match
 * confidently paired five different tracks with the same candidate. Library
 * music is written to fixed broadcast lengths — that is the whole point of it
 * — so duration is nearly a constant, not an identifier.
 *
 * What it does instead: downmix to mono, resample to 8 kHz, take the RMS
 * envelope in 100 ms frames, and compare envelopes by cosine similarity.
 * Loudness contour survives bitrate changes, stereo-to-mono folding and
 * resampling, all of which are exactly the transformations between a CD rip
 * and a device playback copy. It does not survive being a different piece of
 * music, which is the discrimination we need.
 *
 *   > 0.98   same recording, essentially certain
 *   0.90+    very likely the same, worth a listen
 *   < 0.90   different cue
 *
 * Usage:
 *   node scripts/match-music.mjs --left <dir> --right <dir>
 *   node scripts/match-music.mjs --left <dir> --right <dir> --min 0.95
 *   node scripts/match-music.mjs ... --json
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

const LEFT = path.resolve(ROOT, flag("left", "assets/music"));
const RIGHT = path.resolve(ROOT, flag("right", "sources"));
const MIN = Number(flag("min", "0.90"));
const AUDIO = /\.(mp3|m4a|wav|flac|aiff?|ogg|mp2)$/i;

const RATE = 8000;
const FRAME = RATE / 10; // 100 ms

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

/** RMS envelope, 100 ms frames, L2-normalised. */
async function fingerprint(file) {
  const { stdout } = await run(
    "ffmpeg",
    ["-nostdin", "-v", "error", "-i", file, "-ac", "1", "-ar", String(RATE), "-f", "s16le", "-"],
    { encoding: "buffer", maxBuffer: 512 * 1024 * 1024 }
  );
  const samples = new Int16Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.length / 2));
  const frames = Math.floor(samples.length / FRAME);
  if (frames < 20) return null;
  const env = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const off = f * FRAME;
    for (let i = 0; i < FRAME; i++) { const v = samples[off + i] / 32768; sum += v * v; }
    // dB-ish compression: perceived loudness contour discriminates better
    // than raw RMS, which is dominated by the loudest passage.
    env[f] = Math.log10(Math.sqrt(sum / FRAME) + 1e-6);
  }
  const mean = env.reduce((a, b) => a + b, 0) / frames;
  let norm = 0;
  for (let i = 0; i < frames; i++) { env[i] -= mean; norm += env[i] * env[i]; }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < frames; i++) env[i] /= norm;
  return env;
}

/**
 * Best normalised correlation of the shorter envelope against the longer,
 * over all alignments.
 *
 * The first version of this refused any pair whose lengths differed by more
 * than three seconds, on the theory that a different length meant a different
 * cue. That is exactly wrong for library music, which exists precisely as
 * multiple edits of one recording — :30, :60, full, with and without the cold
 * open. A stereo master and the mono playout cut of the same piece routinely
 * differ by more than three seconds, and the guard scored them 0 without ever
 * comparing a sample. It reported "no matches" over a set that had them.
 *
 * Sliding the shorter window through the longer costs more, and finds the
 * shared passage wherever it sits.
 */
function similarity(a, b) {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  const n = short.length;
  if (n < 20) return 0;
  // A cue that only overlaps a sliver of a much longer piece is a coincidence,
  // not a match. Require the shorter to be at least a third of the longer.
  if (n * 3 < long.length) return 0;
  const maxLag = long.length - n;
  // Coarse-to-fine: step the lag, then refine around the best coarse hit.
  const coarse = Math.max(1, Math.floor(maxLag / 200));
  let best = 0, bestLag = 0;
  const score = (lag) => {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < n; i++) {
      const x = short[i], y = long[i + lag];
      dot += x * y; na += x * x; nb += y * y;
    }
    const d = Math.sqrt(na) * Math.sqrt(nb);
    return d ? dot / d : 0;
  };
  for (let lag = 0; lag <= maxLag; lag += coarse) {
    const s = score(lag);
    if (s > best) { best = s; bestLag = lag; }
  }
  for (let lag = Math.max(0, bestLag - coarse); lag <= Math.min(maxLag, bestLag + coarse); lag++) {
    const s = score(lag);
    if (s > best) best = s;
  }
  return best;
}

async function main() {
  for (const [label, dir] of [["--left", LEFT], ["--right", RIGHT]]) {
    if (!fs.existsSync(dir)) { console.error(`\nERROR: ${label} ${dir} does not exist`); process.exit(1); }
  }
  const lefts = (await walk(LEFT)).sort();
  const rights = (await walk(RIGHT)).sort();
  console.error(`fingerprinting ${lefts.length} + ${rights.length} tracks…`);

  const fpL = [], fpR = [];
  for (const f of lefts) { const fp = await fingerprint(f); if (fp) fpL.push({ file: f, fp }); }
  for (const f of rights) { const fp = await fingerprint(f); if (fp) fpR.push({ file: f, fp }); }

  const results = [];
  for (const l of fpL) {
    let best = null;
    for (const r of fpR) {
      const s = similarity(l.fp, r.fp);
      if (!best || s > best.score) best = { score: s, file: r.file };
    }
    results.push({
      left: path.relative(LEFT, l.file),
      right: best && best.score >= MIN ? path.relative(RIGHT, best.file) : null,
      score: best ? best.score : 0,
    });
  }

  if (has("json")) { console.log(JSON.stringify(results, null, 2)); return; }

  const matched = results.filter((r) => r.right);
  console.log(`\nMatches at >= ${MIN} similarity  (${matched.length} of ${results.length})\n`);
  for (const r of matched) {
    console.log(`  ${r.score.toFixed(3)}  ${path.basename(r.left).padEnd(26)} -> ${r.right}`);
  }
  const unmatched = results.filter((r) => !r.right);
  if (unmatched.length) {
    console.log(`\n  No match (${unmatched.length}) — best score shown:\n`);
    for (const r of unmatched) {
      console.log(`  ${r.score.toFixed(3)}  ${path.basename(r.left)}`);
    }
  }
  console.log("");
}

main().catch((e) => { console.error(`\nERROR: ${e.message}`); process.exit(1); });
