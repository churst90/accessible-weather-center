# Asset pipeline

The runtime asset library (`assets/`) is re-encoded, not raw. This document
records what was done, why, and how to redo it.

## Current state

`assets/` holds the **transcoded** library. The untouched originals live
outside the repo at:

```
/run/media/cody/Personal Data/AWC-asset-archive/assets-original-2026-08-06/
```

(Windows: `D:\AWC-asset-archive\assets-original-2026-08-06\`)

| Category    | Original  | Transcoded | Change                       |
|-------------|-----------|------------|------------------------------|
| narration   | 2206 MB   | 367 MB     | WAV/FLAC/MP2 → MP3           |
| backgrounds | 2090 MB   | 228 MB     | PNG → WebP                   |
| music       | 605 MB    | 506 MB     | untouched (already MP3)      |
| icons       | 143 MB    | 143 MB     | untouched                    |
| themes      | 133 MB    | 58 MB      | PNG → WebP (backgrounds only)|
| sfx         | 36 MB     | 4 MB       | WAV → MP3                    |
| fonts       | 27 MB     | 27 MB      | untouched                    |
| **Total**   | **5244 MB** | **1338 MB** | **74% smaller**            |

13,677 source files → 13,650 outputs (27 `.sfk` Sound Forge peak files
dropped as editor scratch). Zero encode failures.

## Encoding choices

**Audio → MP3, 128 kbps mono / 192 kbps stereo (LAME 3.100), source sample
rate preserved.** Narration is 48 kHz PCM, overwhelmingly mono; 128 kbps mono
is transparent for speech, about 6:1 against the source. MP3 rather than
Opus or AAC — both encode more efficiently, but MP3 is the one format every
browser on Windows, macOS and Linux decodes without depending on OS codecs
(Firefox's AAC support leans on system decoders; Safari only gained Ogg Opus
recently). For an accessibility-first app, a clip that silently fails to
decode is worse than a slightly larger file.

Files that were already MP3 are **copied, never re-encoded**. That includes
all music and a handful of clips carrying a `.wav` extension over MP3 data.
Lossy-to-lossy is the one transform that genuinely degrades quality.

**Backgrounds → WebP, best-of(lossy q92, lossless).** Both encodings are
produced and the smaller wins. This is not premature cleverness: the library
mixes 1920×1080 photography, where lossy wins by ~15:1, with flat-colour
radar and UI plates, where lossy is *larger than the source PNG* (it adds
noise to flat regions) and lossless wins by ~3:1. Final split was 2049 lossy
/ 9 lossless. Dimensions and alpha are preserved exactly.

**Not converted:** icons, logos, fonts, JSON, SVG. Icon PNGs are excluded
deliberately — `WeatherIcon`'s runtime fallback chain already juggles
still/WebP/GIF variants by filename, and renaming underneath it would
collide with the `.webp` files already in that directory.

## Source references

Because extensions changed, source references were rewritten in the same
commit:

- everything under `src/audio/` — `.wav`/`.flac` → `.mp3` (260 refs)
- `src/core/settings/backgroundCatalog.ts` — `.png` → `.webp` (82 refs)
- `src/core/settings/themes.ts` — `.png` → `.webp` on `backgroundImage`
  lines only (5 refs)

Icon, logo and font references were left alone, matching the files that were
left alone. `src/ui/weatherscan/weatherscan.css` only references fonts plus
`logos/ldl/LDL.png`, none of which were touched.

## Scripts

```bash
# Rebuild the transcoded tree from originals (resumable, idempotent)
node scripts/build-web-assets.mjs --src <originals> --out assets-web

# Audit an existing build: audio durations, image dimensions, copy sizes
node scripts/build-web-assets.mjs --verify --src <originals> --out assets-web

# Check that every /assets/... path in src/ resolves to a real file
node scripts/check-asset-refs.mjs
```

Requires `lame`, `cwebp`, `ffprobe` on PATH (and `ffmpeg` for FLAC/MP2/AIFF).

`--verify` is what makes an interrupted build trustworthy: it re-probes every
output and compares against the source, so a clip truncated by a killed
encode — which would cut off mid-word and still look like a valid file — is
caught rather than shipped.

## Known pre-existing broken references

`check-asset-refs.mjs` surfaced two problems that predate the transcode:

1. **Jim Cantore radar narration** —
   `narration/Jim Cantore/Vocal Local/Default_Phrases_Local_Radar/RADAR_DEFAULT{1,2}`
   are referenced in `narratorSchema.ts` but that directory has never existed
   in the asset tree. Those two clips have been silently dead since the
   initial commit. Still open: either source the clips or drop the entries.

2. **IS2 Jr blur pool** — `backgroundCatalog.ts` generated 56 numbered paths
   but only 28 files exist, so half the rotation 404'd. Fixed by counting the
   blur series (28) instead of the folder (56). The folder also holds 28
   *non-blur* `generic_generic_NNN` files that no pool currently references —
   adding them is a design decision, not a bug fix, so it was left alone.

## Web serving notes

All asset URLs are root-relative (`/assets/...`), so the browser streams them
on demand from whatever origin serves the app — nothing is bundled into the
JS. Serve them from the **same origin** as the app: the clip player routes
audio through WebAudio, which requires CORS headers for cross-origin media,
and same-origin sidesteps that entirely.
