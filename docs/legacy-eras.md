# Legacy WeatherStar / IntelliStar Eras — Visual Layout Research

Authoritative reference for five theme families that sit outside the Weatherscan
trio covered in `weatherscan-eras.md`: **ws3000**, **ws4000**, **wsjr**,
**intellistar1**, **intellistar2** (HD + Jr HD).

**Status (2026-04-15):** research phase. No code changes yet. This document
captures what we can verify from authentic sources; everything marked ⚠️ or
"unverified" must be confirmed against broadcast stills before it becomes code.

**Source access note:** twcarchive.com (the richest broadcast-stills archive)
returned HTTP 403 to every automated fetch attempt during this research pass.
Findings below draw from Wikipedia, HandWiki, twcclassics.com, and Fandom
search snippets. Pixel-exact positioning for most scenes is **not** in any
text source — those coordinates need to be lifted from aircheck frames before
we build. Open twcarchive.com pages in a browser and capture relevant stills
manually to close those gaps.

---

## Critical correction to current code

`themes.ts` comments WeatherStar Jr as "mirrors WS4000's loop — same set of
scenes, just a lighter-weight hardware skin." **This is wrong.** Three
independent sources confirm WSJr is a **WeatherStar 3000 layout with WS4000
font** — not a WS4000 variant:

- Wikipedia: *"featured the same products used by the Star III, but utilized the typeface used by the 4000."*
- TWC Classics: *"Flavor line-ups and screen layouts match the former WeatherSTAR 3000 perfectly."*
- TWC Classics: *"A graphics display unit identical to the WeatherSTAR 3000 but with a cleaner font."*

Implications for our implementation:

- **No local radar on WSJr** — remove "radar" from `THEME_CORE_SCENES["wsjr"]`.
- **No cartoon icon on Current Conditions** — text-only labeled-field page.
- **No 3-day graphical Extended** — WS3000-style text Extended instead.
- **No graphical moon-phase Almanac** — text-only.
- **No regional-map Travel screens** — text tables.
- WSJr should share most of its scene renderers with WS3000, not WS4000.

---

## Era 1 — WeatherStar 3000 (1988–1990)

**Hardware:** TWC's pre-WS4000 local unit. Text-only raster.
**Narration:** None. Only a single alert tone for warnings.
**Typography:** Blocky uppercase pixel font (shipped as "Star3000").
**Global chrome:** No persistent clock, logo, or city bug. No borders. Each
scene fills the screen with labeled text on a solid color field. Background
color is scene-dependent, not constant.

### Confirmed facts
- No radar, satellite, or weather icons of any kind. [Wikipedia; HandWiki]
- Decorative animated backgrounds phased out by 1988. [TWC Classics]
- Advisories scrolled on **tan/brown** background; warnings on **red**. [HandWiki]
- Warning tone only — no narration track. [Wikipedia]

### Scenes

**Current Conditions ("Latest Observations")** — **purple** background.
Fields: weather state, winds, barometric pressure, temperature, visibility,
dewpoint, heat index / wind chill, monthly precipitation accumulation. ⚠️
Exact label/value positioning (label-left value-right rows) inferred from
convention, not confirmed from a broadcast still.

**Local Forecast ("36 Hour Forecast")** — **grey** background. NWS zone
forecast paragraph rendered as wrapped prose. Title line at top (`36 HOUR
FORECAST`), `TONIGHT` / `TOMORROW` subheads, body text below. No columns.

**Extended Forecast** — purple background. **3 columns** (Mon/Tue/Wed, or the
three days after the 36-hour window). Each column: day name, descriptor,
`HI nn`, `LO nn`. Not 5 columns — **WS3000 never had a 5-day Extended.**

**Almanac** — fields: sunrise, sunset, monthly average high/low, monthly
average precipitation. Coastal markets swap in a Tides page with two tide
locations (high/low times) plus sunrise/sunset. ⚠️ Column arrangement
inferred, not confirmed.

**Travel Cities / Regional** — three distinct products:
- *Regional Conditions:* 7–10 cities, current temp + sky text per row.
- *Latest Hourly Observations (nearby):* 7 nearby cities, weather/temp/wind per row.
- *Travel Cities Forecast:* major US cities, columns for condition / LO / HI. Added 1989 as scrolling satellite feed on **black** background.

### Not carried
Radar, satellite, maps, icons, weekend forecast, hourly.

---

## Era 2 — WeatherStar 4000 (1990–2014 in some markets)

**Status (2026-04-15):** split into two theme variants in `themes.ts`:
- **`ws4000-v1`** — 2001–2004 look (flat orange header, solid blue content, no footer)
- **`ws4000-v2`** — 2005–2009 look (skewed orange header, floating cyan-glow pane on orange-to-purple gradient, always-on footer, light-basemap radar)

Both share scene lineup, fonts, icon set, music pool, and narrator. Layout deltas measured from `docs/reference/ws4000/` captures the user supplied.

**Hardware:** TWC's first local unit with rendered graphics (radar, icons, maps). Kept in smaller markets until the 2014 analog feed shutdown.
**Narration:** Dan Chandler through 1995, then Allan Jackson.
**Typography:** Star4000, Star4000 Extended, Star4000 Large (LED), Star4000 Small.
**Music bed:** Trammell Starks *Music for Local Forecast* (1995 catalog) for flagship Local on the 8s segments.
**Icon set:** 1998 cartoon set — confirmed in-repo `assets/icons/1998/` matches both v1 and v2 broadcast captures. Icon set did **not** change between v1 and v2.

### v1 vs v2 deltas (measured from reference captures)

| Element | v1 (2001-2004) | v2 (2005-2009) |
|---|---|---|
| Frame background | Solid blue gradient (top light, bottom dark) | Orange-to-purple vertical gradient |
| Content pane | Full-bleed with cyan inner border | Floating rounded rect, cyan glow + drop shadow |
| Header strip | Flat orange band + dark-blue triangle cut right | Skewed/parallelogram orange band over narrow dark-blue band |
| Footer bar | None | Always-on full-width bar with contextual data ("Conditions at \<city\>", month precipitation, current obs snippet) |
| Current Conditions fields | Humidity / Dewpoint / Wind / Barometer / Visibility | Humidity / Dewpoint / **Ceiling** / Visibility / **Pressure with trend arrow**; Wind moves to left column; city moves to right column top |
| Radar chrome | Dark-blue gradient strip, cyan "Current Radar" title, 4-color intensity legend | Pink/purple gradient strip, white "Local Radar" stacked title, 7-step "PRECIP" legend + "Incomplete Data" pink swatch |
| Radar basemap | Dark navy with cartoon interstate shields and script city labels | Off-white map with red state borders, black borough outlines, light-blue water |
| Almanac background | Orange top half + purple bottom half (split background unique to Almanac) | **Unknown** — no v2 Almanac capture yet |
| Travel Cities | **Unknown** — no v1 Travel capture yet | Dark purple bg (no orange gradient), city-yellow / icon-center / LOW-HIGH-yellow right |

### v1 scene captures in repo
`docs/reference/ws4000/4000-v1-{3DayOutlook,Almanac,CurrentConditions,Forecast1,Intro,LatestObservations,Radar}.jpg` — 7 scenes covered.

### v2 scene captures in repo
`docs/reference/ws4000/WS4000_Simulator_v2_-_{Current_Conditions,Extended_Forecast,Latest_Observations,Local_Radar,Travel_Cities_Forecast}.jpg` — 5 scenes covered. **Simulator-sourced**, not raw broadcast (user flagged). Detail level suggests authors had broadcast source material; treat as reliable reference with that caveat logged.

### Confirmed (both eras)
- Extended Forecast is **3-day graphical** (Feb 1991 redesign, never 5-day for WS4000). Applied via `extendedStyle: "3-day"` — new value added to the `ExtendedStyle` union.
- Current Conditions uses icon-left / fields-right layout with a hero city name in yellow Star4000 Extended.
- All caps narrative text on Local Forecast, sourced from NWS with `...` separators.
- Weather icons are the 1998 cartoon set (fog-with-dot-eyes, layered cloud+sun, diagonal-rain clouds, cloud+lightning).
- Yellow/gold = titles, day-of-week, city names, Lo/Hi labels, LOW/HIGH column headers. White = body, temps, narrative text.

### Remaining gaps for WS4000 (both eras unless noted)
- **v1 Travel Cities** — no capture yet. Likely text-and-icon table on solid blue; defer until proven.
- **v2 Almanac** — no capture yet. Unknown whether the v1 orange/purple split bg carried forward or was replaced with the v2 orange-to-purple frame gradient.
- **v2 Local Forecast** — no capture yet. Likely narrative text in the floating pane with footer showing current temp/conditions, but not visually confirmed.
- **v2 Intro splash** — no capture yet; v1 uses the orange-to-purple wordmark splash, may or may not have survived into v2.
- **Radar with active precipitation** (either era) — all captures are dry days; we can infer the intensity legend colors but haven't seen a storm-active radar frame to measure tile rendering.
- **Moon-phase photos used in v1 Almanac** — we have moon phase icons at `assets/themes/weatherscan/backgrounds/local-era/moon/` but haven't validated they match the broadcast photo set used in 2001-2004.

### Pre-2001 / post-2009 WS4000 eras
- Earlier (1990–2000) — no captures in repo; TWC Classics timeline page lists the 1991 redesign dates but has no stills. A "v0" era covering the earliest WS4000 look could be added later if captures surface.
- Later (2010–2014) — WS4000 ran in some small markets until the 2014 analog shutdown, but most markets had migrated to XL / IS1 / IS2 by then. Era likely doesn't need a separate theme.

### Narration note (3-day / 5-day reconciliation)
Narrator audio clips are tagged by era in `narratorSchema.ts` using the buckets `"5-day"` and `"7-day"`. The new `"3-day"` ExtendedStyle value is a **visual-only** tag — `App.tsx` passes `"5-day"` to the composer when the visual style is `"3-day"` so "Your Extended Forecast" narration is reused. This avoids retagging 50+ clip entries. Revisit if we ever want narration distinct from visual count.

### Background timeline (for reference)
- **Feb 14, 1991** — Almanac redesign (formerly "Regional Information") added graphic moon phases.
- **Feb 20, 1991** — Extended became 3-day graphical format.
- **Apr 17, 1991** — Current Conditions gained the large weather icon (renamed from "Now at (City)").
- **Nov 18, 1992** — Local radar with 6-image loop added (J, K, M flavors).
- **Aug 1, 1994** — Radar upgraded to 8 intensity levels.

---

## Era 3 — WeatherStar Jr (1993/94–2014)

**Hardware:** Wegener budget unit for small cable/SMATV headends.
**Narration:** Not source-confirmed as Allan Jackson — treat current theme default as tentative.
**Typography:** Star4000-family (our `StarJR.ttf` — very close to Star4000).
**Music bed:** Shared Trammell Starks pool with WS4000 flagship.

### This is a WS3000 in a WS4000 font
See "Critical correction" above. Inherits WS3000 product lineup, layouts, and
background color semantics (blue = normal, red = warning, tan = advisory). The
font swap is the **only** WS4000 DNA present.

### Flavors (from TWC Classics — canonical)
- **D (1 min):** Latest Observations → Almanac → 36-Hour Forecast → Regional Conditions
- **E (1 min):** 36-Hour Forecast → Extended Forecast → Latest Observations
- **L (2 min):** Current Conditions → Latest Observations → Regional Conditions → Regional Forecast → Almanac → 36-Hour Forecast → Extended Forecast
- **M (2 min):** Current Conditions → 36-Hour Forecast → Extended Forecast → Travel Cities Forecast

### Scenes (all inherit WS3000 text-page look rendered in the 4000-era font)

**Current Conditions** — text page. Labeled fields on solid blue. **No large icon.**

**36-Hour / Local Forecast** — text narrative on blue. Not animated.

**Extended Forecast** — multi-day text blocks (WS3000 style), not the WS4000 iconized 3-column graphical page.

**Local Radar** — **not present.** WSJr has no on-unit radar.

**Almanac** — text-based sunrise/sunset/records. No moon-phase graphic.

**Travel / Regional** — text tables. No regional map.

### Must-do adjustments in our code
- Drop "radar" from `THEME_CORE_SCENES["wsjr"]`.
- Reroute WSJr scene rendering to share WS3000 components, not WS4000.
- Update `themes.ts` narrator default from `allan-jackson` to something documented or flag as uncertain.

---

## Era 4 — IntelliStar 1 (2003–2013, SD)

**Hardware:** First IntelliStar; FreeBSD; rolled out first on Weatherscan Feb 2003, reached TWC proper early-mid 2004. Retired Nov 2014.
**Narration:** Jim Cantore was the on-air voice in many markets.
**Typography:** **Interstate** (not Akzidenz-Grotesk as the current theme defines). Chrome/titles used Interstate from launch.
**Music bed:** IS1-exclusive production-music catalog (Becker, Chaquico, Cooling, Howard, Hughes, Sample).

### Five distinct visual eras across IS1's lifespan

| Date | Change |
|---|---|
| Feb 2003 | Launch on Weatherscan. Typeface Interstate from day one. |
| Jul 2004 | "Black bar" LDL added for DirecTV national segments. |
| Dec 12, 2006 | New proprietary TWC icon set replaced 1998 set. |
| **Oct 23, 2007** | Major facelift ~3:18 AM ET: new title bars, light-blue sky background with bright sun upper-right, body text switched **white → dark blue**, slide transitions replaced with fades, Current Conditions renamed **"Now"** (consolidated Latest Observations + Regional + Metro Conditions), Regional Radar → **Regional Doppler**, Local Radar → **Local Doppler**. |
| Jun 2, 2008 | LDL redesign: blue background, font **Interstate Regular → Helvetica Neue**, tabs added as rundown, smaller icons, scroll-down appearance animation. |
| Mar 11, 2010 | Animated weather.com-derived icons. 50-city forecast in LDL, yellow-shaded tabs. |
| Nov 12, 2013 | Flat mobile-style icons, new backgrounds, time bar, summary product combining obs + daypart. LDL on constantly except during Local on the 8s. |

A single "intellistar1" theme cannot capture all of this. Recommend treating
the 2007 facelift as the visual default (mid-life, most years on-air) and
documenting the pre-2007 and post-2013 variants as future optional flavors.

### Chrome
- Sep 2005 Weatherscan redesign parallel: main panel reduced to a smaller but still prominent window upper-middle. Borrowed to IS1 engine for Weatherscan, but the IS1 TWC-channel chrome is **not documented** in my sources as having the same L-bar structure.
- **Persistent IntelliStar HQ bug / clock-with-seconds overlay: NOT documented in retrieved sources.** Do not add until verified from an aircheck.
- "L.F.D." lower strip: no source attributes this label to IS1. Leave out.

### Scenes (products confirmed; pixel layouts not)
1. **Now (post-2007) / Current Conditions** — full-screen segment, cycles through Latest Observations, Regional, Metro Conditions within one slot. Hero with icon + temp + place for primary location.
2. **Latest Observations / Metro Conditions** — map-based with icons; Metro excludes wind.
3. **Regional Conditions** — 7–10 cities with temp + sky.
4. **Daypart Forecast** — four 24-hour time periods.
5. **12-Hour / 24-Hour Metro Forecast** — map-based, 7–11 cities.
6. **Local Forecast (narrative)** — 24–48h text, NWS pre-Apr 2002, TWC in-house after.
7. **Extended / Week Ahead / 7-Day** — map-based, icons + hi/lo, short narration of week's highs/lows.
8. **Local Doppler / Regional Doppler** — 3-hour loops; satellite substitution in coastal markets.
9. **Almanac** — listed as a product. **Layout not in any retrieved source.** Pull from airchecks.
10. **Air Quality** — color-coded index, one or three locations (metro markets).
11. **Travel / Getaway / Traffic** — Getaway Forecast, Traffic Flow / Traffic Incident (Traffic Pulse 2005–2010).
12. **Alerts** — full-screen vertical scroll. **Brown = advisory, red = warning.**

### Must-do adjustments in our code
- Fix typography: current theme lists `AkzidenzGroteskBE` for display. **Change to Interstate** (we already have Interstate in `assets/themes/weatherscan/fonts/`).
- Update narrator default research — Jim Cantore era-correct for IS1 (currently correct in `themes.ts:236`).
- Decide whether single theme covers 2007 facelift or separates pre/post-2007. Suggest single "intellistar1" = 2007-era look (longest-running variant) and deferring earlier/later as optional flavors.
- Alert color-code: brown advisory / red warning — wire into severe-interrupt rendering.

---

## Era 5 — IntelliStar 2 HD + IntelliStar 2 Jr HD (2013+)

**Hardware:** Windows XP Embedded, C#/F#, Vizrt Viz Artist / Viz Engine renderer, 1080i HD. IS2 Jr HD is the smaller-market variant (SD/letterboxed native; IS2 **xD** is the later dual-res unit). Nov 12, 2013 Trollbäck+Company "Enhanced" rebrand introduced the flat-style HD icon set and new product-box chrome used through the HD era.
**Narration:** Jim Cantore (temporarily disabled at 2013 launch, restored Dec 17, 2013).
**Typography:** **Interstate** (confirmed). Claim of "thin Frutiger for giant cinematic temp" is **not documented in retrieved sources.**
**Music bed:** IS2 HD-exclusive production music.

### Chrome (verified verbatim from TWC Archive via search)
- **Main window** fills the left two-thirds of the screen with the active product.
- **TWC logo + "Local on the 8s" logo** sit above the main window, attached to a box showing the **city name and current time** — single attached element, not corner-opposite.
- **Right sidebar "dial"** at center-right cycles supplementary products (visibility, dew point, pressure, airport delays, air quality, almanac).
- **Rundown list** below the main window shows up to four upcoming products with a **progress bar that fills as the current segment plays**.
- **Product icon** next to rundown (thermometer = CC, radarscope = radar, etc.).
- **LDL (Lower Display Line)** runs full-width across the bottom.

### Correction to our assumptions
**The "cinematic full-bleed giant-temp" look is NOT IS2 HD** — that's the later 2018+ Weatherscan/IS2 xD style. IS2 HD renders Current Conditions **inside a windowed panel within the LOT8s frame**. Our `intellistar2` theme implementation should reflect the windowed LOT8s structure, not a full-bleed hero.

### Scenes
1. **Current Conditions** — main-window windowed panel, thermometer product-icon next to rundown. Cycles primary location with icon, temp, place, condition.
2. **36-hour / Hourly** — IS2 HD product list includes *12-hour forecast graph* and *24-hour descriptive*. A separate "36-hour horizontal strip" is **not confirmed** — do not invent.
3. **7-day / Extended Forecast** — confirmed product; column count/art **not confirmed**.
4. **Local Forecast narrative** — Vocal Local narration assembles pre-recorded audio (Cantore) over the narrative product.
5. **Local Doppler radar** — 3-hour loops for region + metro. **Renders inside LOT8s windowed frame**, not full-bleed with overlay.
6. **Almanac** — average and record min/max temperatures with year first set; sunrise/sunset on **analog clock graphic (white=sunrise, black=sunset)**; moon phase.
7. **Travel Cities / Regional** — post-2013 status as a standalone scene is **unverified**. Regional forecasts run via sidebar rundown. Travel Cities Forecast appears in IS1-era flavor docs but not confirmed post-rebrand.
8. **LDL crawl** (always on for IS2 HD) — current weather + 5-day forecast for up to four cities including the local observation site.
9. **Severe weather** — single-line crawl over the LDL: red box left with alert type, alert contents crawl beside it. Yellow variant for severe-T-storm / tornado watches, orange for special weather statements / other NWS advisories. **Clock and current temp box remain visible during alerts.** Full-bleed red/orange takeover is the TOR / Tornado Emergency tier — not the default alert treatment.

### IS2 HD vs IS2 Jr HD (only confirmed layout delta)
**IS2 Jr HD does not render its own LDL during national (network) segments — only the warning crawl appears.** The full IS2 HD carries the LDL continuously. Beyond that, Jr has no native HD output (SD/letterboxed) so chrome is downscaled. Scene lineup is otherwise identical. Our current single-theme treatment is defensible **if** we branch LDL rendering: continuous on `is2-hd`, warning-only-during-national on `is2-jr`. Consider splitting to two theme ids or adding a sub-mode flag.

### Must-do adjustments in our code
- Redesign `intellistar2` frame: windowed main panel + right-sidebar dial + rundown with progress bar, not the current generic full-bleed shell.
- Revise Almanac component to support an analog-clock sunrise/sunset graphic for IS2.
- Wire severe-weather chrome: red/yellow/orange left box + crawl, NOT full-bleed takeover.
- Consider splitting `intellistar2` into `intellistar2-hd` and `intellistar2-jr` for the LDL delta.

---

## Asset inventory vs. per-era needs

Legend: ✓ covered · ⚠️ partial · ✗ missing

### Fonts
| Era | Need | Status |
|---|---|---|
| WS3000 | Star3000 family | ✓ `assets/fonts/star3000/` |
| WS4000 | Star4000 family (incl. Large LED, Extended, Radar) | ✓ `assets/fonts/star4000/` |
| WSJr | StarJR family | ✓ `assets/fonts/starjr/` |
| IS1 (2003–) | Interstate, Helvetica Neue (LDL post-2008) | ✓ Interstate in `assets/themes/weatherscan/fonts/` · ✓ `assets/fonts/helvetica/` |
| IS2 HD | Interstate | ✓ same as above |

### Icons
| Era | Need | Status |
|---|---|---|
| WS3000 | None (text-only) | n/a |
| WS4000 | Cartoon cloud set (1990-era), regional forecast icons | ✓ `assets/icons/legacy/1990-regional/`, `1991-april-cc/`, `1991-ef/`, `ccef/` — rich coverage |
| WSJr | None (text-only) | n/a |
| IS1 2003–2006 | 1998 icon set | ✓ `assets/icons/1998/` (90 files) |
| IS1 2006–2010 | Dec 2006 proprietary TWC set | ⚠️ likely covered by `2006/` (86 files) but needs verification against broadcast stills |
| IS1 2010–2013 | weather.com animated icons | ⚠️ `assets/icons/dashboard/`, `spritesheets/`, and top-level animated GIFs may cover — audit needed |
| IS2 HD 2013+ | Flat-style HD icon set (Trollbäck rebrand) | ⚠️ `68x68/` and `42x42/` WebP sets exist — need to confirm they are the 2013 flat set, not pre-rebrand |

### Logos / chrome art
| Era | Need | Status |
|---|---|---|
| WS3000 | None | n/a |
| WS4000 | Title banners (built into renderings; no separate logo) | n/a |
| IS1 | TWC logo, IntelliStar HQ bug | ✓ `logos/twc/TWC_Logo.png`, `logos/intellistar/IntelliStar_HQ.png` |
| IS2 HD | TWC logo, "Local on the 8s" logo, product icons (thermometer, radarscope, etc.) for rundown | ✓ TWC logo · ✗ LOT8s logo · ⚠️ `logos/lot8/LOT8sLogo.webp` exists — verify it matches post-2013 style · ✗ product-icons for rundown |

### Backgrounds
| Era | Need | Status |
|---|---|---|
| WS3000 | Solid color fields (purple CC, grey LF, blue normal, red warning, tan advisory) | n/a — render as CSS colors |
| WS4000 | Blue gradient with orange/gold accent bars; radar base map | ✓ `backgrounds/BackGround1.png` + variants · ✓ `backgrounds/4000RadarMap*` · ⚠️ accent bars need to be layered in CSS |
| WSJr | Same solid color fields as WS3000 | n/a |
| IS1 2003–2007 | Inherited XL cloud/sky background | ✓ XL backgrounds available |
| IS1 2007+ | Light-blue sky bg with bright sun upper-right | ⚠️ need to confirm a 2007-facelift background asset exists |
| IS2 HD | Darker blue gradient LOT8s framing, sidebar dial art, rundown chrome | ✗ **missing LOT8s frame shell** — this is the biggest asset gap |

### Radar
| Era | Need | Status |
|---|---|---|
| WS3000/WSJr | None | n/a |
| WS4000 | 6-level (pre-1994) then 8-level intensity legend | ⚠️ legends not explicitly in inventory — confirm with `ls assets/backgrounds/*radar*` |
| IS1 | Local + Regional Doppler overlays, 3-hour loop tiles | ✓ `logos/noaa.gif` for NWS attribution · ⚠️ overlay chrome specific to IS1 era needs confirmation |
| IS2 HD | LOT8s-framed Doppler window | ✗ frame shell missing |

---

## Code-level fixes landed so far

- ✓ **WSJr scene order** — `radar` removed from `THEME_CORE_SCENES["wsjr"]`.
- ✓ **IS1 font family** — swapped Akzidenz-Grotesk → Interstate in theme vars.
- ✓ **WSJr narrator** — flagged as uncertain in theme comment pending aircheck confirmation.
- ✓ **WS4000 split** — single `ws4000` theme split into `ws4000-v1` and `ws4000-v2` in themes.ts, CSS, SettingsStore migration, backgroundCatalog. `extendedStyle: "3-day"` added to the union and wired through ExtendedForecastScene.
- ✓ **WS4000 v2 frame CSS** — orange-to-purple gradient background + floating cyan-glow content pane rendered in `weatherscan.css` under `body[data-theme="ws4000-v2"]`.

## Code-level discrepancies still to fix (pending captures / implementation)

- **WSJr shares WS4000 CSS** — layout mirrors WS4000 in `weatherscan.css:913-940`; should mirror WS3000 text-page look. Blocked on building a WS3000 text-page renderer first.
- **WS3000 `extendedStyle`** — currently `"5-day"` in themes.ts; should be `"3-day"` per research. Not captured yet so deferring the flip until we have a WS3000 Extended still to confirm.
- **IS2 frame structure** — generic full-stage panel; IS2 HD is a windowed LOT8s layout with right-sidebar dial + rundown progress bar. Blocked on IS2 HD full-frame captures.
- **IS2 Jr LDL behavior** — no branching for "LDL off during national programming". Either add conditional to LdlCrawl or split the theme. Blocked on IS2 Jr captures.
- **IS1 sub-era splits** — IS1 had 2003 launch look → Oct 2007 "Now" facelift → Nov 2013 rebrand. Current single `intellistar1` theme cannot represent all three. Blocked on post-2007 and post-2013 captures.

---

## Recommended implementation order (post-research)

Progress: themes.ts now defines `ws4000-v1`, `ws4000-v2`, and `intellistar1` with
Interstate typography. `extendedStyle: "3-day"` wired for WS4000 v1/v2. WSJr's
scene order dropped `radar`. WS4000 v2 frame CSS rendered (gradient + floating
pane). No scene-level renderer redesign yet — the six component-level layout
tasks below still depend on captures.

### Unblocked by existing captures

- **WS4000 v1 Current Conditions hero layout** — icon-left / fields-right restructure per `4000-v1-CurrentConditions.jpg`. 5 fields (Humidity, Dewpoint, Wind, Barometer, Visibility). City name in yellow top-right.
- **WS4000 v2 Current Conditions variant** — same structure but with Ceiling added, Pressure-with-trend-arrow, Wind moved to left column. `WS4000_Simulator_v2_-_Current_Conditions.jpg`.
- **WS4000 3-day Extended panels** — 3 vertical columns, louvered blue gradient, day / icon / condition / Lo/Hi / temps.
- **WS4000 v2 always-on footer bar** — pure CSS + a per-scene data slot. Needs a new `WeatherscanFrame` prop for the footer content string.
- **WS4000 Local Forecast** — all-caps NWS narrative on the floating pane (v2) / solid blue (v1).
- **WS4000 v2 Radar chrome** — pink/purple header strip with expanded PRECIP legend. Separate from v1's cyan title + dark chrome.

### Blocked on captures still missing

- **WS3000 text-page renderer stack** — have one CC still (Willow Grove). Need LF (grey bg), Extended (purple, 3-column), Almanac, Regional, Travel.
- **WSJr** — have none. Research says it's WS3000 layout + WS4000 font; one CC capture would confirm and unlock.
- **IS1 post-2007 "Now" facelift** — our IS1 captures are all pre-facelift. Need light-blue sky bg with dark-blue text stills to unlock `intellistar1-2007` theme.
- **IS1 2013 rebrand** — flat-icon era, brief (~1 year). Optional `intellistar1-2013`.
- **IS2 HD LOT8s full frame** — biggest single blocker. Need a still showing main-window-left + sidebar-dial-right + rundown-progress-bottom + LDL to build the frame component.
- **IS2 Jr LDL-off-during-national** — need a national-programming still on Jr to confirm the delta.
- **Alert chrome variants** — per-era alert overlay styles (brown/red WS3000-WSJr, brown advisory/red warning IS1, red/yellow/orange left-box IS2).

### Theme granularity decisions (still owned by user)

- [x] **WS4000** — split into v1 + v2 (complete).
- [ ] **IS1** — three sub-eras (2003, 2007, 2013) or pick one canonical? Awaiting captures before committing.
- [ ] **IS2** — split HD + Jr into two themes, or flag? Awaiting LDL-behavior confirmation.
