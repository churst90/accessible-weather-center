# Accessible Weather Center

A fully accessible, speech- and keyboard-driven weather application with a Weatherscan-style cycling display. Designed accessibility-first: every visual is mirrored by a semantic narration so blind and low-vision users get the same information at the same fidelity as sighted users — including weather radar, which is normally inaccessible.

> Status: **v0.13.0 — Phase 5 (web preparation) plus release hardening.** The app no longer assumes one hard-coded location: a required first-run dialog asks for your ZIP, and nothing is fetched or announced until you answer. The media library was re-encoded from 5.2 GB to 1.3 GB (narration to MP3, backgrounds to WebP) and verified file-by-file against the originals. NOAA Weather Radio now works in a browser via a same-origin reverse proxy, since the Icecast host sends no CORS headers. Packaged Electron builds serve their own assets through a custom `awc-asset://` scheme, and CI builds Windows/macOS/Linux installers. This release also gave the app a logo, fixed a tray icon that had never once rendered, and added main-process crash handling so a tray app meant to run for days can't die in silence. Deployment tooling for weather.codyhurst.com lives in `deploy/`. 336 unit tests. Prior: v0.12.0 — structural release; App.tsx slimmed to wiring/UI, alert polling became a tested service, scene views resolve through a `(theme, scene)` registry. v0.11.0 — no-built-in-TTS policy, announcement system rebuilt, modality gate, and the visual batch that finally loaded the Star4000 fonts and IntelliStar icons. See [CHANGELOG.md](CHANGELOG.md) and [docs/user-manual.md](docs/user-manual.md).
>
> **Not 1.0, deliberately.** The Windows and macOS builds are unsigned and unnotarized, there is no auto-updater, two products (Almanac and Precip Outlook) have no narrator who can announce them, and several scenes declared optional on the hardware have no renderer yet. The code is in good shape; the commitments a 1.0 implies are not all made. See [docs/TODO.md](docs/TODO.md) for what stands between here and there.

## What this project is

Weather maps and radar displays are notoriously inaccessible to screen readers — color-only legends, pixel-based interactions, and no semantic structure. Weather is also one of the few domains where life safety depends on the user *understanding* the data, not just hearing that "an alert exists."

This project is a deliberate attempt to build a weather experience that:

1. **Looks and feels like the 24/7 Weatherscan loop** — cycling scenes, calm music, on-screen narration, the bug in the corner.
2. **Speaks every screen** with structured, prioritized narration, delivered through your screen reader (NVDA, JAWS, Narrator, Orca, VoiceOver) via aria-live regions. The app deliberately has no built-in TTS — the only speech it produces itself is the recorded narrator clips.
3. **Makes the map navigable as data, not pixels** — multiple "lenses" onto the same spatial data, each matched to a question a real user actually asks.
4. **Stays running in the background** so the user gets toast notifications when conditions worsen or alerts are issued.
5. **Honors the TWC visual era** you pick — scene layout, typography, palette, crawl behavior, and narrator all match the hardware unit.

## Install

**In a browser:** <https://weather.codyhurst.com/app/> — nothing to install.

**Desktop:** download an installer from [Releases](https://github.com/churst90/accessible-weather-center/releases).

| Platform | File | Notes |
|----------|------|-------|
| Windows | `-setup.exe` to install, or `-portable.exe` to run in place | Unsigned — SmartScreen will warn about an unknown publisher. Choose "More info" → "Run anyway". |
| macOS | `.dmg` (`x64` Intel / `arm64` Apple Silicon) | Unsigned and unnotarized. After copying to Applications, run:<br>`xattr -dr com.apple.quarantine "/Applications/Accessible Weather Center.app"` |
| Linux | `.AppImage`, `.deb`, `.tar.gz` | AppImage: `chmod +x` then run. |

Code signing certificates cost money per year and this is a personal project, so the builds are unsigned. The warnings above are the operating systems telling you exactly that — not a sign anything is wrong, but also not something to ignore blindly on software you didn't build yourself. The [build workflow](.github/workflows/build.yml) is public and produces the binaries from this source.

### The media library

Installers do **not** include the ~1.3 GB of fonts, icons, background art, narration clips and music. The application runs fine without it — system fonts, no music, screen-reader narration only — so this is an enhancement, not a prerequisite.

To add it, download the `assets-*.tar.gz` files from the media release and unpack them all into one directory:

| Platform | Location |
|----------|----------|
| Windows | `%APPDATA%\accessible-weather-center\assets` |
| macOS | `~/Library/Application Support/accessible-weather-center/assets` |
| Linux | `~/.config/accessible-weather-center/assets` |

Or, from a source checkout, let the script do it:

```bash
npm run assets:fetch -- --list        # see categories and sizes
npm run assets:fetch -- --app-data    # download, verify, unpack into the app's data dir
npm run assets:fetch -- --only fonts,icons --app-data   # just the small ones
```

Downloads are checksummed, and re-running skips anything already verified — so an interrupted 1.3 GB fetch just resumes.

## Quick start (development)

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

Building installers (electron-builder is fetched by `npx` rather than being a devDependency — see [electron-builder.yml](electron-builder.yml) for why):

```bash
npm run dist:linux   # or dist:win / dist:mac — output in release/
```

Cross-platform builds are better left to CI: push a `v*` tag and
[the workflow](.github/workflows/build.yml) builds all three and drafts a release.

Unit tests (uses only what's already installed — esbuild plus Node's built-in test runner):

```bash
npm test             # all tests — 336 of them
npm test Storm       # only test files whose name matches
```

The checks CI gates on, in the order it runs them:

```bash
npm run typecheck    # tsc -b for the renderer, then the Electron main config
npm run lint         # eslint over src/ and electron/
npm test
npm run clips:sweep:ci   # narration audit against the committed reference table
```

### Regenerating the app icon

The AWC mark lives in [`build/icon.svg`](build/icon.svg), with a
detail-stripped small-size variant in `build/icon-tray.svg` for the system
tray. The rasterized PNGs are committed, so you only need this after changing
the artwork:

```bash
npm run icons        # needs librsvg (rsvg-convert)
```

It writes `build/icon.png` (electron-builder derives the Windows `.ico`, macOS
`.icns` and Linux icon set from it), plus `public/tray-icon.png` and
`public/awc-mark.png`. Those two live in `public/` rather than `assets/`
because Vite copies `public/` into `dist/`, which the installers ship —
`assets/` is the optional 1.3 GB media library, and the tray icon pointed into
it until v0.13.0, which is why it was blank in every packaged build.

The mark is set in Interstate Bold, which comes from the media library. Without
it installed, `npm run icons` falls back to system fonts and the letterforms
will differ — another reason the PNGs are committed rather than generated at
build time.

### Configure your NWS User-Agent

The NWS API requires a real `User-Agent` identifying you. If you fork this project, edit `src/bootstrap.ts` (`buildServices`) and replace the contact email with your own before using anything beyond local dev. The version half of that string is injected from `package.json` at build time, so only the contact needs changing.

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
│   ├── places/    # PlacesStore (first-run aware), zipLookup
│   ├── scenes/    # Scene interface, SceneScheduler, scene implementations
│   ├── alerts/    # AlertWatcher — NWS alert polling service
│   └── settings/  # SettingsStore, themes, backgroundCatalog
├── a11y/        # Accessibility plumbing.
│   ├── AnnouncementQueue.ts   # Polite + assertive aria-live channels
│   ├── AnnouncerContext.ts
│   ├── KeyboardRouter.ts      # Centralized shortcut registry
│   ├── modality.ts            # "Is a modal open?" gate for key handlers
│   ├── useArrowList.ts        # 1-D list navigation
│   └── useArrowGrid.ts        # 2-D grid navigation (columns × rows)
├── audio/       # AudioMixer with ducking, MusicPlayer, ClipLibrary, PhraseSequencer
│   ├── nwrStations.ts         # NWR transmitter directory (bundled + live)
│   └── nwrEndpoints.ts        # Upstream vs. same-origin proxy selection
├── ui/
│   ├── weatherscan/           # Decorative visual skin (frame, LDL crawl, CSS per theme)
│   ├── semantic/              # aria-live region — what screen readers actually consume
│   ├── scenes/                # React renderers + sceneRegistry ((theme,scene) -> view)
│   ├── mapnav/                # Places / Alerts / Storms / Grid Explorer sub-modes
│   └── settings/              # Settings panel
├── platform/desktop/          # Electron-specific bridges
├── devices/                   # ONE PROFILE PER EMULATED MACHINE
│   ├── types.ts               # the Device contract
│   ├── registry.ts            # the list (cycle-free)
│   └── profiles/<id>.ts       # what each unit was: era, voice, rundown,
│                              #   product names, capabilities, gaps
├── bootstrap.ts               # buildServices() — constructs and wires everything
├── App.tsx                    # Service wiring / UI only
└── main.tsx                   # React entry
electron/
├── main.ts                    # Electron main: window, tray, awc-asset:// scheme,
│                              #   crash handlers, notifications
└── preload.ts                 # Context-bridged IPC
build/                         # Packaging resources, NOT build output
├── icon.svg                   # The AWC mark (source of truth)
├── icon-tray.svg              # Simplified small-size variant
├── icon.png                   # 1024px — electron-builder derives .ico/.icns
└── icons/                     # 16-1024 px set for Linux
public/                        # Copied verbatim into dist/ — ships in installers
├── tray-icon.png              # System tray (must NOT live in assets/)
└── awc-mark.png               # In-theme station logo slot
assets/                        # The optional 1.3 GB media library. Gitignored.
tests/                         # Unit tests (npm test — esbuild + node:test, no extra deps)
scripts/                       # Build, audit and asset tooling (see npm scripts)
deploy/                        # nginx vhost + server-setup.sh + publish.sh
.github/workflows/build.yml    # Windows / macOS / Linux installer CI
```

The `public/` vs `assets/` split is load-bearing: anything the app needs in
order to *start* goes in `public/` and ships in the installer, while `assets/`
is content the app is designed to run without. The tray icon lived in
`assets/` until v0.13.0, which is why it was blank in every packaged build.

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

The authentic TWC visual recreations rely on community-sourced assets — fonts, icons, logos, backgrounds, narration and music — that originated with The Weather Channel's broadcast systems. Where practical, assets come from MIT-licensed fan projects:

- **WeatherStar fonts** (Star3000, Star4000, StarJR families) and 41 animated weather-condition GIF icons — from [wesellis/FUN-WeatherStar-4000](https://github.com/wesellis/FUN-WeatherStar-4000) and [netbymatt/ws4kp](https://github.com/netbymatt/ws4kp) (MIT).
- **TWC logo, NOAA seal, IntelliStar wordmark, LDL strip template** — from [mewtek/OpenStar](https://github.com/mewtek/OpenStar) (MIT).
- **WeatherStar XL cloud wallpaper** — same source.
- **IntelliStar 1/2 city-gradient backgrounds** — TWC-derived fan archives.

**Important:** "The Weather Channel", "Weatherscan", "WeatherStar" and "IntelliStar" are trademarks of The Weather Channel. This project is a non-commercial recreation and does not claim affiliation or endorsement.

**A note on redistribution.** The MIT-licensed fan projects above are clearly redistributable. The rest of the library — narration clips, production music, and broadcast-derived background art — is not licensed to anyone, and publishing it as a public download is a different act from keeping a personal copy. That decision, and its consequences, belong to whoever publishes it. `scripts/package-assets.mjs` exists to make the mechanics easy; it does not make the rights question go away. Fonts in particular are commercial typefaces (Frutiger, Interstate, Akzidenz-Grotesk, Helvetica Neue) whose licences do not permit redistribution.

The `assets/` directory is **gitignored** — ~1.3 GB of fonts, icons, backgrounds, narration clips and music, sourced separately. Only `assets/.gitkeep` is committed to preserve the directory. The application is explicitly designed to run without it. See **[the User Manual](docs/user-manual.md#assets)** for the expected layout and **[docs/asset-pipeline.md](docs/asset-pipeline.md)** for how the library is encoded.

NWS and FAA data, and the NOAA seal, are US Government works and are in the public domain.

## License

TBD. The source code in `src/`, `electron/`, `scripts/`, `docs/` is your own work. Third-party assets have their own licenses as noted above.
