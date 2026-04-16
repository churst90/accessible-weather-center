#!/usr/bin/env python3
"""
Transcribe the Alan Jackson / TWC voice clip library and emit machine-readable
manifests describing what each clip actually says.

Why this exists
---------------
The clip library ships with ~680 files using the original WeatherStar code
system (CC1600.mp3, CC2790.mp3, etc.). Nobody remembers exactly which code
maps to which phrase anymore, and hand-transcribing is a multi-hour job. This
script automates the first 90%: run Whisper over every file, classify each
result into a rough bucket (number, condition, intro, tone, unknown), and
write a JSON manifest plus a short list of clips that need a human eyeball.

Pipeline
--------
  1. Walk the clip directory.
  2. For each file, transcribe via faster-whisper.
  3. Bucket by Whisper's `no_speech_prob`, duration, and avg_logprob.
     - Very short or high-no-speech-prob files → "non_speech" (alert tones).
     - Low-confidence transcripts → "uncertain" (review manually).
     - Everything else → "speech".
  4. For speech clips, apply regex rules to guess a category and intent id
     that matches the TypeScript clipSchema convention.
  5. Write three outputs under scripts/out/:
       - clip_manifest.raw.json          every clip with raw transcript
       - clip_manifest.categorized.json  grouped by category
       - clip_manifest.review.txt        flat list of uncertain / unknown clips

The script is idempotent. Re-running picks up where it left off by reading
the previous raw manifest. Pass --force to retranscribe everything.

Usage
-----
  pip install -r scripts/requirements.txt
  python scripts/transcribe_clips.py
  python scripts/transcribe_clips.py --model medium      # more accurate
  python scripts/transcribe_clips.py --device cuda       # if you have a GPU
  python scripts/transcribe_clips.py --limit 20          # smoke test
  python scripts/transcribe_clips.py --force             # ignore resume state

You also need ffmpeg on your PATH — faster-whisper uses it to decode mp3.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable, Optional

try:
    from faster_whisper import WhisperModel
except ImportError:
    sys.stderr.write(
        "Missing dependency. Run: pip install -r scripts/requirements.txt\n"
    )
    raise

# ──────────────────────────── paths + knobs ────────────────────────────

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CLIPS_DIR = (
    REPO_ROOT
    / "assets"
    / "clips"
    / "Alan Jackson voice samples and TWC themes and audio"
)
DEFAULT_OUT_DIR = Path(__file__).resolve().parent / "out"

# Anything shorter than this is almost certainly a tone/sting, not speech.
MIN_DURATION_SEC = 0.30
# Whisper's own probability that a segment is non-speech.
NON_SPEECH_PROB_THRESHOLD = 0.60
# Segments below this logprob need human review.
LOW_CONFIDENCE_LOGPROB = -0.90


@dataclass
class ClipResult:
    file: str
    duration_sec: float
    transcript: str
    avg_logprob: float
    no_speech_prob: float
    bucket: str  # "speech" | "non_speech" | "uncertain"
    category: Optional[str] = None  # "number" | "condition" | "intro" | "direction" | "tone" | "unknown"
    intent: Optional[str] = None

    @classmethod
    def from_dict(cls, d: dict) -> "ClipResult":
        return cls(
            file=d["file"],
            duration_sec=d["duration_sec"],
            transcript=d["transcript"],
            avg_logprob=d["avg_logprob"],
            no_speech_prob=d["no_speech_prob"],
            bucket=d["bucket"],
            category=d.get("category"),
            intent=d.get("intent"),
        )


# ──────────────────────────── main pipeline ────────────────────────────


def iter_audio_files(root: Path) -> Iterable[Path]:
    if not root.exists():
        raise FileNotFoundError(f"clip directory does not exist: {root}")
    exts = {".mp3", ".wav", ".ogg", ".m4a", ".flac"}
    for p in sorted(root.iterdir(), key=lambda x: natural_key(x.name)):
        if p.is_file() and p.suffix.lower() in exts:
            yield p


def natural_key(name: str) -> tuple:
    """Sort '1.mp3' before '10.mp3' and 'CC9.mp3' before 'CC10.mp3'."""
    parts = re.split(r"(\d+)", name)
    return tuple(int(p) if p.isdigit() else p.lower() for p in parts)


def transcribe_one(model: WhisperModel, path: Path) -> ClipResult:
    segments_iter, info = model.transcribe(
        str(path),
        beam_size=5,
        vad_filter=False,
        language="en",
        # Short clips benefit from a small word timestamp pass — and we get
        # better no_speech_prob signal for free.
        word_timestamps=False,
        condition_on_previous_text=False,
    )
    segments = list(segments_iter)
    text = " ".join(seg.text.strip() for seg in segments).strip()
    if segments:
        avg_logprob = sum(s.avg_logprob for s in segments) / len(segments)
        no_speech_prob = sum(s.no_speech_prob for s in segments) / len(segments)
    else:
        avg_logprob = -10.0
        no_speech_prob = 1.0

    duration = float(info.duration)
    bucket = classify_bucket(duration, no_speech_prob, avg_logprob, text)

    text = fix_common_mishearings(text)

    result = ClipResult(
        file=path.name,
        duration_sec=round(duration, 3),
        transcript=text,
        avg_logprob=round(avg_logprob, 3),
        no_speech_prob=round(no_speech_prob, 3),
        bucket=bucket,
    )
    if bucket == "speech":
        categorize_speech(result)
    elif bucket == "non_speech":
        result.category = "tone"
        result.intent = guess_tone_intent(path.name)
    else:
        result.category = "unknown"
    return result


def fix_common_mishearings(text: str) -> str:
    """Whisper consistently confuses these phonemes in short weather clips."""
    text = re.sub(r"\bWendy\b", "Windy", text)
    text = re.sub(r"\bwendy\b", "windy", text)
    text = re.sub(r"\bLights know\b", "Light snow", text)
    text = re.sub(r"\blights know\b", "light snow", text)
    text = re.sub(r"\bShower is\b", "Showers", text)
    text = re.sub(r"\bshower is\b", "showers", text)
    # "Ice changing terrain" → "Ice changing to rain"
    text = re.sub(r"\bchanging terrain\b", "changing to rain", text)
    return text


def classify_bucket(
    duration: float, no_speech_prob: float, avg_logprob: float, text: str
) -> str:
    if duration < MIN_DURATION_SEC:
        return "non_speech"
    if no_speech_prob >= NON_SPEECH_PROB_THRESHOLD:
        return "non_speech"
    if not text:
        return "non_speech"
    # Whisper's famous silent-clip hallucinations.
    low = text.lower().strip(". ")
    if low in {"you", "thanks for watching.", "thank you.", "thanks.", "♪", ""}:
        return "non_speech"
    if avg_logprob < LOW_CONFIDENCE_LOGPROB:
        return "uncertain"
    return "speech"


# ──────────────────────────── categorizer ────────────────────────────


NUMBER_WORDS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
    "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
    "nineteen": 19, "twenty": 20, "thirty": 30, "forty": 40,
    "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
    "hundred": 100,
}

WEATHER_TOKENS = (
    "sunny", "cloudy", "cloud", "clouds", "clear", "clearing", "sun",
    "rain", "snow", "thunder", "storm", "wind", "windy", "fog", "foggy",
    "mist", "shower", "showers", "partly", "mostly", "overcast", "fair",
    "hot", "cold", "warm", "cool", "humid", "dry", "freezing", "chilly",
    "breezy", "hail", "sleet", "flurries", "drizzle", "haze", "hazy",
    "smoke", "dust", "sand", "wintry", "blizzard", "sprinkle", "sprinkles",
    "icy", "ice", "squall", "squalls",
)

COMPASS_WORDS = (
    "north", "south", "east", "west",
    "northeast", "northwest", "southeast", "southwest",
    "north-northeast", "east-northeast", "east-southeast",
    "south-southeast", "south-southwest", "west-southwest",
    "west-northwest", "north-northwest",
)


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def categorize_speech(r: ClipResult) -> None:
    t = r.transcript.lower().strip().rstrip(".")

    # "currently the temperature is" → intro
    if "currently" in t and "temperature" in t:
        r.category = "intro"
        r.intent = "current_intro"
        return

    # Status / fallback clip
    if t == "not available":
        r.category = "status"
        r.intent = "condition_not_available"
        return

    # Bare number word: "zero", "thirty", "ninety-nine", or a bare digit.
    if t in NUMBER_WORDS or re.fullmatch(r"\d+", t):
        r.category = "number"
        r.intent = f"number_{slugify(t)}"
        return

    # "N degrees" / "minus N degrees" — Whisper sometimes emits digits
    # ("3 degrees") instead of words ("three degrees"), so match both.
    m = re.match(r"^(minus\s+)?(\d+|[a-z][a-z\s\-]*?)\s+degrees?$", t)
    if m:
        r.category = "number"
        sign = "minus_" if m.group(1) else ""
        r.intent = f"number_{sign}{slugify(m.group(2))}_degrees"
        return

    # "with X", "and X" → condition phrases
    if re.match(r"^(with|and)\s+", t):
        r.category = "condition"
        r.intent = f"condition_{slugify(t)}"
        return

    # Compass direction phrases ("wind from the north", "out of the southwest")
    if any(re.search(rf"\b{w}\b", t) for w in COMPASS_WORDS):
        r.category = "direction"
        r.intent = f"direction_{slugify(t)}"
        return

    # Weather vocabulary fallback
    if any(w in t for w in WEATHER_TOKENS):
        r.category = "condition"
        r.intent = f"condition_{slugify(t)}"
        return

    r.category = "unknown"
    r.intent = None


def guess_tone_intent(filename: str) -> Optional[str]:
    low = filename.lower()
    if "severe" in low and "alert" in low:
        return "alert_tone_severe"
    if "tone" in low and "test" in low:
        return "nws_tone_test"
    if "mnemonic" in low:
        return "mnemonic"
    return None


# ──────────────────────────── output ────────────────────────────


def write_outputs(
    results: list[ClipResult], raw: Path, categorized: Path, review: Path
) -> None:
    results.sort(key=lambda r: natural_key(r.file))

    raw_doc = {"count": len(results), "clips": [asdict(r) for r in results]}
    raw.write_text(json.dumps(raw_doc, indent=2, ensure_ascii=False), encoding="utf-8")

    by_category: dict[str, list[dict]] = {}
    for r in results:
        key = r.category or r.bucket
        by_category.setdefault(key, []).append(
            {
                "file": r.file,
                "transcript": r.transcript,
                "intent": r.intent,
                "confidence": r.avg_logprob,
                "duration": r.duration_sec,
            }
        )
    cat_doc = {
        "count": len(results),
        "categories": {k: len(v) for k, v in by_category.items()},
        "by_category": {k: sorted(v, key=lambda x: natural_key(x["file"])) for k, v in by_category.items()},
    }
    categorized.write_text(
        json.dumps(cat_doc, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    review_lines = [
        "# Clips needing manual review",
        "# file | bucket | category | logprob | no_speech | transcript",
        "",
    ]
    for r in results:
        flagged = r.bucket == "uncertain" or (
            r.bucket == "speech" and r.category == "unknown"
        )
        if flagged:
            review_lines.append(
                f"{r.file:32s} | {r.bucket:10s} | {str(r.category):10s} | "
                f"logp={r.avg_logprob:+.2f} | no_sp={r.no_speech_prob:.2f} | {r.transcript}"
            )
    review.write_text("\n".join(review_lines) + "\n", encoding="utf-8")


def load_existing(path: Path) -> dict[str, ClipResult]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return {row["file"]: ClipResult.from_dict(row) for row in data.get("clips", [])}


# ──────────────────────────── entrypoint ────────────────────────────


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__.splitlines()[0],
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--clips", type=Path, default=DEFAULT_CLIPS_DIR, help="clip directory")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT_DIR, help="output directory")
    ap.add_argument(
        "--model",
        default="small",
        help="Whisper model: tiny | base | small | medium | large-v3 (default: small)",
    )
    ap.add_argument(
        "--device",
        default="cpu",
        help="cpu | cuda | auto (default: cpu)",
    )
    ap.add_argument(
        "--compute-type",
        default="int8",
        help="int8 | float16 | float32 (default: int8 — best for CPU)",
    )
    ap.add_argument(
        "--force",
        action="store_true",
        help="ignore existing raw manifest and re-transcribe everything",
    )
    ap.add_argument(
        "--limit",
        type=int,
        default=0,
        help="transcribe at most N new files (smoke test)",
    )
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    raw_path = args.out / "clip_manifest.raw.json"
    cat_path = args.out / "clip_manifest.categorized.json"
    review_path = args.out / "clip_manifest.review.txt"

    existing: dict[str, ClipResult] = {} if args.force else load_existing(raw_path)
    if existing:
        print(f"Resuming: {len(existing)} clips already transcribed.", file=sys.stderr)

    print(
        f"Loading Whisper model '{args.model}' on {args.device} ({args.compute_type})…",
        file=sys.stderr,
    )
    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)

    results: list[ClipResult] = list(existing.values())
    pending = [p for p in iter_audio_files(args.clips) if p.name not in existing]
    if args.limit:
        pending = pending[: args.limit]
    total = len(pending)
    if total == 0:
        print("Nothing to do. Pass --force to retranscribe.", file=sys.stderr)
        write_outputs(results, raw_path, cat_path, review_path)
        return 0

    print(f"Transcribing {total} clip(s)…\n", file=sys.stderr)
    for i, path in enumerate(pending, start=1):
        try:
            r = transcribe_one(model, path)
        except Exception as e:  # noqa: BLE001
            print(f"[{i}/{total}] FAILED {path.name}: {e}", file=sys.stderr)
            continue
        results.append(r)
        tag = r.category or r.bucket
        transcript_snippet = r.transcript[:60].replace("\n", " ")
        print(
            f"[{i:4d}/{total}] {path.name:32s} {r.duration_sec:5.2f}s  {tag:10s}  {transcript_snippet}",
            file=sys.stderr,
        )
        # Flush every 25 clips so a crash doesn't lose work.
        if i % 25 == 0:
            write_outputs(results, raw_path, cat_path, review_path)

    write_outputs(results, raw_path, cat_path, review_path)

    cats: dict[str, int] = {}
    for r in results:
        key = r.category or r.bucket
        cats[key] = cats.get(key, 0) + 1
    print("\nSummary:", file=sys.stderr)
    for k, v in sorted(cats.items(), key=lambda kv: -kv[1]):
        print(f"  {k:12s} {v:5d}", file=sys.stderr)
    print(
        f"\nWrote:\n  {raw_path}\n  {cat_path}\n  {review_path}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
