# IntelliStar 1 — authentic product rundown and timings

Extracted by `npm run rundowns:extract` from 3839 real per-headend
IntelliStar configuration files. Do not edit by hand.

Durations are seconds, as the machine was configured. Modal across all
markets — these are authored choices, so the most common value is the
intended one and a market that customised is an outlier, not error to
average away.

**These timings are reference, not settings.** Our scenes hold for
`holdMs` *after* narration completes, because a screen-reader user needs
the words before the dwell; broadcast durations are total time on screen.
Substituting one for the other would cut screens short for precisely the
users this application exists for. The ORDERING is what feeds back into
the device profiles.

## Derived rundown order

Products mapped to our scene ids, in broadcast priority order:

```
alerts → current → localforecast → radar → extended → hourly → travel → airport → almanac → traffic → airquality → detailed
```

## Full product table

| priority | product | markets | min | max | optimal | our scene |
|---:|---|---:|---:|---:|---:|---|
| 1 | NWSHeadlines | 22076 | 7 | 8 | 7 | alerts |
| 1 | CurrentConditions | 19534 | 8 | 11 | 4 | current |
| 1 | TextForecast | 16269 | 36 | 36 | 28 | localforecast |
| 1 | RegionalDopplerRadar | 11035 | 8 | 8 | 8 | radar |
| 1 | MetroDopplerRadar | 11032 | 12 | 16 | 0 | radar |
| 1 | 7DayForecast | 11021 | 14 | 16 | 10 | extended |
| 1 | 5DayForecast | 8496 | 11 | 11 | 0 | extended |
| 1 | 36HourForecast | 7080 | 10 | 10 | 0 | localforecast |
| 1 | SqueezebackFade | 1563 | 100 | 100 | 100 | — |
| 1 | HourlyForecast | 1443 | 0 | 0 | 0 | hourly |
| 1 | WeatherBulletin | 1416 | 5 | 5 | 0 | — |
| 1 | DopplerRadar | 1416 | 8 | 8 | 4 | — |
| 1 | CurrentConditionsSmall | 1416 | 12 | 12 | 0 | — |
| 1 | DaypartForecastSmall | 1416 | 16 | 16 | 8 | — |
| 1 | 5DayForecastSmall | 1416 | 20 | 20 | 0 | — |
| 1 | Void | 1225 | 1 | 600 | 1 | — |
| 1 | TodayLDL | 1075 | 5 | 8 | 4 | — |
| 1 | IntroAnimation | 989 | 2 | 2 | 2 | — |
| 1 | RadarSatellite | 944 | 8 | 8 | 8 | — |
| 1 | WelcomeFS | 860 | 3 | 3 | 3 | — |
| 1 | IntroFS | 442 | 2 | 2 | 2 | — |
| 1 | LocalOCM | 430 | 65 | 65 | 65 | — |
| 1 | HurricaneWatch | 317 | 4 | 12 | 4 | — |
| 1 | TornadoWatch | 317 | 6 | 480 | 6 | — |
| 1 | SevereThunderstormWatch | 317 | 6 | 480 | 6 | — |
| 1 | LASCrawl | 245 | 4 | 120 | 4 | — |
| 1 | IntroAnimationSmall | 236 | 2 | 2 | 2 | — |
| 1 | DailyForecast | 81 | 4 | 20 | 4 | — |
| 1 | TravelForecast | 63 | 3 | 9 | 3 | travel |
| 1 | 3DayForecast | 63 | 3 | 9 | 3 | — |
| 1 | TrafficTripTimes | 54 | 4 | 480 | 4 | — |
| 1 | AirportDelayConditions | 54 | 3 | 18 | 3 | airport |
| 2 | ExtendedForecast | 12583 | 10 | 12 | 8 | extended |
| 2 | Unavailable | 1562 | 1 | 60 | 1 | — |
| 2 | TonightLDL | 1075 | 5 | 8 | 4 | — |
| 2 | CurrentObs | 461 | 4 | 44 | 4 | — |
| 3 | MetroForecastMap | 22042 | 8 | 10 | 6 | — |
| 3 | TomorrowLDL | 1075 | 5 | 8 | 4 | — |
| 3 | Null | 215 | 3 | 3 | 3 | — |
| 4 | DaypartForecast | 13295 | 8 | 12 | 7 | hourly |
| 4 | RegionalObservationMap | 11036 | 8 | 10 | 6 | — |
| 4 | RecordHighLow | 11029 | 8 | 8 | 6 | almanac |
| 4 | NowLDL | 1075 | 10 | 15 | 8 | — |
| 5 | OutdoorActivityForecast | 11025 | 8 | 10 | 7 | — |
| 5 | SevereAlertFS | 1075 | 8 | 8 | 6 | — |
| 5 | SevereAlertLDL | 215 | 5 | 15 | 5 | — |
| 6 | GetawayForecast | 11027 | 8 | 10 | 7 | travel |
| 6 | MetroObservationMap | 1729 | 7 | 10 | 6 | — |
| 7 | RegionalForecastMap | 22046 | 8 | 10 | 6 | — |
| 7 | SchoolDayWeather | 11026 | 8 | 10 | 7 | — |
| 8 | Climatology | 11031 | 8 | 10 | 7 | almanac |
| 8 | HeatSafetyTips | 11028 | 8 | 8 | 6 | — |
| 8 | MarineForecast | 11027 | 12 | 14 | 10 | — |
| 9 | TrafficReport | 33103 | 8 | 12 | 7 | traffic |
| 9 | TrafficOverview | 33053 | 10 | 11 | 8 | traffic |
| 9 | TrafficFlow | 22029 | 7 | 10 | 7 | traffic |
| 9 | Almanac | 11085 | 8 | 10 | 7 | almanac |
| 9 | AirQualityForecast | 11063 | 7 | 10 | 6 | airquality |
| 9 | LocalObservations | 11035 | 12 | 14 | 10 | detailed |
| 9 | RadarSatelliteComposite | 11032 | 8 | 8 | 8 | — |
| 10 | Satellite | 11031 | 8 | 8 | 8 | — |
| 10 | Tides | 11027 | 10 | 10 | 8 | — |
| 10 | NowFS | 645 | 8 | 90 | 6 | — |
| 10 | WeekAheadLDL | 215 | 10 | 12 | 8 | — |
| 11 | WeekendLDL | 215 | 10 | 12 | 8 | — |
| 12 | NextWeekLDL | 215 | 10 | 12 | 8 | — |
| 17 | HourlyTodayLDL | 215 | 20 | 28 | 16 | — |
| 18 | HourlyTonightLDL | 215 | 20 | 28 | 16 | — |
| 19 | HourlyTomorrowLDL | 215 | 20 | 28 | 16 | — |
| 20 | RegionalRadarFS | 1075 | 8 | 8 | 8 | — |
| 30 | MetroRadarFS | 1075 | 8 | 12 | 8 | — |
| 40 | TodayFS | 645 | 10 | 90 | 8 | — |
| 40 | MetroNowMapFS | 430 | 9 | 14 | 7 | — |
| 41 | OutroFS | 627 | 2 | 2 | 2 | — |
| 50 | 7DayForecastFS | 1075 | 12 | 14 | 10 | — |
| 60 | SummaryFS | 448 | 4 | 9 | 4 | — |
| 70 | TonightFS | 645 | 10 | 90 | 8 | — |
| 70 | TodayMapFS | 430 | 9 | 10 | 7 | — |
| 72 | TomorrowFS | 645 | 10 | 12 | 8 | — |
| 75 | TomorrowNightFS | 627 | 10 | 10 | 8 | — |
| 80 | TonightMapFS | 430 | 9 | 10 | 7 | — |
| 130 | TomorrowMapFS | 430 | 9 | 10 | 7 | — |
| 131 | TomorrowNightMapFS | 430 | 9 | 10 | 7 | — |
