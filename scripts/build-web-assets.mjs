/**
 * Asset transcoder — builds a smaller, web-servable copy of `assets/`.
 *
 * Why: the raw library is ~5.2 GB, dominated by 48 kHz PCM narration WAVs
 * and full-size PNG backgrounds. That's fine for a local Electron build and
 * far too much to push to a web host (and to stream to every visitor).
 * This script produces a byte-for-byte equivalent tree where the two heavy
 * categories are re-encoded and everything else is copied untouched.
 *
 * What it does NOT do: touch the source tree. Input is read-only; the
 * caller decides whether to swap the output in (see docs/asset-pipeline.md).
 *
 * Encoding choices (quality first — these are not "phone quality"):
 *   - Narration/SFX PCM (48 kHz WAV, FLAC, MP2, AIFF) -> MP3 via LAME
 *     128 kbps mono / 192 kbps stereo, source sample rate preserved.
 *     That is ~6:1 on mono PCM and is transparent for speech; well above
 *     the 64-96 kbps range where artifacts become audible. MP3 (rather than
 *     Opus/AAC, which encode more efficiently) because it is the one audio
 *     format every browser on Windows, macOS and Linux decodes without
 *     relying on OS codecs.
 *   - Files already MP3 (including a couple mislabelled `.wav`) are COPIED,
 *     never re-encoded — lossy-to-lossy is the one thing that actually
 *     sounds bad. Music is all MP3 already, so it passes through untouched.
 *   - Backgrounds (PNG) -> WebP. Encoded BOTH lossy (q92) and lossless, and
 *     the smaller result wins. This matters: the library mixes 1920x1080
 *     photography (lossy wins, ~15:1) with flat-colour radar/UI plates
 *     (lossless wins, ~3:1 — lossy is actually LARGER than the source PNG
 *     on those, because it adds noise to flat regions). Picking per file
 *     means no image ever grows. The extension is always .webp so the
 *     catalog's generated path patterns stay uniform.
 *   - Icons, fonts, logos, UI sprites, JSON, and every other file: copied.
 *     Icon PNGs are deliberately excluded — WeatherIcon's runtime fallback
 *     chain already juggles still/webp/gif variants by name, and renaming
 *     underneath it would collide with the .webp files that exist there.
 *
 * Requires `lame`, `ffprobe`, `cwebp` on PATH (and `ffmpeg` only if the
 * source tree contains FLAC/MP2/AIFF, which are decoded through it).
 *
 * Usage:
 *   node scripts/build-web-assets.mjs [--src assets] [--out assets-web]
 *                                     [--jobs N] [--dry-run] [--force]
 *   node scripts/build-web-assets.mjs --verify     # audit an existing build
 *
 * The build is resumable and idempotent: an interrupted run can simply be
 * re-run, and `--verify` proves the result is complete and undamaged.
 *
 * Writes `_transcode-report.json` into the output dir: per-category counts,
 * byte totals, the old->new path map for extension changes, and any errors.
 */
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const SRC = path.resolve(ROOT, flag("src", "assets"));
const OUT = path.resolve(ROOT, flag("out", "assets-web"));
const JOBS = Number(flag("jobs", String(Math.max(1, os.cpus().length - 2))));
const DRY = has("dry-run");
const FORCE = has("force");
const VERIFY = has("verify");

/** Re-encoded to MP3. Anything else audio-shaped is copied. */
const PCM_AUDIO = new Set([".wav", ".flac", ".mp2", ".aif", ".aiff"]);
/** Sound Forge peak files — editor scratch data, useless at runtime. */
const JUNK = new Set([".sfk", ".ds_store", ".db"]);

/**
 * PNGs are converted to WebP only under these path prefixes (relative to
 * SRC, forward slashes). Everything else keeps its original format so that
 * name-based fallback chains and CSS references stay valid.
 */
const WEBP_PREFIXES = ["backgrounds/", "themes/weatherscan/backgrounds/"];

const wantsWebp = (rel) => {
  const norm = rel.split(path.sep).join("/");
  return path.extname(norm).toLowerCase() === ".png" && WEBP_PREFIXES.some((p) => norm.startsWith(p));
};

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${stderr.trim().split("\n").slice(-3).join(" | ")}`))
    );
  });
}

function probe(file) {
  return new Promise((resolve) => {
    const child = spawn("ffprobe", [
      "-v", "error",
      "-select_streams", "a:0",
      "-show_entries", "stream=codec_name,channels",
      "-of", "default=nw=1:nk=1",
      file
    ], { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.on("error", () => resolve(null));
    child.on("close", () => {
      const [codec, channels] = out.trim().split("\n");
      resolve(codec ? { codec, channels: Number(channels) || 1 } : null);
    });
  });
}

async function walk(dir, base = dir, acc = []) {
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, base, acc);
    else if (entry.isFile()) acc.push(path.relative(base, full));
  }
  return acc;
}

const report = {
  startedAt: new Date().toISOString(),
  src: SRC,
  out: OUT,
  encoder: { audio: "lame -b 128 mono / -b 192 stereo", image: "cwebp best-of(q92 lossy, lossless) -m 6" },
  counts: { audioEncoded: 0, audioCopied: 0, webp: 0, webpLossless: 0, copied: 0, skipped: 0, failed: 0 },
  bytes: { in: 0, out: 0 },
  /** Old asset path -> new asset path, for every file whose extension changed.
   *  Both sides are `/assets/...` URLs, exactly as the app references them. */
  renames: {},
  errors: []
};

/**
 * Decide what happens to one source file: where it lands and how it gets
 * there. Single source of truth for the path mapping — both the build pass
 * and `--verify` call this, so the two can never drift apart.
 */
async function plan(rel) {
  const ext = path.extname(rel).toLowerCase();
  if (JUNK.has(ext)) return { mode: "skip", dstRel: null, channels: 1, ext };

  if (PCM_AUDIO.has(ext)) {
    const info = await probe(path.join(SRC, rel));
    // A handful of clips carry a .wav extension but hold MP3 data. Re-encoding
    // those would be a pointless second generation of loss — copy the bytes
    // and just correct the extension.
    return {
      mode: info?.codec === "mp3" ? "copy-as-mp3" : "encode-audio",
      dstRel: rel.slice(0, -ext.length) + ".mp3",
      channels: info?.channels ?? 1,
      ext
    };
  }
  if (wantsWebp(rel)) {
    return { mode: "encode-webp", dstRel: rel.slice(0, -ext.length) + ".webp", channels: 1, ext };
  }
  return { mode: "copy", dstRel: rel, channels: 1, ext };
}

async function handle(rel) {
  const src = path.join(SRC, rel);
  const stat = await fsp.stat(src);
  const { mode, dstRel, channels, ext } = await plan(rel);

  if (mode === "skip") {
    report.counts.skipped++;
    return;
  }
  report.bytes.in += stat.size;

  const dst = path.join(OUT, dstRel);
  if (dstRel !== rel) {
    report.renames[toUrl(rel)] = toUrl(dstRel);
  }

  if (DRY) return;

  await fsp.mkdir(path.dirname(dst), { recursive: true });

  // Resumable: an existing non-empty output is treated as already done.
  if (!FORCE && fs.existsSync(dst) && (await fsp.stat(dst)).size > 0) {
    report.bytes.out += (await fsp.stat(dst)).size;
    report.counts[mode === "encode-webp" ? "webp" : mode === "encode-audio" ? "audioEncoded" : mode === "copy-as-mp3" ? "audioCopied" : "copied"]++;
    return;
  }

  // Everything is written to `dst.part` and renamed into place only on
  // success. Without this, killing the script mid-encode leaves a truncated
  // file that the resume check above would happily accept as finished — a
  // narration clip that cuts off mid-word, silently.
  const part = `${dst}.part`;
  try {
    if (mode === "encode-audio") {
      // Mono speech at 128k and stereo at 192k. Never upmix: a mono clip
      // forced to stereo would double the bitrate for zero added quality.
      const lameArgs = [
        "-b", channels >= 2 ? "192" : "128",
        "-m", channels >= 2 ? "j" : "m",
        "--quiet"
      ];
      if (ext === ".wav") {
        // LAME reads RIFF/WAV natively — one process instead of two.
        await run("lame", [...lameArgs, src, part]);
      } else {
        // FLAC/MP2/AIFF: decode to a temp WAV first, then encode.
        //
        // Deliberately NOT an `ffmpeg | lame` process pipe. Handing
        // ffmpeg's stdout fd to lame's stdin means the parent's copy of
        // that stream is never closed, so ChildProcess 'close' never fires
        // for ffmpeg and the await hangs forever — the worker stalls, the
        // event loop drains, and Node exits 0 with no error and no summary.
        // A temp file costs one write and cannot deadlock.
        const decoded = `${part}.decoded.wav`;
        try {
          await run("ffmpeg", ["-nostdin", "-v", "error", "-y", "-i", src, "-map", "a:0", "-f", "wav", decoded]);
          await run("lame", [...lameArgs, decoded, part]);
        } finally {
          await fsp.rm(decoded, { force: true });
        }
      }
      await fsp.rename(part, dst);
      report.counts.audioEncoded++;
    } else if (mode === "encode-webp") {
      // Encode both ways and keep whichever is smaller — see the header note.
      const lossyTmp = `${dst}.lossy.tmp`;
      const losslessTmp = `${dst}.lossless.tmp`;
      await Promise.all([
        run("cwebp", ["-quiet", "-q", "92", "-m", "6", "-alpha_q", "100", src, "-o", lossyTmp]),
        run("cwebp", ["-quiet", "-lossless", "-m", "6", src, "-o", losslessTmp])
      ]);
      const [lossy, lossless] = await Promise.all([fsp.stat(lossyTmp), fsp.stat(losslessTmp)]);
      const winner = lossless.size <= lossy.size ? losslessTmp : lossyTmp;
      const loser = winner === lossyTmp ? losslessTmp : lossyTmp;
      await fsp.rename(winner, dst);
      await fsp.rm(loser, { force: true });
      if (winner === losslessTmp) report.counts.webpLossless++;
      report.counts.webp++;
    } else {
      await fsp.copyFile(src, part);
      await fsp.rename(part, dst);
      report.counts[mode === "copy-as-mp3" ? "audioCopied" : "copied"]++;
    }
    report.bytes.out += (await fsp.stat(dst)).size;
  } catch (err) {
    report.counts.failed++;
    report.errors.push({ file: rel, mode, error: String(err.message ?? err) });
    // Never leave a partial artifact behind — a truncated MP3 plays as a
    // clip that cuts off mid-word and looks like a working file.
    await fsp.rm(part, { force: true });
    await fsp.rm(dst, { force: true });
  }
}

const toUrl = (rel) => "/assets/" + rel.split(path.sep).join("/");

/** First value of an ffprobe query, or null. */
function ffprobeValue(file, args) {
  return new Promise((resolve) => {
    const child = spawn("ffprobe", ["-v", "error", ...args, "-of", "default=nw=1:nk=1", file], {
      stdio: ["ignore", "pipe", "ignore"]
    });
    let out = "";
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.on("error", () => resolve(null));
    child.on("close", () => resolve(out.trim() || null));
  });
}

const durationOf = (f) => ffprobeValue(f, ["-select_streams", "a:0", "-show_entries", "format=duration"]).then(Number);
const dimsOf = (f) => ffprobeValue(f, ["-select_streams", "v:0", "-show_entries", "stream=width,height"]);

/**
 * Post-build audit. Confirms every source file produced a real output:
 * audio durations must match (catches a clip truncated by an interrupted
 * encode — which would cut off mid-word and still look like a valid file),
 * images must keep their exact pixel dimensions, and copies must match byte
 * for byte. This is the check that makes an interrupted-and-resumed build
 * trustworthy.
 */
async function verify(files) {
  const problems = [];
  let checked = 0;
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const rel = files[next++];
      const { mode, dstRel } = await plan(rel);
      checked++;
      if (checked % 500 === 0) process.stdout.write(`  verified ${checked}/${files.length}\n`);
      if (mode === "skip") continue;

      const src = path.join(SRC, rel);
      const dst = path.join(OUT, dstRel);
      if (!fs.existsSync(dst)) {
        problems.push({ file: rel, issue: "output missing" });
        continue;
      }
      const dstStat = await fsp.stat(dst);
      // A zero-byte output is only wrong if the source had content —
      // marker files like .gitkeep are legitimately empty.
      if (dstStat.size === 0 && (await fsp.stat(src)).size > 0) {
        problems.push({ file: rel, issue: "output is empty" });
        continue;
      }

      if (mode === "encode-audio") {
        const [a, b] = await Promise.all([durationOf(src), durationOf(dst)]);
        if (!a || !b) {
          problems.push({ file: rel, issue: `undecodable (src ${a}, out ${b})` });
        } else if (Math.abs(a - b) > Math.max(0.12, a * 0.02)) {
          // MP3 frame padding shifts the length a few ms; anything beyond
          // that means the encode was cut short.
          problems.push({ file: rel, issue: `duration ${a.toFixed(2)}s -> ${b.toFixed(2)}s` });
        }
      } else if (mode === "encode-webp") {
        const [a, b] = await Promise.all([dimsOf(src), dimsOf(dst)]);
        if (!a || !b || a !== b) problems.push({ file: rel, issue: `dimensions ${a} -> ${b}` });
      } else {
        const srcStat = await fsp.stat(src);
        if (srcStat.size !== dstStat.size) {
          problems.push({ file: rel, issue: `copy size ${srcStat.size} -> ${dstStat.size}` });
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, JOBS) }, worker));

  console.log(`\n--- verification ---`);
  console.log(`checked : ${checked}`);
  console.log(`problems: ${problems.length}`);
  for (const p of problems.slice(0, 40)) console.log(`  ${p.file}: ${p.issue}`);
  if (problems.length > 40) console.log(`  … and ${problems.length - 40} more`);
  if (problems.length) {
    await fsp.writeFile(path.join(OUT, "_verify-problems.json"), JSON.stringify(problems, null, 2));
    console.log(`\nRe-run the build with --force after deleting the listed outputs, then verify again.`);
  }
  process.exit(problems.length ? 1 : 0);
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source asset dir not found: ${SRC}`);
    process.exit(1);
  }
  console.log(`Scanning ${SRC} …`);
  const files = await walk(SRC);

  if (VERIFY) {
    console.log(`Verifying ${files.length} files against ${OUT} …`);
    return verify(files);
  }

  console.log(`${files.length} files. Transcoding to ${OUT} with ${JOBS} parallel jobs.${DRY ? " (dry run)" : ""}`);

  let next = 0;
  let done = 0;
  const tick = () => {
    done++;
    if (done % 250 === 0 || done === files.length) {
      const pct = ((done / files.length) * 100).toFixed(1);
      process.stdout.write(`  ${done}/${files.length} (${pct}%)  in ${mb(report.bytes.in)} -> out ${mb(report.bytes.out)}\n`);
    }
  };
  const worker = async () => {
    while (next < files.length) {
      const rel = files[next++];
      try {
        await handle(rel);
      } catch (err) {
        report.counts.failed++;
        report.errors.push({ file: rel, error: String(err.message ?? err) });
      }
      tick();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, JOBS) }, worker));

  report.finishedAt = new Date().toISOString();
  report.renameCount = Object.keys(report.renames).length;
  // Measure the output tree rather than trusting the running tally: on a
  // resumed run the tally only reflects this invocation's work, which made
  // the printed total wildly understate a build finished across two runs.
  if (!DRY) {
    report.bytes.out = 0;
    for (const rel of await walk(OUT)) {
      report.bytes.out += (await fsp.stat(path.join(OUT, rel))).size;
    }
  }
  if (!DRY) {
    await fsp.writeFile(path.join(OUT, "_transcode-report.json"), JSON.stringify(report, null, 2));
  }

  console.log("\n--- transcode summary ---");
  console.log(`audio re-encoded : ${report.counts.audioEncoded}`);
  console.log(`audio copied     : ${report.counts.audioCopied}`);
  console.log(`png -> webp      : ${report.counts.webp} (${report.counts.webpLossless} lossless, ${report.counts.webp - report.counts.webpLossless} lossy)`);
  console.log(`copied verbatim  : ${report.counts.copied}`);
  console.log(`skipped (junk)   : ${report.counts.skipped}`);
  console.log(`failed           : ${report.counts.failed}`);
  console.log(`size             : ${mb(report.bytes.in)} -> ${mb(report.bytes.out)}` +
    (report.bytes.in ? `  (${((1 - report.bytes.out / report.bytes.in) * 100).toFixed(1)}% smaller)` : ""));
  if (report.errors.length) {
    console.log(`\nfirst errors:`);
    for (const e of report.errors.slice(0, 10)) console.log(`  ${e.file}: ${e.error}`);
    console.log(`  … full list in ${path.join(OUT, "_transcode-report.json")}`);
  }
  process.exit(report.counts.failed > 0 ? 1 : 0);
}

const mb = (n) => (n / 1024 ** 3 >= 1 ? `${(n / 1024 ** 3).toFixed(2)} GB` : `${(n / 1024 ** 2).toFixed(0)} MB`);

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
