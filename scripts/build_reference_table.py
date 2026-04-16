"""
Build the master clipReferenceTable — the source of truth for all clip
narration across every narrator.

Structure:
{
  "metadata": {
    "generated": ISO-8601,
    "totalClips": int,
    "byNarrator": { narratorId: count, ... },
    "schemaVersion": 1
  },
  "clips": {
    narratorId: {
      "relative/path/to/file.wav": {
        "text": "transcribed text",
        "confidence": -0.25,
        "source": "whisper-small" | "whisper-base" | "manual" | "inferred-from-filename",
        "verified": bool
      },
      ...
    },
    ...
  }
}

This script is idempotent and resumable:
  - Merges ALL existing transcription outputs from scripts/out/
  - Skips files already in the master table
  - Transcribes remaining WAV/FLAC files via Whisper
  - Saves progressively every 100 clips (crash-safe)
  - Output: src/audio/data/clipReferenceTable.json

Run again anytime to pick up new files or re-process missing ones.
"""
import os
import json
import glob
import datetime
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
ASSETS = os.path.join(REPO_ROOT, "assets", "narration")
OUT_DIR = os.path.join(REPO_ROOT, "src", "audio", "data")
OUT_FILE = os.path.join(OUT_DIR, "clipReferenceTable.json")
LEGACY_DIR = os.path.join(BASE_DIR, "out")

NARRATOR_DIRS = {
    "allan-jackson": "Alan Jackson",
    "jim-cantore": "Jim Cantore",
    "amy-bargeron": "Amy Bargeron",
    "chandler": "Chandler",
}

AUDIO_EXTS = (".wav", ".flac", ".mp3")

# ── Load existing master table if present (resume) ──
def load_master():
    if os.path.exists(OUT_FILE):
        with open(OUT_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "metadata": {
            "schemaVersion": 1,
            "generated": None,
            "totalClips": 0,
            "byNarrator": {},
        },
        "clips": {n: {} for n in NARRATOR_DIRS},
    }

# ── Relative path helper ──
def rel_path(narrator_id: str, abs_path: str) -> str:
    narrator_root = os.path.join(ASSETS, NARRATOR_DIRS[narrator_id])
    rp = os.path.relpath(abs_path, narrator_root)
    # Normalize separators to forward slashes for cross-platform consistency
    return rp.replace("\\", "/")

# ── Merge existing scripts/out/*.json into the master table ──
def _set_entry(master, narrator_id, rel, text, conf, source, verified):
    if rel in master["clips"][narrator_id]:
        return False
    master["clips"][narrator_id][rel] = {
        "text": text,
        "confidence": conf,
        "source": source,
        "verified": verified,
    }
    return True

def _strip_narrator_prefix(full_path: str, narrator_dir_name: str) -> str:
    """Given 'Alan Jackson/VocalLocal/Periods2', return 'VocalLocal/Periods2'."""
    prefix = narrator_dir_name + "/"
    if full_path.startswith(prefix):
        return full_path[len(prefix):]
    return full_path

def merge_existing(master: dict) -> int:
    added = 0

    # 1. clip_manifest.raw.json — AJ legacy bundled clips at root of Alan Jackson/
    #    Structure: { "count": N, "clips": [{"file": "1.mp3", "transcript": "...", "avg_logprob": -0.72}, ...] }
    path = os.path.join(LEGACY_DIR, "clip_manifest.raw.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            d = json.load(f)
        for c in d.get("clips", []):
            fname = c.get("file", "")
            if not fname:
                continue
            # Find where this file actually lives under Alan Jackson/
            # These were the legacy bundled CC/CCSH/CCEF clips, often in
            # Alan Jackson/current conditions/ or similar subdir. Since we
            # don't know the subdir from this file alone, store with a
            # synthetic path marker; the directory walk will fill in the
            # real location if different.
            rel = f"_legacy_bundled/{fname}"
            if _set_entry(master, "allan-jackson", rel, c.get("transcript", ""),
                          c.get("avg_logprob"), "whisper-small-legacy", False):
                added += 1

    # 2. vocallocal_transcriptions.json
    #    Structure: { "Alan Jackson/VocalLocal/Periods2": { "FRI.wav": "Friday.", ... }, ... }
    path = os.path.join(LEGACY_DIR, "vocallocal_transcriptions.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            d = json.load(f)
        for full_dir, files in d.items():
            # Determine narrator from prefix
            if full_dir.startswith("Alan Jackson/"):
                target = "allan-jackson"
                narrator_dir = "Alan Jackson"
            elif full_dir.startswith("Jim Cantore/"):
                target = "jim-cantore"
                narrator_dir = "Jim Cantore"
            else:
                continue
            subdir = _strip_narrator_prefix(full_dir, narrator_dir)
            for fname, text in files.items():
                rel = f"{subdir}/{fname}"
                if _set_entry(master, target, rel, text, None, "whisper-small", False):
                    added += 1

    # 3. amy_bargeron_transcriptions.json — {filename: text}
    path = os.path.join(LEGACY_DIR, "amy_bargeron_transcriptions.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            d = json.load(f)
        for fname, text in d.items():
            rel = fname  # at root of Amy Bargeron/
            if _set_entry(master, "amy-bargeron", rel, text, None, "whisper-small", True):
                added += 1

    # 4. remaining_transcriptions.json — JC H08xxxx + AJ composites
    path = os.path.join(LEGACY_DIR, "remaining_transcriptions.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            d = json.load(f)
        for fname, info in d.get("jc_longform_exclusive", {}).items():
            rel = f"Vocal Local/Wx_Phrases_Longform/{fname}"
            if _set_entry(master, "jim-cantore", rel, info.get("text", ""),
                          info.get("confidence"), "whisper-small", False):
                added += 1
        for bucket in ("aj_composites", "aj_composite_sample"):
            for fname, info in d.get(bucket, {}).items():
                rel = f"VocalLocal/Wx_Phrases_Longform/{fname}"
                if _set_entry(master, "allan-jackson", rel, info.get("text", ""),
                              info.get("confidence"), "whisper-small", False):
                    added += 1

    # 5. periods2_transcriptions.json — {filename: text}
    path = os.path.join(LEGACY_DIR, "periods2_transcriptions.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            d = json.load(f)
        for fname, text in d.items():
            rel = f"VocalLocal/Periods2/{fname}"
            if _set_entry(master, "allan-jackson", rel, text, None, "whisper-small", True):
                added += 1

    # 6. group_phrases_transcriptions.json — {dirname: {filename: text}}
    path = os.path.join(LEGACY_DIR, "group_phrases_transcriptions.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            d = json.load(f)
        for dirname, files in d.items():
            for fname, text in files.items():
                rel = f"VocalLocal/{dirname}/{fname}"
                if _set_entry(master, "allan-jackson", rel, text, None, "whisper-small", True):
                    added += 1

    return added

# ── Walk all narrator directories, find untranscribed files ──
def find_untranscribed(master: dict) -> list:
    todo = []  # list of (narrator_id, abs_path, rel_path)
    for narrator_id, narrator_dirname in NARRATOR_DIRS.items():
        narrator_root = os.path.join(ASSETS, narrator_dirname)
        if not os.path.isdir(narrator_root):
            continue
        for root, dirs, files in os.walk(narrator_root):
            for f in files:
                if not f.lower().endswith(AUDIO_EXTS):
                    continue
                abs_p = os.path.join(root, f)
                rel = rel_path(narrator_id, abs_p)
                if rel in master["clips"][narrator_id]:
                    continue
                todo.append((narrator_id, abs_p, rel))
    return todo

# ── Transcribe via faster-whisper ──
_model = None
def get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        print("[info] loading whisper small model...")
        _model = WhisperModel("small", device="cpu", compute_type="int8")
    return _model

def transcribe_one(path: str):
    try:
        segs, _ = get_model().transcribe(path, beam_size=5, language="en")
        parts = []
        total = 0.0
        n = 0
        for s in segs:
            parts.append(s.text.strip())
            total += s.avg_logprob
            n += 1
        text = " ".join(parts).strip()
        conf = round(total / n, 3) if n else None
        return text, conf, None
    except Exception as e:
        return None, None, str(e)

# ── Save master table ──
def save_master(master: dict):
    os.makedirs(OUT_DIR, exist_ok=True)
    # Refresh metadata counts
    master["metadata"]["generated"] = datetime.datetime.utcnow().isoformat() + "Z"
    master["metadata"]["byNarrator"] = {n: len(master["clips"][n]) for n in NARRATOR_DIRS}
    master["metadata"]["totalClips"] = sum(master["metadata"]["byNarrator"].values())
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(master, f, indent=2, ensure_ascii=False, sort_keys=True)

# ── Main ──
def main():
    parser_mode = "--merge-only" in sys.argv
    transcribe_limit = None
    for a in sys.argv[1:]:
        if a.startswith("--limit="):
            transcribe_limit = int(a.split("=", 1)[1])

    print(f"[info] output: {OUT_FILE}")
    master = load_master()
    print(f"[info] resumed with {master['metadata'].get('totalClips', 0)} existing entries")

    added = merge_existing(master)
    print(f"[info] merged {added} entries from scripts/out/")
    save_master(master)

    if parser_mode:
        print("[info] --merge-only mode; skipping transcription")
        print_summary(master)
        return

    todo = find_untranscribed(master)
    print(f"[info] {len(todo)} audio files still need transcription")

    if transcribe_limit is not None:
        todo = todo[:transcribe_limit]
        print(f"[info] limited to {len(todo)} this run")

    if not todo:
        print_summary(master)
        return

    for i, (narrator_id, abs_p, rel) in enumerate(todo):
        text, conf, err = transcribe_one(abs_p)
        if err:
            print(f"  [{i+1}/{len(todo)}] ERROR {narrator_id}/{rel}: {err}")
            continue
        master["clips"][narrator_id][rel] = {
            "text": text,
            "confidence": conf,
            "source": "whisper-small",
            "verified": False,
        }
        if (i + 1) % 25 == 0:
            print(f"  [{i+1}/{len(todo)}] {narrator_id}/{rel}: {text[:60]}")
        if (i + 1) % 100 == 0:
            save_master(master)
            print(f"[info] checkpoint saved ({master['metadata']['totalClips']} total entries)")

    save_master(master)
    print_summary(master)

def print_summary(master: dict):
    print("\n=== Master reference table ===")
    print(f"Total clips: {master['metadata']['totalClips']}")
    for n, count in master["metadata"]["byNarrator"].items():
        print(f"  {n}: {count}")
    print(f"\nWrote: {OUT_FILE}")

if __name__ == "__main__":
    main()
