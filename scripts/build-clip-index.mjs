/**
 * Builds the compact clip index the app loads at runtime.
 *
 * `clipReferenceTable.json` is 1,366 KB and was being imported directly into
 * the renderer, which made it 1,366 KB of a 1,769 KB JavaScript bundle —
 * every visitor downloading all four narrators' Whisper transcriptions in
 * order to use one narrator on one theme.
 *
 * Almost none of it is needed at runtime. Resolution asks the table exactly
 * two questions:
 *
 *   1. does this clip exist in the library?   (absent -> confidence "guess")
 *   2. has a human verified the transcription? (-> "confirmed" vs "likely")
 *
 * The transcription text itself is never rendered or spoken — the screen
 * reader reads `fallbackText`, and the narrator plays audio. Text is used
 * only by the tooling and tests, which read the full JSON from disk.
 *
 * So the runtime index is just paths plus one bit each: two arrays per
 * narrator, `v` for verified and `k` for known-but-unverified. It is written
 * to public/ so Vite copies it beside the app rather than inlining it, and it
 * travels with the app bundle rather than the 1.3 GB media library.
 *
 * Runs automatically as part of `npm run build`.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src/audio/data/clipReferenceTable.json");
const OUT_DIR = path.join(ROOT, "public");
const OUT = path.join(OUT_DIR, "clip-index.json");

const full = JSON.parse(fs.readFileSync(SRC, "utf8"));

const index = { schemaVersion: 1, narrators: {} };
let verified = 0;
let known = 0;

for (const [narratorId, clips] of Object.entries(full.clips ?? {})) {
  const v = [];
  const k = [];
  for (const [relPath, entry] of Object.entries(clips)) {
    (entry?.verified ? v : k).push(relPath);
  }
  v.sort();
  k.sort();
  verified += v.length;
  known += k.length;
  index.narrators[narratorId] = { v, k };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(index));

const before = fs.statSync(SRC).size;
const after = fs.statSync(OUT).size;
console.log(
  `clip-index.json: ${verified + known} clips (${verified} verified) — ` +
  `${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB ` +
  `(${(100 - (after / before) * 100).toFixed(0)}% smaller)`
);
