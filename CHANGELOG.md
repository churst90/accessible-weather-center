# Changelog

All notable changes to this project will be documented in this file.

## [0.9.5] — 2026-04-15

Accessibility-mode fix (double-speech eliminated), mnemonic startup resilience, NWR stream status announcements.

### Fixed

#### Double speech — built-in TTS fired alongside NVDA / JAWS / VoiceOver
- **Root cause:** `AnnouncementQueue` was hardcoded to mode `"both"` in `App.tsx:831`, so every announcement pushed to the aria-live region *and* invoked `WebSpeechTts.speak()`. A friend running the app with NVDA heard every announcement twice (NVDA reading the aria-live region, Windows SAPI via Web Speech reading the utterance).
- **Fix:** added `announcerMode` to `SettingsStore` with default `"live-region"`. The `AnnouncementQueue` is constructed with that mode and a settings subscriber calls `announcer.setMode()` on change. Existing users without the key in localStorage inherit the default via the spread in `SettingsStore.load()` — so the double speech goes away without any action.
- **Surfaced in UI:** new "Accessibility" fieldset at the top of the Settings panel with four options: Screen reader only (default), Built-in speech, Both (with warning), Silent.
- **Docs:** README status blurb, accessibility paragraph, and Tech stack line all clarified that built-in TTS is opt-in.

#### Mnemonic startup could stall the scene loop indefinitely
- **Root cause:** if `clips.play("mnemonic")` rejected (bad path, media error, stream stall), the `finally` block in `App.tsx:~630` would still set `mnemonicDone`, but there was no ceiling — a hung audio element awaiting a never-arriving `onended` would leave the `await` pending forever, and the `finally` would never run. A silent rejection in the `ctx.resume().then(start).catch(...)` chain also suppressed diagnostics.
- **Fix:** wrapped the clip play in `Promise.race([play, timeout])` with a 6-second ceiling, so `setMnemonicDone(true)` always fires within a bounded window. Added `console.warn` at three sites (clip rejection, outer sequence failure, initial `ctx.resume()` rejection) so remote diagnosis is possible if startup audio misbehaves again.

#### NOAA Weather Radio stream failures were silent
- **Root cause:** `NwrPlayer.scheduleReconnect()` retried forever on `onerror`/`onstalled`/`onended` without capping attempts or telling the user. A 404, a blocked feed, or a server that accepts the TCP connection but never sends audio produced no feedback — the stream just never started.
- **Fix:** `NwrPlayer` now tracks a five-state status (`idle`/`connecting`/`streaming`/`reconnecting`/`failed`) and exposes `subscribeStatus()`. After `MAX_RECONNECT_ATTEMPTS = 5` consecutive failures without any successful playback, the player gives up and emits `"failed"` with the last error code. A `CONNECT_TIMEOUT_MS = 10000` guard catches servers that never send data (where neither `error` nor `stalled` fires reliably). Successful `onplaying` resets the attempt counter so brief later hiccups don't exhaust the budget. `App.tsx` subscribes and announces transitions to `"streaming"` (polite) and `"failed"` (assertive) — reconnect attempts are intentionally silent to avoid chatter.

### Changed

#### `ttsVoice` / `ttsRate` settings are now purposeful
- They were persisted but never read before. Now they're the voice + rate used when `announcerMode` is `"tts"` or `"both"`. A future Settings control can wire them up via `tts.setVoice()` / `tts.setRate()`; for this release the infrastructure is in place but no UI surface is added.

#### NWS User-Agent bumped from `0.4` to `0.9.5`
- Cosmetic; NWS doesn't validate the version, but the stale value was misleading.

## [0.9.4] — 2026-04-15

Settings-update scene-respawn fix, scene jumps removed, on-demand alert readback.

### Fixed

#### Pressing `1` (or any settings change) re-prepared the current scene
- **Root cause:** the settings subscriber at `App.tsx:137` called `scheduler.setContext()` on every settings change. `setContext()` re-enters the current scene, which re-prepares it (network fetch) and restarts narration. So bumping music volume → settings change → re-enter → user sees the scene "change" because the screen re-renders and the narrator starts over from the top.
- **Fix:** the settings subscriber now diffs `home.id` and `theme` against last-applied values. `setContext()` only fires when one of those actually changed. Volume nudges, NWR toggle, music enable, etc. no longer disturb the current scene.

### Changed

#### Scene-jump shortcuts on `1`–`5` removed
- All five digit-key scene jumps retired. Tab / Shift+Tab walks every scene; the digit row is now reserved for instant audio + alert controls.

#### New `3` shortcut: read active weather alerts on demand
- Pressing `3` triggers an assertive announcement of every active alert, sorted by severity (Extreme → Severe → Moderate → Minor → Unknown). Each entry: event name + affected area description. Empty state: "No active weather alerts." Reads from the live polled `alertsList` ref so it always reflects current state.

## [0.9.3] — 2026-04-15

Keyboard remap for NVDA compatibility, scene-tab lag fix, KeyboardRouter shift+digit normalization.

### Fixed

#### Tab "lag then catch up" through scenes
- **Root cause:** `SceneScheduler.enter()` only emitted after the async `scene.prepare()` (NWS forecast fetch) resolved. Pressing Tab three times rapidly queued three preparations; as each resolved, the UI flashed through the transitional scenes one at a time.
- **Fix:** added a monotonic `generation` counter in `SceneScheduler`. Each `enter()` bumps the counter; on resolution, stale results are dropped. Only the latest-requested scene commits to `this.current` and emits.

#### Ctrl+R reloaded the renderer
- **Root cause:** Electron's renderer responds to Ctrl+R as a built-in reload accelerator even with `Menu.setApplicationMenu(null)`. The KeyboardRouter handler ran but the page also reloaded.
- **Fix:** moved NWR toggle off Ctrl+R. Now bound to `0` (adjacent to the volume digits 1 and 2).

#### Shift+digit shortcuts didn't fire
- **Root cause:** `KeyboardRouter.specFromEvent` used `e.key` directly; on US layouts, Shift+1 produces `e.key = "!"`, so `register("shift+1")` would never match the actual event spec `"shift+!"`.
- **Fix:** added `eventKeyName()` helper that detects `Digit0–Digit9` / `Numpad0–Numpad9` via `e.code` when Shift is held and normalizes back to the base digit. Registrations like `"shift+1"` now match predictably across keyboard layouts.

### Changed

#### Keyboard remap (NVDA-friendly)
- **Removed** `Ctrl+R` (NWR toggle, page-reload conflict), `Ctrl+Alt+←/→` (volume target cycle, NVDA table-nav conflict), `Ctrl+↑/↓` (volume nudge), `1` and `2` scene-jumps (current / local radar — repurposed for volume).
- **Added** `0` toggle NWR, `1`/`Shift+1` music volume up/down, `2`/`Shift+2` Weather Radio volume up/down.
- **Retained** `3`/`4`/`5` scene jumps for hourly/extended/alerts. Tab/Shift+Tab still cycles through every scene including current and radar.

## [0.9.2] — 2026-04-15

NOAA Weather Radio keyboard shortcuts.

### Added

- **`Ctrl+R`** toggles NOAA Weather Radio on/off. When turning on, announces the active call sign and station ("Weather Radio on. KEC49, Buffalo NY."). If no station is configured, prompts the user to open Settings.
- **`Ctrl+Alt+←` / `Ctrl+Alt+→`** cycle the selected volume bus between Music and Weather Radio. Each press announces "{label} volume selected, currently NN percent."
- **`Ctrl+↑` / `Ctrl+↓`** raise/lower the selected volume bus by 5%. Each press announces the new percentage. Clamps at 0% / 100%.
- **README** keyboard table + new "How to use it" section under NOAA Weather Radio with full keyboard reference.

## [0.9.1] — 2026-04-15

NOAA Weather Radio live streaming + mnemonic startup fix.

### Added

#### NOAA Weather Radio (NWR) live stream
- **`NwrPlayer` service** (`src/audio/NwrPlayer.ts`) — streams the weatherUSA Icecast feed (`https://radio.weatherusa.net/NWR/{callSign}.mp3`) for any NWR transmitter call sign. Plays in the background regardless of which scene is active. MP3 32 kbps mono, public-domain US government audio.
- **Dedicated `radio` bus** in `AudioMixer` alongside music + voice. Independent volume control via `setRadioLevel()`. NWR is intentionally NOT ducked by voice narration — real-time weather information should remain audible alongside the narrator.
- **Reconnection logic** — exponential backoff (2s → 4s → 8s → 16s, cap 30s) on stream error/stall/end. Generation counter prevents stale timer callbacks after switching call signs.
- **Station directory** (`src/audio/nwrStations.ts`) — 60 major-metro NWR stations with city, state, frequency. Powers the autocomplete in Settings; user can type any call sign manually. `suggestCallSignForPlace()` fuzzy-matches the user's home favorite location.
- **Settings additions:** `nwrEnabled`, `nwrCallSign`, `nwrVolume`, plus a new `musicVolume` slider so music level is finally user-adjustable. Defaults: NWR off, volume 0.5; music volume 0.6 (matches old hardcoded default).
- **Settings UI:** new "NOAA Weather Radio" fieldset with enable toggle, call-sign input with `<datalist>` autocomplete, volume slider. Music volume slider added to the Audio fieldset.

### Fixed

#### Mnemonic startup cutoff
- **Root cause:** `App.tsx` audio-unlock fired `clips.play("mnemonic")` while the AudioContext was still transitioning from `suspended` to `running`. `MediaElementAudioSourceNode` produced silence until the context became live, truncating the perceived clip. Fix: wrap the mnemonic play in an async block that awaits `ctx.resume()` first.

### Notes

- **Legal:** NWR audio is US government public domain; FCC permits rebroadcast within 1 hour of receipt (47 CFR 73.1207). EAS Attention Signals embedded in the stream are passed through as-is — this app is a pass-through, not an EAS originator. We do NOT synthesize EAS tones (existing `AlertTones.ts` uses non-EAS chimes). 47 CFR Part 11 prohibits EAS tone simulation outside genuine alerts.
- **Stream provider terms:** weatherUSA streams are intended for direct end-user listening. Pass-through player connecting user to stream = fine. Recording/redistribution = not fine.
- **CORS:** The weatherUSA Icecast server returns `Access-Control-Allow-Origin: *`. If a future provider blocks CORS, Electron's `webRequest.onHeadersReceived` can inject the header for `radio.weatherusa.net`.

## [0.9.0] — 2026-04-15

Era-authentic theme splits, broadcast-referenced layouts, legacy era research.

### Added

#### Weatherscan three-era split
- **`weatherscan-local`** (1999–2003), **`weatherscan-v1`** (2003–2005), **`weatherscan-v2`** (2005–2022) replace the single `weatherscan` theme. Each has era-scoped backgrounds, typography, and music pool. Migration in SettingsStore: `weatherscan` → `weatherscan-v1`.

#### WeatherStar 4000 two-era split
- **`ws4000-v1`** (2001–2004) and **`ws4000-v2`** (2005–2009) replace the single `ws4000` theme. Verified against user-supplied broadcast stills (`docs/reference/ws4000/`). Migration: `ws4000` → `ws4000-v2`.
- **`extendedStyle: "3-day"`** new union value. WS4000's Extended Forecast confirmed as 3-day graphical (Feb 1991 redesign), not 5-day. Narration clips reuse the "5-day" phrasing bucket via coercion in `App.tsx`.
- **v2 frame CSS** — orange-to-purple gradient background, floating cyan-glow content pane with drop shadow under `body[data-theme="ws4000-v2"]`.

#### Legacy era research documentation
- **`docs/legacy-eras.md`** — comprehensive per-era layout reference for WS3000, WS4000, WSJr, IS1, IS2 (HD + Jr). Scene-by-scene layouts, chrome descriptions, asset inventories, confirmed vs unverified facts with source citations.
- **`docs/reference/`** — scraped broadcast stills from Wikipedia, TWC Classics, HandWiki, EverybodyWiki (~20 IS1 scenes, 1 WS3000 CC, 12 WS4000 stills). Plus `README.md` index.
- **`docs/reference-capture-plan.md`** — URL list and scene checklist for manual browser capture of remaining gaps.
- **`scripts/scrape_page_images.py`** + **`scripts/scrape_batch.sh`** — automated broadcast-stills scraper (handles srcset, skips Cloudflare challenges, writes manifest per source).

### Changed

- **WSJr reclassified** — research confirmed WSJr is a WS3000 layout with WS4000 fonts, not a WS4000 variant. `THEME_CORE_SCENES["wsjr"]` no longer includes `radar`. Theme comments updated. Narrator default flagged as unverified.
- **IS1 typography corrected** — `intellistar1` display/LED/small font stacks changed from Akzidenz-Grotesk to Interstate (IS1 launched with Interstate in Feb 2003 per Wikipedia/HandWiki).
- **Assets gitignored** — `assets/*` added to `.gitignore` with `!assets/.gitkeep` to preserve the directory. `src/audio/data/` remains tracked (manifests are code). Previous comment about assets being committed intentionally has been replaced.
- **Default theme** changed from `ws4000` to `ws4000-v2` in `DEFAULT_SETTINGS`.

### Documentation
- **README** updated: ten themes (from seven), 3/5/7-day Extended note, assets-gitignored note.
- **TODO** refreshed with v0.9 items and legacy era research tasks.
- **`docs/weatherscan-eras.md`** updated with implementation checklist status.

## [0.8.1] — 2026-04-14

Asset cleanup, mnemonic cutoff fix, per-scene backgrounds, HD WEBP icon pools, prefers-reduced-motion fallback, and small typography wiring.

### Fixed

- **Mnemonic cutoff regression.** `App.tsx` audio-unlock could call its `start()` handler twice when `ctx.resume().then(start)` raced with the keydown / click listener — both calls passed the `if (!audioStarted)` guard because React state is async, and the second `services.clips.play("mnemonic")` routed through `PhraseSequencer.playOne()` which stops the in-flight playback. Replaced the state guard with a synchronous `audioStartedRef` so the first call wins idempotently.

### Added

#### Reduced-motion icon fallback
- **`useReducedMotion()` hook** in `WeatherIcon.tsx` watches `prefers-reduced-motion: reduce` and switches mapped conditions to static PNGs from `/assets/icons/stills/`. ~22 conditions covered; unmapped conditions transparently fall back to the GIF pool. Fuller coverage available in `/assets/icons/stills/{mv,wxl}/` (TWC code naming) — wiring those is a follow-up.

#### Per-scene WeatherStar 4000 / WS Jr backgrounds
- **`getSceneBackground(themeId, sceneId)`** in `backgroundCatalog.ts` returns a per-scene `BackGround*.png` template. WS4000 maps 17 scenes (current → `BackGround1`, extended → `BackGround2`, temptrend → `BackGround1_1_Chart`, radar → `BackGround5`, etc.); WSJr maps 7 core scenes.
- **Scene-change effect in `App.tsx`** updates `--ws-bg-image` whenever a per-scene mapping exists. Other themes (IS1/IS2/WSXL/Weatherscan) continue to use rotating pools or fixed frame backgrounds.

#### HD WEBP icon pools
- **`iconResolution: 28 | 42 | 68`** optional field on `ThemeDef`. When set, `WeatherIcon` routes through `/assets/icons/{NN}x{NN}/` for conditions in the new `WEBP_MAP` (28 conditions, includes tornado / tropicalstorm / hail not present in the GIF pool).
- **WeatherStar XL → 42×42**, **IntelliStar 2 / 2 Jr HD → 68×68**. Other themes unchanged. Unmapped conditions fall back to the existing GIF pool at `theme.iconSet`.

#### LDL section icon
- **`leadIconName` prop** on `LdlCrawl`; new `TINY_MAP` (15 condition keys → TWC code stems). When supplied, renders the `_Xsm.png` from `/assets/icons/tiny/` next to the "NATIONAL" label.
- **`App.tsx` derives the LDL icon** from the latest current-conditions observation via `chooseIcon()`, threading it through `WeatherscanFrame` → `LdlCrawl`.
- New **`.ws-ldl-icon`** CSS rule (18×18, contained, flex-aligned).

#### Orphan font wiring
- **Star4000 Extended** added as a fallback in the `--ws-font-display` stack on `ws4000` and `wsjr` — was declared in `weatherscan.css` but no theme referenced it.
- **akkopro-light** promoted to primary in `intellistar1.--ws-font-small` (with AkzidenzGroteskBE as fallback) — period-correct IS1 secondary text font.

### Asset cleanup

- **Archived `assets/icons/avi/`** (8.6 GB, 146 raw `.avi` source videos — browsers can't play them) → `D:\AWC-asset-archive\icons\avi\`.
- **Archived `assets/icons/avi-webp/`** (1.9 GB, 146 WebP intermediates of the same set) → archive.
- **Archived `assets/icons/apng/`** (43 MB, 179 APNG duplicates of the active GIF set) → archive.
- **Archived three `assets/themes/` subfolders** (`intellistar1/` 2.4 GB, `intellistar2/` 630 MB, `ws4kp/` 4.9 MB) — third-party source dumps from fan projects (OpenStar / FUN-WeatherStar-4000 / ws4kp) we'd already mined for live assets. Not referenced by code.
- **Restored `assets/themes/weatherscan/` and `assets/themes/intellistar/`** after initial archive accidentally moved live-referenced font and background files (`Frutiger.woff`, `Interstate-*.woff`, `akkopro-light.ttf`, `core_bg.png`).
- **Repo `assets/` reduced from ~19 GB to 5.1 GB.** Total archived: 14 GB. Nothing deleted.

### Documentation

- **`.gitignore` expanded** — covers Python cache, tsbuildinfo, local Claude settings (`.claude/settings.local.json`), and Windows artifacts (`Thumbs.db`, `desktop.ini`). Explicitly preserves `assets/` and `src/audio/data/`.
- **README status bumped to v0.8.1.**
- **TODO refreshed** — six v0.9 prep items checked off; stale "assets should NOT be committed" note removed.

### Known follow-ups

- **Per-theme polish on `.ws-hero` / `.ws-feels` / `.ws-trend` / `.ws-almanac` / `.ws-travel` / `.ws-narrative`** still pending (v0.9 main item).
- **Regional Forecast scene** still pending (v0.9 main item) — Amy's held `Local-RegionalForecastConditions.wav` waiting; Chandler has 32 `rf/*` clips ready; `regional-i1/` icon pool waiting.
- **Time-of-day weighted scheduler** still pending (v0.9 main item).
- **Full reduced-motion still coverage** via `stills/{mv,wxl}/` (TWC code naming → condition-key map).
- **Per-scene backgrounds for non-WS themes** (IS1 / IS2 / WSXL each used scene-specific backdrops too).
- **WeatherIcon "no-data" fallback** when neither GIF nor WEBP exists for a condition (currently always serves `No-Data.gif`).

## [0.8.0] — 2026-04-14

Theme consolidation, authentic era layouts, grid navigation, era-correct logos, fan-sourced assets, and a complete documentation refresh.

### Added

#### Authentic era logos
- **TWC logo** (post-2005 square mark) rendered top-left of the header on Weatherscan, WSXL, IntelliStar 1, and IntelliStar 2 HD themes — era-authentic placement. WS3000 / WS4000 / WSJr intentionally do not show the TWC mark (local Star units never rendered it on-air; the network overlay did).
- **IntelliStar wordmark** replaces the "AWC · LIVE" corner bug on IS1 / IS2 themes.
- **NOAA seal** appears as a data-source attribution strip on the Alerts scene (not broadcast-authentic, but authentic to the data source).
- Assets sourced from the MIT-licensed `mewtek/OpenStar` fan project, placed under `assets/logos/{twc,noaa,intellistar,ldl}/`.

#### Lower Display Line (LDL) crawl
- **`LdlCrawl` component** (`src/ui/weatherscan/LdlCrawl.tsx`) renders a persistent bottom crawl on eras that historically ran one: Weatherscan, WSXL (post-2005), IntelliStar 1, IntelliStar 2 HD / Jr HD. WS4000-family themes keep the hotkey status bar.
- Cycles airport delays + closures (pulled live from the FAA NAS Status feed), scrolling seamlessly with an `aria-hidden` animated strip. AT users get a `sr-only` static `<ul>` of the same items — no chasing motion.
- **Authentic LDL strip template** (`assets/logos/ldl/LDL.png`) — black gradient bar with rounded logo-nub cutout on the right, sized to fit the viewport.
- **Per-theme LDL label color + typography:** cyan for IS1/IS2, gold for WSXL, warm yellow for Weatherscan.
- Respects `prefers-reduced-motion: reduce` — marquee freezes and the strip wraps as plain text.

#### WSXL cloud wallpaper
- **Authentic blue-sky cloud photography** (`assets/backgrounds/weatherstarxl-clouds/`) — two images rotated randomly on theme apply. Replaces the previous IS1 city-gradient reuse that was a mismatch for WSXL's post-2005 graphics package.
- Frame overlay softened from 95% dark crush to 55% so the sky actually shows through.

#### Grid navigation
- **`useArrowGrid` hook** (`src/a11y/useArrowGrid.ts`) — 2-D arrow navigation for scenes laid out as columns × rows. Left/right walks columns, up/down walks rows, Home/End jump to row ends.
- **`useArrowList` kept** for linear scenes (Alerts, Airport Delays, Local Forecast narrative).

#### Era-authentic columnar Extended Forecast
- **`ExtendedForecastView` rewritten** as a CSS Grid (5 or 7 columns depending on era). Each column stacks day label / weather icon / short conditions / hi or lo temp — the authentic TWC Local on the 8s layout every Star unit used.
- **Per-theme grid styling** in `weatherscan.css`:
  - WS3000: text-only cells, no icons, cool blue/white
  - WS4000 / WSJr: orange-framed blue gradient panels, LED temp values
  - WSXL: translucent dark panels over the cloud wallpaper, gold Akzidenz headers with 2px drop shadow
  - Weatherscan: deep-navy rounded panels with cyan accent, Frutiger throughout
  - IntelliStar 1: blurred glass panels over city gradients, amber highs / pale-blue lows
  - IntelliStar 2 HD: larger HD glass panels with shadow, Frutiger Light, thinner weights

#### Era-authentic columnar Hourly Forecast
- **`HourlyForecastView` rewritten** in the same columnar pattern. Up to 8 hours shown; time + icon + temp + precip chance per column. Inherits the same per-theme styling as Extended.

#### New scene layouts
- **Current Conditions hero** — large icon + 120-px temp + 3×2 readout grid (feels like, humidity, wind, pressure, visibility, dewpoint). Per-era temp rendering: WS4000 yellow-on-blue drop-shadow, Weatherscan thin Frutiger, IS2 HD Frutiger 200-weight.
- **Overnight Forecast hero card** — period header + 100-px low temp + stat strip + narrative panel.
- **Feels Like split panels** — side-by-side Actual vs Feels Like. Feels-Like panel tints blue under wind chill, red under heat index.
- **Temperature Trend** — 4-tile LED readout (Current / High / Low / Trend arrow) + hourly vertical bar chart, each bar walkable via arrow grid.
- **Almanac sun/moon 2-column grid** — Sun cells (sunrise/sunset/day length) left, Moon cells (phase/illumination) right. Grid-nav walks L/R between panels and U/D between rows.
- **Travel Cities 3-column table** — name | temp+icon | conditions. L/R walks columns, U/D walks between cities.
- **Weekend Forecast** reuses the Extended columnar grid (same CSS, same pattern).
- **Local Forecast** rebuilt as a large-text narrative panel — period title + big temp + detailed NWS text, walked via up/down through periods.

#### Era-correct severe ticker accessibility
- **`sr-only` static `<ul>`** of headlines inside the severe-interrupt ticker — AT users who enter mid-alert can walk the list instead of chasing the marquee.
- **`prefers-reduced-motion: reduce`** freezes the ticker and wraps text normally.
- **Per-theme EAS styling:** WS4000-family orange/Star4000, WSXL gold-bordered maroon, Weatherscan brick-red with white top border, IS1/IS2 subtle red vertical gradient with gold border.

#### FAA parser fix
- **`FaaClient` tag-name bug fixed.** Feed uses `<Name>` inside `<Delay_type>`; old parser looked for `<Delay_type_name>` and classified every row as "other" with no delay minutes.
- **Closure rows now handled.** New `closureStart` / `closureReopen` fields populated for `Airport Closures` entries (which have `<Start>` / `<Reopen>` but no `<Min>/<Max>/<Avg>`).
- **`AirportDelaysScene` sorts closures to the top** via synthetic weight; view and speech both render "XXX closed, reopens …" instead of "— min".

### Changed

#### Theme consolidation (7 themes, down from 10)
- **Retired `classic90s`** — was a soft duplicate of WS4000 (same fonts, same scene order, only different accent color). Users on this theme auto-migrate to `ws4000` via `SettingsStore.load()`.
- **Retired `intellistar2jr` as a distinct theme.** Consolidated into `intellistar2` labeled "IntelliStar 2 / 2 Jr HD" — same fonts (Frutiger), same scene order, same narrator. IS2Jr's 56 AMHQ blur backgrounds are folded into the IS2 rotation pool (310 images total). Users migrated to `intellistar2`.
- **Retired `highcontrast` as a theme.** It was never a TWC hardware unit. The `highContrast` boolean setting remains as an accessibility CSS overlay that can layer on top of any theme. Users on the retired theme migrate to `weatherscan`.
- `THEME_EXCLUDED_SCENES` introduced: IS2 excludes the standalone Airport Delays scene because IS2 HD never ran one (airport data lived in the LDL).

#### Keyboard remap
- **Scene switch moved from `←` / `→` to `Tab` / `Shift+Tab`.** Arrow keys now freed for per-scene grid/list navigation. Existing scene-jump (`1`–`5`), pause (`Space`), modals (`,` / `?`), favorites (`M`), map (`N`), and silence (`Esc`) unchanged.
- Startup announcement, `aria-label` on the stage, and the status-bar hints all updated to the new model.

#### Palette corrections against reference
- **WS4000:** `--ws-accent-warm` `#ffd24d` → `#ff9933` (the iconic saturated 1990-era TWC orange, confirmed via fandom.com/wiki/WeatherStar_4000).
- **WS3000:** cooled toward period-correct blue/purple with blue-white text (per TWC Archive). Cream text → near-white; amber primary accent → cool-white; LED amber kept for legibility.

#### TWC alert-bar red
- Authentic `#ae1d0b` brick-red extracted from the MIT-licensed IS1-era fan emulator replaces the earlier `#cc2200` default for the severe ticker background. Per-theme overrides tint further.

### Fixed

- **Airport Delays scene showed empty/mis-categorized data** — tag-name mismatch in XML parser, now fixed (see `FaaClient` above).
- **AWC logos folder had an orphaned `noaa.gif`** — unused in source. Superseded by the transparent NOAA PNG on the Alerts scene.
- **Severe ticker had no static AT equivalent** — now carries both a decorative animated strip and a `sr-only` list.

### Removed

- `classic90s` theme (migrated to `ws4000`).
- `intellistar2jr` theme (merged into `intellistar2`).
- `highcontrast` theme (kept as boolean overlay only).
- Per-theme gradient backgrounds on `.ws-ldl` that were clobbering the authentic LDL strip image.

### Documentation

- **README rewritten** for v0.8: new keyboard model, consolidated theme roster, scene layout list, fan-asset attribution, IP notice, link to user guide.
- **New `USER_GUIDE.md`** — first-run setup, keyboard primer, theme + scene walkthrough, settings tour, assets setup, troubleshooting.
- **`docs/architecture.md` expanded** with LDL crawl pipeline, grid navigation hook, theme consolidation rationale, scene layout patterns, fan-asset sourcing.
- **`TODO.md` refreshed** — completed items marked, per-theme CSS polish on remaining scene classes queued.

## [0.7.0] — 2026-04-14

Era alignment, narrator polish, severe-tone wiring, three new themes, and two new scenes.

### Added

#### Era-aware Extended Forecast
- **`ThemeDef.extendedStyle`** (`"5-day" | "7-day"`) and **`ThemeDef.extendedTitle`** on every theme. WeatherStar 4000 / WeatherStar Jr / 1990s Classic / WeatherStar 3000 use `5-day` with title "Extended Forecast"; Weatherscan, IntelliStar 1/2/2Jr, WeatherStar XL, and High Contrast use `7-day` with authentic titles ("7-Day Outlook", "Week Ahead").
- **`NarratorClipDef.eras`** — each scene-intro clip can declare which era(s) it fits. `pickSceneIntro(narrator, sceneId, era)` filters the pool accordingly. AJ's `extended` pool split: "Your/Our extended forecast" tagged `5-day`, all "7-Day Outlook" / "Week Ahead" variants tagged `7-day`. JC's 3 extended intros all tagged `7-day`.
- **`SceneContext.themeId`** — scenes now see the active theme and adjust accordingly. `ExtendedForecastScene` slices NWS periods to 10 (5-day) or 14 (7-day) and sets its own title from the theme. `composeExtendedForecast` takes `era` + `title` params and threads them through.

#### Three new themes
- **WeatherStar 3000** (`ws3000`) — pre-WS4000, late-80s. Star3000 fonts, orange-on-blue palette, 5-day Extended Forecast, no radar/hourly scenes (authentic to the hardware). Defaults to the new `silent` narrator (no local voiceover existed for the 3000).
- **WeatherStar Jr** (`wsjr`) — 1997-2003 lightweight WS for smaller cable systems. StarJR fonts, WS4000-style scene loop, AJ narration (era-correct).
- **IntelliStar 2 Jr** (`intellistar2jr`) — 2013+ scaled-down IS2. Helvetica, Chandler narrator, modern TWC palette. Pulls backgrounds from the 56-image `intellistar2jr/AMHQ` library (new `I2JR_BACKGROUNDS` set in `backgroundCatalog.ts`).
- `@font-face` registrations for `StarJR` / `StarJR Large` / `StarJR Small` and `Star3000` / `Star3000 Large` / `Star3000 Small` added to `weatherscan.css`.

#### Two new scenes
- **Traffic scene** (`TrafficScene` + `TrafficView`) — always renders the unavailable placeholder (no free public traffic API fits the Weatherscan "local trip times" granularity). Narrator intros for AJ/Amy continue to play if the user enables the scene.
- **Airport Delays scene** (`AirportDelaysScene` + `AirportDelaysView`) — fetches the FAA's public NAS Status XML feed (`https://nasstatus.faa.gov/api/airport-status-information`), parses `Delay_type` groups into a flat `AirportDelay[]` (ground delays, ground stops, arrival/departure, closures), sorts worst-delay first, renders in the standard list view. 5-minute cache. Fetch failures fall through to the unavailable placeholder.
- **Shared `SceneUnavailable` component** (`src/ui/scenes/SceneUnavailable.tsx`) + new `.ws-unavailable*` CSS — consistent placeholder UI across themes. Used by Traffic and Airport Delays; existing Overnight/Weekend views continue to use inline styling.

#### Silent narrator
- New `silent` narrator id for eras that predate voice overlay (WS3000). Empty `sceneIntros`, all `hasX=false` — every scene falls through to TTS/NVDA. Selectable from the narrator dropdown for any theme.

#### Severe-alert audio wiring
- **NWS 4-beep warning tone** wired. `assets/sounds/severe_weather_tone.wav` (previously mapped to the dead `alert_tone` intent) is now mapped to `warning_beep` and plays via `services.clips.play("warning_beep")` on alert detection.
- **`getSevereAlertIntroClips`** helper in `PhraseComposer` — routes severe-alert opening sequences per narrator. AJ: `[4-beep tone, spoken warning]`. JC: tier-based `[N_Beep.wav, N_EVENT.wav]` from `assets/narration/Jim Cantore/Crawl audio/` (tier 4 for tornado/severe thunderstorm/flash flood/flood/extreme wind; tier 2 for hurricane/blizzard/ice storm/tsunami/earthquake; tier 1 fallback).
- **`pickSevereAnnouncementClip` refactored** to route through the semantic registry via `Sem.named("alert_tornado")` etc., eliminating duplicate hard-coded severe clip paths.
- AJ `AJ_NAMED_MAP` severe entries switched from the unverified `severe/*` folder to the verified `VocalLocal/Default_Phrases_Severe/TOR001 / SVR001 / FFW001.wav` set (single canonical source per intent).

#### JC period coverage
- **`JC_PERIOD_MAP` gained** `MON_NIGHT`..`SUN_NIGHT` (pointing to `Vocal Local/Periods2/Monday_Night.wav` etc.) plus `TODAY` and `TONIGHT`. JC now speaks the day-name-night label on extended/weekend night periods and announces "today"/"tonight" on screens where he previously stayed silent.
- **`AJ_PERIOD_MAP` gained** `MON_NIGHT`..`SUN_NIGHT` using the existing `MON7.wav` ("on Monday night.") family — AJ was silent on weekday-night periods before.
- **`AFTERNOON` PeriodKey** added for both narrators (`AFTERNOON1.wav` = "this afternoon.") — closes the known TTS-fallback gap for NWS's "This Afternoon" period name.

#### "And on …" closing period clips
- Final-period swap in `getPeriodClip` — when `isLast=true` the clip for AJ or JC is switched to the `*4.wav` ("and on Monday.") or `*5.wav` ("and Monday night.") variant so the extended/weekend forecast closes naturally instead of trailing off on a bare day name.

### Changed

#### Weekend Forecast intro
- New `weekend` sceneIntros slot for AJ + JC so the scene no longer falls back to the 7-day outlook intro. AJ: `VocalLocal/Periods2/WEEK3.wav` = "heading into the weekend." JC: `Vocal Local/Periods2/WEEKEND2.wav` = "This weekend."
- `composeWeekendForecast` prefers the `weekend` intro and falls straight to TTS if missing (no more shared-with-extended intro pool).

#### Extended Forecast narration
- Group-phrase summary clip **removed** from `composeExtendedForecast`. The old "On Wednesday, we'll see rain" intro played before the per-period rundown, which announced a future day before "Today" — sounded like the days were swapped. Per-period narration now plays cleanly without the pre-amble.

#### Mnemonic startup
- Scheduler now waits for the three-bell TWC mnemonic to finish before starting the scene loop. New `mnemonicDone` state in `App.tsx`; `services.clips.play("mnemonic").finally(() => setMnemonicDone(true))` gates the scheduler-start effect. Previously the first scene-change effect called `sequencer.stop()` mid-jingle and cut the mnemonic.

#### Polling tone
- Alert-polling code in `App.tsx` simplified: instead of playing one of four narrator-specific spoken clips on alert detection, it plays a single `warning_beep` attention tone. The full per-narrator announcement sequence is handled by the scene-change `composeAlerts` path.

#### Amy Bargeron audit
- Her 9 preserved Weatherscan clips re-verified against the scenes she actually narrated. `Local-RegionalForecastConditions.wav` was previously mapped to `extended` — it's actually for the Weatherscan Regional Forecast scene (nearby-cities map), not the 7-Day Outlook. **Removed** that mapping; Extended now falls to TTS for Amy. Clip preserved in the library for when a dedicated Regional scene is added. All other mappings (current, radar, hourly, localForecast, traffic, airport, allergy) verified correct.

### Fixed

- **Airport Delays endpoint.** Initial wiring used `soa.smext.faa.gov/asws/api/airport/delays` which has been retired (DNS no longer resolves). Rewrote `FaaClient` to use the live `https://nasstatus.faa.gov/api/airport-status-information` XML feed with a browser-native `DOMParser`. Every fetch was silently failing → scene always showed the unavailable placeholder; now it shows real delay data when the FAA reports any.

### Removed
- `alert_tone` NamedIntent (never returned by `pickAlertTone`, replaced by `warning_beep`).
- `AJ_VOCALLOCAL_BASE` import in `PhraseComposer.ts` (no longer needed after the severe-clip registry refactor).
- Orphaned hardcoded severe clip paths in `pickSevereAnnouncementClip`.

### Migration notes
- **Asset files left in place but now unreferenced:**
  - `assets/narration/Alan Jackson/severe/*.wav` (3 files, unverified duplicates of `Default_Phrases_Severe/*001.wav`).
  - `assets/narration/Alan Jackson/VocalLocal/Default_Phrases_Severe/TORNADO_DEFAULT.wav` / `THUNDERSTORM_DEFAULT.wav` / `FFLOOD_DEFAULT.wav` (the "our area" variants; we use the "your area" TOR001/SVR001/FFW001 set).
  - `assets/narration/Jim Cantore/Weatherscan severe/*.wav` (3 files, duplicates of `Default phrases severe/*001.wav`).
  - Safe to delete when cleaning up.

## [0.5.0] — 2026-04-11

Authentic WeatherStar 4000 visual assets and theme groundwork.

### Added

#### Authentic WeatherStar assets (MIT, from wesellis/FUN-WeatherStar-4000)
- **Star4000 fonts** — 4 TTF + 8 WOFF font files in `assets/fonts/`. `@font-face` declarations in `weatherscan.css` replace Google Fonts as the primary display font. `--ws-font-display` is now `Star4000` (Lato fallback), `--ws-font-led` is `Star4000 Large`, new `--ws-font-small` variable for small labels.
- **41 animated weather GIF icons** in `assets/icons/`. `WeatherIcon.tsx` rewritten to use `<img>` tags with GIF sources instead of inline SVGs. `chooseIcon()` expanded with full coverage: thundersnow, scattered variants, freezing rain + sleet combos, wintry mix, smoke, all moon phases, blowing snow, snow-to-rain transitions.
- **66 background images** in `assets/backgrounds/`. Classic blue gradient with orange header bar (`BackGround1.png`) set as default frame background via `background-image: cover`. Multi-panel layouts (3-column forecast, full-width radar) available for future scene-specific backgrounds.
- **Logos** in `assets/logos/` — WeatherStar corner badge, NOAA logo, app icons.
- **Travel city data** — `assets/data/travelcities.js` (25 cities), `regionalcities.js` (170+ cities), `stations.js`. New `src/core/places/TravelCities.ts` exports typed travel city data with `travelCityToPlace()` converter for the future Travel Cities scene.

### Changed
- **WeatherIcon** is now GIF-based (was inline SVG). The `IconName` type is now a plain string keyed to GIF filenames. All scene views that use `chooseIcon()` get animated icons automatically.
- **Font loading** — dropped the VT323 Google Font import. Star4000 fonts load locally, Lato still loads from Google Fonts as a fallback.

### Removed
- Tested and discarded 75 smooth jazz MP3s from the WeatherStar repo (quality was poor).

## [0.4.0] — 2026-04-11

The severe weather experience — bringing the classic Weatherscan alert behavior to life.

### Added

#### Severe weather interrupt system
- **Alert interrupt with orange visual takeover.** When an Extreme or Severe NWS alert arrives, the app now preempts the normal scene cycle: auto-jumps to the Alerts scene, turns the entire background orange (deep burnt orange gradient with pulsing red alert banner), and plays the alert tone. The `SceneScheduler` gains `interrupt(sceneId)` and `clearInterrupt()` methods that suspend/resume the normal cycle, remembering where it left off. The interrupt clears automatically when no severe-level alerts remain active.
- **Scrolling severe weather ticker.** During a severe interrupt, the bottom status bar is replaced by a scrolling text crawl (CSS animation, `aria-hidden`) showing alert headlines and affected areas separated by `///`. Mimics the classic Weatherscan orange ticker bar. When the interrupt clears, the normal hotkey hint bar returns.
- **Bundled alert tone option.** New setting: "Use bundled severe weather alert tone" — when enabled, plays `Severe Weather Alert tone.mp3` from the Alan Jackson clip library via `ClipLibrary.playSrc()` instead of the synthesized `AlertTones.playWarning()` chime. Default remains synthesized (legal safety around FCC-regulated EAS signal). The setting appears in the Audio fieldset of the Settings panel.

#### Visual changes during severe interrupt
- Frame background switches to `#8b3000 → #cc4400 → #993300` gradient (Weatherscan orange)
- Alert banner text changes to "SEVERE WEATHER ALERT" in white on pulsing red
- Stage area gains orange side borders
- All accent colors shift to orange family (`#ff6600`)
- Bug corner text shifts to orange

### Changed
- **Alert polling** now builds ticker text from severe alerts, tracks severe vs non-severe separately, and triggers/clears scheduler interrupts based on alert severity.
- **`SceneScheduler`** extended with `interrupt()`, `clearInterrupt()`, `isInterrupted()`. The `SchedulerEvent` type now includes an `interrupted: boolean` field.
- **`Settings` type** gains `useBundledAlertTone: boolean` (default `false`).
- **`WeatherscanFrame`** accepts new `severeInterrupt` and `tickerText` props. When `severeInterrupt` is true, applies the `ws-severe` CSS class for the orange takeover and renders the ticker instead of the status bar.
- NWS User-Agent bumped to `AccessibleWeatherCenter/0.4`.

### Fixed
- **CCSH1801.mp3 transcription.** Whisper had transcribed this as "light sleep" — corrected to "light sleet" in `clip_manifest.raw.json`, `clip_manifest.categorized.json`, and `clip_manifest.review.txt`.

### Documentation
- **`TODO.md`** reorganized: completed items marked, new v0.4/v0.5 sections, severe weather features added to backlog.
- **`docs/architecture.md`** expanded with Storm detection & tracking, Dual-tier alert system, and Audio pipeline sections.
- **`docs/weatherscan-flavors.md`** updated: Local Radar marked as v0.3, Severe Weather Alert marked as v0.4 (partial), implementation status list updated.
- **`docs/clip-schema.md`** alert tones section remains accurate (documents the synthesized-vs-bundled tradeoff).

## [0.3.0] — 2026-04-11

User-reported bugs and UX gaps from first hands-on testing with NVDA.

### Fixed
- **Music restarted on every scene change.** `MusicPlayer` rewritten as a continuous shuffle queue: one persistent shuffled track list, advance to next on track-end (or skip), reshuffle when the queue empties. App.tsx no longer calls `playMood` on scene change — music is now fully independent of the scene loop, exactly like the original Weatherscan. Mood-based selection is gone; if the user wants per-scene mood later it can come back as a *next-track-after-current* preference rather than as an interrupting switch.
- **Up/down arrows did nothing in scene mode.** New `useArrowList` hook in `src/a11y/useArrowList.ts`. Each scene view exposes its content as a flat array of items (forecast periods, hours, conditions cells, alerts, precip windows) and the hook installs Up/Down/Home/End handlers that walk the list and announce the focused item. Resets to "no item focused" on scene change so the scene's own narration runs first.
- **Up/down did nothing in Places mode with one place.** Now the user has multiple default places — Greeneville (home), Knoxville, Asheville, Johnson City, Bristol, Kingsport, Pigeon Forge — so there's content to walk. Place picker UI for adding more is still on the v0.4 backlog.

### Added
- **`role="application"` on the stage.** `WeatherscanFrame` marks the stage with `role="application"` and an explicit `aria-label` so NVDA stays in screen-reader focus mode automatically. Users no longer need to manually toggle browse vs focus mode each session.
- **Visible help dialog.** `src/ui/semantic/HelpDialog.tsx` is a real modal listing every shortcut from the `KeyboardRouter`, grouped by category, with `aria-modal="true"` and Esc-to-close. Opened by `?` (replaces the previous read-aloud-only behavior).
- **Status hint bar.** `WeatherscanFrame` now renders a bottom strip with hotkey hints (`← → scenes`, `↑ ↓ items`, `1–5 jump`, `M map`, `Space pause`, `, settings`, `? help`, `Esc silence`). Decorative — `aria-hidden="true"` — but immediately discoverable for sighted users.
- **AnnouncerContext.** `src/a11y/AnnouncerContext.ts` provides the announcement queue to deeply-nested scene views without prop-drilling. `App.tsx` wraps the tree.
- **Local Radar scene** (`src/core/scenes/scenes/LocalRadarScene.ts` + `src/ui/scenes/LocalRadarView.tsx`). First-pass text-based radar that uses the NWS hourly forecast to group upcoming hours into precipitation windows and produce a plain-language summary like *"Heavy rain expected in about 2 hours, 65 percent chance."* Each window is walkable with up/down. When the RainViewer pixel sampler lands in v0.4, the scene's data shape stays the same — only the prepare step changes. Wired into the scheduler as the second scene (after Current Conditions) and added to the Settings flavor toggles.
- **Per-flavor jump shortcuts re-numbered.** `1` Current, `2` Radar, `3` Hourly, `4` Extended, `5` Alerts.
- **`Ctrl+→` skips to the next music track.** With announcement.
- **Better startup announcement.** Now explicitly tells the user about left/right (scenes), up/down (items), M (map), comma (settings), question mark (help). No more guessing what does what.
- **Better Places mode entry announcement.** Explains place count, what arrows do, how to exit.

### Changed
- **Decorative bits hidden from screen readers.** The clock, the bug, the alert banner emoji, and the bottom hint bar are all `aria-hidden="true"`. The aria-live announcer remains the single source of truth for what assistive tech reads.
- **`PlacesStore.defaultPlaces()`** now seeds 7 cities instead of 1.
- **Scene jump shortcuts** moved from `1`–`4` to `1`–`5` to make room for the new Local Radar scene at position 2.

## [0.2.0] — 2026-04-11

### Added

#### Asset pipeline
- `vite.config.ts` — new `serveAssetsPlugin` middleware so the project-root `assets/` directory (which is too large to copy under `public/`) is served at `/assets/*` in dev. Production prod-time serving via Electron protocol is still on the TODO list.

#### Music
- `src/audio/manifests/musicCatalog.ts` — full hand-curated catalog of all 80 bundled music tracks (41 Weatherscan in-house jazz instrumentals + 39 named Trammell Starks "Music for Local Forecast" tracks across 3 disks). Each Trammell Starks track is mood-tagged from its title; the unnamed jazz tracks share a generic `ambient`/`weatherscan`/`any` mood pool.
- `src/audio/MusicPlayer.ts` — rewritten to load from the catalog, support master enable/disable, and auto-advance to a fresh same-mood track when one finishes (instead of looping the same song forever).

#### Voice clips (Alan Jackson library, 682 files)
- `src/audio/manifests/clipSchema.ts` — schema-aware resolver that maps the WeatherStar/Weatherscan voice library filenames to semantic intents *without renaming files*. Handles:
  - Numeric files `1.mp3`..`139.mp3` (positive temperature readings)
  - `M1.mp3`..`M99.mp3` (negative temperature readings)
  - `Zero.mp3` / `Zeros.mp3` / `1s.mp3` (special number cases)
  - `CC_INTRO1.mp3` (current-conditions intro)
  - `CC###.mp3` base condition codes with a confidence-tagged lookup table (`CC400`/`CC402` confirmed by user, others marked `guess`)
  - `CC####.mp3` / `CCEF####.mp3` / `CCSH####.mp3` (raw filename access for the verifier and the composer)
  - Named conditions: `CCDUST`, `CCSAND`, `CCSNOW`, `CCTHUNDER`, `CCSHOWERS`, etc.
  - Special files: `Mnemonic.mp3`, `Severe Weather Alert tone.mp3`, `National weather service tone test.mp3`
  - Every entry carries a `confidence` flag (`confirmed` | `likely` | `guess`) so the composer can decide whether to use a clip or fall back to TTS.
- `src/audio/PhraseComposer.ts` — composes ordered narration scripts from structured scene data. v0.2 ships `composeCurrentConditions(observation, placeName)` which produces:
  ```
  CC_INTRO1 → numbered temp clip → matched CC condition clip → TTS tail (wind/humidity/pressure)
  ```
  with a `guessConditionCode()` helper that maps NWS free-text condition strings to the CC code family.
- `src/audio/PhraseSequencer.ts` — plays a `PhraseScript` end-to-end through the mixer's voice bus, ducking music for the duration. Honors a confidence threshold; segments below the threshold (or with no clip at all) fall through to TTS for that segment only.
- `src/audio/ClipLibrary.ts` — rewritten to be a thin wrapper around `clipSchema.getNamedClip()`. Old hardcoded manifest is gone.

#### Alert tones
- `src/audio/AlertTones.ts` — synthesizes alert chimes via Web Audio oscillators so we never bundle the FCC-regulated EAS Attention Signal:
  - `playNwr1050()` — public-domain NOAA Weather Radio 1050 Hz tone with envelope
  - `playAdvisory()` — three-note rising chime for Minor / Moderate alerts
  - `playWarning()` — four-note urgent chime for Severe / Extreme alerts

#### Settings + per-flavor toggles
- `src/core/settings/SettingsStore.ts` — reactive settings store backed by `localStorage`. State includes per-flavor enable map, music master enable, AJ voice enable, clip confidence threshold, TTS voice/rate, high contrast.
- `src/core/scenes/SceneScheduler.ts` — extended with an `isEnabled` predicate so disabled flavors are skipped during normal next/prev cycling. The predicate can be replaced at runtime via `setEnabledPredicate()`, which `App.tsx` wires to the settings store so toggling a flavor in the panel takes effect immediately.
- `src/ui/settings/SettingsPanel.tsx` — modal settings dialog (opened with `,`) covering:
  - Music master enable
  - AJ voice clips enable + confidence threshold
  - Per-flavor checkboxes for every scene in the cycle
  - High-contrast theme toggle (writes `body[data-contrast="high"]`)
  - Esc to close, focus trap, real ARIA dialog markup

#### Visual upgrades
- `src/ui/weatherscan/weatherscan.css` — switched display font to Lato (SIL OFL) and LED font to VT323 (SIL OFL), loaded via Google Fonts `@import`. Fallbacks preserved.
- `src/ui/weatherscan/WeatherIcon.tsx` — original inline SVG weather icon set (sun, moon, partly-cloudy day/night, cloudy, rain, thunderstorm, snow, fog, wind, unknown). Decorative; semantic labels live in scene views. Includes `chooseIcon(text, isDay)` helper that maps NWS condition strings to icon names.
- `src/ui/scenes/CurrentConditionsView.tsx` — now displays the icon next to the condition text.

#### App wiring
- `src/App.tsx` — major rewrite:
  - Builds the `SettingsStore` and threads it through music, scheduler, and panel
  - Subscribes to settings changes for the music master enable and the flavor predicate
  - On Current Conditions entry, runs `composeCurrentConditions()` and plays the resulting script through `PhraseSequencer`; falls through to plain announcer for other scenes
  - Polls active alerts every 60 s; on a *new* high-severity alert, plays the warning chime; on a new minor/moderate alert, plays the advisory chime; either way the headline is announced assertively
  - New shortcuts: `,` (settings), `Ctrl+M` (mute music), and the existing list still works
  - `Esc` now also aborts the phrase sequencer, not just the announcer

#### Documentation
- `docs/clip-schema.md` — full explanation of the WeatherStar/Weatherscan voice library schema, what's confirmed vs guessed, and how the user can verify entries one at a time.
- `docs/weatherscan-flavors.md` — research notes on the canonical Weatherscan flavor lineup, which ones are implemented in v0.2, which are in the backlog, time-of-day rotation patterns, and music-mood pairings.

### Changed
- `MusicPlayer.defaultMusicManifest` — removed (catalog is the source of truth now).
- `ClipLibrary.defaultClipManifest` — removed.

### Notes
- Music files include spaces and parentheses in their paths. They're URL-encoded via `encodeURIComponent` where needed and the dev middleware decodes them on the way back.
- The `clipSchema.ts` confidence flags are conservative on purpose. If you set the threshold to "Guess" in Settings, every CC*-family file the composer asks for will be played even though many mappings are best-guesses — this is the right setting for verifying clips by ear.
- `App.tsx` no longer hardcodes a User-Agent placeholder; bump the `0.2` string in `buildServices()` if you change the contact info.

## [0.1.0] — 2026-04-11

Initial scaffold. The application boots, fetches live data from the National Weather Service, cycles through scenes, narrates each one, and offers a Places-mode map navigation.

### Added

#### Tooling and shell
- `package.json`, `tsconfig.json`, `tsconfig.electron.json`, `vite.config.ts`, `index.html`, `.gitignore`.
- Electron main process (`electron/main.ts`) with hidden-on-close window, system tray, and `notify` / `minimize-to-tray` IPC handlers.
- Electron preload (`electron/preload.ts`) exposing a context-bridged `window.awc` API.

#### Core (pure TS, no DOM)
- `src/core/types.ts` — domain vocabulary: `Place`, `Observation`, `ForecastPeriod`, `HourlyForecastPoint`, `WeatherAlert`, `RadarFrame`, `RadarCell`, `StormCell`, `PrecipBand`, etc.
- `src/core/weather/NwsClient.ts` — `api.weather.gov` client. Resolves gridpoints, fetches forecasts/hourly/observations/active alerts, normalizes to domain types. Required NWS `User-Agent` header is constructor-injected.
- `src/core/weather/RainViewerClient.ts` — RainViewer manifest fetch, tile URL templating, `buildRadarFrame` helper for sparse cell models.
- `src/core/weather/WeatherService.ts` — facade with simple in-memory TTL caching for observations, forecasts, hourly, and alerts.
- `src/core/radar/IntensityLegend.ts` — single source of truth mapping mm/h → `PrecipBand` → color name → speech. Includes Marshall-Palmer-ish dBZ-to-rate conversion.
- `src/core/places/PlacesStore.ts` — in-memory home/favorites store with subscribe; default home seeded.
- `src/core/scenes/Scene.ts` — `Scene` interface and `RenderedScene` shape (data + speech + cues).
- `src/core/scenes/SceneScheduler.ts` — cycles scenes, holds for `holdMs`, supports pause/resume/next/prev/jump/jumpToId, emits events on every transition.
- Concrete scenes: `CurrentConditionsScene`, `HourlyForecastScene`, `ExtendedForecastScene`, `AlertsScene`. Each produces both visual data and a TTS script.

#### Accessibility
- `src/a11y/TtsService.ts` — `TtsService` interface with a `WebSpeechTts` default. Pluggable for native voices later.
- `src/a11y/AnnouncementQueue.ts` — bridge between intent ("say this") and both TTS + a DOM aria-live region. Modes: `tts`, `live-region`, `both`, `off`.
- `src/a11y/KeyboardRouter.ts` — central shortcut registry with conflict detection, sortable spec normalization, and a `attach()` lifecycle helper.

#### Audio
- `src/audio/AudioMixer.ts` — Web Audio mixer with music/voice buses and ducking ramps.
- `src/audio/MusicPlayer.ts` — track manifest, mood-based selection, music-bus routing. Includes `defaultMusicManifest()`.
- `src/audio/ClipLibrary.ts` — Alan Jackson clip catalog by intent id, voice-bus routing with auto-duck. Includes `defaultClipManifest()`.

#### UI
- `src/ui/weatherscan/weatherscan.css` — Weatherscan-inspired skin (deep blues, LED readouts, focus outlines, high-contrast mode toggle).
- `src/ui/weatherscan/WeatherscanFrame.tsx` — header, live clock, alert banner, stage, bug.
- `src/ui/semantic/AnnouncementRegion.tsx` — polite + assertive aria-live regions; the source of truth for screen readers.
- `src/ui/scenes/CurrentConditionsView.tsx`, `HourlyForecastView.tsx`, `ExtendedForecastView.tsx`, `AlertsView.tsx` — scene renderers.
- `src/ui/mapnav/PlacesMode.tsx` — first map nav lens; arrow up/down walks the place list, current observation announced on focus change.
- `src/App.tsx` — wires all services together, registers keyboard shortcuts (←/→, Space, 1–4, M, ?, Esc), starts the loop, polls active alerts every 60 s, handles audio context unlock on first gesture.
- `src/main.tsx` — React entry.

#### Documentation
- `README.md` — overview, quick start, architecture, design rules, tech stack.
- `docs/architecture.md` — deeper architectural rationale.
- `TODO.md` — prioritized backlog.
- `CHANGELOG.md` — this file.

#### Assets
- `assets/music/` and `assets/clips/` placeholders with notes on what to drop in.

### Notes
- Audio assets (Alan Jackson narration, Weatherscan music) are user-supplied and not bundled.
- The radar pixel-sampling step that turns RainViewer tiles into a `RadarFrame` is not yet implemented — the client and helper are in place, the canvas sampler is the next radar task.
- Future map nav modes (Alert polygons, Radial, Storm cells, Raw radar) are designed but not yet built; v1 ships Places mode only.
