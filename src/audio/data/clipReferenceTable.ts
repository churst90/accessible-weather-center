/**
 * Clip index — which clips exist, and which transcriptions a human checked.
 *
 * This used to `import` the full 1,366 KB `clipReferenceTable.json`, which
 * inlined it into the renderer: 1,366 KB of a 1,769 KB JavaScript bundle,
 * downloaded by every visitor to use one narrator on one theme.
 *
 * Resolution only ever asks two things — does this clip exist, and is its
 * transcription verified — so the runtime now loads a compact index built by
 * `scripts/build-clip-index.mjs` (378 KB raw, ~32 KB gzipped, served beside
 * the app rather than bundled). The transcription text is never rendered or
 * spoken; the screen reader reads `fallbackText` and the narrator plays
 * audio. Text stays in the full JSON for tooling and tests, which read it
 * from disk.
 *
 * Failure behaviour is deliberate. If the index has not loaded — slow
 * network, 404, offline — every clip resolves at "likely" rather than
 * "guess". Treating an unloaded index as "nothing is known" would filter out
 * the entire narration at the default threshold, which is exactly the silent
 * failure that cost a week of debugging. Missing metadata must degrade to
 * "play it", never to "say nothing".
 */

export type NarratorId = "allan-jackson" | "jim-cantore" | "amy-bargeron" | "chandler" | "silent";

export interface ClipReferenceEntry {
  /** Whisper transcription. Empty when only the compact index is loaded. */
  text: string;
  /** Whisper avg_logprob, or null. Only present with the full table. */
  confidence: number | null;
  /** How the transcription was produced. Only with the full table. */
  source?: "whisper-small" | "whisper-base" | "whisper-small-legacy" | "manual" | "inferred-from-filename";
  /** True if a human confirmed the transcription matches the audio. */
  verified: boolean;
}

/** Compact on-disk shape: verified and known path lists per narrator. */
interface ClipIndex {
  schemaVersion: number;
  narrators: Record<string, { v: string[]; k: string[] }>;
}

type NarratorClips = Record<string, ClipReferenceEntry>;

let clips: Partial<Record<NarratorId, NarratorClips>> = {};
let loaded = false;

/** True once an index (or a full table) is in memory. */
export function isClipIndexLoaded(): boolean {
  return loaded;
}

/** Install a compact index. Called by the loader and by tests. */
export function setClipIndex(index: ClipIndex): void {
  const next: Partial<Record<NarratorId, NarratorClips>> = {};
  for (const [narratorId, sets] of Object.entries(index.narrators ?? {})) {
    const map: NarratorClips = {};
    for (const p of sets.v ?? []) map[p] = { text: "", confidence: null, verified: true };
    for (const p of sets.k ?? []) map[p] = { text: "", confidence: null, verified: false };
    next[narratorId as NarratorId] = map;
  }
  clips = next;
  loaded = true;
}

/** Install a full reference table (tests and tooling, which want the text). */
export function setClipReferenceTable(table: { clips: Record<string, NarratorClips> }): void {
  clips = table.clips as Partial<Record<NarratorId, NarratorClips>>;
  loaded = true;
}

/**
 * Fetch the compact index. Resolves even on failure — a missing index is a
 * degraded state, not a fatal one, and callers should not have to handle it.
 */
export async function loadClipIndex(url = "clip-index.json"): Promise<boolean> {
  if (loaded) return true;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setClipIndex((await res.json()) as ClipIndex);
    return true;
  } catch (err) {
    console.warn(
      "[clips] clip index unavailable; every clip will resolve at \"likely\" confidence.",
      err
    );
    return false;
  }
}

/**
 * Entry for a single clip, or null if the library has no such clip.
 *
 * @param relPath Path relative to the narrator's root
 *                (e.g. `VocalLocal/Periods2/MON.mp3`).
 */
export function getClipText(narratorId: NarratorId, relPath: string): ClipReferenceEntry | null {
  return clips[narratorId]?.[relPath] ?? null;
}

/** Every known clip for a narrator, as `relPath → entry`. */
export function getNarratorClips(narratorId: NarratorId): NarratorClips {
  return clips[narratorId] ?? {};
}

/**
 * Search by transcription text. Only meaningful when the FULL table is
 * loaded — the compact runtime index carries no text.
 */
export function findClipsByText(
  narratorId: NarratorId,
  substring: string
): Array<{ relPath: string; entry: ClipReferenceEntry }> {
  const needle = substring.toLowerCase();
  const out: Array<{ relPath: string; entry: ClipReferenceEntry }> = [];
  for (const [relPath, entry] of Object.entries(getNarratorClips(narratorId))) {
    if (entry.text && entry.text.toLowerCase().includes(needle)) out.push({ relPath, entry });
  }
  return out;
}

/** Total clips across all narrators. */
export function getTotalClipCount(): number {
  return Object.values(clips).reduce((n, m) => n + Object.keys(m ?? {}).length, 0);
}
