"""
Transcribe remaining untranscribed vocal clips:
1. JC H08xxxx exclusive longform clips (364 files)
2. AJ composite pair clips (sample of 30, then full if encoding confirmed)

Uses faster-whisper with the 'small' model for good accuracy on short clips.
Output: scripts/out/remaining_transcriptions.json
"""
import os
import json
import sys
from faster_whisper import WhisperModel

BASE = os.path.join(os.path.dirname(__file__), "..", "assets", "narration")
OUT_DIR = os.path.join(os.path.dirname(__file__), "out")
OUT_FILE = os.path.join(OUT_DIR, "remaining_transcriptions.json")

# Resume from existing output if available
if os.path.exists(OUT_FILE):
    with open(OUT_FILE, "r") as f:
        results = json.load(f)
    print(f"Resuming: {sum(len(v) for v in results.values())} clips already transcribed")
else:
    results = {}

model = WhisperModel("small", device="cpu", compute_type="int8")

def transcribe_file(filepath):
    """Transcribe a single audio file. Returns (text, confidence)."""
    try:
        segments, info = model.transcribe(filepath, beam_size=5, language="en")
        text_parts = []
        total_prob = 0
        count = 0
        for seg in segments:
            text_parts.append(seg.text.strip())
            total_prob += seg.avg_logprob
            count += 1
        text = " ".join(text_parts).strip()
        avg_conf = total_prob / count if count > 0 else -999
        return text, avg_conf
    except Exception as e:
        print(f"  ERROR: {e}")
        return None, None

def transcribe_directory(label, dirpath, file_filter=None):
    """Transcribe all .wav files in a directory."""
    if label not in results:
        results[label] = {}

    if not os.path.isdir(dirpath):
        print(f"SKIP (not found): {dirpath}")
        return

    files = sorted([f for f in os.listdir(dirpath) if f.endswith(".wav")])
    if file_filter:
        files = [f for f in files if file_filter(f)]

    # Skip already transcribed
    remaining = [f for f in files if f not in results[label]]
    print(f"\n=== {label}: {len(remaining)} remaining of {len(files)} total ===")

    for i, filename in enumerate(remaining):
        filepath = os.path.join(dirpath, filename)
        text, conf = transcribe_file(filepath)
        if text is not None:
            results[label][filename] = {
                "text": text,
                "confidence": round(conf, 3)
            }
            print(f"  [{i+1}/{len(remaining)}] {filename}: {text}")

        # Save every 25 clips for resume safety
        if (i + 1) % 25 == 0:
            save_results()

    save_results()

def save_results():
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_FILE, "w") as f:
        json.dump(results, f, indent=2)

# ─── 1. JC H08xxxx exclusive longform clips ───
print("\n" + "="*60)
print("PHASE 1: JC exclusive longform clips (H08xxxx)")
print("="*60)

jc_longform_dir = os.path.join(BASE, "Jim Cantore", "Vocal Local", "Wx_Phrases_Longform")
transcribe_directory(
    "jc_longform_exclusive",
    jc_longform_dir,
    file_filter=lambda f: f.startswith("H08")
)

# ─── 2. AJ composite pairs (sample first) ───
print("\n" + "="*60)
print("PHASE 2: AJ composite pair clips (sample)")
print("="*60)

aj_longform_dir = os.path.join(BASE, "Alan Jackson", "VocalLocal", "Wx_Phrases_Longform")

# Sample: pick ~30 files spread across different CCSH code pairs
all_composites = sorted([
    f for f in os.listdir(aj_longform_dir)
    if f.endswith(".wav") and f[0].isdigit() and len(f) == 14  # 10 digits + .wav
])

# Pick samples: every ~50th file for good coverage
sample_indices = list(range(0, len(all_composites), max(1, len(all_composites) // 30)))
sample_files = [all_composites[i] for i in sample_indices[:30]]

print(f"Sampling {len(sample_files)} of {len(all_composites)} composite clips")

if "aj_composite_sample" not in results:
    results["aj_composite_sample"] = {}

for i, filename in enumerate(sample_files):
    if filename in results["aj_composite_sample"]:
        continue
    filepath = os.path.join(aj_longform_dir, filename)
    text, conf = transcribe_file(filepath)
    if text is not None:
        # Parse the encoding
        code_a = filename[:4]
        code_b = filename[4:8]
        variant = filename[8]
        take = filename[9]
        results["aj_composite_sample"][filename] = {
            "text": text,
            "confidence": round(conf, 3),
            "ccsh_a": int(code_a),
            "ccsh_b": int(code_b),
            "time_variant": int(variant),
            "take": int(take)
        }
        print(f"  [{i+1}/{len(sample_files)}] {filename} ({code_a}->{code_b} v{variant}t{take}): {text}")

    if (i + 1) % 10 == 0:
        save_results()

save_results()

# ─── 3. Full composite transcription if sample looks good ───
print("\n" + "="*60)
print("PHASE 3: Full AJ composite transcription")
print("="*60)

transcribe_directory(
    "aj_composites",
    aj_longform_dir,
    file_filter=lambda f: f[0].isdigit() and len(f) == 14
)

save_results()
print(f"\nDone! Total clips transcribed: {sum(len(v) for v in results.values())}")
print(f"Output: {OUT_FILE}")
