"""
Generate TypeScript LfEntry[] data for JC H08xxxx exclusive longform clips.

Reads scripts/out/remaining_transcriptions.json and emits a TypeScript
snippet suitable for insertion into src/audio/manifests/longformSchema.ts.

Output: scripts/out/jc_exclusive_entries.ts (snippet)
"""
import os
import json
import re

BASE = os.path.dirname(__file__)
IN_FILE = os.path.join(BASE, "out", "remaining_transcriptions.json")
OUT_FILE = os.path.join(BASE, "out", "jc_exclusive_entries.ts")

with open(IN_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

jc = data.get("jc_longform_exclusive", {})
print(f"Read {len(jc)} JC H08xxxx transcriptions")


def clean_text(text: str) -> str:
    """Clean up Whisper output for consistent TypeScript strings."""
    t = text.strip()
    # Remove trailing period for consistency with N-series style
    t = t.rstrip(".")
    # Collapse multiple spaces
    t = re.sub(r"\s+", " ", t)
    # Capitalize first letter (Whisper sometimes lowercases)
    if t and t[0].islower():
        t = t[0].upper() + t[1:]
    # Escape any double quotes for TS string literal
    t = t.replace('"', '\\"')
    return t


# Sort by filename for deterministic output
entries = []
for fname, info in sorted(jc.items()):
    base = fname.replace(".wav", "")
    text = clean_text(info["text"])
    conf = info["confidence"]
    entries.append((base, text, conf))

# Emit TypeScript snippet
lines = [
    "// ────────────────────────────────────────────────────────────────────────────",
    "//  JC-exclusive H08xxxx longform clips (transcribed via Whisper 2026-04-13)",
    "// ────────────────────────────────────────────────────────────────────────────",
    "",
    "/**",
    f" * JC-exclusive H08xxxx longform clips ({len(entries)} clips).",
    " * These have no AJ N-series equivalent — they're unique to Jim Cantore.",
    " * Transcribed via faster-whisper 'small' model; confidence values retained.",
    " */",
    "const JC_EXCLUSIVE_CLIPS: LfEntry[] = [",
]
for base, text, conf in entries:
    lines.append(f'  ["{base}", "{text}"],  // conf: {conf}')
lines.append("];")
lines.append("")

with open(OUT_FILE, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"Wrote {len(entries)} entries to {OUT_FILE}")
print(f"\nFirst 5 entries:")
for base, text, _ in entries[:5]:
    print(f'  ["{base}", "{text}"]')
