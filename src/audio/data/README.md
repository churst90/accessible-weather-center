# Clip Reference Table

`clipReferenceTable.json` is the **source of truth for every narration clip** across all four narrator libraries (Allan Jackson, Jim Cantore, Amy Bargeron, Chandler).

## Why it exists

Narrator libraries differ in file structure and naming conventions — `VocalLocal/` vs `Vocal Local/`, `Wind_Misc/` vs `Winds_Misc/`, `MON.wav` vs `Monday.wav`, etc. Without a central reference, any narration feature had to branch per narrator, and assumed clip contents (based on filenames) hid bugs like the `Wx_Phrases_Groups_Expect/TUE_TSTORM3.wav` clip saying *"And on Tuesday, expect a chance of thunderstorms"* rather than the filename-inferred *"Expect thunderstorms on Tuesday."*

This table records the **actual transcription** of every clip, produced by running Whisper over the entire `assets/narration/` tree. Downstream narration code reads the transcription (not the filename) to decide how to use each clip.

## Structure

```json
{
  "metadata": {
    "schemaVersion": 1,
    "generated": "ISO-8601 timestamp",
    "totalClips": 12345,
    "byNarrator": {
      "allan-jackson": 8000,
      "jim-cantore": 3500,
      "amy-bargeron": 9,
      "chandler": 200
    }
  },
  "clips": {
    "allan-jackson": {
      "VocalLocal/Periods2/MON.wav": {
        "text": "Monday.",
        "confidence": -0.15,
        "source": "whisper-small",
        "verified": true
      },
      "...": { "..." : "..." }
    },
    "jim-cantore":   { "...": { "...": "..." } },
    "amy-bargeron":  { "...": { "...": "..." } },
    "chandler":      { "...": { "...": "..." } }
  }
}
```

### Field meanings

| Field | Description |
|---|---|
| `text` | The Whisper transcription of the audio clip. |
| `confidence` | Whisper `avg_logprob` (closer to 0 = more confident). `null` if unknown. |
| `source` | How the transcription was produced. Most are `whisper-small`. Some (from early work) are `whisper-small-legacy` (different tooling). Manual transcriptions are `manual`. |
| `verified` | `true` once a human has confirmed the transcription matches the audio. Use this flag to mark clips after listening or double-checking. |

### Path conventions

Paths are **relative to the narrator's root directory**:

| Narrator | Root |
|---|---|
| `allan-jackson` | `assets/narration/Alan Jackson/` |
| `jim-cantore` | `assets/narration/Jim Cantore/` |
| `amy-bargeron` | `assets/narration/Amy Bargeron/` |
| `chandler` | `assets/narration/Chandler/` |

Example: the AJ clip living at `assets/narration/Alan Jackson/VocalLocal/Periods2/MON.wav` is stored under the key `"VocalLocal/Periods2/MON.wav"` in the `allan-jackson` map.

Forward slashes are used even on Windows, for cross-platform consistency.

## Do not delete

This file is intentionally committed to the repo. Regenerating it from scratch takes hours of Whisper CPU time. Downstream schemas (`longformSchema.ts`, future ID-keyed dispatch maps) rely on it being present.

## Regenerating / updating

Run `scripts/build_reference_table.py` anytime:

- **Fresh or incremental run** — processes only files not already in the table.
- **`--merge-only`** — skips Whisper, just consolidates legacy `scripts/out/*.json` outputs.
- **`--limit=N`** — process at most N new files this run (useful for testing / checkpoints).

```bash
python scripts/build_reference_table.py              # full (resumable)
python scripts/build_reference_table.py --limit=200  # sample
python scripts/build_reference_table.py --merge-only # no Whisper
```

Each run saves progress every 100 clips, so interruptions are safe — resume by re-running.

## TypeScript access

Import from `src/audio/data/clipReferenceTable.ts`:

```ts
import { getClipText, findClipsByText } from "./data/clipReferenceTable";

// Look up a specific clip
const entry = getClipText("allan-jackson", "VocalLocal/Periods2/MON.wav");
console.log(entry?.text); // "Monday."

// Find clips containing a phrase
const matches = findClipsByText("jim-cantore", "thunderstorm");
```

## Roadmap

Planned work building on this table:

1. **Semantic ID layer** — ✅ built (2026-04-14). See `../manifests/semanticRegistry.ts`. Covers all enumerable clip families (periods, temps, CC/CCSH/CCEF, wind, precip, qualifiers, rate-OP, accumulation, named singletons) for AJ + JC. IDs have the shape `"category:param"` (e.g. `"period:MON"`, `"temp:72"`). Construct via `Sem.period(...)`, `Sem.temp(...)`, etc. Verified text comes from this reference table when available; otherwise it's derived from the ID params.
2. **Missing-clip audit** — partial. 80 AJ/JC scene-intro + default-phrase clips manually verified and synced to schema text. Broader coverage (CC/CCSH/CCEF, wind, qualifiers) still pending.
3. **Narrator-agnostic `PhraseComposer`** — ✅ substantially done. All enumerable clip lookups (temps, CC/CCSH/CCEF, wind, qualifiers, precip, periods) now go through `getLibrary(narrator).resolve(Sem.xxx(...))`. `clipSchema.ts` shrank from ~750 lines to ~110. A handful of narrator-specific branches remain in composer — all are legitimate behavioral differences (e.g. AJ vs JC severe-alert dir structures), not dispatch boilerplate.

## Semantic registry usage

```ts
import { getLibrary, Sem } from "../manifests/semanticRegistry";

const lib = getLibrary("allan-jackson");
const clip = lib.resolve(Sem.temp(72));          // { src: ".../Temps_Specific/72.wav", text: "72 degrees", confidence: "likely" }
const clip = lib.resolve(Sem.ccsh(1600));        // narrator-aware zero-padding handled
const clip = lib.resolve(Sem.windAtSpeed("10_15"));
const clip = lib.resolve(Sem.period("TUE_NIGHT")); // null for AJ (no bare weekday-night clips), clip for JC
```

Smoke test: `npx tsx scripts/check_semantic_registry.ts` (36 probes covering every category).
