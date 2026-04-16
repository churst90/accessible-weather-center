"""
Generate TypeScript entries for AJ composite longform clips (1,525 files).

The composite clips are stored in the same Wx_Phrases_Longform/ directory as
N-series clips, but their filenames are 10 digits encoding {CCSH_A}{CCSH_B}{v}{t}.

This script emits a TS snippet for insertion into longformSchema.ts.
Deduplicates texts that are identical across takes (keep first occurrence
with its canonical filename, skip redundant takes).

Output: scripts/out/aj_composite_entries.ts
"""
import os, json, re

BASE = os.path.dirname(__file__)
IN_FILE = os.path.join(BASE, "out", "remaining_transcriptions.json")
OUT_FILE = os.path.join(BASE, "out", "aj_composite_entries.ts")

with open(IN_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

comp = data.get("aj_composites", {})
sample = data.get("aj_composite_sample", {})
# merge sample (it was the 30 early transcriptions before the full run)
for k, v in sample.items():
    if k not in comp:
        # normalize shape: sample has ccsh_a/ccsh_b/etc fields, comp has just text+confidence
        comp[k] = {"text": v["text"], "confidence": v["confidence"]}

print(f"Total composite clips: {len(comp)}")

def clean(text: str) -> str:
    t = text.strip().rstrip(".")
    t = re.sub(r"\s+", " ", t)
    if t and t[0].islower():
        t = t[0].upper() + t[1:]
    t = t.replace('"', '\\"')
    return t

# Deduplicate: keep one entry per unique text (prefer lower take number so the
# canonical recording wins). The matcher only needs each unique phrase once.
seen_texts: dict[str, str] = {}  # lowercase text → filename
entries = []
skipped_dupes = 0

for fname in sorted(comp.keys()):
    base = fname.replace(".wav", "")
    text = clean(comp[fname]["text"])
    key = text.lower()
    if key in seen_texts:
        skipped_dupes += 1
        continue
    seen_texts[key] = base
    entries.append((base, text))

print(f"Unique texts: {len(entries)}  (dedup saved {skipped_dupes} redundant takes)")

lines = [
    "// ────────────────────────────────────────────────────────────────────────────",
    "//  AJ composite longform clips (transcribed via Whisper 2026-04-13)",
    "// ────────────────────────────────────────────────────────────────────────────",
    "",
    "/**",
    f" * AJ composite longform clips ({len(entries)} unique phrases, deduped from 1,525 takes).",
    " * Filenames encode {CCSH_A}{CCSH_B}{variant}{take} — 10 digits.",
    " * Many variants share text (alternate recordings of same phrase); dedup keeps one.",
    " * Merged into the findLongformMatch pool so the fuzzy matcher picks them when",
    " * they score better than N-series phrases against an NWS detailedForecast.",
    " */",
    "const AJ_COMPOSITE_CLIPS: LfEntry[] = [",
]
for base, text in entries:
    lines.append(f'  ["{base}", "{text}"],')
lines.append("];")
lines.append("")

with open(OUT_FILE, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"\nWrote {OUT_FILE}")
print("First 5:")
for base, text in entries[:5]:
    print(f'  ["{base}", "{text}"]')
