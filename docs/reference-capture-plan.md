# Broadcast Stills Capture Plan

Target locations to visit in a browser and save authentic TWC broadcast stills from. Each section lists the URL, the specific era + scenes we need frames for, and where to save them.

Every automated tool returned HTTP 403 for `twcarchive.com`, which is the richest source. These pages need to be opened in a real browser and the embedded images saved manually. Fandom wiki pages load without auth but some images are upload-behind-login.

## How to save

1. Create directory tree:
   ```
   docs/reference/
     ws3000/
     ws4000/
     wsjr/
     is1-2003-2007/
     is1-2007-2013/
     is1-2013-rebrand/
     is2-hd/
     is2-jr/
     is2-xd/           (only if we confirm this as a distinct era)
   ```
2. Name captures `{scene}-{source}-{yyyy}.{ext}` — e.g. `current-conditions-twcarchive-2005.jpg`. Source and year matter because we're cross-referencing.
3. Prefer frames showing the **whole screen** including chrome (logo, clock, bug, LDL). If a still only shows the product panel, note that in the filename (`-panel-only`).
4. If the still is watermarked by a fan uploader, still save it — we can measure layout through a watermark.

---

## WeatherStar 3000 (1988–1990)

### Sources
- **TWC Archive (primary, needs browser):**
  - https://www.twcarchive.com/wiki/Weather_Star_III
- **Fandom (browser; images often load):**
  - https://weatherchannel.fandom.com/wiki/WeatherStar_III
- **Wikipedia (images are directly downloadable):**
  - https://en.wikipedia.org/wiki/WeatherStar — look for "WeatherStar III" section; grab the Willow Grove, Pennsylvania observation capture that the article embeds.
- **TWC Classics flavor thumbnails:**
  - https://twcclassics.com/information/weatherstar-3000-jr-flavors.html
- **Handwiki (secondary):**
  - https://handwiki.org/wiki/Engineering:WeatherStar

### Scenes needed
- Current Conditions ("Latest Observations") — **purple** background
- 36-Hour Forecast (Local Forecast) — **grey** background
- Extended Forecast — purple, 3-column (Mon/Tue/Wed style)
- Almanac (both normal + coastal Tides variant if available)
- Regional Conditions (7–10 cities table)
- Latest Hourly Observations (nearby cities)
- Travel Cities Forecast (1989+, **black** background scrolling)
- A warning crawl (red background) + advisory crawl (tan background) if either is visible anywhere

---

## WeatherStar 4000 (1990–1998)

### Sources
- **TWC Archive:**
  - https://www.twcarchive.com/wiki/Weather_Star_4000
- **Fandom:**
  - https://weatherchannel.fandom.com/wiki/WeatherStar_4000
- **Wikipedia:**
  - https://en.wikipedia.org/wiki/WeatherStar
- **TWC Classics (timeline page has inline thumbnails):**
  - https://twcclassics.com/information/weatherstar-4000-timeline.html
- **YouTube search terms (for frame-grabs):**
  - "WeatherStar 4000 Local on the 8s" — many archival uploads
  - "TWC 1993 aircheck" / "TWC 1995 aircheck"

### Scenes needed — we want stills from **multiple years** to see the evolution
- Current Conditions — pre-Apr 1991 ("Now at (City)") **and** post-Apr 1991 ("Current Conditions" with large weather icon)
- Local Forecast (today/tonight narrative slab)
- Extended Forecast — needs post-Feb 1991 (3-day graphical format, icons over temps)
- Local Radar — pre-Aug 1994 (6-color intensity legend) **and** post-Aug 1994 (8-color legend)
- Almanac — post-Feb 1991 (moon-phase graphic visible)
- Regional map (base map with city markers + icons + temps)
- Travel Cities Forecast (map-based)

### Asset we already have but need to validate against captures
- `assets/icons/legacy/1990-regional/` — confirm these match 1990–1991 regional forecast icons on-screen
- `assets/icons/legacy/1991-april-cc/` — should match April 1991 Current Conditions icon redesign
- `assets/icons/legacy/1991-ef/` — should match Feb 1991 Extended Forecast animated icons
- `assets/icons/legacy/ccef/` — legacy icon set; verify era

---

## WeatherStar Jr (1993/94–2014)

### Sources
- **TWC Archive:**
  - https://www.twcarchive.com/wiki/Weather_Star_Jr
- **Fandom:**
  - https://weatherchannel.fandom.com/wiki/WeatherStar_Jr.
- **TWC Classics shared with WS3000:**
  - https://twcclassics.com/information/weatherstar-3000-jr-timelines.html
  - https://twcclassics.com/information/weatherstar-3000-jr-flavors.html

### Scenes needed — to confirm the WS3000-with-different-font thesis
- Current Conditions (should be **text-page** with labeled fields, no large icon)
- 36-Hour Forecast
- Extended Forecast (text multi-day, not 3-column graphical)
- Almanac (text only, no moon graphic)
- Regional Conditions
- Travel Cities Forecast
- The red/tan/blue background variants during alerts

---

## IntelliStar 1 — three eras to treat as separate themes

User has confirmed: if the visual eras are drastically different, we'll build separate themes. Three IS1 sub-eras qualify.

### Era A — IS1 launch look (Feb 2003 – Oct 22 2007)

**What defines it:** inherited WeatherStar XL graphics, Interstate typography, white body text, Latest Observations / Regional / Metro as separate scenes (not yet consolidated into "Now"). Pre-Dec 2006 used the 1998 icon set; Dec 2006 proprietary TWC set replaced it.

#### Sources
- https://www.twcarchive.com/wiki/IntelliStar
- https://www.twcarchive.com/wiki/User:Ccc/is1
- https://weatherchannel.fandom.com/wiki/IntelliStar
- https://twcclassics.com/information/intellistar-flavors.html (canonical flavor sequences)
- YouTube: "TWC IntelliStar 2004", "TWC Local on the 8s 2005", "TWC 2006 aircheck"

#### Scenes needed
- Current Conditions (white text era)
- Latest Observations (map-based with icons)
- Metro Conditions (no wind)
- Regional Conditions (7–10 cities)
- Daypart Forecast (4 time periods)
- 12-Hour Metro Forecast
- 24-Hour Metro Forecast
- Local Forecast narrative
- Extended / Week Ahead
- Local Radar
- Regional Radar
- Almanac
- Air Quality
- Traffic Pulse (2005+)
- Getaway Forecast
- LDL pre-Jun 2008 (Interstate Regular, non-tabbed)
- Alerts (brown advisory, red warning)

### Era B — IS1 "Now" facelift (Oct 23 2007 – Nov 11 2013)

**What defines it:** new title bars, light-blue sky background with bright sun upper-right, body text switched **white → dark blue**, fade transitions replacing slide, Current Conditions renamed **"Now"** (consolidating LatestObs + Regional + Metro), Regional Radar → **Regional Doppler**, Local Radar → **Local Doppler**. Jun 2, 2008: LDL redesign to blue bg with tabs and Helvetica Neue body font. Mar 11, 2010: new weather.com-derived animated icons.

This is the longest-running IS1 era and is what most viewers remember.

#### Sources
- https://www.twcarchive.com/wiki/IntelliStar — section on 2007 facelift
- https://www.twcarchive.com/wiki/User:Ccc/is1
- https://weatherchannel.fandom.com/wiki/IntelliStar
- YouTube: "TWC IntelliStar 2008", "TWC 2010 Local on the 8s", "TWC IntelliStar 2012"

#### Scenes needed
- "Now" (consolidated Current Conditions) — dark blue body text
- Local Doppler (renamed)
- Regional Doppler (renamed)
- Week Ahead / 7-day Extended
- Daypart Forecast
- Local Forecast narrative
- Almanac (this era's design — we have zero text-source info on its layout)
- Travel / Getaway
- Air Quality
- Traffic Pulse (through 2010)
- LDL pre-Jun 2008 **and** post-Jun 2008 (tabs, Helvetica Neue body, scroll-down appear animation)
- Pre-Mar 2010 icons **and** post-Mar 2010 animated icons (two captures of the same Week Ahead scene if possible, for icon set comparison)
- Alerts

### Era C — IS1 2013 rebrand (Nov 12 2013 – Nov 2014)

**What defines it:** Trollbäck+Company "Enhanced" rebrand, flat mobile-style icons, new backgrounds, time bar, summary product (obs + daypart combined), LDL continuous except during Local on the 8s. Narration briefly disabled Nov 12, restored Dec 17 2013. Retired Nov 2014.

This era is brief (~1 year) but visually distinct and shared the flat-icon vocabulary with IS2 HD's launch look.

#### Sources
- https://www.twcarchive.com/index.php/2013_Rebrand
- https://www.twcarchive.com/wiki/IntelliStar
- YouTube: "TWC 2014 Local on the 8s", "TWC 2013 November rebrand"

#### Scenes needed
- Summary product (combined obs + daypart)
- Time bar
- Any of the "Now" replacements
- Flat-icon Week Ahead
- Continuous LDL + what it looks like during Local on the 8s (is it truly hidden, or shrunk?)

---

## IntelliStar 2 HD + Jr + (xD?)

### Era D — IS2 HD launch (Nov 12 2013 – ~2018)

**What defines it:** flat-icon Trollbäck rebrand shared with IS1 Era C, but on new hardware with **windowed LOT8s frame** (main window left two-thirds, right sidebar dial, rundown list with filling progress bar, always-on LDL). Interstate typography. Jim Cantore narration.

#### Sources
- https://www.twcarchive.com/wiki/IntelliStar_2_HD
- https://www.twcarchive.com/wiki/Local_on_the_8s
- https://en.wikipedia.org/wiki/Local_on_the_8s
- https://en.everybodywiki.com/IntelliStar_2
- YouTube: "TWC IntelliStar 2 HD 2014", "TWC Local on the 8s 2015", "TWC 2016 forecast"

#### Scenes needed
- The full LOT8s frame with **all chrome elements visible** (main window + sidebar dial + rundown + LDL) — this is the priority capture, we cannot build the frame without it
- TWC logo + Local on the 8s logo + city/time attached box (as one unit)
- Right sidebar dial showing a supplementary product (visibility, dew point, pressure, airport delays, air quality, almanac — any)
- Rundown list showing 4 upcoming products + progress bar
- Product icons next to rundown (thermometer = CC, radarscope = radar, others)
- Current Conditions rendered inside the main window
- 12-hour forecast graph
- 24-hour descriptive
- 7-day / Extended Forecast
- Local Forecast narrative
- Local Doppler (windowed)
- Regional Doppler
- Almanac — specifically the **analog clock graphic** for sunrise/sunset (white = sunrise, black = sunset)
- LDL crawl full-width with 5-day city forecast
- Alert overlay: red box + crawl over LDL (advisory), yellow variant (tornado/t-storm watch), orange variant (special weather statements)
- Full-bleed TOR/Tornado Emergency takeover if any aircheck shows it

### Era E — IS2 Jr HD

**What defines it:** same frame as IS2 HD, SD/letterboxed native output. **One confirmed delta: LDL does not render during national programming — only warning crawls appear.**

#### Sources
- https://www.twcarchive.com/wiki/IntelliStar_2_Jr
- https://en.everybodywiki.com/IntelliStar_2_Jr
- YouTube: "TWC IntelliStar 2 Jr" / "IntelliStar 2 Jr HD aircheck"

#### Scenes needed
- Any Local on the 8s segment showing the Jr frame (to confirm it matches HD)
- National programming segment showing the **absence of LDL** on Jr
- National programming segment showing an alert crawl appearing on Jr (the exception that *does* render during national)
- Any supplementary scene that might differ from HD

### Era F — IS2 xD / cinematic refresh (2018+)?

**Unresolved.** The research agent noted that "cinematic full-bleed" look is post-2018 xD, not IS2 HD launch. Before we commit to a separate theme, we need confirmation this is actually a distinct unit/era or just a look refresh on the same hardware.

#### Sources to investigate
- https://www.twcarchive.com/wiki/IntelliStar_2_xD (if exists)
- https://www.twcarchive.com/wiki/IntelliStar_2_HD — check for "Enhanced" / "xD" sections
- YouTube: "TWC 2019 Local on the 8s", "TWC 2020 forecast", "IntelliStar 2 xD"

#### Scenes needed — if era is confirmed
- The cinematic full-bleed Current Conditions (giant temp, thin typography, minimal chrome)
- Whatever other scenes got the cinematic treatment
- Proof this is different hardware (xD) or same hardware with a look refresh

---

## Asset gap summary (honest accounting)

**Per the research, here is what we already have vs. need:**

| Era | Fonts | Icons | Chrome/Backgrounds | Logos | Verdict |
|---|---|---|---|---|---|
| WS3000 | ✓ Star3000 family | n/a text-only | n/a colored fields via CSS | n/a | **Complete** |
| WS4000 | ✓ Star4000 + Extended + Large + Radar + Small | ✓ 1990-regional, 1991-april-cc, 1991-ef, ccef | ✓ BackGround1 + radar maps | n/a | **Complete for renderer; need captures to verify icon period-accuracy** |
| WSJr | ✓ StarJR | n/a text-only | n/a colored fields via CSS | n/a | **Complete once we reuse WS3000 renderer stack** |
| IS1-2003 | ✓ Interstate (in weatherscan/fonts/) | ✓ 1998 set (90 files) | ⚠️ XL cloud/sky — need to confirm which background asset matches | ✓ TWC logo, IntelliStar HQ bug | **Mostly there; needs XL-background confirmation** |
| IS1-2007 | ✓ Interstate + Helvetica | ⚠️ 2006 set (86 files) — verify it matches the Dec 2006 proprietary set | ✗ **Light-blue sky + sun upper-right: MISSING** | ✓ TWC logo + bug | **Missing 2007 facelift background art** |
| IS1-2013 | ✓ Interstate | ⚠️ flat icons (28x28, 42x42 WebP) — verify era | ⚠️ 2013 rebrand backgrounds not specifically identified | ✓ | **Missing verification that flat icons match 2013 rebrand** |
| IS2 HD | ✓ Interstate | ⚠️ 68x68 WebP — verify these are 2013 flat-icon rebrand set | ✗ **LOT8s frame shell: MISSING.** No sidebar dial art, no rundown chrome, no product-icon set (thermometer, radarscope, etc.) | ⚠️ LOT8s logo exists (`logos/lot8/LOT8sLogo.webp`) — verify post-2013 style | **Biggest gap. The frame shell art does not exist in the repo.** |
| IS2 Jr | same as IS2 HD | same as IS2 HD | same as IS2 HD | same as IS2 HD | **Same gaps as IS2 HD** |
| IS2 xD (if confirmed) | ? | ? | ? | ? | **Unknown until era confirmed** |

### Highest-priority asset gaps (order of blocker severity)

1. **IS2 HD LOT8s frame shell art** — without this, we cannot build the defining chrome of the era. Needs either (a) capture from an aircheck showing the whole screen, (b) manual recreation from those captures, or (c) rip from a reputable fan sim as a last resort.
2. **IS2 HD product icons for rundown** — thermometer, radarscope, sun/moon, map icons. Small set but defines the rundown strip.
3. **IS1 2007 facelift background** — light-blue sky with sun upper-right. No asset currently identified in the repo matches this description.
4. **Icon-set period verification** — we have `1998/`, `2006/`, `28x28/`, `42x42/`, `68x68/` but no documentation of which era each matches exactly. Captures will let us confirm.
5. **IS2 analog-clock sunrise/sunset graphic for Almanac** — either grab from aircheck or build from scratch. Small but era-defining.

### What we can build today without blocking on captures

- WS3000 text-page renderer stack (rendering is CSS + text; layouts from research are sufficient to start)
- WSJr reuse of WS3000 renderer with StarJR font
- WS4000 Current Conditions icon-left/fields-right layout (icons and fonts all present)
- IS1 typography fix (Akzidenz → Interstate in `themes.ts`) — 1-line change
- WSJr scene-order fix (remove radar from `THEME_CORE_SCENES["wsjr"]`) — 1-line change

Everything else is better deferred until we have at least a handful of reference stills per era.

---

## Suggested workflow for the user

1. Start with IS2 HD — open the twcarchive IS2 HD page in a browser and grab the LOT8s full-frame still, plus any sidebar/rundown shots visible. **Priority #1** because it unblocks the biggest piece of work.
2. Then IS1 Era B (2007–2013) — this is the longest-running IS1 look and gives us the canonical "Now" facelift.
3. WS4000 icon-era captures (Apr 1991 CC, Feb 1991 Extended, post-1994 8-level radar) — small set but validates our icon inventory.
4. The rest can come as you have time.

If you can only grab 10 stills total, grab:
- 1× IS2 HD full-frame with LDL
- 1× IS2 HD sidebar dial + rundown visible
- 1× IS2 HD Almanac (for the analog-clock sunrise/sunset graphic)
- 1× IS1 "Now" (post-2007 CC, dark blue text, light-blue sky bg)
- 1× IS1 LDL post-Jun 2008 (tabs, Helvetica)
- 1× WS4000 Current Conditions (post-Apr 1991, large icon visible)
- 1× WS4000 Extended (post-Feb 1991, 3-day graphical)
- 1× WS3000 Latest Observations (purple)
- 1× WS3000 Extended (3-column)
- 1× WSJr Current Conditions (to confirm text-page thesis)
