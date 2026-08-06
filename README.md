# Accessible Weather Center

A fully accessible, speech- and keyboard-driven weather application with a Weatherscan-style cycling display. Designed accessibility-first: every visual is mirrored by a semantic narration so blind and low-vision users get the same information at the same fidelity as sighted users — including weather radar, which is normally inaccessible.

> Status: **v0.11.0 — accessibility core + visual quick wins.** Speech policy clarified: the app has exactly two speech paths — your screen reader reading the aria-live regions, and the recorded narrator clips. The Web Speech built-in TTS is removed entirely. The announcement system was rebuilt (independent polite/assertive channels that no longer erase each other, identical repeats now speak, Escape's cancel works for screen-reader users), a shared modality gate stops scene shortcuts and arrow keys from firing underneath open dialogs, and Map Navigation now tracks the live radar instead of freezing at entry. Visual batch: the Star4000 fonts load for the first time (a path typo had every WS4000 theme in fallback fonts), IntelliStar 1 icons render (were 100% broken images), the severe-weather takeover now wins on every theme (IS2 authentically swaps to its LOT8 severe background art), high-contrast mode strips photo wallpapers, per-scene backgrounds reset properly, and all radar intensity labels/colors flow from one canonical table. Prior release 0.10.0 fixed ten audit-confirmed reliability bugs and added the test suite and the adjustable map-nav grid step. See [CHANGELOG.md](CHANGELOG.md) and [docs/user-manual.md](docs/user-manual.md).

## What this project is

Weather maps and radar displays are notoriously inaccessible to screen readers — color-only legends, pixel-based interactions, and no semantic structure. Weather is also one of the few domains where life safety depends on the user *understanding* the data, not just hearing that "an alert exists."

This project is a deliberate attempt to build a weather experience that:

1. **Looks and feels like the 24/7 Weatherscan loop** — cycling scenes, calm music, on-screen narration, the bug in the corner.
2. **Speaks every screen** with structured, prioritized narration, delivered through your screen reader (NVDA, JAWS, Narrator, Orca, VoiceOver) via aria-live regions. The app deliberately has no built-in TTS — the only speech it produces itself is the recorded narrator clips.
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

Unit tests (uses only what's already installed — esbuild plus Node's built-in test runner):

```bash
npm test             # all tests
npm test Storm       # only test files whose name matches
```

### Configure your NWS User-Agent

The NWS API requires a real `User-Agent` identifying you. If you fork this project, edit `src/App.tsx` (`buildServices`) and replace the contact email with your own before using anything beyond local dev.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Next / previous scene (skips disabled flavors) |
| `←` `→` `↑` `↓` | Navigate within the current scene (columns / rows / list) |
| `Home` / `End` | Jump to the start / end of the current row or list |
| `Space` | Pause or resume the scene loop |
| `M` | Toggle Favorites mode (place picker) |
| `N` | Toggle Map Navigation mode |
| `Ctrl+M` | Mute / unmute background music |
| `Ctrl+→` | Skip to the next music track |
| `0` | Toggle NOAA Weather Radio stream on / off |
| `1` / `Shift+1` | Music volume up / down (5%) |
| `2` / `Shift+2` | Weather Radio volume up / down (5%) |
| `3` | Speak active weather alerts (or "no active alerts") |
| `,` | Open Settings |
| `?` | Open Help dialog (full shortcut list) |
| `Esc` | Exit Favorites / Map Nav, otherwise silence current speech / close the current modal |

Inside Map Navigation (`N`): `Tab` cycles Storms / Alerts / Grid Explorer modes; arrows walk items or move the grid cursor; `[` and `]` change the grid step size (1, 3, 5, 10, or 25 miles per press); `Home` returns to your location; `Enter` reads full detail.

The stage carries `role="application"` so NVDA stays in focus mode automatically — no need to toggle browse vs focus each session.

For new users: see the **[User Manual](docs/user-manual.md)**.

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

## NOAA Weather Radio (NWR)

Optional live NWR transmitter stream that plays in the background regardless of the active scene. Powered by the weatherUSA Icecast feeds (`radio.weatherusa.net`). Independent volume control on its own audio bus — music ducks for narration but NWR does not, since it carries real-time weather information.

### How to use it

**Turn it on/off:** press `0` anywhere in the app, or open Settings (`,`) → "NOAA Weather Radio" → "Enable Weather Radio stream". The keyboard toggle announces what's playing ("Weather Radio on. KEC49, Buffalo NY.").

**Pick a station:** open Settings → NOAA Weather Radio → Call sign. Type any weatherUSA mount-point call sign (e.g. `KEB98` for Buffalo, `KEC60` for Milwaukee) or pick from the autocomplete. The list is a curated bundled snapshot (~35 stations with parsed city/state) merged with a live fetch from `radio.weatherusa.net/status-json.xsl` that runs when you open Settings — so the dropdown reflects mounts that are *currently streaming*, not a catalog of transmitters that may or may not relay. If you leave the field blank and Weather Radio is enabled, the app matches your favorite location — city and state together, so a Columbus, Ohio home never lands on Columbus, Georgia — to the nearest known active transmitter. **Important:** weatherUSA does not carry every NWS transmitter — contributors post SDR feeds from where they live. Your local call sign may not be there; pick the closest metro that is.

**Adjust the volume from the keyboard:**
- `1` raises **Music** volume by 5%; `Shift+1` lowers it by 5%.
- `2` raises **Weather Radio** volume by 5%; `Shift+2` lowers it by 5%.
- Each press announces the new percentage. Clamps at 0% / 100%.

**Adjust the volume in Settings:** sliders for both Music volume and Weather Radio volume live in the Audio fieldset.

**Mute Weather Radio:** hold `Shift+2` until you reach 0%, or press `0` to fully disconnect the stream.

### When a stream is unavailable

If a transmitter is offline or your network blocks the Icecast feed, the player retries with exponential backoff (2s, 4s, 8s, 16s, 30s). A connect-timeout guard also catches servers that accept the connection but never send data. After five consecutive failures the player gives up and announces *"Weather Radio stream for {call sign} is unavailable. Press comma to open settings and choose another station, or disable Weather Radio."* — your screen reader reads this from the live region. When a stream finally starts flowing, it announces *"Weather Radio streaming from {call sign}."* Re-selecting a station (even the same one) or changing any audio setting retries a failed stream; switching call signs resets the failure counter and starts fresh.

### Legal

NWR audio is US government public domain. The FCC permits rebroadcast within 1 hour of receipt (47 CFR 73.1207). EAS Attention Signals embedded in the stream are passed through as-is — this app is not an EAS originator and does not synthesize EAS tones (47 CFR Part 11 prohibits that outside genuine alerts).

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
│   ├── AnnouncementQueue.ts   # Polite + assertive aria-live channels
│   ├── AnnouncerContext.ts
│   ├── KeyboardRouter.ts      # Centralized shortcut registry
│   ├── modality.ts            # "Is a modal open?" gate for key handlers
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
tests/                         # Unit tests (npm test — esbuild + node:test, no extra deps)
```

For architectural rationale (visual/semantic split, radar legend invariant, scene lifecycle, storm tracking, dual-tier alerts, LDL crawl), see **[docs/architecture.md](docs/architecture.md)**. For the August 2026 full-codebase audit that drove the v0.10.0 fixes, see **[docs/code-audit-2026-08.md](docs/code-audit-2026-08.md)**. The backlog lives in **[docs/TODO.md](docs/TODO.md)**.

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
- **aria-live regions** — all announcements go to your screen reader; the app has no built-in TTS by design.
- **Web Audio API** — music/voice/radio mixer with ducking.
- **NWS API** + **RainViewer** + **FAA NAS Status** — weather data. All free, no keys.

## Fan-sourced assets and attribution

This project is personal and not distributed. The authentic TWC visual recreations rely on community-sourced assets — fonts, icons, logos, backgrounds — that originated with the Weather Channel's broadcast systems. Where practical, assets come from MIT-licensed fan projects:

- **WeatherStar fonts** (Star3000, Star4000, StarJR families) and 41 animated weather-condition GIF icons — from [wesellis/FUN-WeatherStar-4000](https://github.com/wesellis/FUN-WeatherStar-4000) and [netbymatt/ws4kp](https://github.com/netbymatt/ws4kp) (MIT).
- **TWC logo, NOAA seal, IntelliStar wordmark, LDL strip template** — from [mewtek/OpenStar](https://github.com/mewtek/OpenStar) (MIT).
- **WeatherStar XL cloud wallpaper** — same source.
- **IntelliStar 1/2 city-gradient backgrounds** — TWC-derived fan archives.

**Important:** "The Weather Channel" logo and name are trademarks of The Weather Channel. This project is a personal, non-commercial recreation and does not claim affiliation or endorsement. If you fork or redistribute, you are responsible for the IP implications in your jurisdiction.

The `assets/` directory is **gitignored** — it contains ~5 GB of fonts, icons, backgrounds, narration clips, and music that must be sourced separately. Only `assets/.gitkeep` is committed to preserve the directory. See **[the User Manual](docs/user-manual.md#assets)** for how to set up your local asset library.

NWS and FAA data, and the NOAA seal, are US Government works and are in the public domain.

## License

TBD. The source code in `src/`, `electron/`, `scripts/`, `docs/` is your own work. Third-party assets have their own licenses as noted above.
