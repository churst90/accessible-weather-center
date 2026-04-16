# Broadcast Reference Captures

Automated scrape landed here via `scripts/scrape_page_images.py` and
`scripts/scrape_batch.sh`. Images can be read directly (PNG/JPG/GIF) by
viewing in any image tool or by the assistant (multimodal).

## What the automated pass captured

| Era | Source | Useful captures | Notes |
|---|---|---|---|
| **WS3000** | Wikipedia | **1** — `WeatherStarIII-example.png` (Willow Grove, PA Current Conditions — authoritative 500px still) | `ws3000/wiki/images/004_...` |
| WS3000 | HandWiki | Same Wikipedia still at 250px | Lower-res mirror — use Wikipedia copy |
| WS3000 | Fandom | 0 (Fandom renders images client-side) | MediaWiki API call returned no images in article body |
| WS3000 | TWC Classics (flavors) | Timeline thumbnails (not broadcast stills) | 149 files but most are site chrome / flavor tiles |
| **WS4000** | TWC Classics (timeline) | 0 useful captures | Only site navigation icons |
| WS4000 | Fandom | 0 | Client-side rendered |
| **WSJr** | Fandom | 0 | Client-side rendered |
| **IS1** | **TWC Classics (flavors)** | **~20 unique scene captures** — see list below | `is1/twcclassics/images/` |
| IS1 | HandWiki / Wikipedia | 0 scene captures (only hardware box photos) | |
| **IS2 HD** | EverybodyWiki | 1 hardware photo (`Intellistar_2.jpg`) | Not a screen capture |
| IS2 HD | Wikipedia (LOT8s) | 1 logo (`Local_on_the_8s_logo.png`) | Useful as a logo asset, not a frame capture |
| IS2 Jr | EverybodyWiki | 0 | |

## Usable IS1 scene captures

All at roughly 300×200px but legible enough to derive layouts. From the
`is1/twcclassics/images/` subdirectory:

- `current_conditions.jpg` — hero card (icon, gold temp, cyan-label fields right)
- `latest_observations.jpg` — 5-city table (city / temp / icon / condition)
- `regional_conditions.jpg`
- `regional_radar.jpg` — map with city labels + radar overlay
- `regional_forecast.jpg` — map with icons + HI/LO per city (titled by day, e.g. "saturday forecast")
- `radar_satellite.jpg`
- `the_week_ahead.jpg` — **7-column grid**, day / icon / HI / LO
- `extended_forecast.jpg`
- `daypart_forecast.jpg` — 4-column times (2pm/5pm/8pm/Mid) with large gold temps
- `12_hour_metro_forecast.jpg`, `24_hour_metro_forecast.jpg`
- `almanac.jpg` — 2-column (sunrise/sunset left, record highs/lows right)
- `air_quality_forecast.jpg`
- `local_forecast.jpg` — narrative text
- `traffic_flow.jpg`, `traffic_report.jpg`
- `getaway_forecast.jpg`
- `outdoor_activity_forecast.jpg`, `school_day_weather.jpg`

## What is still missing (needs real-browser capture)

Listed in priority order:

1. **IS2 HD / IS2 Jr full-frame captures** — the windowed LOT8s layout. Without these we can't build the signature IS2 frame component. Cloudflare blocks twcarchive.com and Fandom renders client-side, so both require a real browser (or a headless browser dependency we haven't taken on).
2. **WS4000 broadcast stills** — authentic 1991+ Current Conditions with large icon, Feb 1991 3-day Extended, 8-level radar (post-1994), graphic moon Almanac.
3. **WSJr broadcast stills** — to confirm the "WS3000 layout in WS4000 font" thesis with real frames.
4. **IS1 "Now" 2007 facelift** — our captures are pre-facelift (white body text, not dark blue). Need post-Oct 2007 stills for the later sub-era.
5. **IS1 LDL evolution** — pre-Jun 2008 (Interstate Regular) and post-Jun 2008 (tabs + Helvetica Neue) captures.
6. **IS2 alert overlay variants** — the red/yellow/orange left-box + crawl over the LDL.

## How to re-run the scrape

```bash
# One URL at a time:
python scripts/scrape_page_images.py <URL> docs/reference/<era>/<slug>

# All working sources in one go:
bash scripts/scrape_batch.sh
```

The scraper skips Cloudflare challenge pages and preserves a `manifest.txt`
per subdirectory showing every source URL that was fetched.

## Adding new sources

If the user gets captures by hand (e.g. from twcarchive.com in a browser),
drop them under `<era>/manual-<source>/images/` with descriptive filenames
like `current-conditions-twcarchive-2005.jpg`. The implementation passes
will pick them up automatically.
