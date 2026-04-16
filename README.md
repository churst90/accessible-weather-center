# Accessible Weather Center

A fully accessible, speech- and keyboard-driven weather application with a Weatherscan-style cycling display. Designed accessibility-first: every visual is mirrored by a semantic narration so blind and low-vision users get the same information at the same fidelity as sighted users — including weather radar, which is normally inaccessible.

> Status: **v0.9 — era-authentic theme splits, broadcast-referenced layouts**. Ten visual themes across seven TWC hardware families (Weatherscan split into Local/V1/V2, WS4000 split into V1/V2 with broadcast-verified 3-day Extended). Columnar forecast layouts with weather icons (per-theme resolution: WSXL→42×42, IS2→68×68 HD WEBP). Per-scene background templates for WS4000-v1/WSJr. Tab-based scene switching plus 2-D arrow navigation inside each scene. Era-correct logos (TWC, NOAA, IntelliStar). Persistent Lower Display Line (LDL) crawl with per-condition section icon. Static-PNG icon fallback under `prefers-reduced-motion: reduce`. Assets are gitignored — see Fan-sourced assets section below.

## What this project is

Weather maps and radar displays are notoriously inaccessible to screen readers — color-only legends, pixel-based interactions, and no semantic structure. Weather is also one of the few domains where life safety depends on the user *understanding* the data, not just hearing that "an alert exists."

This project is a deliberate attempt to build a weather experience that:

1. **Looks and feels like the 24/7 Weatherscan loop** — cycling scenes, calm music, on-screen narration, the bug in the corner.
2. **Speaks every screen** with structured, prioritized narration suitable for both built-in TTS and third-party screen readers (NVDA, JAWS, VoiceOver).
3. **Makes the map navigable as data, not pixels** — multiple "lenses" onto the same spatial data, each matched to a question a real user actually asks.
4. **Stays running in the background** so the user gets toast notifications when conditions worsen or alerts are issued.
5. **Honors the TWC visual era** you pick — scene layout, typography, palette, crawl behavior, and narrator all match the hardware unit.

## Quick start

```bash
npm install
npm run dev          # Vite dev server on http://localhost:5173
npm run dev:electron # in another terminal — Electron main process pointing at the dev server
```

Packaged build:

```bash
npm run build
npm run start
```

### Configure your NWS User-Agent

The NWS API requires a real `User-Agent` identifying you. Edit `src/App.tsx` (`buildServices`) and replace `configure-me@example.com` with your contact before using anything beyond local dev.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Next / previous scene (skips disabled flavors) |
| `←` `→` `↑` `↓` | Navigate within the current scene (columns / rows / list) |
| `Home` / `End` | Jump to the start / end of the current row or list |
| `Space` | Pause or resume the scene loop |
| `1`–`5` | Jump to Current / Radar / Hourly / Extended / Alerts |
| `M` | Toggle Favorites mode (place picker) |
| `N` | Toggle Map Navigation mode |
| `Ctrl+M` | Mute / unmute background music |
| `Ctrl+→` | Skip to the next music track |
| `,` | Open Settings |
| `?` | Open Help dialog (full shortcut list) |
| `Esc` | Silence current speech / close the current modal |

The stage carries `role="application"` so NVDA stays in focus mode automatically — no need to toggle browse vs focus each session.

For new users: see **[USER_GUIDE.md](USER_GUIDE.md)**.

## Themes

Ten themes across seven TWC hardware families. Each represents a specific broadcast era with period-correct typography, palette, music pool, narrator, and scene order. Research backed by authentic broadcast stills in `docs/reference/`.

| Theme | Era | Narrator | Visual signature |
|---|---|---|---|
| WeatherStar 3000 | 1988–1990 | Silent (no local voice) | Blue/purple, blocky Star3000 text, no radar, no icons |
| WeatherStar 4000 v1 | 2001–2004 | Allan Jackson | Flat orange header, solid blue content, 3-day Extended, 1998 cartoon icons |
| WeatherStar 4000 v2 | 2005–2009 | Allan Jackson | Skewed orange header, floating cyan-glow pane on orange-to-purple gradient, footer bar |
| WeatherStar Jr | 1993–2014 | Allan Jackson (unverified) | WS3000 layout in WS4000 font — text-only pages, no radar, no icons |
| WeatherStar XL | 1998–2014 | Allan Jackson | Cloud wallpaper, gold Akzidenz, persistent LDL crawl |
| Weatherscan Local | 1999–2003 | Allan Jackson | Regional photo backgrounds, Akzidenz-Grotesk, Trammell Starks music |
| Weatherscan V1 | 2003–2005 | Amy Bargeron | City-skyline backgrounds, Frutiger, yellow-wedge chrome, in-house jazz |
| Weatherscan V2 | 2005–2022 | Amy Bargeron | Same skylines, Interstate chrome, L-bar layout (pending) |
| IntelliStar 1 | 2003–2013 | Jim Cantore | Interstate, city-gradient backgrounds, LDL (sub-era splits pending) |
| IntelliStar 2 / 2 Jr HD | 2013+ | Chandler | HD, Interstate/Frutiger, glass panels, LDL (airport data via crawl) |

An accessibility **high-contrast overlay** (boolean setting, not its own theme) can layer on top of any theme.

## Scenes

Core scenes shown in era-authentic order per theme:

- **Current Conditions** — big icon + 120-px temp + readout grid of humidity/wind/pressure/visibility/dewpoint
- **Local Forecast** — narrative large-text panel cycling through NWS periods
- **Local Radar** — animated radar overlay with storm markers (see "Accessible map navigation" below)
- **Extended Forecast** — columnar layout, 3/5/7 days per theme era (WS4000=3-day, WS3000=3-day, others=7-day), weather icon per column, hi/lo temps
- **Hourly Forecast** — columnar, up to 8 hours, time + icon + temp + precip chance
- **Travel Cities** — 3-column table (city / temp + icon / conditions), walkable via arrow grid
- **Almanac** — 2-column Sun (sunrise/sunset/day length) and Moon (phase/illumination)
- **Alerts** — active NWS alerts with NOAA attribution

Value-add scenes (opt-in via Settings):

Detailed Conditions, Feels Like (side-by-side actual vs perceived), Temperature Trend (readouts + hourly bar chart), Weekend Forecast (columnar Sat/Sun), Overnight Forecast (hero card), Precipitation Outlook, Storm Tracker, Airport Delays (live FAA NAS Status feed), Traffic (placeholder — no free public API fits the Local-Trip-Times niche).

## Architecture at a glance

```
src/
├── core/        # Pure TS — types, data clients, scheduler. No DOM, no React.
│   ├── types.ts
│   ├── weather/   # NwsClient, RainViewerClient, FaaClient, WeatherService
│   ├── radar/     # IntensityLegend, StormScanner, StormClusterer, StormTracker
│   ├── places/    # PlacesStore, TravelCities
│   ├── scenes/    # Scene interface, SceneScheduler, scene implementations
│   └── settings/  # SettingsStore, themes, backgroundCatalog
├── a11y/        # Accessibility plumbing.
│   ├── TtsService.ts          # Pluggable TTS (Web Speech default)
│   ├── AnnouncementQueue.ts   # Bridge to TTS + aria-live region
│   ├── AnnouncerContext.ts
│   ├── KeyboardRouter.ts      # Centralized shortcut registry
│   ├── useArrowList.ts        # 1-D list navigation
│   └── useArrowGrid.ts        # 2-D grid navigation (columns × rows)
├── audio/       # AudioMixer with ducking, MusicPlayer, ClipLibrary, PhraseSequencer
├── ui/
│   ├── weatherscan/           # Decorative visual skin (frame, LDL crawl, CSS per theme)
│   ├── semantic/              # aria-live region — what screen readers actually consume
│   ├── scenes/                # React renderers (column grids, hero cards, readouts)
│   ├── mapnav/                # Places / Alerts / Storms / Grid Explorer sub-modes
│   └── settings/              # Settings panel
├── platform/desktop/          # Electron-specific bridges
├── App.tsx                    # Service wiring
└── main.tsx                   # React entry
electron/
├── main.ts                    # Electron main process: window, tray, notifications
└── preload.ts                 # Context-bridged IPC
```

For architectural rationale (visual/semantic split, radar legend invariant, scene lifecycle, storm tracking, dual-tier alerts, LDL crawl), see **[docs/architecture.md](docs/architecture.md)**.

## Accessibility design rules

These are *load-bearing*, not stylistic preferences:

1. **Never rely on color alone.** Every visually-conveyed state has a semantic counterpart.
2. **Visual and semantic are siblings.** Both render from the same core state.
3. **One source of truth for radar intensity** — `IntensityLegend`.
4. **Keyboard reachable for everything.** No mouse-only interactions.
5. **Visible focus, always.** Bright outline shows what has focus.
6. **Speech is interruptible.** `Esc` always silences. Assertive announcements preempt polite.
7. **High-contrast overlay** is one CSS attribute swap (`body[data-contrast="high"]`).
8. **Motion respects `prefers-reduced-motion`** — LDL and severe crawls freeze when requested.

## Tech stack

- **Electron** — desktop shell (tray, notifications, background).
- **Vite + React + TypeScript** — renderer UI.
- **Web Speech API** — default TTS engine (pluggable).
- **Web Audio API** — music/voice mixer with ducking.
- **NWS API** + **RainViewer** + **FAA NAS Status** — weather data. All free, no keys.

## Fan-sourced assets and attribution

This project is personal and not distributed. The authentic TWC visual recreations rely on community-sourced assets — fonts, icons, logos, backgrounds — that originated with the Weather Channel's broadcast systems. Where practical, assets come from MIT-licensed fan projects:

- **WeatherStar fonts** (Star3000, Star4000, StarJR families) and 41 animated weather-condition GIF icons — from [wesellis/FUN-WeatherStar-4000](https://github.com/wesellis/FUN-WeatherStar-4000) and [netbymatt/ws4kp](https://github.com/netbymatt/ws4kp) (MIT).
- **TWC logo, NOAA seal, IntelliStar wordmark, LDL strip template** — from [mewtek/OpenStar](https://github.com/mewtek/OpenStar) (MIT).
- **WeatherStar XL cloud wallpaper** — same source.
- **IntelliStar 1/2 city-gradient backgrounds** — TWC-derived fan archives.

**Important:** "The Weather Channel" logo and name are trademarks of The Weather Channel. This project is a personal, non-commercial recreation and does not claim affiliation or endorsement. If you fork or redistribute, you are responsible for the IP implications in your jurisdiction.

The `assets/` directory is **gitignored** — it contains ~5 GB of fonts, icons, backgrounds, narration clips, and music that must be sourced separately. Only `assets/.gitkeep` is committed to preserve the directory. See **[USER_GUIDE.md#assets](USER_GUIDE.md#assets)** for how to set up your local asset library.

NWS and FAA data, and the NOAA seal, are US Government works and are in the public domain.

## License

TBD. The source code in `src/`, `electron/`, `scripts/`, `docs/` is your own work. Third-party assets have their own licenses as noted above.
