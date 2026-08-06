# Full codebase audit — August 2026

Four parallel deep-dives (audio/NWR/narration, themes/visuals, radar/map-nav, core app/a11y/data) over the whole of `src/` and `electron/`, cross-checked against `docs/*.md` and the on-disk `assets/` tree. This file is the synthesis; findings carry file:line evidence.

## Overall verdict

The architecture is genuinely strong — the data+speech scene snapshot contract, the semantic clip registry, the single-fetcher radar scanner, and the three-bus mixer are all well-designed and mostly well-executed. The problems are concentrated in three places: (1) a handful of silent-failure bugs that quietly break the app's core safety promises, (2) a visual layer where two one-line asset-path bugs gut the flagship themes, and (3) drift — dead code, stale comments, and duplicate truth tables that have diverged.

## Tier 1 — safety/correctness bugs that silently break core promises

1. **Alert poller pinned to boot-time home** (`App.tsx:354,429`). Changing home via Favorites never restarts the alert-polling effect — severe-alert interrupts, ticker, and OS notifications keep watching the OLD city until app restart. Highest-stakes bug found.
2. **Storms falsely announced "Stationary" ~80% of the time** (`StormScanner.ts:204-241` + `StormTracker.ts:67-74`). Scanner polls every 2 min but RainViewer publishes ~every 10; identical frames re-tracked → movement 0. One-line fix: gate on `frame.time`.
3. **"New storm" announcements silently suppressed** (`StormClusterer.ts:92-94`, `StormScanner.ts:254-295`). Positional ids (`storm_1` = nearest) shift when a new storm appears; dedupe eats exactly the announcement that matters. Needs stable tracker-minted ids.
4. **One failed grid lookup poisons the app until restart** (`WeatherService.ts:37-46`). Rejected grid-resolution promise is cached forever; all scenes read "unavailable" even after network recovery. Fix: evict cache entry on rejection.
5. **Scene error fallback crashes the app; no ErrorBoundary** (`SceneScheduler.ts:247-257` + `App.tsx:863-899`). `data: {error}` with real scene id → views cast and dereference → TypeError → white screen, total silence for a blind user. Add SceneErrorView + ErrorBoundary with spoken fallback.
6. **Help dialog unreachable by keyboard** (`KeyboardRouter.ts:87-106` vs `App.tsx:604-607`). `?` registers as `?` but Shift+/ produces spec `shift+?`. Its only trigger.
7. **NWR "failed" state is sticky** (`NwrPlayer.ts:238-242`, `App.tsx:724`). After 5 failed connects, re-picking the same station or network recovery never reconnects; only off/on toggle does.
8. **Wrong-state NWR auto-pick** (`nwrStations.ts:119-129`). City-only substring match: Columbus OH homes get Columbus GA radio. Match city+state.
9. **PhraseSequencer stale-handler race** (`PhraseSequencer.ts:126-138`). `onended/onerror` lack generation guards (MusicPlayer/NwrPlayer have them) → rapid scene changes can produce overlapping, unstoppable narration.
10. **Music un-ducks over narration** (`AudioMixer.ts:67-72` + `App.tsx:712`). Any settings change mid-narration (volume keys!) ramps music back to full under the voice clips. Mixer needs an `isDucked` flag.

## Tier 2 — a11y core weaknesses

- **AnnouncementQueue isn't a queue** (`AnnouncementQueue.ts:21,36`; `AnnouncementRegion.tsx:33,42`). Single `latest` slot; assertive announcements *erase* polite ones from the DOM (and vice versa). Also: repeating an identical announcement is silent (aria-live needs a mutation); `cancel()` is a no-op in the default live-region mode, so Escape's "silence speech" contract is TTS-only.
- **Arrow-nav hooks stay live under modals** (`useArrowGrid.ts:84`, `useArrowList.ts:67`, `App.tsx:807`). Window-level listeners + `inert` doesn't block them → arrows inside Settings selects are preventDefaulted and announce background scene cells.
- **TTS voice/rate settings exist but nothing reads them** (`SettingsStore.ts:28-30`).
- **Modal + Escape + focus-trap work (ModalDialog) is excellent** — keep as the pattern.

## Weather radio (NWR) assessment

Good: reconnect state machine is the strongest audio code — exponential backoff w/ cap, attempt reset on success, connect-timeout guard, clean teardown, status pub/sub with sensible announce policy (streaming/failed only). Bundled-snapshot + live IPC refresh station model is the right architecture.
Bad: sticky-failed (#7), wrong-state autopick (#8), live refresh only fires when Settings opens (`SettingsPanel.tsx:37`) — never-opens-Settings users ride the stale bundle; `onstalled` can trigger unnecessary reconnects during normal Icecast buffering; `updateLiveStations` wholesale-replaces the list (a partial Icecast response collapses the picker).
Web deployment: `crossOrigin="anonymous"` + WebAudio + no CORS headers on radio.weatherusa.net = playback fails in real browsers. Need a streaming proxy on the subdomain (same proxy covers `status-json.xsl`) OR a browser path that plays the `<audio>` element directly (element.volume instead of radio bus).

## Narration / audio stack assessment

Good: compose/sequence split (pure PhraseComposer, testable); semantic registry absorbing four narrators' folder chaos with confidence tiers from ~12k Whisper-transcribed clips; era-aware scene intros; longform-first period narration; generation-counter cancellation in MusicPlayer/NwrPlayer; assets on disk match manifests (spot-verified).
Bad: sequencer race (#9), duck clobber (#10); CCEF regex ordering bug (`PhraseComposer.ts:1034-1054`) — `shower` matches before `snow shower`, `rain` before `rain and snow` → wrong clips for wintry conditions in morning/evening blocks (CCSH blocks have correct ordering — confirmed defect); alert-tone fallback plays **Allan Jackson's voice** during Amy/Chandler/silent sessions (`PhraseComposer.ts:429-431` + `clipSchema.ts:57-59`); AlertTones bypasses sequencer serialization and ducking (`AlertTones.ts`); MusicPlayer error → infinite retry churn with no failure cap (`MusicPlayer.ts:168-171`); in tts/both announcer modes scene TTS speaks over clip narration (`App.tsx:292,345` — masked by the live-region default).
Narration completeness: AJ deepest (8 fully-composed scenes; temps −99..139, CC/CCSH/CCEF, qualifiers, 566 longform + 549 composites, AWIPS headlines). JC solid but **artificially degraded**: `Wind_And_Increasing/`, `Wind_And_Diminishing/`, `Wind_Dir2/`, `Wind_Speed/` exist on disk but are unmapped in JC_RESOLVERS (`semanticRegistry.ts:353-361` comment claims they don't exist). Amy = 9 verified intros; Chandler = intros only; silent = by design. Humidity/pressure/visibility, gusts, hourly time markers, alert detail sentences are aria/TTS-only even for AJ. `groupPhraseSchema.ts` (407 lines, multi-day summaries) is fully built and wired to nothing.

## Themes — visual completeness verdicts

Mechanism: CSS vars (`ThemeDef.vars` → `:root`) + `body[data-theme]` selectors + `--ws-bg-image` pools. Scene views are 100% theme-agnostic — fine for skinning, but every v1.0 authenticity item (LOT8s window frame, L-bar, WS3000 text pages, WS4000-v2 footer) is *structural* and needs a `(themeId, sceneId) → component` registry + per-theme frame variants before that work starts.

Per theme:
- **weatherstarxl — most complete.** Deepest chrome CSS (frame/header/readouts/clock/bug/LDL), cloud wallpapers. Model for what a finished skin looks like.
- **intellistar2 — partial.** Second-deepest CSS, 310-bg pool, HD icons; but real IS2 is a windowed LOT8s layout — current full-bleed shell is wrong-by-design (acknowledged in docs).
- **ws4000-v1 — partial.** Best per-scene background art (17 scenes); but no v1 frame/header CSS of its own, and see the font bug below.
- **ws4000-v2 — partial.** Real frame identity (orange→purple + cyan pane); missing footer bar, skewed header, radar chrome.
- **weatherscan-local / weatherscan-v1 — partial.** Font+photo differentiation only; all three Weatherscan CSS blocks are shared. Rich unused asset packs (curves, segment bgs, slides).
- **weatherscan-v2 — skeleton.** Differs from v1 by fonts+accent hex; the L-bar (the era's entire signature) unbuilt.
- **intellistar1 — skeleton+.** 254-bg pool + Interstate typography, but **every icon is a broken image** (see below).
- **ws3000 — skeleton.** ~4 era rules; still shows icons it never historically had; flat background (gradient dead — below).
- **wsjr — skeleton/wrong-by-design.** Visually a WS4000 clone with icons WSJr never had.

Cross-cutting visual bugs (all verified):
1. **Star4000 fonts never load** — `weatherscan.css:14-35` references `/assets/fonts/star4000.ttf` but files live at `/assets/fonts/star4000/star4000.ttf`. Flagship WS4000 typography silently falls to Lato (itself a Google-Fonts @import = network dependency; offline → Arial). One-line fixes.
2. **IS1 icons all 404** — `iconSet: "/assets/icons/large"` (`themes.ts:295`) + GIF fallback path, but that dir is 75 `.apng` with different stems. Same fallback 404s hit XL/IS2 for 6 wintry conditions missing from WEBP_MAP.
3. **Severe orange takeover defeated on XL / WS4000-v2 / IS2** — `.ws-frame.ws-severe` (css:390) loses specificity to `body[data-theme=...] .ws-frame` rules.
4. **High-contrast mode leaves photo wallpapers + hardcoded gradients in place** (css:207-214 only swaps colors) — yellow-on-photo for low-vision users.
5. **Stale per-scene background** — `App.tsx:286-289` never resets `--ws-bg-image` when a scene has no mapping; previous scene's art lingers.
6. **Dead base gradient** — `.ws-frame` shorthand gradient always overridden by the `--ws-bg-image` longhand; ws3000 renders flat.
7. **LDL tiny-icon guesses filename stems** (`LdlCrawl.tsx:77`) → broken img for unmapped conditions.
8. Dead severe bg pool (`backgroundCatalog.ts:116-129` — no caller passes `severe`), stale status-bar hotkey hints (`WeatherscanFrame.tsx:113-114`), `InterstateMono` referenced but no @font-face (files on disk), `akkopro-light` @font-face wired to nothing, 7 unpooled Weatherscan city bgs on disk (free win).

## Radar & map navigation assessment

Good: TileMath is textbook-correct (mercator, haversine, bearing, point-in-polygon); Marshall-Palmer inversion correct; single-fetcher scanner with inflight collapse and error-preserving snapshots; grid explorer's two-tier (instant probe + debounced geocode) announcement model is exactly right; strict canvas/semantic split.
Bad (beyond Tier-1 #2/#3): **MapNavView never subscribes to the scanner** (`MapNavView.tsx:81`) — storm list/canvas freeze at entry-time until a keypress re-render, indices unclamped when the list shrinks; radar animation manifest fetched once, never re-polled → stale loop after ~30-60 min; two uncoordinated async draw paths race one canvas; **five duplicate intensity band→label/color tables that disagree** (canvas legend calls #ffcc00 "Heavy", markers use it for moderate) while `IntensityLegend.ts` — the documented single source of truth — is dead code; `snow=1` requested in tile URLs but no snow palette → winter precip misclassified; grid explorer says "Clear" beyond the 150-mi data radius (indistinguishable from actual clear) and phrases a cell up to 10 mi away as "at this location"; range rings' mile labels are uncalibrated; alerts fetch has no `.catch` (failure reads as "no alerts").

Can it be better — yes, and the seams already exist:
- `RadarFrame.source` is already typed `"rainviewer" | "mrms"`; clusterer/tracker consume cells, not tiles. A second sampler (MRMS PrecipRate via Iowa State Mesonet tiles, fetched in the Electron main process like NWR already is) drops in without touching downstream. Best long-term: NEXRAD Level-3 SCIT storm-attribute products — authoritative cell ids, motion, hail probability, TVS — replacing the weakest links (palette reversal + blob clustering + 2-point tracking) with ground truth.
- rbush R-tree over cells (rebuilt once/2 min) makes `probeAt` O(log n) and enables "jump to nearest precipitation" — the missing command that currently costs dozens of "Clear." presses.
- Closest-point-of-approach = ~5 lines with existing primitives → "will pass 12 miles north of you at 3:40".
- Sampling the already-fetched nowcast frames answers "will it rain here in 30 minutes" in grid mode.
- Multi-frame track smoothing (last 3-4 frames) kills ETA jitter.
- County/zone-geometry fallback for the many alerts with `polygon: null` (currently invisible to grid mode).

## Core app / data layer

Good: SceneScheduler generation guards + narration-gated advance; NwsClient retry/backoff/Retry-After (TODO claims it doesn't exist — it does, and it's good); SunCalc accurate; SettingsStore migrations; Electron security posture (contextIsolation, sandbox, minimal typed bridge); audio-unlock state machine; ModalDialog.
Bad: App.tsx is a god file (service construction, 200-line keyboard effect, a full alert-polling engine, audio unlock, and a per-scene-id narration dispatch chain that ignores the `jacksonCue` field every scene dutifully sets); `buildServices()` in `useMemo` under StrictMode double-constructs AudioContexts; **PlacesStore.upsert mutates in place** → same array identity → React bails → newly added ZIP invisible until another action (`PlacesStore.ts:31-37`); first-run hard-codes Greeneville TN; localStorage is origin-scoped (dev vs packaged app have separate settings — the real argument for userData persistence); WeatherService has no stale-while-error and no fetchedAt (can't say "as of 10 minutes ago"); observation uses only `stations[0]` with no fallback when it reports nulls; no CSP meta and no `setWindowOpenHandler`/`will-navigate` guard; tray icon empty in prod because `dist/assets/...` never exists (assets gitignored + dev-only middleware) and `createFromPath` returns an empty image rather than throwing.

## Dead code & stale docs inventory

Dead: `groupPhraseSchema.ts` (407 lines), `core/places/TravelCities.ts`, `IntensityLegend`/`buildRadarFrame` chain, `jacksonCue`/`musicCue` fields, `announceLiveRegionOnly()`, `KeyboardRouter.setEnabled`, severe bg pool, `akkopro-light` @font-face, ~large orphaned asset dirs (see themes audit §6).
Stale docs: TODO says NWS retry/backoff missing (shipped), PlacesStore doesn't persist (it does — localStorage `awc.places.v1`); PhraseComposer header claims runtime TTS fallback (removed); semanticRegistry comment claims legacy getters in use (aren't); JC wind-dir comment claims dirs absent (present on disk); AlertsScene docstring claims upstream skip-when-empty (not implemented); architecture.md's IntensityLegend invariant (violated by five divergent tables).

## Prioritized "hone what's here" plan

Phase 1 — trust (small diffs, big safety): alert-poller home fix; radar frame-time gate + stable storm ids; WeatherService rejection eviction + stale-while-error; ErrorBoundary + SceneErrorView; `?` shortcut; NWR un-stick + state-aware station match; PhraseSequencer generation guards; AudioMixer duck flag; CCEF regex ordering.
Phase 2 — a11y core: real AnnouncementQueue (two slots, dedup-breaking mutation, working cancel, resume-after-assertive); modality gate shared by KeyboardRouter + arrow hooks (fixes modal arrow bleed); wire ttsVoice/ttsRate; MapNavView subscribe + clamp.
Phase 3 — visual quick wins: Star4000 font paths; IS1 icon set + wintry WEBP gaps + ws3000/wsjr icon hiding + LDL stem guard; severe-takeover specificity; high-contrast background neutralization; scene-bg reset; unify all intensity tables through IntensityLegend; cheap authenticity (7 city bgs, severe pool, curve overlays, ws3000 color fields, status-bar hints).
Phase 4 — structure for what's next: extract bootstrap/AlertWatcher/shortcuts from App.tsx; `(themeId, sceneId) → component` registry + per-theme frames (prereq for LOT8s/L-bar/WS3000 renderers); Vitest on SceneScheduler/KeyboardRouter/AnnouncementQueue/PhraseComposer guess functions; delete dead code, fix stale docs.
Phase 5 — web prep (weather.codyhurst.com): NWR streaming + status proxy decision; production asset serving (Electron custom protocol + trimmed web asset set); first-run ZIP flow (replaces Greeneville default; the PlacesStore/zipLookup pieces exist); persistence to userData in Electron.
