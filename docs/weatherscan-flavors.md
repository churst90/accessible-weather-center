# Weatherscan Flavors — Research Notes

A "flavor" is what Weatherscan called each screen in its loop. Different markets and different times of day showed different sets, but this document captures the canonical lineup so future scenes can be modeled on real history.

The four scenes shipped in v0.1 (Current Conditions, Hourly Forecast, Extended Forecast, Alerts) cover the most-used flavors but are nowhere near the full set. Everything below is on the implementation backlog and can be enabled/disabled per-flavor through Settings (`,`).

## Always-on flavors

| Flavor                  | Implemented | What it shows                                          |
| ----------------------- | :---------: | ------------------------------------------------------ |
| Current Conditions      | ✓ v0.1      | Temp, feels-like, humidity, wind, pressure, visibility, ceiling |
| Local Forecast          |             | 36-hour narrative split by daypart                     |
| Tonight / Today         |             | Single-period detailed forecast for next major period  |
| Extended Forecast       | ✓ v0.1      | 5–7 day forecast                                       |
| Hourly Forecast         | ✓ v0.1      | Next 12 hours by hour                                  |
| Local Radar             | ✓ v0.3      | Text-based radar via StormScanner; animated tiles TODO  |
| Regional Doppler        |             | Wider radar zoom, often with national context inset    |
| Almanac                 |             | Sunrise/sunset, moonrise/moonset, moon phase, record highs/lows |
| Heating & Cooling Days  |             | Degree-day accumulation vs normal                      |

## Travel & lifestyle

| Flavor               | What it shows                                              |
| -------------------- | ---------------------------------------------------------- |
| Travel Cities — East / Central / West | List of cities with current conditions and high/low |
| Travel Cities — Sports / Vacation     | Themed travel-city groupings                       |
| Travel Outlook       | Forecast at major airline hubs                             |
| Airport Delays       | Real-time hub delay status (TWC fed this from FAA at one point) |
| Health               | Pollen, UV index, air quality                              |
| Allergy              | Tree / grass / weed pollen counts (seasonal)               |
| Cold & Flu           | Risk index (winter)                                        |

## Region-specific

| Flavor          | Where                                                      |
| --------------- | ---------------------------------------------------------- |
| Boat & Beach    | Coastal markets — marine forecast, surf, water temp, tides |
| Ski Report      | Mountain markets — base depth, new snow, lift status       |
| Aviation        | Hub markets — winds aloft                                  |
| Lake Levels     | Great Lakes / reservoir markets                            |

## Severe weather (interrupt)

| Flavor                | Behavior                                              |
| --------------------- | ----------------------------------------------------- |
| Severe Weather Alert  | ✓ v0.4 (partial) | Preempts the loop with the alert chime, orange background takeover, scrolling ticker with affected areas. Modeled as an "interrupt" that suspends normal cycling. v0.3 had alert polling + tones but no visual takeover or auto-jump. |
| Storm Tracker         |             | Animated track of an active severe cell with arrival times for cities in its path. Uses StormScanner data. |

## National (occasional filler)

| Flavor                | What it shows                                          |
| --------------------- | ------------------------------------------------------ |
| National Weather Map  | National radar / forecast snapshot                     |

## Implementation status (v0.7, 2026-04-14)

### Core Weatherscan loop (default ON, authentic order — varies per theme)
| # | Flavor | Scene ID | Status | Narrator clips |
|---|--------|----------|--------|---------------|
| 1 | Current Conditions | `current` | ✓ v0.1 | AJ: full, JC: full, Amy: intro, Chandler: intro |
| 2 | Local Forecast | `localforecast` | ✓ v0.4 | AJ: full, JC: full, Amy: intro, Chandler: intro |
| 3 | Local Radar | `radar` | ✓ v0.3 | AJ: intro, JC: intro, Amy: intro, Chandler: detailed |
| 4 | Extended Forecast | `extended` | ✓ v0.1 (era-aware in v0.7) | AJ: full (5-day + 7-day intro pools), JC: full (7-day only), Amy: TTS, Chandler: intro |
| 5 | Hourly Forecast | `hourly` | ✓ v0.1 | AJ: full, JC: full, Amy: intro, Chandler: intro |
| 6 | Travel Cities | `travel` | ✓ v0.4 | AJ: intro, Chandler: intro |
| 7 | Almanac | `almanac` | ✓ v0.4 | AJ: intro |

### Value-add scenes (default OFF, toggleable in Settings)
| Flavor | Scene ID | Status | Notes |
|--------|----------|--------|-------|
| Detailed Conditions | `detailed` | ✓ v0.4 | Wind/humidity/pressure detail |
| Feels Like | `feelslike` | ✓ v0.4 | Heat index / wind chill |
| Storm Tracker | `stormtracker` | ✓ v0.4 | RainViewer-based cell tracking |
| Overnight Forecast | `overnight` | ✓ v0.4 | Tonight's single-period forecast |
| Weekend Forecast | `weekend` | ✓ v0.4 (dedicated intro v0.7) | Saturday/Sunday periods. AJ: "heading into the weekend", JC: "This weekend" |
| Precip Outlook | `precip` | ✓ v0.4 | Precipitation probability chart |
| Temperature Trend | `temptrend` | ✓ v0.4 | 12-hour rising/falling/steady |
| Traffic | `traffic` | ✓ v0.7 (unavailable placeholder) | No free data source; renders `SceneUnavailable`. AJ + Amy intros still play if enabled. |
| Airport Delays | `airport` | ✓ v0.7 | Live FAA NAS Status XML feed (`nasstatus.faa.gov/api/airport-status-information`), 5-minute cache. Sorts worst delay first. Falls to unavailable on fetch error. |
| Alerts | `alerts` | ✓ v0.4, severe-tone v0.7 | Severe weather interrupts. AJ plays NWS 4-beep + spoken warning; JC plays tier-4/2/1 crawl-audio beep + event announcement. |

### Planned scenes (not yet built)
| Flavor | Data Source | Cost | Clips ready |
|--------|-----------|------|-------------|
| Air Quality / UV | EPA AirNow + UV APIs | Free (key for AirNow) | Amy: "The pollen report for your area" |
| Regional Forecast | NWS API (already available) | Free | Amy (RegionalForecastConditions.mp3 held for this) + Chandler (32 rf/* clips) |
| Regional Conditions | NWS nearby stations | Free | Chandler (8 rc/* clips) |
| Pollen/Allergy | No reliable free API | **N/A** | Amy: clip ready (kept as placeholder), no data |

### Era-aware multi-day forecast

Each theme declares `extendedStyle: "5-day" | "7-day"` plus an `extendedTitle`. Intros are tagged with matching `eras: ["5-day"]` / `["7-day"]` so `pickSceneIntro` filters the pool to the active theme.

| Theme | Title | Period count | AJ intro pool |
|---|---|---|---|
| WS4000, WS Jr, 1990s Classic | "Extended Forecast" | 10 periods (~5 days) | "Your extended forecast" / "Our extended forecast" |
| WS 3000 | "Extended Forecast" | 10 periods | Silent narrator default |
| WS XL | "Extended Forecast" | 14 periods | Full 7-day pool |
| Weatherscan, IS2, IS2 Jr, High Contrast | "7-Day Outlook" | 14 periods | Full 7-day pool |
| IntelliStar 1 | "Week Ahead" | 14 periods | Full 7-day pool (JC) |

### TODO for next session
1. Wire up a Regional Forecast scene (NWS data + Amy `RegionalForecastConditions.mp3` + Chandler's `rf/` pool).
2. Air Quality scene (EPA AirNow API, free with registration).
3. Time-of-day weighted scheduler (heavier on Almanac at night, Travel Cities mid-morning, etc.).
4. Clean up orphaned severe-clip `.wav` duplicates in the asset folder (see CHANGELOG v0.7 migration notes).

## Where to look for visual/audio reference

I cannot fetch or redistribute trademarked TWC/Weatherscan assets. Below are public reference points the user can investigate independently. No promises about license — verify before borrowing anything.

- **WeatherStar 4000+** (open source) — emulates the older WeatherStar 4000 unit, not Weatherscan, but uses the same family of fonts, colors, and layout conventions. Good architectural reference.
- **Weatherscan emulator projects** — there are at least two community projects on GitHub. Search GitHub for `weatherscan` to find current ones.
- **Archive.org** has hours of Weatherscan recordings. Useful as a visual study.
- **TWC Today** (community wiki / fan site) documents many of the flavor variations and time-of-day rotation rules.

## Time-of-day rotation

Weatherscan didn't show every flavor every hour. The rotation logic varied by version and time of day:

- **Daytime** (6 AM – 6 PM): heavier on Travel Cities, Today's Forecast, Extended, Almanac
- **Evening** (6 PM – 11 PM): Tonight's Forecast, Health, Allergy
- **Overnight** (11 PM – 6 AM): heavier on Local Radar, Almanac, Extended

Modeling this is on the TODO list under "Smart scheduler" — the existing `SceneScheduler` doesn't yet know about time-of-day-weighted ordering.

## Music and flavor pairing

The original Weatherscan had a music scheduler that mapped music tracks to flavor families and time of day. The v0.2 `MusicPlayer` does a coarser version of this via mood tags on each scene. Flavor → mood pairings shipped:

| Flavor             | Mood cue (current) | Notes                                  |
| ------------------ | ------------------ | -------------------------------------- |
| Current Conditions | `calm`             | Trammell Starks "Lazy Days", "Pastel" etc. fit |
| Hourly Forecast    | `calm`             | Same                                   |
| Extended Forecast  | `uplift`           | Trammell Starks "Brighter Days", "The Promise of Tomorrow" |
| Alerts             | `alert`            | "The Chase", or jazz fillers when no alert-tagged track matches |

When a future scene like Travel Cities lands, `upbeat` is the natural cue ("Cool Cats", "Funk Dance"). For Local Radar with active precipitation, `rain` is the cue ("Rainy Days").
