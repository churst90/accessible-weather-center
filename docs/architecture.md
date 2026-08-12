# Architecture

This document explains the *why* behind the layout in `src/`. The README has the surface overview; this is the design rationale you'd want before making structural changes.

## Layering

```
┌──────────────────────────────────────────────────────────┐
│  ui/           React components (Weatherscan + semantic) │
├──────────────────────────────────────────────────────────┤
│  a11y/         TTS, announcements, keyboard routers,     │
│                useArrowList + useArrowGrid hooks         │
│  audio/        Mixer, music player, clip library,        │
│                PhraseSequencer, PhraseComposer           │
├──────────────────────────────────────────────────────────┤
│  core/         Pure TS — types, clients, scheduler,      │
│                scenes, settings/themes, places, radar    │
├──────────────────────────────────────────────────────────┤
│  platform/     Electron-specific bridges                 │
└──────────────────────────────────────────────────────────┘
```

Each layer depends only on layers below it. `core/` has no DOM, no React, no Electron, no Web APIs beyond `fetch`. `a11y/` and `audio/` depend on browser APIs but not on React. `ui/` is the only layer that imports React. This isn't ceremony — it's what lets us swap the renderer (or run scenes in tests) without dragging the world along.

## The visual / semantic split

**Rule:** the visual skin and the semantic layer are **siblings**, both rendering the same core state. Neither is the source of truth for the other.

A naive accessibility approach instruments visual components after the fact — adds `aria-label`, traps focus, hopes for the best. That always fails because the visual structure was designed for sighted users; the screen reader sees a noisy approximation. We avoid this by producing two outputs from each scene at the same time:

```
SceneContext ──▶ Scene.prepare() ──▶ RenderedScene
                                       ├── data    (consumed by ui/scenes/*)
                                       ├── speech  (consumed by a11y/AnnouncementQueue)
                                       ├── musicCue
                                       └── jacksonCue
```

The visual view never inspects the speech string; the announcer never inspects the React tree. They share `data` and produce parallel outputs. They cannot drift.

## Keyboard model

Version 0.8 introduced a two-axis keyboard model:

```
Tab / Shift+Tab    ───▶  change scenes  (scheduler.next/prev)
Arrow keys         ───▶  navigate WITHIN the current scene
  ← →              ───▶  columns (or linear list in 1-D scenes)
  ↑ ↓              ───▶  rows (or linear list in 1-D scenes)
Home / End         ───▶  start / end of current row or list
1–5                ───▶  jump to a specific scene
Space              ───▶  pause/resume scheduler
Esc                ───▶  silence speech / close modal
```

Two hooks implement the within-scene nav:
- **`a11y/useArrowList.ts`** — 1-D list. Used by Alerts, Airport Delays, Local Forecast narrative (walks periods).
- **`a11y/useArrowGrid.ts`** — 2-D grid with explicit `columns` count. Used by Extended / Hourly / Weekend (single-row columnar), Current Conditions (3×2 readouts), Almanac (2 × 3), Travel Cities (3 × N), Feels Like (1×2), Temp Trend bars (1 × N).

The scheduler-level handlers (`Tab`, `1`–`5`, `Space`, `M`, `N`, `,`, `?`, `Esc`) live in `App.tsx` and route through `a11y/KeyboardRouter`. Per-scene arrow handlers attach on mount in their view component.

## The radar legend invariant

`core/radar/IntensityLegend.ts` is the **single source of truth** mapping mm/h → `PrecipBand` → color name → speech. Everything that talks about radar intensity goes through it:

- The visual layer renders the color from the same row that produced the speech word "moderate."
- The TTS announcer pulls "moderate rain, yellow on radar" from the same lookup.
- Future alert rules ("notify me on heavy rain") use the same `PrecipBand` enum.

Without this invariant, "yellow on the screen" and "moderate rain in audio" would diverge the moment someone tweaked one and forgot the other.

## Scene system

A scene is the unit of cycling content. The interface is intentionally tiny:

```ts
interface Scene<T = unknown> {
  readonly id: string;
  readonly title: string;
  readonly defaultHoldMs: number;
  prepare(ctx: SceneContext): Promise<RenderedScene<T>>;
}
```

`prepare()` is async because every scene fetches its own data. The scheduler awaits it, then holds for `holdMs`, then advances. Pausing cancels the hold timer; resuming reschedules. Jump-by-id (`jumpToId("alerts")`) is the same code path as next/prev.

The split between `Scene` (logic) and `View` (React renderer) lives in two folders:

- `core/scenes/scenes/*.ts` — prep logic, speech generators
- `ui/scenes/*.tsx` — React renderers, switched on `scene.id` in `App.tsx#SceneStage`

## Scene layout patterns

The UI layer uses a small set of reusable layout patterns. Every new scene should pick one rather than inventing a new shape:

| Pattern | Used by | CSS class prefix | Navigation |
|---|---|---|---|
| **Columnar grid** (1 row × N columns) | Extended, Hourly, Weekend | `.ws-extended-*` | `useArrowGrid`, L/R walks days |
| **Hero card** (large icon + big temp + readouts) | Current Conditions, Overnight | `.ws-cc-*`, `.ws-hero-*` | `useArrowGrid` on readout cells |
| **Split panels** (side-by-side comparison) | Feels Like | `.ws-feels-*` | `useArrowGrid` (columns = 2) |
| **Readout + bars** (data-dense) | Temperature Trend | `.ws-trend-*` | `useArrowGrid` on bars |
| **Sun/Moon 2-column** | Almanac | `.ws-almanac-*` | `useArrowGrid` (columns = 2) |
| **Multi-row table** | Travel Cities | `.ws-travel-*` | `useArrowGrid` with per-row cells |
| **Large narrative** (single-period big text) | Local Forecast | `.ws-narrative-*` | `useArrowList` stepping periods |
| **Readout table** (stacked label/value rows) | Detailed, Storm Tracker, Precip Outlook | `.ws-readout-*` (already era-themed) | `useArrowList` on rows |
| **Simple list** | Alerts, Airport Delays, Traffic fallback | `.ws-list-*` (already era-themed) | `useArrowList` |

Each pattern has a shared base in `weatherscan.css` and per-theme overrides keyed by `body[data-theme="…"]`. The Extended grid has the most complete per-theme tuning; other patterns rely on CSS variables (`--ws-accent`, `--ws-font-display`, etc.) and pick up era-distinct looks from those alone.

## Themes

Seven themes live in `src/core/settings/themes.ts`. Each represents a distinct TWC hardware unit and must be visually unique. Soft duplicates were retired in v0.8:

- **Retired `classic90s`** — duplicated WS4000's fonts + scene order. Users migrate to `ws4000`.
- **Retired `intellistar2jr` as a distinct theme** — same fonts and scene order as IS2. Consolidated into `intellistar2` ("IntelliStar 2 / 2 Jr HD"), with Jr's blur backgrounds folded into the shared pool. Users migrate to `intellistar2`.
- **Retired `highcontrast` as a theme** — never a TWC hardware unit. The `highContrast` boolean setting remains as a CSS overlay (`body[data-contrast="high"]`) that can layer on any theme. Users migrate to `weatherscan`.

Each `ThemeDef` bundles:
- CSS custom properties (palette, font family tokens)
- Background image (or empty for themes that use a gradient)
- Icon set path (small GIFs for WS4000-era, larger for IS / WSXL)
- Music tags (filters what `MusicPlayer` will pick)
- `extendedStyle` (`"5-day"` or `"7-day"`) + `extendedTitle` — drives the Extended Forecast scene's period count + heading
- Default narrator id

`THEME_CORE_SCENES` defines the authentic loop order per theme. `VALUE_ADD_SCENES` are off-by-default opt-ins. `THEME_EXCLUDED_SCENES` hides scenes that weren't part of a particular unit's presentation — currently only `intellistar2` hides `"airport"` (IS2 HD ran airport data in the LDL, not as a standalone scene).

## Lower Display Line (LDL) crawl

The Lower Display Line is a persistent bottom-of-screen crawl that ran on every era from Weatherscan forward. `ui/weatherscan/LdlCrawl.tsx` renders it; `WeatherscanFrame` gates it by theme:

```
themeId ∈ { weatherscan, weatherstarxl, intellistar1, intellistar2 }
  &&  faaClient present
  &&  no severe-alert interrupt active
  ──▶  render <LdlCrawl />
```

The crawl pulls airport delays + closures live from the FAA NAS Status feed, sorts closures first + worst delays next, and scrolls a seamless marquee over the authentic `LDL.png` strip (a black gradient bar with a rounded logo-nub cutout on the right edge, sized to fit via `background-size: 100% 100%`). Per-theme CSS tints the left-side label block and the content typography without clobbering the strip image.

Accessibility:
- Animated strip is `aria-hidden`.
- Same content exposed as a visually-hidden `<ul role="region">` so AT users walk a static list.
- `prefers-reduced-motion: reduce` freezes the marquee and wraps text normally.

The crawl yields to the severe-alert ticker when a severe interrupt fires — that path has the same AT treatment (sr-only list + reduced-motion freeze).

## Map navigation as data

The instinct to "make the map accessible" usually produces a grid sweep — arrow keys panning across a 2D field. That's the wrong abstraction for almost every question a user actually asks. Instead, the app ships **multiple lenses**, each matched to a real question:

| Mode | Question | Data structure |
|---|---|---|
| Places | "What's at my saved locations?" | Flat list |
| Alert polygons | "What does this warning cover?" | NWS CAP polygons |
| Storms | "What's approaching?" | List sorted by distance/bearing |
| Grid Explorer | "Let me explore the shape" | 2D grid, opt-in |

Implementations live in `ui/mapnav/`. The mode switcher is Tab-bar style within Map Navigation view (entered via `N`).

## Speech routing

Anything that wants to be spoken calls `AnnouncementQueue.announce(text, priority)`. The queue routes to:

1. The DOM aria-live region (`ui/semantic/AnnouncementRegion.tsx`) — picked up by NVDA, JAWS, VoiceOver, Orca.
2. The internal `TtsService` — for users running the app standalone without a screen reader.

A user can disable either via `setMode("tts" | "live-region" | "both" | "off")`. Most users pick one. Both is the dev default.

`Esc` always silences. Assertive announcements (alerts) preempt polite ones via `speechSynthesis.cancel()` then queue.

## Audio mixer routing

```
MusicPlayer ──▶ musicGain ─┐
                            ├──▶ destination
ClipLibrary ──▶ voiceGain ──┘
```

When `ClipLibrary.play(intent)` or `PhraseSequencer.play(script)` runs, it calls `mixer.duck()` (ramp musicGain to 0.15 over 150 ms), plays the clip on the voice bus, and `mixer.unduck()`s on end (ramp back over 400 ms). Music keeps playing throughout — narration rides *over* music.

The mixer is started lazily on first user gesture because browsers/Electron block `AudioContext` creation otherwise. `App.tsx` listens for the first keydown or click and calls `mixer.ensureStarted()`.

## Electron lifecycle

The window hides on close instead of quitting — the app keeps running in the tray so `AlertWatcher` (`core/alerts/`) can keep polling and firing notifications. `before-quit` flips an `isQuitting` flag that lets the close handler skip the hide step. The tray menu's "Quit" item flips the same flag.

`window.awc` (context-bridged preload API) currently exposes `notify(title, body)`, `minimizeToTray()` and `fetchActiveNwrStations()`. New IPCs should be added in pairs: handler in `electron/main.ts`, declaration in `electron/preload.ts`, type re-exported via `AwcBridge`.

### The tray icon comes from the bundle, not the media library

`public/tray-icon.png` → copied into `dist/` by Vite → shipped by electron-builder. This is load-bearing, not incidental: the icon previously lived under `assets/`, the optional 1.3 GB media library, which meant it could never resolve in a packaged install. Anything the app needs in order to *start* belongs in `public/`; `assets/` is for content it can run without.

### Crash handling

`installCrashHandlers()` runs before `app.whenReady()`. `uncaughtException` appends a timestamped stack to `<userData>/logs/main-crash.log`, raises a critical notification naming that path, and exits non-zero. `unhandledRejection` logs without exiting.

The asymmetry is deliberate. After an uncaught exception the process state is unknown, and a weather app that keeps running while quietly reporting stale conditions is more dangerous than one that stopped — the user at least notices absence. Unhandled rejections, in practice, are aborted fetches during shutdown and are not worth killing the app over.

### Serving the app: `awc-asset://`

Packaged builds load from a custom privileged scheme rather than `file://`, because every media URL the renderer builds is root-relative (`/assets/...`) for the web deployment's benefit, and over `file://` those resolve against the filesystem root. Registered `standard` (real origin and URL parsing) and `stream` (so `<audio>` can issue Range requests, which seeking depends on); requests are served through `net.fetch` rather than read by hand so MIME sniffing and streaming behave.

Two containment steps, in order:

1. **Lexical.** `path.join` normalizes `..`, then the resolved target must sit under the resolved root.
2. **Symbolic.** Both target *and root* are `realpath`'d and re-checked, because `path.resolve` does not follow symlinks and the media library is user-installed content unpacked from a tarball. The root is resolved too — a 1.3 GB library is a plausible thing to symlink onto a second drive, and comparing a resolved target against an unresolved root would reject that entire install.

Malformed percent-encoding returns 400 rather than rejecting the handler's promise.

## Storm detection and tracking

The radar pipeline turns raw RainViewer tile pixels into discrete, trackable storm objects with movement vectors and ETAs. Components in `core/radar/`:

```
RainViewerSampler ──▶ RadarFrame (cells) ──▶ StormClusterer ──▶ StormCells
                                                                     │
                                                    StormTracker ◀───┘
                                                         │
                                                    TrackedStorm[]  (with movement, ETA, bearing)
```

**`StormScanner`** (`core/radar/StormScanner.ts`) orchestrates:

1. Polls RainViewer every 2 minutes
2. Fetches manifest → samples latest past frame into a `RadarFrame`
3. Clusters nearby cells (within ~20 mi) via DBSCAN-like grouping
4. Matches storms frame-to-frame via greedy nearest-neighbor (derives movement vector, speed, direction)
5. Computes distance/bearing from home, ETA if moving toward home
6. Emits events: `"storm-new"`, `"storm-approaching"`, `"storm-intensified"`
7. Dedupes per storm ID + event kind

`App.tsx` subscribes and routes:
- `storm-new` → polite announcement
- `storm-approaching` (within 80 mi, ETA < 60 min) → assertive announcement
- `storm-intensified` (band step-up) → polite announcement

## Dual-tier alert system

Alerts flow through two independent channels that can both fire simultaneously:

**Tier 1: NWS Alerts (authoritative)**
- Polled from `api.weather.gov` every 60 seconds
- New alerts detected by ID diffing against the previous poll
- Severity drives the tone: Extreme/Severe → `warning_beep` (NWS 4-beep), others → `playAdvisory()`
- Headlines announced assertively
- `ws-alert-banner` shows static count at the top of the frame
- Alerts scene shows full details with NOAA attribution

**Tier 2: Radar nowcasts (eyes-on-radar)**
- `StormScanner` events (independent of NWS)
- Real-time proximity awareness NWS alerts don't cover
- Polite priority (never interrupts NWS announcements)

**Severe interrupt:** On an Extreme/Severe alert, `App.tsx` calls `scheduler.interrupt("alerts")` which suspends the cycle, remembers the current index, and jumps to Alerts. `WeatherscanFrame` receives `severeInterrupt={true}` which applies `ws-severe` — orange takeover background, pulsing red banner, and the scrolling EAS ticker (with per-theme color tinting). `scheduler.clearInterrupt()` resumes the cycle when no severe alerts remain.

## Audio pipeline

```
MusicPlayer ────────────────▶ musicGain (0.6 baseline) ─┐
                                                         ├──▶ destination
ClipLibrary / PhraseSequencer ▶ voiceGain (1.0) ────────┘
AlertTones (oscillators) ──────▶ voiceGain ──────────────┘
```

**Ducking:** When voice content plays, `mixer.duck()` ramps music to 0.15 over 150 ms. On end, `unduck()` ramps back over 400 ms.

**PhraseComposer → PhraseSequencer:** For scenes with narrator voice enabled:
1. `PhraseComposer` builds a `PhraseScript` — an ordered array of `{ clip, fallbackText }` segments
2. `PhraseSequencer` plays them in order through the voice bus
3. Each segment: if clip exists and meets the confidence threshold → play audio; else → TTS fallback
4. 80 ms inter-segment gap; abortable via `abort()`

**AlertTones:** Synthesizes chimes via Web Audio oscillators (not the bundled MP3):
- `playNwr1050()` — 1050 Hz NOAA tone (8 sec)
- `playAdvisory()` — 3-note rising chime
- `playWarning()` — 4-note urgent pattern

The bundled `severe_weather_tone.mp3` is mapped to the `warning_beep` intent and plays on severe alert detection. Narrator-specific severe intros (AJ's 4-beep + spoken warning, JC's tier-based crawl beeps) route through `getSevereAlertIntroClips` in `PhraseComposer`.

## Fan-sourced assets

The app is a personal, non-commercial TWC recreation and relies on community-sourced visual assets for authenticity. All asset repos used are MIT-licensed:

- **WeatherStar fonts** (Star3000, Star4000, StarJR) + 41 animated weather-condition GIFs — from `wesellis/FUN-WeatherStar-4000` and `netbymatt/ws4kp`.
- **TWC logo, NOAA seal, IntelliStar wordmark, LDL strip** — from `mewtek/OpenStar` (`assets/logos/{twc,noaa,intellistar,ldl}/`).
- **WeatherStar XL cloud wallpaper** — same source (`assets/backgrounds/weatherstarxl-clouds/`).
- **IntelliStar 1 / IntelliStar 2 city-gradient backgrounds** — TWC-derived fan archives (the IS2Jr AMHQ blur set is folded into the IS2 rotation).

The TWC name and logo are trademarks. This project is non-distributed and does not claim affiliation. The heavy binary asset folders (narration 2.2 GB, music 606 MB, backgrounds 2.1 GB) are excluded from git via `.gitignore`; see the media library section of the [README](../README.md) for how to populate them on a fresh clone (`npm run assets:fetch`).

## What this scaffold deliberately does *not* do

- No state management library. The service bag is created once in `App.tsx#buildServices` and held in a `useMemo`. When that gets unwieldy we'll add a context, not Redux/Zustand.
- No CSS framework. Weatherscan is a hand-tuned aesthetic; Tailwind would fight us.
- No design system primitives. Radix is on the table for future dialogs when those land.
- No test framework. There are 336 unit tests as of v0.13.0 — this line used to say "no unit tests yet" and was left behind by them — but they run on esbuild plus Node's built-in `node --test`, with no Vitest or Jest. See `scripts/run-tests.mjs` for why, including the `--test-force-exit` incident where the suite could silently shrink by ten tests and still exit 0.

The point of these "nots" is that the scaffold is small enough that you can read the whole thing in an afternoon and understand exactly how scenes flow through the system. Premature abstraction would buy nothing right now.
