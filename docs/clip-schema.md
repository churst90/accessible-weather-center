# Alan Jackson Voice Clip Schema

This document describes how the bundled clip library under
`assets/clips/Alan Jackson voice samples and TWC themes and audio/`
maps to semantic intents. The mapping lives in code at
`src/audio/manifests/clipSchema.ts` — this doc explains the *why* and
flags every entry that needs spot-verification.

The library follows the original WeatherStar / Weatherscan voice
convention, which is reasonably well documented in the fan-emulator
community but was never published officially. Where I'm guessing, I say so.

## File family overview

| Pattern                  | Count    | Purpose                                          | Confidence |
| ------------------------ | -------- | ------------------------------------------------ | ---------- |
| `1.mp3` .. `139.mp3`     | 139      | Positive integer readings ("1 degree" .. "139 degrees") | likely |
| `M1.mp3` .. `M99.mp3`    | 99       | Negative integer readings ("minus 1 degree" .. "minus 99 degrees") | likely |
| `Zero.mp3`               | 1        | "zero"                                           | likely     |
| `Zeros.mp3`              | 1        | Alternate take of "zero" (?)                     | guess      |
| `1s.mp3`                 | 1        | Singular form of "one" (e.g. "1 degree")         | likely     |
| `CC_INTRO1.mp3`          | 1        | "Currently, the temperature is"                  | confirmed  |
| `CC###.mp3`              | ~25      | Base condition codes (CC400..CC910)              | mixed      |
| `CC####.mp3`             | ~50      | Extended condition codes (CC1000..CC3400)        | guess      |
| `CCEF####.mp3`           | ~50      | Extended-forecast condition variants             | guess      |
| `CCSH####.mp3`           | ~310     | Sky cover + weather composite codes              | guess      |
| `CCSAND.mp3`, etc.       | 8        | Named conditions (sand, dust, snow, thunder…)    | likely     |
| `Mnemonic.mp3`           | 1        | Weatherscan musical signature / sting            | likely     |
| `Severe Weather Alert tone.mp3` | 1 | Alert chime audio                              | confirmed  |
| `National weather service tone test.mp3` | 1 | NWS tone test                          | confirmed  |

**Total:** 682 files.

## What's confirmed vs guessed

### Confirmed (you told me directly)

- `CC_INTRO1.mp3` = "Currently, the temperature is"
- `CC400.mp3` = "with a thunderstorm"
- `CC402.mp3` = "with a heavy thunderstorm"
- `Severe Weather Alert tone.mp3` = the alert chime
- `National weather service tone test.mp3` = NWS test signal

### Likely (matches the WeatherStar/Weatherscan documented convention)

- The numeric files 1.mp3..139.mp3 are temperature readings, one file per integer.
- The M-prefixed files M1.mp3..M99.mp3 are negative-temperature readings ("minus N degrees").
- `1s.mp3` is the singular form ("1 degree" with the singular noun).
- `Zero.mp3` is just "zero."
- The named condition phrases (CCDUST, CCSAND, CCSNOW, CCTHUNDER, CCSHOWERS) are short distinct phrases as named.

### Guess (consistent pattern, but not verified by ear)

- The base CC### family follows the convention: first digit = weather group
  (4 = thunderstorm, 5 = drizzle, 6 = rain, 7 = snow, 8 = clear/fair,
  9 = freezing precipitation), with sub-digits modifying intensity. So:
  - CC500 ≈ "with drizzle"
  - CC600 ≈ "with rain"
  - CC610 ≈ "with light rain"
  - CC700 ≈ "with snow"
  - CC710 ≈ "with light snow"
  - CC800 ≈ "and clear"
  - CC900 ≈ "with freezing rain"
- The 4-digit codes (CC1000+) are composite conditions (e.g. "rain mixed with snow").
- The CCEF prefix is the Extended Forecast variant of the same condition codes — same content, different phrasing.
- The CCSH prefix encodes a 4-digit composite where the first two digits are
  sky cover (clear / mostly clear / partly cloudy / mostly cloudy / overcast)
  and the last two digits are the weather code. So `CCSH6300` ≈ "overcast
  with rain", `CCSH4000` ≈ "scattered clouds with no weather", etc. **This
  is the family I'm least sure about.** The PhraseComposer falls back to
  TTS for these by default unless the user lowers the confidence threshold.

## How to verify

1. Open Settings (`,` while the app is running) and set "Clip confidence threshold" to "Confirmed only" — this forces the app to only use the clips I'm sure about. Everything else falls back to TTS.
2. As you confirm individual codes by ear, edit `src/audio/manifests/clipSchema.ts` and bump their `confidence` from `"guess"` to `"confirmed"`. Then raise the threshold back to `"likely"` to enable them.
3. A more efficient approach (TODO): build a small "clip verifier" page in the app that walks every file in the schema and lets you press Y/N to mark each one. The marks would patch the schema file directly.

## Why we don't rename files

Three reasons:

1. **Reproducibility.** A future drop-in of the same library replaces files in place without breaking anything.
2. **One source of truth.** The schema lives in code, not in the filesystem. Filename and meaning are decoupled.
3. **Round-trip with the community.** If we ever want to share manifests with WeatherStar emulator projects, we're speaking the same filename language.

## Phrase composition

When the Current Conditions scene fires, the `PhraseComposer` builds a script like this:

```
[CC_INTRO1.mp3]   "Currently, the temperature is"
[52.mp3]          "52 degrees"
[CC402.mp3]       "with a heavy thunderstorm"
[TTS fallback]    "Wind south at 12 miles per hour. Humidity 78 percent."
```

Each segment is either a clip (chosen by intent) or a TTS fallback. The
sequencer plays them in order through the voice bus, ducking music. If a
clip is missing or low-confidence, the TTS fallback runs for that segment
only — the rest of the phrase still uses clips.

## Wind, humidity, pressure

The bundled library is current-conditions focused and does not appear to ship dedicated wind-direction, wind-speed, humidity, or pressure phrasing. Until we confirm otherwise, the composer reads those through TTS as a single trailing segment. If you find clips for these (e.g. WIND_*, HUM_*, PRESS_*), add them to `clipSchema.ts` and the composer will start using them automatically.

## Alert tones

We do **not** use the bundled `Severe Weather Alert tone.mp3` by default. The `AlertTones` module in `src/audio/AlertTones.ts` synthesizes:

- A 1050 Hz NOAA Weather Radio tone (public domain spec)
- A three-note advisory chime
- A four-note warning chime

This avoids any chance of confusion with the FCC-regulated EAS Attention Signal (47 CFR §11.45), which is illegal to broadcast outside actual emergencies. If you specifically want to use the bundled file for personal-use playback, plumb it through `ClipLibrary.playSrc("/assets/clips/Alan%20Jackson...%20tone.mp3")`.
