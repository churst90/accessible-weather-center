"""
Interactive scene-intro / default-phrase verification tool.

Plays each unverified AJ/JC scene-intro or default-phrase clip, shows the
current Whisper transcription, and lets the user accept, correct, or skip.
Writes back to src/audio/data/clipReferenceTable.json with verified=true
and source="manual" when the user confirms or edits.

Windows-only (uses winsound for async WAV playback). Progress is saved
after every decision, so quit/resume is safe.

Usage:
    python scripts/verify_scene_intros.py                 # all in-scope unverified
    python scripts/verify_scene_intros.py --scope aj      # AJ only
    python scripts/verify_scene_intros.py --scope jc      # JC only
    python scripts/verify_scene_intros.py --redo          # include already-verified
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import winsound
from pathlib import Path
from typing import Iterator

REPO_ROOT = Path(__file__).resolve().parent.parent
TABLE_PATH = REPO_ROOT / "src" / "audio" / "data" / "clipReferenceTable.json"

NARRATOR_ROOTS = {
    "allan-jackson": REPO_ROOT / "assets" / "narration" / "Alan Jackson",
    "jim-cantore":   REPO_ROOT / "assets" / "narration" / "Jim Cantore",
}

# Which relPaths count as "scene-intro / default-phrase" for each narrator.
def in_scope(narrator: str, rel_path: str) -> bool:
    if narrator == "allan-jackson":
        return rel_path.startswith("VocalLocal/Default_Phrases_") or rel_path.startswith("general/")
    if narrator == "jim-cantore":
        return rel_path.startswith("Vocal Local/Default_Phrases_")
    return False


def load_table() -> dict:
    with TABLE_PATH.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def save_table(table: dict) -> None:
    """Write the table atomically; retry on transient Windows lock errors
    (OneDrive / antivirus briefly hold the file). Falls back to in-place
    write if os.replace keeps failing."""
    tmp = TABLE_PATH.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(table, fh, indent=2, ensure_ascii=False)

    last_err = None
    for attempt in range(10):
        try:
            os.replace(tmp, TABLE_PATH)
            return
        except PermissionError as e:
            last_err = e
            time.sleep(0.1 * (attempt + 1))

    # Fallback: write directly to the real path. One decision's worth of
    # risk if the process is killed mid-write, but better than losing the
    # session to a transient file lock.
    print(f"  (atomic replace failed after retries: {last_err}; writing in place)")
    with TABLE_PATH.open("w", encoding="utf-8") as fh:
        json.dump(table, fh, indent=2, ensure_ascii=False)
    try:
        tmp.unlink()
    except FileNotFoundError:
        pass


def iter_queue(table: dict, scopes: set[str], redo: bool) -> Iterator[tuple[str, str, dict]]:
    for narrator, clips in table["clips"].items():
        if narrator not in NARRATOR_ROOTS:
            continue
        if narrator == "allan-jackson" and "aj" not in scopes:
            continue
        if narrator == "jim-cantore" and "jc" not in scopes:
            continue
        for rel_path, entry in sorted(clips.items()):
            if not in_scope(narrator, rel_path):
                continue
            if entry.get("verified") and not redo:
                continue
            yield narrator, rel_path, entry


def play_async(path: Path) -> None:
    winsound.PlaySound(str(path), winsound.SND_FILENAME | winsound.SND_ASYNC)


def stop_playback() -> None:
    winsound.PlaySound(None, 0)


HELP = """\
Commands:
  <Enter>  accept the current transcription as verified
  e        edit — type the correct transcription on the next line
  r        replay the clip
  s        skip (leave unverified, move on)
  q        save and quit
  ?        show this help
"""


def prompt_decision(clip_path: Path, entry: dict, narrator: str, rel_path: str,
                    idx: int, total: int) -> str | tuple[str, str]:
    """Returns 'accept' | 'skip' | 'quit' | ('edit', new_text)."""
    current = entry.get("text", "").strip()
    source = entry.get("source", "?")
    conf = entry.get("confidence")
    print()
    print(f"[{idx}/{total}] {narrator}  {rel_path}")
    print(f"  Current: {current!r}")
    print(f"  source={source}  confidence={conf}")
    play_async(clip_path)
    while True:
        try:
            choice = input("  > ").strip().lower()
        except EOFError:
            return "quit"
        if choice == "" or choice == "y":
            stop_playback()
            return "accept"
        if choice == "r":
            play_async(clip_path)
            continue
        if choice == "s":
            stop_playback()
            return "skip"
        if choice == "q":
            stop_playback()
            return "quit"
        if choice == "?":
            print(HELP)
            continue
        if choice == "e":
            stop_playback()
            new_text = input("  New text: ").strip()
            if not new_text:
                print("  (empty — treating as skip)")
                return "skip"
            return ("edit", new_text)
        print("  Unknown. Press ? for help.")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scope", choices=["all", "aj", "jc"], default="all")
    ap.add_argument("--redo", action="store_true",
                    help="Include clips already marked verified")
    args = ap.parse_args()

    scopes = {"aj", "jc"} if args.scope == "all" else {args.scope}
    table = load_table()

    queue = list(iter_queue(table, scopes, args.redo))
    total = len(queue)
    if total == 0:
        print("Nothing to verify. (All in-scope clips already verified — use --redo to review.)")
        return 0

    print(f"Loaded {total} clips to review. Scope={sorted(scopes)} redo={args.redo}")
    print("Press ? at any prompt for help. Progress saves after every decision.")
    print()

    stats = {"accept": 0, "edit": 0, "skip": 0, "missing": 0}
    for idx, (narrator, rel_path, entry) in enumerate(queue, start=1):
        clip_path = NARRATOR_ROOTS[narrator] / rel_path
        if not clip_path.exists():
            print(f"[{idx}/{total}] MISSING FILE: {clip_path}")
            stats["missing"] += 1
            continue

        decision = prompt_decision(clip_path, entry, narrator, rel_path, idx, total)
        if decision == "quit":
            print("\nSaved progress. Exiting.")
            break
        if decision == "skip":
            stats["skip"] += 1
            continue
        if decision == "accept":
            entry["verified"] = True
            stats["accept"] += 1
        else:  # edit
            _, new_text = decision
            entry["text"] = new_text
            entry["verified"] = True
            entry["source"] = "manual"
            entry["confidence"] = None
            stats["edit"] += 1

        save_table(table)

    stop_playback()
    print()
    print(f"Done. accepted={stats['accept']} edited={stats['edit']} "
          f"skipped={stats['skip']} missing={stats['missing']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
