"""Transcribe AJ group phrase samples (Well_See / Look_For / Expect / All_Days)."""
import os, json
from faster_whisper import WhisperModel

BASE = "D:/Data/Github/accessible-weather-center/assets/narration/Alan Jackson/VocalLocal"
OUT = "D:/Data/Github/accessible-weather-center/scripts/out/group_phrases_transcriptions.json"

model = WhisperModel("small", device="cpu", compute_type="int8")
results = {}

# Sample a few from each group dir
dirs_and_samples = [
    ("Wx_Phrases_Groups_Well_See", ["MON_RAIN1.wav", "TUE_TSTORM1.wav", "WED_FAIR1.wav", "THU_MCLOUDY1.wav"]),
    ("Wx_Phrases_Groups_Look_For", ["MON_RAIN2.wav", "TUE_TSTORM2.wav", "WED_FAIR2.wav"]),
    ("Wx_Phrases_Groups_Expect", ["MON_RAIN3.wav", "TUE_TSTORM3.wav", "WED_FAIR3.wav"]),
    ("Wx_Phrases_Groups_All_Days", ["RAIN_M_W.wav", "TSTORM_M_F.wav", "FAIR_T_T.wav"]),
    ("Wx_Phrases_Groups_Day3_4", ["RAIN_M_T.wav", "FAIR_T_W.wav"]),
    ("Wx_Phrases_Groups_Day4_5", ["RAIN_M_T.wav", "FAIR_T_W.wav"]),
]

for dirname, files in dirs_and_samples:
    results[dirname] = {}
    for f in files:
        path = os.path.join(BASE, dirname, f)
        if not os.path.exists(path):
            print(f"MISSING: {path}")
            continue
        segments, _ = model.transcribe(path, beam_size=5, language="en")
        text = " ".join(s.text.strip() for s in segments).strip()
        results[dirname][f] = text
        print(f"  {dirname}/{f}: {text}")

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)
print(f"\nWrote {OUT}")
