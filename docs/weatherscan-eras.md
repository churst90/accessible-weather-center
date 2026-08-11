# Weatherscan Eras — Visual & Platform Research Notes

Authoritative reference for the three Weatherscan themes. Sources: Wikipedia,
HandWiki, TWC Archive fandom wikis, weatherscan.net V1/V2 simulators,
JesseWx2011/Weatherscan-Local-Sim and mewtek/OpenStar asset dumps, in-repo
asset inventory.

**Status (2026-04-15):** theme split complete. Three themes shipped:
`weatherscan-local`, `weatherscan-v1`, `weatherscan-v2`. Each has its own
era-scoped background pool, typography, and music pool. Remaining build work
is tracked at the bottom of this doc.

---

## Era 1 — Weatherscan Local (1999 – Feb 28 2003)  — ✓ shipped

**Platform:** WeatherStar XL. Hardware unit at the cable headend, IRIX OS.
**Launch:** March 31, 1999, originally named "Weatherscan Local."
**Music:** Trammell Starks *Music for Local Forecast* (1995 catalog). Identical pool to the TWC flagship channel's Local on the 8s.
**Typeface:** Akzidenz-Grotesk (outer chrome) plus the XL's bitmap display type.

### Chrome
- Faux-letterbox graphics set — a windowed content area framed by colored borders
- **Lower Display Line (LDL)** at the bottom ~10% of the screen showing rotating current observations and a text ad crawl
- Mid-era refresh (May 2000): "new distinctive graphics set" — LDL observation summary removed, ad crawl retained
- Feb 2003 (final weeks of the era): **Upper Display Line (UDL)** added with rudimentary observation + forecast summaries

### Backgrounds
- **Regional themed** — different bg pools for "densely populated areas, smaller markets and suburbs, coastal, desert." The viewer's background matched the market the unit was installed in.
- **No skyscraper cityscapes yet.** Neighborhoods, nature, generic regional scenes.

### Scene lineup
Mostly mirrored TWC's domestic XL layout. Core package only — no activity add-ons yet.

### Assets we have
- `assets/music/Trammell Starks - Music for Local Forecast (3 disk set) 1995/` (3 disks, full catalog) ✓
- `assets/fonts/akzidenz-grotesk/` ✓
- **Authentic pre-2003 "neighborhood" regional theme pack** under `assets/themes/weatherscan/backgrounds/local-era/neighborhood/` (now.png, extended.png, almanac.png, nearby.png, 36hr.png, upnext.png). Sourced from JesseWx2011/Weatherscan-Local-Sim. ✓
- **Slides** (`local-era/slides/`): 6 transition slides — Almanac, Extended, Near_36, Now, Radar, Satellite ✓
- **Weatherscan Plus screens** (`local-era/plus/`): Plus_Affiliate (the blue/white split affiliate screen), Plus_AffiliateLogo, Plus_Bulletin_{A,W,Y}, Plus_Product, Plus_Splash, Plus_UpNext, Plus_Upgrade ✓
- **Moon phase icons** (`local-era/moon/`): First, Full, Last, New ✓
- **Pre-2003 WSXL weather icons** (`local-era/xl-icons/`): 48 numbered icons (0–47.png) ✓
- **Radar/satellite skeletons** at `local-era/` root: startup.png, local-doppler-skeleton.png, regional-doppler-skeleton.png, regional-satellite-skeleton.png ✓
- ⚠️ The older `core_*_bg.png` set turned out to be IntelliStar-era framing despite its filename — not used for Local. Kept in tree for reference only.

---

## Era 2 — Weatherscan on IntelliStar V1 (Feb 28 2003 – Sept 27 2005)  — ✓ shipped

**Platform:** First-generation IntelliStar. FreeBSD, more flexible for updates.
**Music:** **TWC in-house production music**, 15 original tracks. End of the Trammell Starks era for core Weatherscan. (Note: **Weatherscan Plus**, launched April 30 2003 as a premium activity-packs variant, kept Trammell Starks on an expanded playlist.)
**Typeface:** Frutiger (throughout). First appearance in the service.

### Chrome
- Same UDL + LDL system inherited from late-XL era
- TWC logo + "weatherscan" wordmark (blue Frutiger) top-left
- Clock with seconds top-right
- Branded corner treatments (colored "arc-side" curves — these are the **yellow wedges** the user remembers)

### Backgrounds — this is where the cityscape appears
- **Forecast segments:** "city scene" backgrounds replace the neighborhood scenes of Era 1. Main reporting site's **skyline silhouette** with the Weatherscan wordmark rendered over it in blue Frutiger.
- **Color-coded accents per segment** (this is the key visual signature of Era 2/3):
  - Yellow = local forecasts
  - Orange = traffic
  - Blue = travel / airport
  - Green = garden / golf
  - Teal = health
  - Purple = ski & snow

### Scene lineup (confirmed from V1 simulator)
Core: current conditions, hourly/daypart, 36-hour forecast, 5-day forecast, almanac, local Doppler radar.
Travel/lifestyle: travel cities, travel outlook, airport delays, international forecast.
Activity packs (Weatherscan Plus tier): golf, ski, beach/boating, health, garden.
Severe: NWS alerts/bulletins with orange takeover.

### Assets we have
- `assets/music/The Weather Channel Weatherscan In-house production music (4 disk set)/` ✓ (4 disks — the V1 15-track set is a subset; V2's 33-track expansion is in the rest)
- `assets/fonts/frutiger/` — Frutiger family (multiple weights) ✓ also mirrored in `assets/themes/weatherscan/fonts/`
- **City-skyline backgrounds** (the yellow-wedge + blue building photo set): `atlanta_bg.png`, `baltimore_bg.png`, `boston_bg.png`, `charlotte_bg.png`, `chicago_bg.png`, `cleveland_bg.png`, `dallas_bg.png`, `denver_bg.png`, `detroit_bg.png`, `ftworth_bg.png`, `hartford_bg.png`, `houston_bg.png`, `indianapolis_bg.png`, `philadelphia_bg.png`, `phoenix_bg.png`, `pittsburgh_bg.png`, `portland_bg.png`, `sacramento_bg.png`, `san_diego_bg.png`, `san_francisco_bg.png`, `seattle_bg.png`, `stlouis_bg.png`, `tampa_bg.png`, `washington_dc_bg.png`, `oklahoma_city_bg.png`, `orange_county_bg.png`, `orlando_bg.png`, `city_bg.png` ✓
- **Per-segment color-coded backgrounds** — every segment has dedicated `*_bg.png` + `*_intro_bg.png` pairs: `airport_*`, `boatbeach_*`, `garden_*`, `golf_*`, `health_*`, `international_*`, `ski_*`, `traffic_*`, `travel_*` ✓
- **Colored curve overlays** (the V1 "arc-side" accent strips): `airport-curve.svg`, `beach-curve.svg`, `blue-curve.svg` ✓
- **Segment intro promos:** `garden_promo.png`, `golf_promo.png`, `health_promo.png`, `Golfintro.png`, `airportintroslide.png` ✓
- **Severe:** `severe_core_bg.png`, `severe_map_banner_bg.png`, `severefrostpane.svg`, `weather_bulletin_bg.png`, `sev_wx_statement.png`, `bulletinfrostpane.svg`, `frostpane.svg` ✓
- **IntelliStar bug:** `assets/themes/weatherscan/images/intellistarlogo.png` ✓
- **Icon spritesheets:** `icons2007sprite.png` (V1-era) ✓

---

## Era 3 — Weatherscan L-bar (Sept 27 2005 – Dec 12 2022)  — ✓ theme shipped, ✓ L-bar layout shipped

**Platform:** IntelliStar, proprietary Weatherscan configuration.
**Music:** In-house production music, **33 tracks**, fixed to not skip, remastered in stereo.
**Typefaces:** Interstate Bold (outer chrome, logo wordmark) + Frutiger (inner panel content kept from V1).

### Chrome — the big L-bar redesign
The L-bar is the signature of this era. The screen is divided into a left vertical column and a bottom horizontal strip that together form an "L":

| Region | Contents |
|---|---|
| Top-left | TWC logo ("The Weather Channel") + "weatherscan" wordmark (blue Interstate Bold lowercase) stacked, with date and clock (with seconds) underneath |
| Middle-left | Persistent current observations — large temp + condition icon, rotating secondary obs (humidity, wind, pressure, visibility) cycling below |
| Bottom-left | Compact 3-hour radar loop + cable-provider logo |
| Upper-right (main panel) | The rotating scene content — the 5-day, hourly, almanac, travel, etc. lives here |
| Bottom (horizontal strip) | Alternates between: condensed text forecast for current + next daypart, a graphical daypart forecast, and a graphical 5-day forecast. Crawl for airport delays and local observations underneath. |

### Where the geometry came from

Built in `src/ui/weatherscan/WeatherscanLBar.tsx`. The column width is not
eyeballed from a screen capture — it falls out of two of TWC's own render
scripts in `twc_wxscan_dynamic-2.13`, which do not reference each other:

| Source | Value |
|---|---|
| `products/ext/ticker/CityTicker.rs` | `tickerWidth = 496`, `tickerHeight = 19` — hardcoded fallbacks for when the headend config has no `ticker` viewport |
| `products/pm/Radar/LocalDoppler.prod` | `renderUtil.gradientBox(224, 19)` — the radar legend, drawn inside the `radar` viewport |

**224 + 496 = 720**, the NTSC raster width exactly. The left column is 224px,
everything right of it is 496px, and the ticker is 496 wide precisely because
it spans the main panel and stops where the column starts. The app expresses
this as `grid-template-columns: 224fr 496fr` so the *ratio* survives any
window size — the ratio is what was measured, the pixel count is not.

Row heights are **not** sourced and are not presented as though they were.
`products/misc/setupLayers.rs` reads every viewport rectangle out of
`dsm.configGet('viewports')`, headend configuration that never shipped inside
the package:

```python
layers = dsm.configGet('viewports')
name, depth, repeat, x, y, w, h, sx, sy, tx, ty = lprops
RenderControl.queueCommand(SetNamedLayerViewPortCmd(name, x, y, w, h, sx, sy, tx, ty))
```

The `sx, sy` scale parameters are also why the main-panel products still use
full-frame coordinates internally (`CurrentConditions.prod` places content at
x=72 on a 720-wide layout): each product draws at IntelliStar size into its
own layer, and the layer is scaled down into the window. A coordinate read out
of a `.prod` file is local to its layer, not global to the screen.

### Accessibility of a permanent sidebar

Persistent chrome is a hazard in a screen-reader-first application, so the
column is bound by three rules, all covered by `tests/lbar.test.tsx`:

1. **No `aria-live` anywhere in the subtree.** The observations refresh every
   60 seconds; a live region there would interrupt every scene narration in
   the app with a temperature.
2. **No tab stops.** Tab changes scenes. The column is a labelled
   `complementary` landmark, reached by landmark navigation or browse mode.
3. **The radar canvas is `aria-hidden`** with a one-line text summary beside
   it. Storms are enumerated in the Local Doppler scene and nowhere else, so
   the two readouts cannot drift apart by a scan.

The column is written *after* the stage in the DOM and placed left by the
grid, so browse mode reaches the scene before the sidebar.

### Backgrounds
- Same cityscape skyline set as Era 2, with the wordmark treatment retained
- Same segment color-coding retained
- **Main panel** rendered as a smaller window inside the L-bar rather than full-bleed

### Scene lineup (confirmed from V2 simulator)
All Era 2 scenes plus: regional forecasts (distinct from local), surf/beach with tide detail, destination forecasts (domestic + international), expanded safety tips card (winter driving, tornado, pet safety).

### Assets we have
- All Era 2 assets ✓
- Expanded in-house music: the 4-disk set on disk covers both the V1 15-track and V2 33-track catalogs ✓
- `Interstate-Bold.woff/ttf/otf`, `Interstate-Regular.woff2`, `Interstate-BoldCondensed.woff`, `InterstateMono.woff2` ✓
- `icons2010sprite.png` (V2-era icons) ✓
- **L-bar layout shell:** not present as a built-out asset. The radar cover art (`blueradarcover.png`), `precip-legend-mix.png`, `precip-legend-snow.png` suggest the bottom-left radar module was planned but isn't wired

---

## What the user's current `weatherscan` theme actually matches

From the screenshots in-session:
- Yellow corner wedges ✓ Era 2 / Era 3
- Cityscape photograph ✓ Era 2 / Era 3
- TWC logo top-left + clock top-right separately ✓ **Era 2** (Era 3 stacks them into the L-bar top-left)
- No L-bar structure — the main panel is full-bleed ✓ **Era 2**
- Bottom scrolling LDL ✓ Era 2 (L-bar era moved the crawl into the horizontal strip)

**Conclusion: the current single `weatherscan` theme is targeting Era 2 (IntelliStar V1, 2003-2005), already correctly.** The look the user remembers as "later Weatherscan with the yellow and blue" is this Era 2 / Era 3 era, confirming their memory.

---

## Recommended theme split

Rename current `weatherscan` → `weatherscan-v1`, then add two siblings:

| Theme ID | Era | Years | Music | Typeface | Chrome | Backgrounds |
|---|---|---|---|---|---|---|
| `weatherscan-local` | 1 | 1999–2003 | Trammell Starks 1995 | Akzidenz-Grotesk | UDL + LDL, letterbox frame | Regional themes — neighborhood, forest, ocean, mountain, southwest |
| `weatherscan-v1` | 2 | 2003–2005 | In-house 15-track | Frutiger | Top-left logo/wordmark, top-right clock, LDL, arc-side curves | City skylines + color-coded per segment |
| `weatherscan-v2` | 3 | 2005–2022 | In-house 33-track remastered | Interstate + Frutiger | Full L-bar | City skylines + color-coded per segment |

All three have complete asset coverage except the V2 L-bar layout shell (persistent left column + bottom strip rendered around the main panel), which is a build task, not an asset task.

---

## Weatherscan Plus — separate from the main timeline

**Launched:** April 30, 2003.
**Relationship:** a premium variant of Weatherscan running alongside V1 (and probably V2) on the IntelliStar platform — not a separate era.
**Differences from base Weatherscan:**
- Activity add-on packs: golf, ski, beach/boating, business/leisure travel, international destinations
- Location-based background theme choices (broader catalog than base)
- **Kept Trammell Starks music** (this is the outlier — base V1 moved to in-house, but Plus kept Starks with an expanded playlist)
- Data pulled over an Internet connection (not just RF)

Could be modeled as a per-theme **`plus: true`** flag on V1/V2 that unlocks the activity scenes and swaps the music pool back to Trammell Starks — rather than a fourth theme.

---

## Implementation checklist

Done:
1. ✓ `weatherscan` split into `weatherscan-local` / `weatherscan-v1` / `weatherscan-v2` in `themes.ts` + `backgroundCatalog.ts`
2. ✓ Settings migration for retired `weatherscan` id → `weatherscan-v1`
3. ✓ Era-scoped music pools via mood tags (`trammell-starks`, `weatherscan-inhouse`, `intellistar1`, `intellistar2`)
4. ✓ Per-scene Local backgrounds wired (`WS_LOCAL_SCENE_BACKGROUNDS` in backgroundCatalog)
5. ✓ City-skyline pool for V1/V2 (`WS_CITY_BACKGROUNDS`, 29 real metros)
6. ✓ Authentic JesseWx2011 neighborhood-pack assets installed under `assets/themes/weatherscan/backgrounds/local-era/`
7. ✓ LDL clock rotation (TIME h:mm AM/PM between scene label and airport rundown)
8. ✓ Radar canvas enlarged (58vh, full width)
9. ✓ Humidity rounded at source in NwsClient
10. ✓ Extended/Weekend forecast rebuilt around `DayForecast[]` with high-over-low stack
11. ✓ CSS selectors expanded per-era (individual `body[data-theme="weatherscan-{local,v1,v2}"]` descendants)

Pending:
- Wire segment-specific color accents in V1/V2 (yellow local forecast, orange traffic, blue travel/airport, green garden/golf, teal health, purple ski)
- Build the "Local Avails / Brought to you by" scene using `Plus_Affiliate.png`
- Build L-bar layout for V2 (`displayMode: "lbar"` → persistent left column + bottom strip with mini-radar + rotating obs)
- Wire XL icons (0–47) as the weather-icon pool for `weatherscan-local`
- Wire moon phase icons into Almanac
- Source additional regional-theme packs beyond "neighborhood" (coastal, desert, mountain)
- Optional: `plus: true` flag on V1/V2 → Trammell Starks swap + activity scenes (golf/ski/beach/health/garden)
