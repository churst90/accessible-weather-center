"""
Transcribe key VocalLocal clips using faster-whisper.
Targets: Periods2, Wind dirs, Default phrases, and numbered period variants.
"""
import os
import json
from faster_whisper import WhisperModel

model = WhisperModel("small", device="cpu", compute_type="int8")

BASE = os.path.join(os.path.dirname(__file__), "..", "assets", "narration")

DIRS_TO_TRANSCRIBE = [
    # AJ clips
    ("Alan Jackson", "VocalLocal/Periods2"),
    ("Alan Jackson", "VocalLocal/Default_Phrases_36_Hr_Fcast"),
    ("Alan Jackson", "VocalLocal/Default_Phrases_7Day_Fcast"),
    ("Alan Jackson", "VocalLocal/Default_Phrases_Curr_Cond"),
    ("Alan Jackson", "VocalLocal/Default_Phrases_Daypart"),
    ("Alan Jackson", "VocalLocal/Default_Phrases_Ext_Fcast"),
    ("Alan Jackson", "VocalLocal/Default_Phrases_Local_Obs"),
    ("Alan Jackson", "VocalLocal/Default_Phrases_Local_Radar"),
    ("Alan Jackson", "VocalLocal/Default_Phrases_Severe"),
    ("Alan Jackson", "VocalLocal/Default_Phrases_Traffic_Flow"),
    ("Alan Jackson", "VocalLocal/Default_Phrases_Traffic_Overview"),
    ("Alan Jackson", "VocalLocal/Intros_Curr_Cond"),
    # JC clips
    ("Jim Cantore", "Vocal Local/Periods2"),
    ("Jim Cantore", "Vocal Local/Default_Phrases_7Day_Fcast"),
    ("Jim Cantore", "Vocal Local/Default_Phrases_Curr_Cond"),
    ("Jim Cantore", "Vocal Local/Default_Phrases_Daypart"),
    ("Jim Cantore", "Vocal Local/Default_Phrases_Now"),
    ("Jim Cantore", "Vocal Local/Wind_Dir1"),
    ("Jim Cantore", "Vocal Local/Wind_Dir2"),
    ("Jim Cantore", "Vocal Local/Wind_Speed"),
    ("Jim Cantore", "Vocal Local/Wind_At_Speed"),
    ("Jim Cantore", "Vocal Local/Wind_Misc"),
    ("Jim Cantore", "Vocal Local/Wind_Becoming"),
    ("Jim Cantore", "Vocal Local/Wind_Shifting"),
    ("Jim Cantore", "Vocal Local/Wind_Increasing"),
    ("Jim Cantore", "Vocal Local/Wind_Diminishing"),
]

results = {}

for narrator, subdir in DIRS_TO_TRANSCRIBE:
    dirpath = os.path.join(BASE, narrator, subdir)
    if not os.path.isdir(dirpath):
        print(f"SKIP (not found): {narrator}/{subdir}")
        continue

    key = f"{narrator}/{subdir}"
    results[key] = {}

    audio_files = sorted([f for f in os.listdir(dirpath) if f.endswith(('.wav', '.mp3', '.flac'))])
    print(f"\n=== {key} ({len(audio_files)} files) ===")

    for fname in audio_files:
        fpath = os.path.join(dirpath, fname)
        try:
            segments, info = model.transcribe(fpath, language="en", beam_size=3)
            text = " ".join(s.text.strip() for s in segments).strip()
            results[key][fname] = text
            print(f"  {fname}: {text}")
        except Exception as e:
            results[key][fname] = f"ERROR: {e}"
            print(f"  {fname}: ERROR: {e}")

# Save results
outpath = os.path.join(os.path.dirname(__file__), "out", "vocallocal_transcriptions.json")
os.makedirs(os.path.dirname(outpath), exist_ok=True)
with open(outpath, "w") as f:
    json.dump(results, f, indent=2)

print(f"\nSaved to {outpath}")
