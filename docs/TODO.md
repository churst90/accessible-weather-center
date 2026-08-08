# TODO

Prioritized backlog. Ordered top to bottom within each section. Items marked `[x]` shipped in a prior release; `[ ]` is still open.

## Device profiles (emulator architecture)

Each machine now declares itself in `src/devices/profiles/<id>.ts`: era, voice, music, extended day count, capabilities, base rundown, per-product naming and availability, and outstanding art/audio gaps. The kernel reads from there and never branches on a theme id of its own accord. `npm run device:report` regenerates `docs/clip-wishlist.md` and `docs/asset-gaps.md` from the profiles.

- [x] ~~Device type + all ten profiles~~ — replaces `THEME_CORE_SCENES`, `THEME_EXCLUDED_SCENES`, `VALUE_ADD_SCENES` and the hand-maintained era table.
- [x] ~~`absent` products~~ — a WeatherStar 3000 no longer offers a radar checkbox; Settings lists what the unit could not do and why.
- [ ] **Move per-device visuals into the profile.** Background pools, CSS vars and the scene-view overrides still live in `themes.ts` / `backgroundCatalog.ts` / `sceneRegistry.tsx`. Mechanical follow-on now the contract exists.
- [ ] **Code-split by device.** The bundle is 1,769 KB of which 1,366 KB is `clipReferenceTable.json`. Move the table out of the JS bundle (fetch it, or prune the transcription text at build) and lazy-load per-device renderers — plausibly a 5-8x smaller initial download.
- [ ] **Optional-package scenes still need building:** Air Quality (IS1), School Day Weather and Outdoor Activity Forecast (Sept 2004+), and the Weatherscan Plus activity packs (golf, ski, beach, garden, health). Declared as optional where the hardware had them; no renderers yet.
- [ ] **Loading / "not available" screens in period fonts.** Settings lists absent products, but a scene-level notice in each unit's own typography is not built.
- [ ] **Local sponsor slot.** `sponsorSlot` capability is declared for the Weatherscan and IntelliStar profiles; nothing consumes it yet. See the discussion note in the commit for options.

## Narration period accuracy

Source for the dates below: the IntelliStar timeline in `docs/reference/is1/handwiki/page.html`, September 2004 — *"36 Hour Forecast" is renamed "Local Forecast"… The hour-by-hour forecast, referred to as "Daily Planner" is now renamed the "Daypart Forecast"*.

- [x] ~~"36 Hour Forecast" and "Daily Planner" clips were unreachable~~ — both are pre-Sept-2004 product names, for the Local Forecast and Hourly scenes respectively. Now selected per theme by `src/audio/manifests/sceneSegments.ts`; `npm run clips:explain` shows the chain.
- [ ] **Chandler's clips are pre-rename but he narrates IntelliStar 2 (2013+).** His whole hour-by-hour pool says "the 36-hour forecast", which suggests the recordings date from the 2003–2004 IS1 window. Either re-source post-rename audio, reassign him to an earlier theme, or accept the anachronism. Enforcing the era rule on him today would leave IS2 with no hourly/local-forecast narration.
- [ ] **Amy Bargeron has only `Local-DaypartForecast`** (the post-2004 name) but also narrates Weatherscan Local (1999–2003). Same class of problem, opposite direction.
- [ ] **Verify `weatherscan-v1` (2003–2005) product era.** Currently assigned post-2004 because it runs on the IntelliStar platform the rename applied to and most of its life is after it — but it launched Feb 2003, before. Needs an aircheck to confirm which naming Weatherscan itself used.
- [ ] **`weatherstarxl` has no dated label** in `themes.ts`, so its pre-2004 assignment is inferred from the XL predating the IntelliStar rollout rather than confirmed.

## Narration coverage

Full audit of all four narrators against all seventeen scenes is complete and pinned by `tests/sceneNarrationMatrix.test.ts`. Run `npm run clips:explain` for the live matrix. Remaining gaps are missing *recordings*, not missing wiring:

| Scene | Narrators that can announce it | Missing because |
|---|---|---|
| almanac | none | no narrator has sunrise/sunset/moon phrasing |
| precip | none | the Wx_Phrases_Precip pool is probability phrases, not an intro |
| airport | Amy only | only she recorded "local airport delays" |
| travel | Chandler only | only he recorded "forecast cities nationwide" |
| traffic | Allan Jackson, Amy | Jim Cantore and Chandler have no traffic clips |
| weekend | Allan Jackson, Jim Cantore | Amy and Chandler have no weekend phrasing |
| radar, stormtracker | all but Jim Cantore | he has no `Default_Phrases_Local_Radar` directory at all |
| extended | all but Amy | she has no extended phrasing; Jim Cantore's is 7-day only, by design — IntelliStar never ran a 5-day |

- [ ] **Source almanac and precipitation-outlook intros.** The only two scenes silent for every narrator.
- [ ] **Source a Jim Cantore radar intro.** He is the IntelliStar 1 default, so Local Radar and Storm Tracker are silent on that theme.
- [ ] **Regional Forecast scene.** Chandler has 32 `rf/` clips and Amy has `Local-RegionalForecastConditions`; both are unreachable until the scene exists.
- [ ] **Allergy/pollen scene.** Amy's `Local-AllergyReport` is her one genuinely unused clip.
- [ ] **Chandler has 104 of 202 clips unused** — extra variants inside categories that are already wired. Widening the pools would add variety; not a correctness issue.


- [x] ~~Scenes with no narrator audio~~ — was 7 (travel, almanac, detailed, feelslike, stormtracker, precip, temptrend); now 2. Fixed by case-insensitive scene-id lookup, a documented alias map for scenes that legitimately share an intro, and reconnecting Chandler's travel/regional clips which were wired under key names no scene id matched.
- [ ] **Almanac narration.** No narrator has a phrase covering sunrise/sunset/moon phase. Needs real clips; pinned as KNOWN_SILENT in tests/narratorCoverage.test.ts.
- [ ] **Precipitation Outlook narration.** Same — the Wx_Phrases_Precip pool is probability phrases ("a 40 percent chance"), not a scene intro.
- [ ] **Airport Delays narration for Allan Jackson / Jim Cantore / Chandler.** Only Amy Bargeron has an airport clip, so the scene is silent on the WeatherStar and IntelliStar themes.
- [ ] **Unused Allan Jackson intro keys** — `dailyPlanner` and `thirtySixHour` are defined but no scene id maps to them. Either wire a scene or drop them.

## Phase 5 — web + distribution (in progress)

- [x] ~~First-run ZIP flow~~ — see Usability gaps.
- [x] ~~Asset transcode~~ — 5244 MB → 1338 MB (74%), verified file-by-file. `scripts/build-web-assets.mjs` (+ `--verify`), `scripts/check-asset-refs.mjs`, `docs/asset-pipeline.md`.
- [x] ~~NWR browser support~~ — `src/audio/nwrEndpoints.ts` picks upstream vs. same-origin proxy; Vite dev proxy + nginx `/nwr/` block. The Icecast host sends no CORS headers, so a browser cannot otherwise list stations or feed the stream to WebAudio.
- [x] ~~Electron production asset protocol~~ — see Usability gaps.
- [x] ~~Deployment tooling~~ — `deploy/nginx/weather.codyhurst.com.conf`, `deploy/server-setup.sh`, `deploy/publish.sh`, `docs/web-deployment.md`.
- [x] ~~Binary build pipeline~~ — `electron-builder.yml` + `.github/workflows/build.yml`; Windows/macOS/Linux on tag push. Unsigned.
- [x] ~~Media library distribution~~ — `scripts/package-assets.mjs` (per-category tarballs + checksums for a GitHub Release), `scripts/fetch-assets.mjs` (verify + unpack, resumable).
- [ ] **Deploy to the OVH box.** The nginx config has never been syntax-checked — there is no nginx on the dev machine. Run `nginx -t` before the first reload.
- [ ] **Landing page.** Cody is writing this to match his other sites; `server-setup.sh` drops a placeholder and never overwrites it.
- [ ] **Cut the first release.** Tag `v0.13.0` to trigger the build workflow, then decide what (if anything) of the media library gets published — see the redistribution note in the README.
- [ ] **Move persistence to Electron userData.** localStorage is origin-scoped; dev (localhost:5173) and packaged (`awc-asset://app`) builds do not share settings. Note the scheme change means existing packaged-build users start fresh.
- [ ] **Test the packaged build end to end.** The `awc-asset://` protocol typechecks and is written against Electron 33's `protocol.handle` + `net.fetch`, but has not been run in a packaged app yet.
- [ ] **Fix or drop the dead Jim Cantore radar clips.** `narration/Jim Cantore/Vocal Local/Default_Phrases_Local_Radar/RADAR_DEFAULT{1,2}` — referenced since the initial commit, directory never existed.

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

## v0.9.1 — NOAA Weather Radio + mnemonic fix — DONE

- [x] ~~NWR live stream~~ — `NwrPlayer` service streaming `radio.weatherusa.net/NWR/{callSign}.mp3` on dedicated radio bus.
- [x] ~~Three-bus AudioMixer~~ — music, voice, radio with independent volumes.
- [x] ~~Settings: nwrEnabled, nwrCallSign, nwrVolume, musicVolume~~ + UI sliders + station autocomplete.
- [x] ~~Fuzzy call-sign default~~ — falls back to favorite-location match if user hasn't picked one.
- [x] ~~Mnemonic cutoff fix~~ — await `ctx.resume()` before play to ensure AudioContext is running.

## v0.9 — Era-authentic theme splits + broadcast research — DONE

- [x] ~~Weatherscan split~~ — `weatherscan-local` / `weatherscan-v1` / `weatherscan-v2`.
- [x] ~~WS4000 split~~ — `ws4000-v1` (2001-2004) / `ws4000-v2` (2005-2009). Extended changed to `"3-day"`.
- [x] ~~WSJr reclassified~~ — confirmed as WS3000 layout with WS4000 font. Radar removed from scene loop.
- [x] ~~IS1 typography fix~~ — Akzidenz-Grotesk → Interstate.
- [x] ~~Assets gitignored~~ — `assets/*` excluded, `assets/.gitkeep` committed.
- [x] ~~Broadcast capture pipeline~~ — `scripts/scrape_page_images.py` + `scrape_batch.sh`.
- [x] ~~Legacy era research docs~~ — `docs/legacy-eras.md`, `docs/reference/`, `docs/reference-capture-plan.md`.

## v0.12.0 — audit Phase 4 (structure) — DONE

- [x] ~~buildServices → src/bootstrap.ts~~ — App.tsx is wiring/UI only.
- [x] ~~Alert polling → core/alerts/AlertWatcher.ts~~ — service with events, fresh-dedupe, setPlace seam, generation guard. Unit-tested.
- [x] ~~(themeId, sceneId) → view registry~~ — `src/ui/scenes/sceneRegistry.tsx`; THEME_VIEWS override table is where the v1.0 era renderers plug in.
- [x] ~~Dead code~~ — TravelCities.ts deleted; musicCue/jacksonCue fields removed from RenderedScene.
- [x] ~~Electron hardening~~ — CSP meta in index.html; setWindowOpenHandler deny + will-navigate guard.
- [x] ~~SceneScheduler + AlertWatcher unit tests~~ — 57 tests total.
- Still open from the Phase-4 wishlist: keyboard-shortcut registration extraction from App.tsx (200-line effect, entangled with app state — low payoff), narration dispatch moving into scenes (the per-scene-id chain in App's scene-change effect), per-theme *frame* variants (WeatherscanFrame is still a single component; needed alongside the view registry for LOT8s/L-bar).

## v0.11.0 — audit Phases 2 + 3 — DONE

- [x] ~~No-built-in-TTS policy~~ — WebSpeechTts/TtsService, announcerMode, ttsVoice/ttsRate all removed. Screen reader (aria-live) + narrator clips are the only speech paths, by design.
- [x] ~~AnnouncementQueue rebuild~~ — independent polite/assertive slots, repeat-breaking zero-width-space alternation, cancel() that actually clears the regions. Unit-tested.
- [x] ~~Modality gate~~ — `src/a11y/modality.ts`; ModalDialog push/pop; KeyboardRouter + useArrowGrid/useArrowList + MapNav + PlacesMode all stand down under modals.
- [x] ~~MapNavView reactivity~~ — subscribes to scanner updates, clamps selection on shrink.
- [x] ~~Star4000 font paths + InterstateMono face~~; dead akkopro-light face removed.
- [x] ~~IS1 icons (42px WEBP) + WeatherIcon runtime fallback chain~~ (still → WEBP → GIF → hidden, no more broken-image placeholders); ws3000/wsjr hero icons hidden; LDL stem guard.
- [x] ~~Severe takeover specificity~~ — wins on all themes; IS2 uses the LOT8 severe background pool (pickBackground severe param finally wired).
- [x] ~~High-contrast background neutralization~~; ~~stale per-scene background reset~~ (`--ws-theme-bg-image`).
- [x] ~~Intensity table unification~~ — `IntensityLegend.BAND_INFO` is now the single source for band labels/phrases/colors across all five former tables; sampler color names from `classifyMmPerHour`.
- [x] ~~7 unpooled Weatherscan city backgrounds added~~; ~~status-bar hotkey hints corrected~~.

## v0.10.0 — reliability release (audit Phase 1) — DONE

All ten confirmed silent-failure bugs from `docs/code-audit-2026-08.md` fixed, plus the first unit-test suite and a map-nav feature. Details in CHANGELOG 0.10.0.

- [x] ~~Alert poller pinned to boot-time home~~ — `homePlace` React state; polling restarts and re-announces on home change.
- [x] ~~False "Stationary" storms~~ — StormScanner gates on RainViewer frame time; unchanged frames aren't re-tracked.
- [x] ~~Suppressed new-storm announcements~~ — StormTracker mints stable `track_N` ids that follow storms across frames.
- [x] ~~Grid-lookup rejection cached forever~~ — evicts on failure; TTL caches serve stale-while-error with honest `lastFetchedAt()`.
- [x] ~~Scene crash = silent white screen~~ — ErrorBoundary with role="alert" fallback + SceneUnavailable for the scheduler's error data shape.
- [x] ~~`?` Help shortcut unmatchable~~ — shifted punctuation no longer gets a `shift+` prefix in KeyboardRouter.
- [x] ~~NWR sticky-failed~~ — settings changes retry a failed stream.
- [x] ~~NWR wrong-state station autopick~~ — city+state matching before city-only.
- [x] ~~PhraseSequencer stale-handler race~~ — identity guards in onended/onerror.
- [x] ~~Music surging over narration~~ — AudioMixer duck-state flag; anchored gain ramps.
- [x] ~~Wrong wintry CCEF clips~~ — specific regex patterns reordered above general ones.
- [x] ~~Configurable Map Nav grid step~~ — 1/3/5/10/25 mi, `[`/`]` live cycling, persisted, Settings UI, Help section.
- [x] ~~Unit tests~~ — `npm test`: esbuild + node:test, zero new deps; 39 tests over StormTracker, WeatherService, KeyboardRouter, PhraseComposer guesses, nwrStations, TileMath.
- [x] ~~User manual~~ — `docs/user-manual.md`.
- [x] ~~tsconfig noEmit~~ — tsc no longer sprays compiled .js into src/.
- [x] ~~README back at repo root~~; versions unified at 0.10.0; real NWS User-Agent contact.

## v0.9.6 — NVDA modal focus, Escape, volume flash, NWR stations — DONE

- [x] ~~Volume key screen flash~~ — `applyTheme()` now diffs `prevThemeId` / `prevContrast` and skips CSS work on volume changes.
- [x] ~~Escape didn't exit M/N modes~~ — stop-speech handler checks viewMode first; Favorites and Map Nav now exit on Escape.
- [x] ~~Modal focus trap under NVDA~~ — new shared `ModalDialog` component owns portal, inert, explicit focus movement, Tab wrap trap, and Escape dispatch. `SettingsPanel` and `HelpDialog` refactored onto it.
- [x] ~~NWR every-station-fails bug~~ — bundled list was 90% dead mounts (fabricated NWS call signs vs. weatherUSA's actually-active Icecast mounts). New `fetchActiveNwrStations()` pulls live list from `status-json.xsl` via Electron main-process IPC (CORS bypass), merges with 35-entry curated bundled snapshot.

## v0.9.5 — accessibility-mode fix + startup resilience — DONE

- [x] ~~Double-speech with NVDA~~ — added `announcerMode` setting (default `"live-region"`); `AnnouncementQueue` no longer hardcoded to `"both"`. Accessibility fieldset added to the Settings panel with four options.
- [x] ~~Mnemonic startup could stall~~ — 6s `Promise.race` timeout + `console.warn` diagnostics around the clip play in `App.tsx` audio-unlock.
- [x] ~~NWR silent failure~~ — status subscription + 5-attempt cap + 10s connect timeout + aria-live announcements on `streaming` / `failed` transitions.
- [x] ~~NWS User-Agent version bump~~ — `0.4` → `0.9.5`.

## NWR follow-ups (post v0.9.4)

- [x] ~~NWR keyboard shortcut~~ — `0` toggles stream; `1`/`Shift+1` music volume; `2`/`Shift+2` NWR volume. NVDA-friendly (no Ctrl+Alt+arrow conflicts).
- [x] ~~Tab lag/catch-up~~ — fixed via generation guard in `SceneScheduler`.
- [x] ~~Settings-change scene-respawn~~ — settings subscriber now diffs home+theme before calling setContext.
- [x] ~~Scene jumps on 1-5 removed~~ — digits reserved for audio/alerts. Tab walks all scenes.
- [x] ~~`3` reads active alerts on demand~~ — assertive readback sorted by severity.
- [ ] **Visual NWR indicator** — show "NWR: KEC49 — Buffalo NY" somewhere in the chrome (LDL? corner bug? settings status?) so the user can confirm what's playing.
- [ ] **Cycle to next call sign** — single key (e.g. `Shift+0`) walks the station directory while NWR is enabled.
- [ ] **RTL-SDR backend** (power user) — optional `rtl_fm` spawn in Electron main for users with an SDR dongle. Internet-independent; works during outages when you need NWR most.
- [x] ~~Stream availability check~~ — `NwrPlayer` now has a 10s connect-timeout guard + 5-attempt failure cap + status subscription; `App.tsx` announces `streaming` / `failed` transitions. Shipped in v0.9.5.
- [ ] **Expand station directory** — current 60 metros; full NWS list at weather.gov/nwr/station_search has ~1000 transmitters.

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
- [ ] **Regional Forecast scene.** Amy's `Local-RegionalForecastConditions.mp3` is waiting.
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

- [x] ~~Place picker persistence~~ — STALE ENTRY: `PlacesStore` already persists (localStorage `awc.places.v1`). Still open: move both stores to `app.getPath("userData")` so dev and packaged builds share state (localStorage is origin-scoped).
- [x] ~~First-run setup flow~~ — SHIPPED (Phase 5). `FirstRunSetup.tsx`: required, non-dismissable ZIP prompt; `defaultPlaces()` now returns a neutral placeholder; the seed is not persisted so quitting mid-setup re-prompts; scene loop, scanner, alert watcher and NWR autopick all held until setup completes.
- [ ] **Settings panel polish.** Scene-duration overrides per flavor. (TTS voice/rate items dropped — no-TTS policy as of v0.11.0.)
- [ ] **Error/empty states for every scene.** v0.10.0 added the ErrorBoundary + SceneUnavailable safety net; per-scene visual empty states still worth fleshing out.
- [x] ~~NWS retry/backoff~~ — STALE ENTRY: shipped long ago. `NwsClient.get` has 10s timeout, 3 retries, exponential backoff, and Retry-After handling.
- [x] ~~Production asset serving~~ — SHIPPED (Phase 5). Packaged builds load from an `awc-asset://app` scheme registered in `electron/main.ts`, so root-relative `/assets/...` URLs work identically in Electron and the browser. Media resolves from `AWC_ASSETS_DIR`, then userData, then resources, then the repo; path-traversal guarded; served via `net.fetch` so Range requests work for audio seeking.

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

- [x] ~~`WebSpeechTts.setVoice` persistence~~ — moot: built-in TTS removed entirely in v0.11.0 (no-TTS policy).
- [x] ~~`AnnouncementQueue` overwrite/silent-repeat/cancel bugs~~ — rebuilt in v0.11.0 (independent channels, repeat-breaking, working cancel).
- [x] ~~`KeyboardRouter` shortcut tests~~ — covered in `tests/KeyboardRouter.test.ts` (shifted symbols, digits, letters, editable-field guard, conflicts).
- [ ] Tray icon still empty on Windows packs — root cause known: `dist/assets/logos/app-icon-180.png` never exists in prod (assets are gitignored and served by dev middleware only), and `nativeImage.createFromPath` returns an empty image instead of throwing. Blocked on "Production asset serving".

## Repo setup

- [x] ~~Assets gitignored~~ — `assets/*` in `.gitignore`, `assets/.gitkeep` committed. Assets are ~5 GB and managed separately.
- [x] ~~Fresh initial commit~~ — code-only, no binary assets in git history.
- [ ] **Decide on LICENSE.** Code is MIT-compatible; the fan-sourced assets carry their own MIT notices.
- [ ] **CI** — GitHub Actions running `npm run typecheck` on push.
