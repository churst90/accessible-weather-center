# Accessible Weather Center — User Manual

This manual is written for screen-reader users first. Everything in the application can be done from the keyboard, and everything the application shows on screen is also spoken or exposed to your screen reader. Sighted users are welcome too — the visuals recreate The Weather Channel's classic 24/7 local-forecast systems — but no part of this manual assumes you can see the screen.

Current as of version 0.10.0.

## Contents

1. [What this application is](#what-this-application-is)
2. [Screen readers and speech modes](#screen-readers-and-speech-modes)
3. [First launch](#first-launch)
4. [The scene loop](#the-scene-loop)
5. [Navigating inside a scene](#navigating-inside-a-scene)
6. [Favorites: managing your locations](#favorites-managing-your-locations)
7. [Map Navigation: exploring the radar as data](#map-navigation-exploring-the-radar-as-data)
8. [NOAA Weather Radio](#noaa-weather-radio)
9. [Alerts and severe weather](#alerts-and-severe-weather)
10. [Themes and narrators](#themes-and-narrators)
11. [Settings reference](#settings-reference)
12. [Full keyboard reference](#full-keyboard-reference)
13. [Assets](#assets)
14. [Troubleshooting](#troubleshooting)

## What this application is

Accessible Weather Center is a desktop weather application that recreates the cycling "local weather channel" experience — Current Conditions, Local Forecast, Radar, Extended Forecast, and so on, rotating automatically with background music and a narrator — while treating accessibility as the primary design constraint, not an afterthought.

The application's core promise: **anything a sighted user can see, you can hear or navigate.** That includes radar, which is normally a wall of inaccessible colored pixels. Here, radar is analyzed into storm objects with distance, direction, movement, and intensity, and you can walk them with arrow keys.

## Screen readers and speech modes

The application speaks through exactly two channels, by design:

1. **Your screen reader.** Every announcement — scene content, navigation readouts, alerts, status messages — is pushed into aria-live regions that NVDA, JAWS, Narrator, Orca, or VoiceOver read in your own voice, at your own rate. There is deliberately **no built-in text-to-speech**: the app never speaks with an OS voice, and there is nothing to configure or turn off.
2. **Recorded narrator clips.** The authentic TWC narrator voices (see [Themes and narrators](#themes-and-narrators)) play as audio through the app's mixer — the weather-channel narrator experience. This coexists fine with your screen reader: the clips are the atmosphere, your screen reader is the precise data channel. Clip narration can be disabled in Settings → Audio.

The main stage uses `role="application"`, so NVDA and JAWS switch to focus mode automatically. All shortcuts are global — you never need to find a specific control first.

## First launch

1. Start the application (`npm run dev` plus `npm run dev:electron`, or the packaged build).
2. **Press any key to start audio.** Browsers and Electron require a user gesture before audio can play; until then the status line reads "Press any key to start audio". Your first keypress unlocks the mixer, plays the startup mnemonic jingle, and starts music (if enabled).
3. The scene loop begins at Current Conditions for the default location and announces it.
4. **Set your own location:** press `M` for Favorites, press `Z`, type your ZIP code, and press Enter. The place is added and announced. Select it with the arrow keys and press Enter to make it your home — every scene, alert, and radar scan now follows it. Press Escape to return to the scenes.

Your home location, favorites, and all settings persist between sessions.

## The scene loop

The application continuously cycles through weather scenes, each shown and narrated, then advancing after narration finishes plus a configurable delay.

- `Tab` — next scene. `Shift+Tab` — previous scene.
- `Space` — pause or resume the automatic cycling. Paused, the current scene stays until you Tab manually.
- `Esc` — silence the current narration/announcement.

Which scenes appear, and in what order, depends on your theme (each TWC hardware era had its own rundown) and on your Settings — eight core scenes are on by default, and nine more value-add scenes (Feels Like, Storm Tracker, Airport Delays, and others) can be enabled in Settings → Scenes.

Each scene announces its content as structured speech — for example Current Conditions reads temperature, condition, humidity, wind, pressure, and visibility in a fixed, predictable order.

## Navigating inside a scene

Scenes with tabular or list content (Extended Forecast, Hourly, Travel Cities, Temperature Trend, Almanac, Alerts, Radar's storm table) support arrow navigation:

- `←` `→` — move between columns (for example, days in the Extended Forecast).
- `↑` `↓` — move between rows or list items.
- `Home` / `End` — first / last item in the current row or list.

Every move announces the newly-focused cell. The narrative scenes (Local Forecast, Overnight) use Up/Down to walk periods of the forecast text.

## Favorites: managing your locations

Press `M` to enter Favorites; press `M` or `Escape` to leave.

- `↑` `↓` — walk your saved places. Each announces name, current role (home or favorite), and position in the list.
- `Z` — jump to the ZIP entry field. Type a US ZIP code, press Enter; the place is looked up, added, and announced. (While typing, ordinary keys go into the field, not to shortcuts.)
- `Enter` — make the selected place your **home**. Home drives everything: the scene loop, alert polling, radar scans, and the Weather Radio station suggestion, all of which switch immediately.
- `Delete` or `Backspace` — remove the selected place.

Your home and favorites also feed the **Travel Cities** scene.

## Map Navigation: exploring the radar as data

Press `N` to enter Map Navigation; press `N` or `Escape` to leave. This is the deepest accessibility feature in the application: the radar picture around your home (150-mile radius, refreshed every couple of minutes) is converted into navigable objects.

Map Navigation has three modes. `Tab` and `Shift+Tab` cycle between them; each switch is announced.

### Storms mode

Walks every detected storm, nearest first.

- `↑` `↓` — previous / next storm. Each announces like: *"Storm 2. Heavy rain, 23 miles to the northwest, moving east at 25 miles per hour, 40 minutes away."*
- `Home` / `End` — nearest / farthest storm.
- `Enter` — full detail: peak rainfall rate, storm radius, movement vector, and estimated arrival time if it is heading toward you.

Storm identities are stable — a storm keeps its identity from scan to scan, so "new storm" announcements really mean a new storm, and movement reflects genuine change between radar frames.

### Alerts mode

Walks every active NWS alert for your area.

- `↑` `↓` — previous / next alert, announcing event type and headline.
- `Enter` — the full alert: severity, urgency, certainty, affected areas, and the complete instruction text.

### Grid Explorer mode

A virtual cursor you move across the map. Every press answers "what's the weather *there*?"

- `←` `→` `↑` `↓` — move the cursor west / east / north / south. Each press gives an immediate answer (relative position, precipitation at that spot, any alerts covering it), followed a moment later by a fuller description with the nearest city, county, and state once the geocoder responds.
- `[` and `]` — **decrease / increase the step size.** Steps are 1, 3, 5, 10, or 25 miles per press; the new step is announced and remembered. Use 1–3 miles to trace a storm's edge across your county, 10–25 to sweep a region. The default lives in Settings → Accessibility → "Map grid step".
- `Home` — jump the cursor back to your location.
- `Enter` — repeat the full description for the current position.

Steps are true miles in both directions — the application compensates for the fact that a degree of longitude shrinks as you move north.

## NOAA Weather Radio

The application can stream live NOAA Weather Radio transmitters (via weatherUSA's community relay network) in the background on an independent audio channel — narration ducks the music but never the radio, because the radio may be telling you about a warning.

- `0` — toggle the stream on or off. Turning it on announces the station.
- `2` / `Shift+2` — radio volume up / down 5%, announced.
- Settings → NOAA Weather Radio — enable checkbox, station picker with autocomplete, volume slider.

**Choosing a station:** the picker lists stations known to be live right now (a bundled snapshot merged with a live check each time you open Settings). If you leave the station blank, the application matches your home city *and state* to the nearest known transmitter. Note that weatherUSA does not relay every NWS transmitter — if your exact local station isn't there, pick the nearest metro that is.

**If a stream fails:** the player retries with increasing delays; after five consecutive failures it announces that the station is unavailable and suggests choosing another. Re-selecting a station (even the same one) or changing any audio setting retries; so does toggling `0` off and on.

## Alerts and severe weather

The application polls NWS alerts for your home location every minute.

- **Any new alert** is announced assertively (interrupting other speech) with its event name and headline, plays an attention tone, and — when the application is minimized to the tray — fires an operating-system notification.
- **Severe or Extreme alerts** (Tornado Warning, Severe Thunderstorm Warning, etc.) additionally interrupt the scene loop: the application jumps to the Alerts scene, the visual theme switches to the emergency takeover, and a crawl runs with the alert text. The interrupt clears when the severe alerts expire.
- `3` — speak the current active alerts at any time (or "no active alerts").

Changing your home location resets alert tracking, so alerts already in effect at the new location are announced as if fresh — you will never silently sit inside a warning you weren't told about.

Radar-derived storm warnings ("storm approaching") are a separate, complementary layer from the scanner — they tell you about rain and storms *before* any official alert exists. Official NWS alerts always take priority.

## Themes and narrators

Ten visual themes recreate seven generations of TWC hardware, from the 1988 WeatherStar 3000 to the modern IntelliStar 2 HD. A theme selects the visual skin, typography, background art, music pool, **scene order**, and default narrator. Change themes in Settings → Theme.

The narrators are recorded voice-clip libraries:

- **Allan Jackson** — the deepest library (thousands of clips): current conditions, extended/hourly forecasts, local forecast narratives, alerts, and more. Default for the WeatherStar and Weatherscan Local eras.
- **Jim Cantore** — IntelliStar 1 era clips including warning headlines and accumulation phrasing.
- **Amy Bargeron** — Weatherscan V1/V2 scene intros.
- **Chandler** — IntelliStar 2 era intros.
- **Silent** — no clip narration (WS3000 had no local voice); your screen reader still announces everything.

You can override the narrator per Settings → Audio → "Voice narrator". The "Clip confidence threshold" setting controls how adventurous the clip matching is; anything without a suitable clip is simply carried by the announcement channel instead.

A **high-contrast** overlay (Settings → Theme) can be layered on any theme for low-vision use.

## Settings reference

Open with `,` (comma). Close with Escape. The panel is a proper modal — focus moves in, Tab cycles inside it, and the scene behind is inert.

- **Accessibility** — map grid step default. (Announcements always go to your screen reader; there is no speech engine to configure.)
- **Theme** — visual theme; high contrast.
- **Audio** — background music on/off and volume; voice-clip narration on/off; narrator; clip confidence; bundled vs synthesized alert tone; post-narration delay (how long a scene lingers after speech).
- **NOAA Weather Radio** — enable, station, volume.
- **Scenes** — enable/disable each scene in the cycle.

All settings persist and take effect immediately.

## Full keyboard reference

Press `?` at any time for this list in-app.

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Next / previous scene |
| `←` `→` `↑` `↓` | Navigate within the scene |
| `Home` / `End` | First / last item in row or list |
| `Space` | Pause / resume the scene loop |
| `M` | Favorites (place picker) — `Z` add ZIP, `Enter` set home, `Delete` remove |
| `N` | Map Navigation — `Tab` switches Storms / Alerts / Grid modes |
| `[` / `]` | (Grid Explorer) smaller / larger cursor step |
| `Ctrl+M` | Mute / unmute music |
| `Ctrl+→` | Next music track |
| `0` | Weather Radio on / off |
| `1` / `Shift+1` | Music volume up / down |
| `2` / `Shift+2` | Weather Radio volume up / down |
| `3` | Speak active alerts |
| `,` | Settings |
| `?` | Help |
| `Esc` | Exit Favorites / Map Nav; close modal; otherwise silence speech |

## Assets

The repository does not include the ~5 GB of fonts, weather icons, background art, narration clips, and music (the `assets/` directory is gitignored — the app runs without them, falling back to system fonts, no music, and announcement-only narration).

To set up a full asset library, the expected layout under `assets/` is:

- `fonts/` — WeatherStar and IntelliStar typefaces (`star4000/`, `frutiger/`, etc.)
- `icons/` — weather condition icon sets by resolution and era
- `backgrounds/`, `themes/` — per-era background art
- `narration/` — narrator clip libraries (`Allan Jackson/`, `Jim Cantore/`, `Amy/`, `Chandler/`)
- `music/` — era music pools
- `sounds/`, `sfx/` — mnemonic jingle, alert tones, crawl beeps
- `logos/` — TWC / NOAA / IntelliStar marks

Sources and licenses for the fan-maintained portions are listed in the README's "Fan-sourced assets and attribution" section.

## Troubleshooting

**No sound at all.** Audio needs one keypress after launch ("Press any key to start audio"). Check the music/radio volumes (`1`, `2`) weren't nudged to 0%.

**Two voices talking over each other.** The app itself has no built-in TTS, so overlapping speech means your screen reader plus the recorded narrator clips. If the clips bother you, turn off "Use voice clips for narration" in Settings → Audio, or lower the voice with the music/radio volume keys.

**Scenes say "unavailable".** The NWS API is unreachable — check your connection. The app retries automatically and will serve the last good data where it has any (announcing it as such). If a scene errored, it shows a retry note and heals on the next cycle.

**Weather Radio won't play.** The transmitter's relay may be down — after five retries the app says so. Open Settings and pick another station; the list shows only stations currently live. Corporate/school networks sometimes block Icecast streams.

**A shortcut doesn't fire.** If focus is inside a text field (ZIP entry, station picker), ordinary keys type instead of triggering shortcuts — Escape first. NVDA users: the app forces focus mode automatically; if you manually switched to browse mode, switch back (NVDA+Space).

**The display looks wrong / fonts look generic.** The `assets/` library isn't populated (see [Assets](#assets)) — the app is designed to degrade gracefully without it.

**Something crashed.** A crashed scene announces "Display problem" with a recovery hint and repairs itself when the scene changes. If the whole app is wedged, restarting loses nothing — every setting and place is persisted.
