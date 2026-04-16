"""
Sync clipSchema.ts DEFAULT_PHRASES and narratorSchema.ts sceneIntros text
fields from the verified transcriptions in clipReferenceTable.json.

For each entry whose `file:` path resolves to an entry in the reference
table, replace the `text:` field with the verified transcription. For
DEFAULT_PHRASES, also bump `confidence:` to "confirmed" (entries were
user-verified in this pass).

Dry-run by default; pass --write to apply. The script is idempotent.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
TABLE = REPO / "src" / "audio" / "data" / "clipReferenceTable.json"
CLIP_SCHEMA = REPO / "src" / "audio" / "manifests" / "clipSchema.ts"
NAR_SCHEMA = REPO / "src" / "audio" / "manifests" / "narratorSchema.ts"


def normalize(text: str) -> str:
    """Tidy a raw whisper/manual transcription into display text.
    Strips surrounding whitespace, drops a single trailing period, and
    capitalizes the first letter. Preserves internal punctuation and case.
    """
    t = text.strip()
    if t.endswith("."):
        t = t[:-1].rstrip()
    if t and t[0].islower():
        t = t[0].upper() + t[1:]
    return t


def load_ref() -> dict[str, dict[str, str]]:
    """Return {narrator_prefix: {relPath_after_prefix: verified_text}}.

    Keys are shaped so that a schema file path like `${VL}/Default_Phrases_X/Y.wav`
    maps to `("VocalLocal/Default_Phrases_X/Y.wav", aj_table)`, etc.
    """
    with TABLE.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    out = {"allan-jackson": {}, "jim-cantore": {}}
    for narrator in out:
        for rel, entry in data["clips"].get(narrator, {}).items():
            if not entry.get("verified"):
                continue
            out[narrator][rel] = normalize(entry.get("text", ""))
    return out


# ─── clipSchema.ts DEFAULT_PHRASES ───
# Each line looks like:
#   { sceneType: "7day", file: `${VL}/Default_Phrases_7Day_Fcast/7DAY_DEFAULT1.wav`, text: "Here's your 7-day forecast", confidence: "likely" },
#
# We locate entries by the file path (backtick-quoted, starting with ${VL}/)
# and replace the `text:` and `confidence:` fields on that line only.

DEFAULT_PHRASE_RE = re.compile(
    r'(\{[^}]*?file:\s*`\$\{VL\}/(?P<path>[^`]+)`,\s*text:\s*")(?P<text>[^"]*)(",\s*confidence:\s*")(?P<conf>[^"]*)(".*?\})',
)


def sync_clip_schema(ref: dict[str, dict[str, str]], write: bool) -> list[tuple[str, str]]:
    text = CLIP_SCHEMA.read_text(encoding="utf-8")
    aj = ref["allan-jackson"]
    changes: list[tuple[str, str]] = []

    def repl(m: re.Match) -> str:
        path = m.group("path")  # e.g. Default_Phrases_7Day_Fcast/7DAY_DEFAULT1.wav
        ref_key = f"VocalLocal/{path}"
        new_text = aj.get(ref_key)
        if new_text is None:
            return m.group(0)  # not in reference / not verified
        old_text = m.group("text")
        old_conf = m.group("conf")
        new_conf = "confirmed"
        if old_text == new_text and old_conf == new_conf:
            return m.group(0)  # already in sync
        changes.append((f"VL {path}", f"{old_text!r} -> {new_text!r}"))
        return m.group(1) + new_text + m.group(4) + new_conf + m.group(6)

    new = DEFAULT_PHRASE_RE.sub(repl, text)
    if write and new != text:
        CLIP_SCHEMA.write_text(new, encoding="utf-8")
    return changes


# ─── narratorSchema.ts sceneIntros ───
# AJ lines:
#   { file: `${AJ_GENERAL_BASE}/Your Current Conditions.wav`, text: "Your current conditions" },
# JC lines:
#   { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Now/CC_INTRO1.wav`, text: "Your current conditions" },

AJ_INTRO_RE = re.compile(
    r'(\{\s*file:\s*`\$\{AJ_GENERAL_BASE\}/(?P<path>[^`]+)`,\s*text:\s*")(?P<text>[^"]*)(".*?\})',
)
JC_INTRO_RE = re.compile(
    r'(\{\s*file:\s*`\$\{JC_VOCALLOCAL_BASE\}/(?P<path>[^`]+)`,\s*text:\s*")(?P<text>[^"]*)(".*?\})',
)


def sync_narrator_schema(ref: dict[str, dict[str, str]], write: bool) -> list[tuple[str, str]]:
    text = NAR_SCHEMA.read_text(encoding="utf-8")
    aj = ref["allan-jackson"]
    jc = ref["jim-cantore"]
    changes: list[tuple[str, str]] = []

    def repl_aj(m: re.Match) -> str:
        path = m.group("path")
        ref_key = f"general/{path}"
        new_text = aj.get(ref_key)
        if new_text is None:
            return m.group(0)
        old_text = m.group("text")
        if old_text == new_text:
            return m.group(0)
        changes.append((f"AJ general/{path}", f"{old_text!r} -> {new_text!r}"))
        return m.group(1) + new_text + m.group(4)

    def repl_jc(m: re.Match) -> str:
        path = m.group("path")  # e.g. Default_Phrases_Now/CC_INTRO1.wav
        ref_key = f"Vocal Local/{path}"
        new_text = jc.get(ref_key)
        if new_text is None:
            return m.group(0)
        old_text = m.group("text")
        if old_text == new_text:
            return m.group(0)
        changes.append((f"JC Vocal Local/{path}", f"{old_text!r} -> {new_text!r}"))
        return m.group(1) + new_text + m.group(4)

    new = AJ_INTRO_RE.sub(repl_aj, text)
    new = JC_INTRO_RE.sub(repl_jc, new)
    if write and new != text:
        NAR_SCHEMA.write_text(new, encoding="utf-8")
    return changes


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="Apply changes (default: dry run)")
    args = ap.parse_args()

    ref = load_ref()
    print(f"Loaded ref: AJ={len(ref['allan-jackson'])} JC={len(ref['jim-cantore'])} verified clips")
    print()

    clip_changes = sync_clip_schema(ref, args.write)
    print(f"=== clipSchema.ts DEFAULT_PHRASES: {len(clip_changes)} changes ===")
    for path, diff in clip_changes:
        print(f"  {path}")
        print(f"    {diff}")

    print()
    nar_changes = sync_narrator_schema(ref, args.write)
    print(f"=== narratorSchema.ts sceneIntros: {len(nar_changes)} changes ===")
    for path, diff in nar_changes:
        print(f"  {path}")
        print(f"    {diff}")

    print()
    mode = "APPLIED" if args.write else "DRY RUN — pass --write to apply"
    print(f"Total changes: {len(clip_changes) + len(nar_changes)}  [{mode}]")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
