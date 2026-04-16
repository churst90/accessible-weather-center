# TODO

Prioritized backlog. Ordered top to bottom within each section. Items marked `[x]` shipped in a prior release; `[ ]` is still open.

## v0.8 — Theme consolidation + authentic layouts + logos — DONE

- [x] ~~Retire `classic90s` theme~~ — was a soft duplicate of WS4000. Users migrate to `ws4000` on load.
- [x] ~~Retire `intellistar2jr` as a distinct theme~~ — merged into `intellistar2` ("IntelliStar 2 / 2 Jr HD"). IS2Jr blur backgrounds folded into the combined pool.
- [x] ~~Retire `highcontrast` as a theme~~ — no TWC unit was high-contrast. The `highContrast` boolean setting stays as an overlay on any theme.
- [x] ~~WS4000 palette correction~~ — warm accent bumped to saturated `#ff9933` per the iconic 1990s TWC orange.
- [x] ~~WS3000 palette correction~~ — cooled toward period-correct blue/purple + near-white text.
- [x] ~~Authentic TWC logo~~ — placed top-left on Weatherscan / WSXL / IS1 / IS2 headers.
- [x] ~~IntelliStar wordmark bug~~ — replaces the "AWC · LIVE" corner on IS1 / IS2.
- [x] ~~NOAA attribution on Alerts scene~~ — authentic to the data source.
- [x] ~~LDL (Lower Display Line) crawl~~ — persistent bottom crawl on Weatherscan / WSXL / IS1 / IS2 with airport delays + closures. Accessible (sr-only list, prefers-reduced-motion).
- [x] ~~Authentic LDL strip template~~ — `LDL.png` from OpenStar (MIT).
- [x] ~~WSXL cloud wallpaper~~ — authentic blue-sky photography rotation.
- [x] ~~FAA parser bug fix~~ — `<Name>` vs old `<Delay_type_name>`. Closures now handled.
- [x] ~~Severe ticker accessibility~~ — sr-only list + prefers-reduced-motion.
- [x] ~~Per-theme severe EAS crawl styling~~.
- [x] ~~Authentic `#ae1d0b` alert-bar red~~.
- [x] ~~Tab / Shift+Tab scene switching~~ — arrows freed for per-scene grid/list nav.
- [x] ~~`useArrowGrid` hook~~ — 2-D grid navigation primitive.
- [x] ~~Extended Forecast columnar layout~~ — day / icon / conditions / hi-lo per column, era-specific styling.
- [x] ~~Hourly Forecast columnar layout~~ — same pattern.
- [x] ~~Weekend Forecast~~ — reuses Extended grid.
- [x] ~~Current Conditions hero layout~~ — big icon + 120-px temp + readout grid.
- [x] ~~Overnight Forecast hero card~~ — period + low temp + stat strip + narrative.
- [x] ~~Feels Like split panels~~ — wind-chill tints blue, heat-index tints red.
- [x] ~~Temperature Trend~~ — LED readouts + hourly bar chart with grid nav.
- [x] ~~Almanac sun/moon 2-column grid~~.
- [x] ~~Travel Cities 3-column table~~ with icons.
- [x] ~~Local Forecast narrative panel~~ — big-text per-period walking.

## v0.8.1 — Asset cleanup + mnemonic fix + per-scene backgrounds + HD icons — DONE

- [x] ~~Mnemonic cutoff regression~~ — synchronous `audioStartedRef` in `App.tsx` audio-unlock; eliminates the resume/gesture race that double-called `clips.play("mnemonic")`.
- [x] ~~Per-scene WS4000 / WSJr backgrounds~~ — `getSceneBackground()` in `backgroundCatalog.ts`; scene-change effect updates `--ws-bg-image`.
- [x] ~~HD WEBP icon pools~~ — `iconResolution: 28|42|68` on `ThemeDef`; WSXL→42, IS2→68; unmapped fall back to GIF.
- [x] ~~Prefers-reduced-motion stills~~ — `useReducedMotion()` + `STILLS_MAP` for ~22 conditions; GIF fallback otherwise.
- [x] ~~LDL section weather icon~~ — `leadIconName` on `LdlCrawl`; tracks current observation via `chooseIcon()`.
- [x] ~~Orphan font wiring~~ — Star4000 Extended into ws4000/wsjr; akkopro-light into IS1 small font.
- [x] ~~Asset archive~~ — moved 14 GB of duplicates and source dumps out of repo (icons/avi/, icons/avi-webp/, icons/apng/, themes/intellistar1/, themes/intellistar2/, themes/ws4kp/) → `D:\AWC-asset-archive\`. Repo `assets/` now 5.1 GB.

## v0.9 — Era-authentic theme splits + broadcast research — DONE

- [x] ~~Weatherscan split~~ — `weatherscan-local` / `weatherscan-v1` / `weatherscan-v2`.
- [x] ~~WS4000 split~~ — `ws4000-v1` (2001-2004) / `ws4000-v2` (2005-2009). Extended changed to `"3-day"`.
- [x] ~~WSJr reclassified~~ — confirmed as WS3000 layout with WS4000 font. Radar removed from scene loop.
- [x] ~~IS1 typography fix~~ — Akzidenz-Grotesk → Interstate.
- [x] ~~Assets gitignored~~ — `assets/*` excluded, `assets/.gitkeep` committed.
- [x] ~~Broadcast capture pipeline~~ — `scripts/scrape_page_images.py` + `scrape_batch.sh`.
- [x] ~~Legacy era research docs~~ — `docs/legacy-eras.md`, `docs/reference/`, `docs/reference-capture-plan.md`.

## v1.0 (next) — Per-theme scene renderers + era sub-splits

### Unblocked (captures exist)
- [ ] **WS4000 v1 Current Conditions layout** — icon-left / fields-right per broadcast stills.
- [ ] **WS4000 v2 footer bar component** — always-on bar with per-scene contextual data.
- [ ] **WS4000 3-day Extended panel redesign** — 3 vertical panels with louvered blue gradient.
- [ ] **WS4000 v2 Radar chrome** — pink/purple header with PRECIP legend.
- [ ] **IS1 pre-2007 layout implementation** — IS1 scene captures from TWC Classics cover ~20 scenes. Build component variants for CC hero, Week Ahead 7-column, Daypart 4-column, Almanac 2-column.

### Blocked on captures
- [ ] **WS3000 text-page renderer stack** — need LF (grey bg), Extended (3-column), Almanac, Regional, Travel stills.
- [ ] **WSJr scene renderer** — reuse WS3000 stack once built; need one CC still to confirm.
- [ ] **IS1 2007 facelift theme** (`intellistar1-2007`) — need post-Oct 2007 "Now" stills (dark-blue text on light-blue-sky bg).
- [ ] **IS1 2013 rebrand theme** (`intellistar1-2013`) — optional, brief ~1 year era.
- [ ] **IS2 HD LOT8s frame component** — need full-frame still showing main-window + sidebar-dial + rundown + LDL.
- [ ] **IS2 Jr LDL branching** — need national-programming still to confirm "LDL off during national" delta.
- [ ] **Alert chrome per era** — brown/red (WS3000/WSJr), brown advisory / red warning (IS1), red/yellow/orange left-box (IS2).
- [ ] **Weatherscan V2 L-bar layout** — persistent left column (logo/obs/radar) + bottom horizontal strip.

### Cross-cutting
- [ ] **Era-tuned CSS for `.ws-hero` / `.ws-feels` / `.ws-trend` / `.ws-almanac` / `.ws-travel` / `.ws-narrative`.**
- [ ] **Per-scene backgrounds for non-WS4000 themes.** IS1 / IS2 / WSXL each used distinct scene-specific backdrops.
- [ ] **Time-of-day scheduler.** Weight scene order by time of day per `docs/weatherscan-flavors.md`.
- [ ] **Regional Forecast scene.** Amy's `Local-RegionalForecastConditions.wav` is waiting.
- [ ] **Full reduced-motion still coverage** via `stills/mv/` and `stills/wxl/`.
- [ ] **Per-condition LDL icon refresh** — should also refresh on periodic poll.

## Clip verifier (still open from v0.4)

- [ ] **Clip verifier UI.** Modal that walks every `clipSchema.ts` entry plus every raw `CC*`/`CCSH*`/`CCEF*` file, plays on demand, lets the user mark confirmed/wrong with one keystroke. Writes a sidecar JSON the schema imports.

## v0.6 — Theme packs — DONE (see v0.8 consolidation)

- [x] ~~Theme system architecture, core theme set~~.
- [ ] **WeatherStar I / II** (pre-1990). No assets in repo; would need hand-drawn CSS for blocky color-block screens.
- [ ] **Future asset expansion.** Additional community-sourced backgrounds for existing themes.

## v0.5 — New flavors + smart scheduling (mostly done)

- [x] All scenes listed previously — Almanac, Local Forecast, Travel Cities, Storm Tracker, Detailed Conditions, Feels Like, Precipitation Outlook, Weekend, Overnight, Temperature Trend.
- [ ] **Time-of-day rotation** (moved to v0.9 above).

## Usability gaps

- [ ] **Place picker UI.** Search NWS for a place by ZIP or city/state, save to `PlacesStore`. Persist to disk (electron-store or flat JSON in `app.getPath("userData")`). `SettingsStore` already persists via localStorage; `PlacesStore` is next.
- [ ] **First-run setup flow.** Prompt for home location and contact email on first launch instead of editing `App.tsx`.
- [ ] **Settings panel polish.** TTS voice picker, TTS rate slider, scene-duration overrides per flavor.
- [ ] **Error/empty states for every scene.** Right now most degrade to "unavailable" strings; flesh out the visual fallbacks.
- [ ] **NWS retry/backoff.** Wrap `NwsClient.get` with retry-after handling and a circuit breaker.
- [ ] **Production asset serving.** Dev middleware in `vite.config.ts` only handles dev. For Electron prod, register a custom `awc-asset://` protocol resolving to the assets folder.

## Radar — accessible map navigation

- [x] Animated radar overlay, Alert Polygons, Radial (storms by distance/bearing), Raw radar Grid Explorer.
- [ ] **Storm cells mode.** Once MRMS is on the table (post v1.0), traverse identified cells as discrete objects.
- [ ] **Spatial index.** Wrap polygons + places in an R-tree (`rbush`) for O(log n) radial queries.

## Alerts and notifications

- [ ] **AlertEngine.** User-defined triggers ("precip > 0.5 in/hr within 20 mi", "any tornado warning in my favorite places") emit notification events.
- [ ] **Wire renderer → main IPC** so AlertEngine calls `window.awc.notify(...)` for OS toasts.
- [ ] **Persistent alert log.** Last 24 hours of alerts in a "Recent Alerts" view, navigable with arrows.

## Audio polish

- [x] Real music + clip manifests, clip sequencing, warning/advisory chimes.
- [ ] **Gapless clip playback.** Current 80 ms gap. If seams bother you, decode each clip into an `AudioBuffer` once and schedule via `start(when)`.
- [ ] **Crossfade between music tracks** on scene change.
- [ ] **Per-scene voice clip selection weighted by recency** so the same clip doesn't repeat back-to-back.
- [ ] **Verify CC* code mappings.** ~70% of `clipSchema.ts` entries are tagged `guess`. Clip verifier makes this tractable.
- [ ] **Wind / humidity / pressure clips** if found in sister libraries.

## Architecture

- [ ] **Move `buildServices()` out of `App.tsx`** into `src/bootstrap.ts`.
- [ ] **Service locator or React context** for the service bag instead of prop-drilling.
- [ ] **Unit tests.** Vitest. Start with `IntensityLegend`, `SceneScheduler`, `KeyboardRouter`, `useArrowGrid`, NWS normalizers.
- [ ] **Integration test for the loop.** Mock `WeatherService`, run the scheduler, assert speech and event sequences.
- [ ] **Type the IPC bridge end-to-end.** Shared `types.ts` between `electron/preload.ts` and the renderer.

## Background / lifecycle

- [ ] **Background fetch.** Slimmed-down poll loop in the main process when the window is hidden.
- [ ] **Auto-launch on login** via Electron's `app.setLoginItemSettings`.
- [ ] **macOS support.** Tray icon is empty — macOS needs a real template image.
- [ ] **Linux support.** AppIndicator vs StatusNotifier.

## Mobile (post v1)

- [ ] **Capacitor wrap** of the same renderer bundle.
- [ ] **Capacitor Local Notifications + Background Fetch.**
- [ ] **Touch gesture equivalents** for arrow-key / tab navigation.
- [ ] **Native TTS plugin** for iOS/Android.

## Documentation

- [x] ~~README refreshed for v0.8~~.
- [x] ~~`USER_GUIDE.md` drafted~~.
- [x] ~~`docs/architecture.md` expanded~~.
- [ ] **`docs/accessibility-rules.md`** — pull design rules from README into a standalone, reviewable document.
- [ ] **`docs/data-sources.md`** — NWS vs RainViewer vs FAA vs what's missing for v2.
- [ ] **`docs/themes.md`** — canonical per-theme reference (visual language, narrator, scene order, backgrounds).

## Known bugs / cleanup

- [ ] `WebSpeechTts.setVoice` doesn't persist across reloads — needs to live in settings.
- [ ] `AnnouncementQueue` doesn't actually queue — it overwrites. For long narration that's fine, but an alert preempting scene speech loses the original. Consider a "resume after assertive" mode.
- [ ] `KeyboardRouter` modifier-only chords (`Ctrl+Shift+P`) aren't covered by tests.
- [ ] Tray icon still empty on Windows packs.

## Repo setup

- [x] ~~Assets gitignored~~ — `assets/*` in `.gitignore`, `assets/.gitkeep` committed. Assets are ~5 GB and managed separately.
- [x] ~~Fresh initial commit~~ — code-only, no binary assets in git history.
- [ ] **Decide on LICENSE.** Code is MIT-compatible; the fan-sourced assets carry their own MIT notices.
- [ ] **CI** — GitHub Actions running `npm run typecheck` on push.
