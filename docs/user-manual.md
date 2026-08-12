# Accessible Weather Center — User Manual

This manual is written for screen-reader users first. Everything in the application can be done from the keyboard, and everything the application shows on screen is also spoken or exposed to your screen reader. Sighted users are welcome too — the visuals recreate The Weather Channel's classic 24/7 local-forecast systems — but no part of this manual assumes you can see the screen.

Current as of version 0.13.0.

## Contents

1. [Why this application exists](#why-this-application-exists)
2. [What it looks like](#what-it-looks-like)
3. [How speech works here](#how-speech-works-here)
4. [Getting started](#getting-started)
5. [First-run setup](#first-run-setup)
6. [The scene loop](#the-scene-loop)
7. [Every scene, one by one](#every-scene-one-by-one)
8. [Navigating inside a scene](#navigating-inside-a-scene)
9. [Favorites: managing your locations](#favorites-managing-your-locations)
10. [Map Navigation: exploring radar as data](#map-navigation-exploring-radar-as-data)
11. [Alerts and severe weather](#alerts-and-severe-weather)
12. [NOAA Weather Radio](#noaa-weather-radio)
13. [Themes: seven generations of hardware](#themes-seven-generations-of-hardware)
14. [Narrators](#narrators)
15. [Music and the audio mixer](#music-and-the-audio-mixer)
16. [Settings reference](#settings-reference)
17. [Full keyboard reference](#full-keyboard-reference)
18. [Accessibility design notes](#accessibility-design-notes)
19. [Your data and privacy](#your-data-and-privacy)
20. [Assets](#assets)
21. [Troubleshooting](#troubleshooting)

---

## Why this application exists

This project sits at an intersection almost nobody builds for: **people who are blind, and people who love The Weather Channel's local forecast hardware.** It turns out those are not separate audiences.

From 1982 until 2020, if you had cable, you had a machine in your headend — a WeatherStar, later an IntelliStar — cutting into national programming every ten minutes with your local forecast. Lower-third crawl, jazz soundtrack, a narrator reading conditions over a rotating slideshow. For a lot of people it was ambient background comfort. For blind and low-vision people it was something more specific: **weather you could just listen to.** No app, no screen, no navigation. It talked, and you learned what the weather was doing.

Then it went away. Weatherscan shut down on December 15, 2022, and what replaced it was websites and phone apps — which are visual-first, chart-heavy, and often flatly inaccessible. Radar is the worst case: a wall of coloured pixels conveying position, intensity, size, and motion, with no text equivalent at all. A sighted user glances at a radar loop and knows a storm is 20 miles west and closing. A screen-reader user gets "image".

Accessible Weather Center is an attempt to bring that experience back and fix what it never had:

- **Recreate the thing faithfully.** Real era typography, real background art, real narrator clips, real music, real scene rundowns per hardware generation. Not a tribute — a reconstruction, sourced from broadcast stills and airchecks.
- **Make every part of it non-visual.** Not "screen-reader compatible" as a compliance checkbox. Designed so the audio and keyboard paths are the *primary* interface and the graphics are the skin on top.
- **Solve radar properly.** Radar here is not an image with alt text. It's parsed into storm objects — position, distance, bearing, intensity, movement vector, estimated arrival — that you walk with arrow keys. See [Map Navigation](#map-navigation-exploring-radar-as-data). This is the feature the whole project is really built around.

The design rule everything follows: **anything a sighted user can see, you can hear or navigate.** Where that was hard, the app does the analysis rather than handing you the raw pixels.

There is one deliberate, load-bearing decision that follows from all this, described in the next-but-one section: the app has **no built-in text-to-speech**, on purpose.

## What it looks like

Worth describing plainly, both because sighted users will read this and because knowing what's on screen helps when you're telling someone else about it.

**The frame.** The window is a 16:9 stage. Across the top runs a header bar with the scene title on the left and, depending on the era, a clock, a location, and a channel logo bug in the corner. Across the bottom runs the **LDL** — the Lower Display Line — a horizontal strip with a coloured label block ("AIRPORT DELAYS", "CLOSINGS") on the left and a continuously scrolling text crawl to its right, with a small weather icon tracking current conditions. Between them sits the content pane, which changes per scene.

**The content.** Different scenes use different layouts: a hero panel with an enormous temperature and a condition icon; a row of vertical day-panels for the Extended Forecast; multi-column tables for Hourly and Travel Cities; a bar chart for Temperature Trend; a radar map with a colour-graded intensity legend. Backgrounds are per-era photography or gradients — city skylines, blue-sky cumulus, soft-focus neighbourhood scenes at golden hour, or IntelliStar's 254-image pool of city gradients that rotate as scenes change.

**Severe weather takeover.** When a Severe or Extreme alert is active the whole look changes: the theme switches to an emergency palette (TWC's authentic `#ae1d0b` alert red), a crawl runs the alert text across the screen, and the scene loop jumps to Alerts. It's visually loud on purpose, and it's matched by an assertive spoken announcement and an attention tone, so it reads the same whether you're watching or listening.

**Motion.** The LDL crawl scrolls, icons animate, scenes cross-fade. All of it respects `prefers-reduced-motion` — with that OS setting on, animated icons swap to still frames and the crawl stops scrolling (the text is still there as a list).

If you use a screen reader, none of this is required knowledge. It's the skin. The information is in the speech.

## How speech works here

The application speaks through exactly two channels, and understanding the split makes everything else make sense.

**1. Your screen reader.** Every announcement — scene content, navigation readouts, alerts, status messages — is pushed into ARIA live regions that NVDA, JAWS, Narrator, Orca, or VoiceOver read *in your voice, at your rate, with your punctuation and pronunciation settings*. This is the precise data channel.

**2. Recorded narrator clips.** The authentic TWC narrator voices play as audio through the app's mixer. This is the atmosphere channel — it's what makes it feel like the real thing.

**There is deliberately no built-in text-to-speech.** The app will never speak with an OS or browser voice. This is a standing design rule, not an oversight or a missing feature.

The reasoning: an app with its own TTS engine is an app fighting your screen reader. You get double-speech, two different voices, two speech rates, an interruption model that doesn't match the one you've configured, and a pile of settings to reconcile. Screen-reader users already have a speech system, tuned exactly how they want it. The correct behaviour for an application is to *feed* that system, not to duplicate it. Earlier versions had a Web Speech TTS path and an "announcer mode" setting; both were removed in 0.11.0, and the announcement queue was rebuilt around two independent live-region channels (polite and assertive) with proper repeat-breaking and a cancel that actually cancels.

The main stage uses `role="application"`, so NVDA and JAWS switch to focus mode automatically and single-letter shortcuts reach the app instead of triggering quick-nav. All shortcuts are global — you never have to find a control first.

## Getting started

**On the web:** open `https://weather.codyhurst.com/app/`. Nothing to install. Your location and settings are saved in that browser.

**On the desktop (Electron):** run the packaged build, or from a source checkout:

```
npm install
npm run dev            # in one terminal
npm run dev:electron   # in another
```

**Press any key to start audio.** Browsers and Electron both require a user gesture before audio can play. Until you press something, the status line reads "Press any key to start audio". Your first keypress unlocks the mixer, plays the TWC startup mnemonic, and starts the music.

Desktop and web are the same application. The differences are small: the desktop build can raise OS notifications for alerts and can minimise to the tray; the web build uses browser notifications. Weather Radio works in both, by different routes (see [NOAA Weather Radio](#noaa-weather-radio)).

## First-run setup

The very first time you run the application — or the first time in a new browser — it asks for your location before anything else happens.

A dialog opens with the heading "Welcome to Accessible Weather Center". Focus is placed straight into the ZIP code field, and the prompt is announced assertively so you hear it immediately. Type your five-digit US ZIP code and press Enter.

The application looks up the ZIP, then **speaks the city and state back to you** — "Home set to Nashville, Tennessee. Loading your forecast." That readback is deliberate: a mistyped ZIP that still happens to be valid would otherwise silently give you someone else's weather, and there's no visual cue to catch it. Hearing the city name catches it.

If the ZIP isn't found or the network is down, the error is announced and shown, and you can try again.

**This dialog cannot be dismissed.** Escape and clicking outside it both just restate the requirement. Every other modal in the app closes on Escape; this one doesn't, because there is no meaningful application behind it — with no location there is nothing to forecast. Until setup finishes, the scene loop, radar scanner, alert polling and Weather Radio all stay stopped, so the app never fetches or announces weather for somewhere you didn't choose.

You can change your home location at any time afterwards with `M` (see [Favorites](#favorites-managing-your-locations)).

## The scene loop

The application continuously cycles through weather scenes. Each is displayed and narrated, then advances once narration finishes plus a configurable delay.

- `Tab` — next scene
- `Shift+Tab` — previous scene
- `Space` — pause or resume automatic cycling. Paused, the current scene stays put until you Tab.
- `Escape` — silence the current narration

Which scenes appear, and in what order, depends on your **theme** — each generation of TWC hardware had its own rundown, and the app reproduces it — and on which scenes you've enabled in Settings. A core set is on by default; the rest are opt-in.

Each scene announces its content as structured speech in a fixed, predictable order, so you learn the shape and stop having to listen to all of it.

## Every scene, one by one

Seventeen scenes exist. Enable or disable any of them in Settings → Scenes.

**Current Conditions** — the anchor scene. Temperature, condition text, humidity, wind speed and direction, barometric pressure, visibility. Visually a hero layout: oversized temperature, large condition icon, supporting readouts in a grid.

**Local Forecast** — the narrative forecast in the National Weather Service's own words, walked period by period ("This Afternoon", "Tonight", "Wednesday"). Up/Down moves between periods.

**Local Radar** — the radar map centred on your home, with a colour-graded precipitation intensity legend. Backed by the same storm scanner that powers Map Navigation, so what's announced here is analysed, not described from the picture.

**Extended Forecast** — the multi-day outlook. Day, icon, conditions, high and low per column. The number of days is era-accurate: 3-day on WeatherStar 4000, 5-day or 7-day on later hardware, with the title changing to match ("Extended Forecast", "7-Day Outlook", "Week Ahead").

**Hourly Forecast** — hour-by-hour temperature, condition and precipitation chance in a navigable grid.

**Travel Cities** — conditions in your saved favourite locations, as a table with icons. This is the scene that consumes your Favorites list.

**Almanac** — sunrise, sunset, moon phase, and normal/record temperatures, in a two-column layout.

**Detailed Conditions** — the fuller observation: dew point, ceiling, pressure trend, and the fields the main Current Conditions scene leaves out.

**Feels Like** — apparent temperature, split into wind chill and heat index panels (the panel tints blue for chill, red for heat).

**Storm Tracker** — the storm objects detected by the radar scanner, listed with distance, bearing and movement. The scene-loop counterpart to Map Navigation's Storms mode.

**Overnight Forecast** — tonight's low and narrative, as a hero card with a stat strip.

**Weekend Forecast** — the upcoming weekend pulled out of the extended forecast.

**Precipitation Outlook** — precipitation chances and expected amounts.

**Temperature Trend** — the hourly temperature curve as a navigable bar chart with LED-style readouts.

**Traffic** — a placeholder scene. There is no free public traffic API that works nationwide without a key, so this scene is honest about having no data rather than inventing it. Disabled by default.

**Airport Delays** — live delays and ground stops from the FAA's NAS Status feed. Also feeds the LDL crawl.

**Alerts** — active NWS alerts for your location. Conditional: with no active alerts it's skipped rather than showing an empty page. This is the scene the severe-weather interrupt jumps to.

## Navigating inside a scene

Scenes with tabular or list content support arrow navigation:

- `←` `→` — move between columns (days in the Extended Forecast, hours in Hourly)
- `↑` `↓` — move between rows or list items
- `Home` / `End` — first / last item in the current row or list

Every move announces the newly focused cell. Narrative scenes (Local Forecast, Overnight) use Up/Down to walk forecast periods.

Arrow keys are free for this because scene switching lives on Tab/Shift+Tab. That's a deliberate trade: it means in-scene navigation gets the keys that feel natural for it.

## Favorites: managing your locations

Press `M` to enter Favorites; `M` or `Escape` to leave. Entering pauses the scene loop.

- `↑` `↓` — walk your saved places. Each announces its name, state, and current conditions.
- `Z` — jump to the ZIP entry field. Type a five-digit US ZIP and press Enter; the place is looked up, added and announced. While the field has focus, ordinary keys type into it instead of firing shortcuts.
- `Enter` — make the selected place your **home**, and return to the scenes.
- `Delete` or `Backspace` — remove the selected place.

Home drives everything: the scene loop, alert polling, the radar scanner, and the Weather Radio station suggestion all re-point the moment you change it. There is exactly one "home changed" path in the code, so nothing can be left pointing at your old location.

Your favourites also populate the Travel Cities scene.

## Map Navigation: exploring radar as data

Press `N` to enter; `N` or `Escape` to leave. This is the deepest accessibility feature in the application, and the reason it was built.

Radar within a 150-mile radius of your home — refreshed every couple of minutes — is converted from pixels into objects you can navigate. Three modes; `Tab` and `Shift+Tab` cycle between them, and each switch is announced.

### Storms mode

Walks every detected storm, nearest first.

- `↑` `↓` — previous / next storm. Each announces roughly like: *"Storm 2. Heavy rain, 23 miles to the northwest, moving east at 25 miles per hour, 40 minutes away."*
- `Home` / `End` — nearest / farthest storm
- `Enter` — full detail: peak rainfall rate, storm radius, movement vector, estimated arrival

Storm identity is **stable across scans**. Each storm is tracked frame to frame and keeps its identity, which is what makes "new storm detected" mean an actually new storm rather than a re-numbered old one, and makes the movement vector reflect real motion rather than list-order churn. (Before this was fixed, storms reported "Stationary" about 80% of the time because identical radar frames were being re-compared.)

### Alerts mode

Walks every active NWS alert for your area.

- `↑` `↓` — previous / next alert, announcing event type and headline
- `Enter` — the full alert: severity, urgency, certainty, affected areas, and the complete instruction text

### Grid Explorer mode

A virtual cursor you move across the map. Every keypress answers "what is the weather *there*?"

- `←` `→` `↑` `↓` — move the cursor west / east / north / south. Each press answers immediately with relative position, precipitation at that spot, and any alerts covering it — then follows up a moment later with the nearest city, county and state once the geocoder responds.
- `[` / `]` — decrease / increase the step size: 1, 3, 5, 10 or 25 miles per press. Announced and remembered. Use 1–3 miles to trace a storm's edge across your county; 10–25 to sweep a region.
- `Home` — jump the cursor back to your location
- `Enter` — repeat the full description for the current position

Steps are true miles in both directions — the app compensates for the fact that a degree of longitude shrinks as you move north, so a "10 mile" step east really is ten miles whether you're in Texas or Minnesota.

## Alerts and severe weather

The application polls NWS alerts for your home location every minute.

- **Any new alert** is announced assertively, interrupting other speech, with its event name and headline, plus an attention tone. On desktop, it also raises an OS notification, so you get it while minimised to the tray.
- **Severe or Extreme alerts** (Tornado Warning, Severe Thunderstorm Warning, and similar) additionally interrupt the scene loop: the app jumps to the Alerts scene, the visual theme switches to the emergency takeover, and a crawl runs the alert text. Severe alerts get the NWS four-beep attention tone; lesser alerts get a softer advisory tone. The interrupt clears when the severe alerts expire.
- `3` — speak the currently active alerts on demand, at any time, sorted most severe first. Says "No active weather alerts" when there are none.

**Changing your home location resets alert tracking**, so alerts already in effect at the new location are announced as if fresh. You will never silently sit inside a warning you were never told about because it was already active when you arrived.

Radar-derived storm announcements ("New storm detected", "Storm approaching", "Storm has intensified") are a separate, complementary layer. They can warn you about rain and storms *before* any official alert exists. Official NWS alerts always take priority.

## NOAA Weather Radio

The application can stream live NOAA Weather Radio transmitters in the background, via weatherUSA's community relay network, on an independent audio channel. Narration ducks the music but **never** ducks the radio — the radio might be telling you about a warning.

- `0` — toggle the stream on or off. Turning it on announces the station.
- `2` / `Shift+2` — radio volume up / down 5%, announced
- Settings → NOAA Weather Radio — enable, station picker with autocomplete, volume

**Choosing a station.** The picker lists stations known to be live right now: a bundled snapshot merged with a live check each time you open Settings. Leave it blank and the app matches your home city *and state* to the nearest known transmitter — matching on city alone used to hand a Columbus, Ohio user the Columbus, Georgia transmitter, which is exactly the kind of error a blind user has no easy way to notice.

Note that weatherUSA relays user-contributed receiver feeds, not the full NWS transmitter catalogue. If your exact local station isn't listed, pick the nearest metro that is. The live list matters: as of August 2026 there were 116 active mounts, while the bundled fallback snapshot listed 34, four of which had gone dead.

**If a stream fails**, the player retries with increasing delays; after five consecutive failures it announces the station as unavailable and suggests another. Re-selecting a station — even the same one — or changing any audio setting retries, as does toggling `0` off and on.

**A technical note for the web version.** The Icecast relay sends no CORS headers, which means a browser cannot fetch its station list *or* play its audio through the Web Audio API. The web deployment therefore routes both through a small reverse proxy on the same origin. If Weather Radio works on the desktop but not in your browser, that proxy is what to check.

## Themes: seven generations of hardware

Ten themes recreate seven generations of TWC hardware. A theme sets the visual skin, typography, background art, music pool, **scene order**, and default narrator. Change it in Settings → Theme.

They are not equally complete. Some are finished reconstructions; others are correct in palette and typography while their distinctive page layouts are still being built. Honest status is given for each.

**WeatherStar 3000 (1988–1990)** — TWC's pre-4000 local unit. Blocky coloured text on a dark blue/purple field. No narration (the 3000 had no local voice, so its default narrator is Silent), no graphical weather icons, and no radar — the 3000 couldn't render it locally, so the scene order drops it. *Status: palette and typography correct; the text-page renderer stack is not built yet.*

**WeatherStar Jr (1993–2014)** — the budget Wegener unit for small cable operators. Inherited the 3000's product set and screen layouts; the only WS4000 DNA is the cleaner typeface. Text-only pages, no on-unit radar, no cartoon icons. *Status: as WS3000 — awaiting the same renderer stack.*

**WeatherStar 4000 v1 (2001–2004)** — the iconic one. Flat orange header strip with a dark-blue diagonal cut on the right, full-bleed solid blue content pane with a cyan inner border, yellow Star4000 Extended titles, gold Star4000 Large temperatures, and the 1998 cartoon icon set. Extended Forecast is three vertical day-panels. The Almanac gets its own orange-top/purple-bottom split background. Radar has dedicated dark-blue chrome with an inline intensity legend. No bottom footer. *Status: most complete of the WeatherStar themes.*

**WeatherStar 4000 v2 (2005–2009)** — late-era redesign on the same hardware, and the application's default theme. Skewed parallelogram orange header over a narrow dark-blue band, a floating cyan-glow content box with a drop shadow on an orange-to-purple vertical gradient, and an always-on footer bar carrying contextual data. Radar switches to a pink/purple header with a seven-step PRECIP legend and a light off-white basemap with red state borders. Current Conditions adds a pressure-trend arrow and a ceiling field. *Status: the footer bar component is still outstanding.*

**WeatherStar XL** — Interstate and Frutiger typography, deep navy palette, blue-sky cumulus wallpaper, 7-Day Outlook. *Status: the most complete theme overall.*

**Weatherscan Local (1999–2003)** — the pre-IntelliStar era running on XL hardware. Regional photographic backgrounds (neighbourhood, forest, ocean, mountain, southwest), Akzidenz-Grotesk typography, upper and lower display line text strips framing the content, and Trammell Starks' *Music for Local Forecast* as the soundtrack. No skylines, no yellow wedges — those came later.

**Weatherscan V1 (2003–2005)** — first era on the IntelliStar platform. City-skyline backgrounds with the "weatherscan" wordmark in blue Frutiger, and colour-coded arc-side curves per segment: yellow for local forecast, orange traffic, blue travel and airport, green garden and golf, teal health, purple ski. The 15-track in-house jazz catalogue, with Amy Bargeron as the voice.

**Weatherscan V2 L-bar (2005–2022)** — the final redesign, and the one most people remember from the shutdown. Interstate Bold in the outer chrome, Frutiger retained inside the content panel, the same skylines and segment accents, and the 33-track remastered stereo jazz catalogue. This is the only machine that renders in a different *shape* rather than just a different palette: a permanent left column carries the logo, the current observations and a long-range radar loop, and the scene content occupies a window to its right.

The column never speaks. It is not in the tab order and it holds no live regions, so it cannot interrupt a scene narration — the observations simply change underneath you every minute. To read it, use your screen reader's landmark navigation (`D` in NVDA and JAWS) and look for the region called "L bar", or browse into it with the arrow keys in browse mode. Everything in it is also available as a full scene: Current Conditions for the observations, Local Doppler Radar for a storm-by-storm walk of the radar.

On narrow windows the column folds to a horizontal band above the scene, since a 224/496 split leaves too little room for both halves to be readable.

**IntelliStar 1 (2003–2013)** — black-to-navy gradient palette with muted gold accents, Interstate typography, and a pool of 254 city-gradient backgrounds that rotate between scenes. Jim Cantore's voice. *Status: icons and typography correct; several pre-2007 page layouts are still generic.*

**IntelliStar 2 / 2 Jr HD (2011–2022)** — the modern HD look. Bright blue palette, Interstate chrome with Helvetica Neue LDL body text (matching the June 2008 LDL redesign), and a combined background pool of 254 sharp HD generics plus 28 blurred IS2 Jr plates. Severe weather draws from a dedicated LOT8 severe background set. Chandler's voice. *Status: the LOT8s windowed frame is still outstanding.*

A **high-contrast** overlay (Settings → Theme) can be layered on any theme for low-vision use. It neutralises photographic backgrounds so text contrast is not fighting a picture.

## Narrators

The narrators are libraries of recorded voice clips, stitched together at runtime into sentences — the same technique the real hardware used.

- **Allan Jackson** — the deepest library by far, thousands of clips: current conditions, extended and hourly forecasts, local forecast narratives, alerts. The definitive TWC local-forecast voice. Default for the WeatherStar and Weatherscan Local eras.
- **Jim Cantore** — IntelliStar 1 era, including warning headlines and snow accumulation phrasing.
- **Amy Bargeron** — the voice of Weatherscan; scene intros for V1 and V2.
- **Chandler** — IntelliStar 2 era intros.
- **Silent** — no clip narration at all. Era-correct for WeatherStar 3000, which had no local voice. Your screen reader still announces everything, so nothing is lost — you just get the machine as it actually was.

Override the narrator for any theme in Settings → Audio → Voice narrator.

**Clip confidence.** Clip libraries were reconstructed from fan archives, and not every filename's meaning is certain. Each clip carries a confidence rating — confirmed, likely, or guess — and the "Clip confidence threshold" setting controls how adventurous the matching is. Set it to *confirmed* for only verified clips; *likely* (the default) is a good balance; *guess* uses everything. Anything without a suitable clip is simply carried by your screen reader instead, so a stricter setting means less recorded voice, never less information.

## Music and the audio mixer

Audio runs on three independent buses: **music**, **voice**, and **radio**.

- Narration **ducks** the music — music drops in level while a clip plays, then comes back.
- Narration **never** ducks the radio, because Weather Radio may be delivering a warning.
- Each bus has its own volume, adjustable live and persisted.

Music pools are era-matched to the theme: Trammell Starks' *Music for Local Forecast* for the WeatherStar and Weatherscan Local eras, the Weatherscan in-house jazz catalogue for V1 and V2, and dedicated IntelliStar 1 and 2 pools.

- `Ctrl+M` — mute/unmute music
- `Ctrl+→` — skip to the next track
- `1` / `Shift+1` — music volume up / down 5%

## Settings reference

Open with `,` (comma). Close with Escape. It's a proper modal: focus moves inside, Tab cycles within it, the app behind is marked inert, and Escape is captured so it closes the dialog rather than exiting whatever mode you were in. This was specifically tested with NVDA.

**Accessibility**
- *Map grid step* — default cursor step for Grid Explorer (1, 3, 5, 10 or 25 miles). Also changeable live with `[` and `]`.

**Theme**
- *Theme* — one of the ten hardware eras
- *High contrast* — overlay for low-vision use, layerable on any theme

**Audio**
- *Background music* — on/off, and volume
- *Use voice clips for narration* — turn the recorded narrators off entirely and rely on your screen reader
- *Voice narrator* — override the theme's default
- *Clip confidence threshold* — confirmed / likely / guess
- *Alert tone* — bundled recorded tone vs. synthesised
- *Post-narration delay* — how long a scene lingers after speech finishes, in seconds. Raise it if scenes advance faster than you can read them with a screen reader; the loop waits for narration to finish, then waits this long on top.
- *Auto-cycle* — turn off to make the loop fully manual (Tab only)

**NOAA Weather Radio**
- *Enable*, *station* (autocomplete over the live list), *volume*

**Scenes**
- A checkbox per scene. Turn off anything you don't care about and it leaves the rotation.

All settings apply immediately and persist between sessions.

## Full keyboard reference

Press `?` at any time for this list in-app.

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Next / previous scene (or switch mode in Map Nav) |
| `←` `→` `↑` `↓` | Navigate within the current scene or mode |
| `Home` / `End` | First / last item in row or list |
| `Space` | Pause / resume the scene loop |
| `M` | Favorites — `Z` add ZIP, `Enter` set home, `Delete` remove |
| `N` | Map Navigation — `Tab` switches Storms / Alerts / Grid |
| `[` / `]` | (Grid Explorer) smaller / larger cursor step |
| `Ctrl+M` | Mute / unmute music |
| `Ctrl+→` | Next music track |
| `0` | Weather Radio on / off |
| `1` / `Shift+1` | Music volume up / down 5% |
| `2` / `Shift+2` | Weather Radio volume up / down 5% |
| `3` | Speak active weather alerts |
| `,` | Settings |
| `?` | Help |
| `Esc` | Exit Favorites / Map Nav; close a dialog; otherwise silence speech |

Number keys are reserved for instant audio and alert control rather than scene jumping, on the theory that volume and "what are the alerts" are what you need *right now*, while scene selection can afford a Tab or two.

## Accessibility design notes

For anyone evaluating the app, or curious how the accessibility is actually implemented.

**Two live-region channels, not one.** Announcements are split into polite and assertive queues, driven independently. An urgent alert doesn't wait behind a scene description. The queue breaks repeats (so an identical message twice in a row is still announced) and has a cancel that genuinely clears the regions.

**A modality gate.** Every window-level key handler — the global shortcut router, both arrow-navigation hooks, Map Nav, Favorites — checks a shared modal gate and stands down while a dialog is open. `inert` blocks focus but not window keydown listeners, so without this a dialog would appear modal while background shortcuts still fired underneath it.

**Focus management that matches NVDA's model.** Dialogs render into a portal attached to `document.body`, not inside the `role="application"` region, because NVDA's dialog context switch depends on that. Focus moves in on open and is restored on close; Tab wraps within the dialog; `#root` is marked inert.

**Shifted punctuation is handled properly.** `?` is Shift+/ on a US keyboard. The shortcut router understands that shifted symbols shouldn't carry a `shift+` prefix — before that fix, the Help shortcut was literally unmatchable.

**Failures are audible.** A scene that can't load its data says so and retries on the next cycle instead of showing a blank screen. A crashed scene is caught by an error boundary that announces a recovery hint via `role="alert"`. Cached data served after a network failure is announced as stale rather than presented as current. A Weather Radio stream that dies says so after five attempts and tells you what to do about it.

**Reduced motion is respected**, including swapping animated weather icons for still frames.

## Your data and privacy

There is no account, no server-side profile, and no analytics. The application is entirely client-side.

Your home location, favourites and settings live in local storage on your own machine or browser. Weather data is requested directly by your device from public sources: api.weather.gov for forecasts and alerts, api.zippopotam.us for ZIP lookup, RainViewer for radar, the FAA for airport delays, and the weatherUSA relay for Weather Radio. The National Weather Service asks API users to identify themselves, so requests carry an application name and a contact address.

On the web version, the only thing the server does with your location is nothing — it never sees it. ZIP lookup and weather requests go from your browser to those public APIs directly.

## Assets

The media library — fonts, weather icons, background art, narration clips and music — is roughly 1.3 GB and is not included in the repository (`assets/` is gitignored). **The application runs without it**, falling back to system fonts, no music, and screen-reader-only narration. Nothing breaks; it just looks and sounds plain.

Expected layout under `assets/`:

- `fonts/` — WeatherStar and IntelliStar typefaces
- `icons/` — condition icon sets by resolution and era
- `backgrounds/`, `themes/` — per-era background art
- `narration/` — narrator clip libraries, one directory per voice
- `music/` — era music pools
- `sounds/`, `sfx/` — the mnemonic, alert tones, crawl beeps
- `logos/` — TWC, NOAA and IntelliStar marks

Audio is served as MP3 and images as WebP — chosen because they are the two formats every browser on Windows, macOS and Linux decodes without depending on OS codecs. See `docs/asset-pipeline.md` for how the library is encoded, and the README's attribution section for sources and licences of the fan-maintained material.

## Troubleshooting

**No sound at all.** Audio needs one keypress after launch ("Press any key to start audio"). Then check that music and radio volumes weren't nudged to zero with `1` and `2`.

**Two voices talking over each other.** The app has no built-in TTS, so this is your screen reader plus the recorded narrator clips — by design. If the clips get in the way, turn off "Use voice clips for narration" in Settings → Audio, or drop the voice level.

**Scenes advance before I finish reading.** Raise *Post-narration delay* in Settings → Audio, or turn off *Auto-cycle* and drive the loop yourself with Tab.

**Scenes say "unavailable".** The NWS API is unreachable. The app retries automatically and serves the last good data where it has any, announcing it as stale. A scene that errored shows a retry note and heals on the next cycle.

**Weather Radio won't play.** The transmitter's relay may be down — after five retries the app says so. Open Settings and pick another station; the list shows only stations currently live. In a browser, also confirm the site's `/nwr/` proxy is reachable. Corporate and school networks sometimes block Icecast streams outright.

**A shortcut doesn't fire.** If focus is in a text field (ZIP entry, station picker), ordinary keys type instead of triggering shortcuts — press Escape first. NVDA users: the app forces focus mode automatically, but if you manually switched to browse mode, switch back with NVDA+Space.

**The display looks wrong, or fonts look generic.** The `assets/` library isn't populated. The app degrades gracefully by design.

**Something crashed.** A crashed scene announces a display problem with a recovery hint and repairs itself on the next scene change. If the whole app is wedged, restarting loses nothing — every setting and place is persisted.

**The application vanished with no warning.** As of 0.13.0 it should tell you first: an unrecoverable error raises a notification reading "Accessible Weather Center has stopped" and names a log file. If you want to report it, that file has the details:

| Platform | Log location |
|---|---|
| Windows | `%APPDATA%\accessible-weather-center\logs\main-crash.log` |
| macOS | `~/Library/Application Support/accessible-weather-center/logs/main-crash.log` |
| Linux | `~/.config/accessible-weather-center/logs/main-crash.log` |

If the app disappeared and that file does *not* exist, it was killed from outside — the operating system's out-of-memory handler, a task manager, or a power event — rather than crashing on its own.

**There's no icon in the system tray.** Fixed in 0.13.0; the icon had never rendered in any packaged build before that. On Linux, some desktop environments also need an AppIndicator extension for tray icons to appear at all — GNOME in particular.
