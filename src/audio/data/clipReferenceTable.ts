/**
 * Master clip reference table — source of truth for every narration clip
 * across all 4 narrator libraries.
 *
 * This module loads `clipReferenceTable.json` (built by
 * `scripts/build_reference_table.py`) and exposes typed lookup helpers.
 *
 * Each entry records:
 *   - `text`: the Whisper transcription (verified manually in some cases)
 *   - `confidence`: Whisper avg_logprob (closer to 0 = more confident)
 *   - `source`: how the transcription was produced
 *   - `verified`: true if a human confirmed the transcription matches audio
 *
 * Paths are relative to the narrator's root directory under
 * `assets/narration/<Narrator>/` (e.g. `VocalLocal/Periods2/MON.mp3`).
 *
 * Usage:
 *   import { getClipText, getNarratorClips } from "./clipReferenceTable";
 *   const entry = getClipText("allan-jackson", "VocalLocal/Periods2/MON.mp3");
 *   if (entry) console.log(entry.text); // "Monday."
 */

import rawTable from "./clipReferenceTable.json";

// Must mirror `NarratorId` in narratorSchema.ts. Declared locally to
// avoid a circular import (this module is imported by the registry that
// defines NarratorId's canonical home).
export type NarratorId = "allan-jackson" | "jim-cantore" | "amy-bargeron" | "chandler" | "silent";

export interface ClipReferenceEntry {
  /** Whisper transcription of the audio clip. */
  text: string;
  /** Whisper avg_logprob, or null if unknown. Closer to 0 = more confident. */
  confidence: number | null;
  /** How this transcription was produced. */
  source: "whisper-small" | "whisper-base" | "whisper-small-legacy" | "manual" | "inferred-from-filename";
  /** True if a human confirmed the transcription matches audio. */
  verified: boolean;
}

export interface ClipReferenceTable {
  metadata: {
    schemaVersion: number;
    generated: string | null;
    totalClips: number;
    byNarrator: Record<string, number>;
  };
  clips: Record<NarratorId, Record<string, ClipReferenceEntry>>;
}

export const CLIP_REFERENCE_TABLE = rawTable as unknown as ClipReferenceTable;

/**
 * Get the transcription entry for a single clip.
 *
 * @param narratorId Which narrator library to query.
 * @param relPath Path relative to the narrator's root
 *                (e.g. `VocalLocal/Periods2/MON.mp3`).
 * @returns The entry, or null if this clip has no transcription yet.
 */
export function getClipText(narratorId: NarratorId, relPath: string): ClipReferenceEntry | null {
  return CLIP_REFERENCE_TABLE.clips[narratorId]?.[relPath] ?? null;
}

/**
 * Get every transcribed clip for a narrator.
 * Returns a map of `relPath → ClipReferenceEntry`.
 */
export function getNarratorClips(narratorId: NarratorId): Record<string, ClipReferenceEntry> {
  return CLIP_REFERENCE_TABLE.clips[narratorId] ?? {};
}

/**
 * Search the reference table by transcription text (substring match).
 * Useful for finding clips that match a phrase without knowing the filename.
 *
 * @param narratorId Which narrator to search.
 * @param substring Lowercase substring to find (e.g. "partly cloudy").
 * @returns List of matching (relPath, entry) pairs.
 */
export function findClipsByText(
  narratorId: NarratorId,
  substring: string
): Array<{ relPath: string; entry: ClipReferenceEntry }> {
  const needle = substring.toLowerCase();
  const out: Array<{ relPath: string; entry: ClipReferenceEntry }> = [];
  const clips = getNarratorClips(narratorId);
  for (const [relPath, entry] of Object.entries(clips)) {
    if (entry.text.toLowerCase().includes(needle)) {
      out.push({ relPath, entry });
    }
  }
  return out;
}

/** Total number of clips in the table, across all narrators. */
export function getTotalClipCount(): number {
  return CLIP_REFERENCE_TABLE.metadata.totalClips;
}
