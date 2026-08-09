# Weatherscan v2 (L-bar, 2005-2022) — screen layouts

Extracted by `npm run layouts:extract` from TWC's own render scripts
(`twc_wxscan_dynamic-2.13_p1.tgz`, product package `weatherscan-packages`). Do not edit by hand.

Coordinates are the machine's own, in its native raster. These are not
measurements taken off a screenshot — they are the values the hardware
drew with, so a view built against them is exact rather than close.

Device profile: `src/devices/profiles/weatherscan-v2.ts`

---

### SevereWeatherCrawl

Typefaces: Interstate-Bold 23pt, Interstate-BoldCondensed 18pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 6 | element | crawl |  |
| 0 | 0 | element | box |  |
| 0 | 25 | element | box |  |
| 22 | 29 | text | headline | Interstate-BoldCondensed 18pt |

### CityTicker

Typefaces: Interstate-BoldCondensed 16pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 3 | 3 | text | string.upper(label) | Interstate-BoldCondensed 16pt |
| 0 | 0 | image | tabfile |  |
| 0 | 3 | element | tabCR |  |
| 0 | 0 | element | tabBlend |  |
| 0 | 0 | element | cr |  |
| 0 | 1 | element | m |  |

### _AirportDelays

Typefaces: Interstate-Bold 19pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 2 | text | txt | Interstate-Bold 19pt |

### _Background


| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 0 | element | background |  |

### _LocalCitiesCurrentConditions

Typefaces: Interstate-Bold 19pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 2 | text | txt | Interstate-Bold 19pt |

### _LocalCitiesForecast

Typefaces: Interstate-Bold 19pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 2 | text | txt | Interstate-Bold 19pt |

### _TravelCitiesCurrentConditions

Typefaces: Interstate-Bold 19pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 2 | text | txt | Interstate-Bold 19pt |

### _TravelCitiesForecast

Typefaces: Interstate-Bold 19pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 2 | text | txt | Interstate-Bold 19pt |

### SplashScreen

Typefaces: Frutiger_Bold 16pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 0 | image | <%-imageFile%> |  |
| 180 | 120 | image | /rsrc/images/istarLogo |  |
| 70 | 92 | text | headend Id: %s' % (<%-headendId%>) | Frutiger_Bold 16pt |
| 70 | 76 | text | serial number: %s' % (<%-serialNum%>) | Frutiger_Bold 16pt |
| 70 | 60 | text | location name: %s' % (<%-locName%>) | Frutiger_Bold 16pt |
| 70 | 44 | text | affiliate name: %s' % (<%-affiliateName%>) | Frutiger_Bold 16pt |
| 600 | 62 | image | filename |  |
| 490 | 44 | image | filename |  |

### Default

Typefaces: Frutiger_Bold_Cond 15pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 0 | image | backImage |  |
| 0 | 0 | element | gr |  |
| 76 | 35 | image | logo |  |
| 226 | 422 | element | gr |  |
| 226 | 404 | element | gr |  |

### _CCIncl

Typefaces: Interstate-Bold 35pt, Interstate-Regular 16pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 74 | 259 | text | rt[0] | Interstate-Bold 18pt |
| 76 | 173 | text | no report | Interstate-Bold 24pt |
| 76 | 211 | text | now | Interstate-Black 24pt |
| 147 | 157 | element | gr |  |

### DaypartForecast

Typefaces: Interstate-Bold 24pt, Interstate-Bold 14pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 71 | element | gr |  |
| 5 | 75 | text | locName.upper() | Interstate-Bold 15pt |

### ExtendedForecast

Typefaces: Interstate-Bold 24pt, Interstate-Bold 18pt, Interstate-Bold 14pt, Interstate-Bold 15pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 70 | element | gr |  |
| 5 | 5 | text | %s:" % (string.upper(locName)) | Interstate-Bold 15pt |
| 0 | 70 | element | locNameCR |  |

### TextForecast

Typefaces: Interstate-Bold 15pt, Interstate-Regular 21pt, Interstate-Bold 24pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 70 | element | gr |  |
| 5 | 75 | text | %s:" % (string.upper(<%-params.locName%>)) | Interstate-Bold 15pt |
| 0 | 0 | element | bg |  |
| 0 | 0 | element | bgCR |  |
| 284 | 0 | element | highlight |  |

### Unavailable

Typefaces: Interstate-Bold 24pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 71 | element | gr |  |
| 10 | 75 | text | <%-locName%> | Interstate-Bold 15pt |

### Default


| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 0 | element | m |  |

### IBOSSDefault


| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 0 | element | m |  |

### AirQualityForecast

Typefaces: Frutiger_Bold 22pt, Frutiger_Bold_Cond 24pt, Frutiger_Bold_Cond 18pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 97 | image | /rsrc/images/middle_white |  |
| 403 | 97 | image | /rsrc/images/middle_white |  |
| 72 | 348 | image | /rsrc/images/middle_white |  |
| 403 | 316 | image | /rsrc/images/middle_white |  |
| 131 | 353 | text | fcstForLabel | Frutiger_Bold 22pt |
| 450 | 150 | image | /rsrc/logos/ozoneActionLogo |  |
| 424 | 108 | text | str | Frutiger_Bold_Cond 18pt |

### AllergyReport

Typefaces: Frutiger_Bold 22pt, Frutiger_Bold_Cond 24pt, Frutiger_Bold 19pt, Frutiger_Bold_Cond 20pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 97 | image | /rsrc/images/middle_white |  |
| 463 | 97 | image | /rsrc/images/middle_white |  |
| 72 | 348 | image | /rsrc/images/middle_white |  |
| 463 | 307 | image | /rsrc/images/middle_white |  |
| 131 | 353 | text | timeLabel | Frutiger_Bold 22pt |

### Almanac

Typefaces: Frutiger_Bold 18pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 222 | image | TOPIMAGE |  |
| 72 | 348 | image | TOPIMAGE |  |
| 0 | 100 | image | BOTIMAGE |  |
| 131 | 352 | text | date | Frutiger_Bold 22pt |
| 119 | 317 | text | Average | Frutiger_Bold 24pt |
| 356 | 317 | text | Record | Frutiger_Bold 24pt |
| 98 | 173 | text | Sunrise | Frutiger_Bold 24pt |
| 98 | 130 | text | Sunset | Frutiger_Bold 24pt |
| 175 | 281 | text | High | Frutiger_Bold 21pt |
| 395 | 281 | text | High | Frutiger_Bold 21pt |
| 175 | 243 | text | Low | Frutiger_Bold 21pt |
| 395 | 243 | text | Low | Frutiger_Bold 21pt |
| 265 | 279 | text | <%-avgHigh%> | Frutiger_Bold 36pt |
| 265 | 240 | text | <%-avgLow%> | Frutiger_Bold 36pt |
| 470 | 279 | text | <%-recHigh%> | Frutiger_Bold 36pt |
| 470 | 240 | text | <%-recLow%> | Frutiger_Bold 36pt |
| 535 | 281 | text | <%-recHighYear%> | Frutiger_Bold 24pt |
| 535 | 242 | text | <%-recLowYear%> | Frutiger_Bold 24pt |
| 198 | 173 | text | <%-sunrise%> | Frutiger_Bold 26pt |
| 198 | 130 | text | <%-sunset%> | Frutiger_Bold 26pt |

### CoastalWatersForecast

Typefaces: Frutiger_Bold 16pt, Frutiger_Bold_Cond fontHeightpt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 97 | image | /rsrc/images/middle_white |  |
| 72 | 349 | image | /rsrc/images/middle_white |  |
| 131 | 354 | text | FROM THE NATIONAL WEATHER SERVICE | Frutiger_Bold 16pt |

### CurrentConditions

Typefaces: Frutiger_Bold_Cond 27pt, Frutiger_Bold 21pt, Frutiger_Bold modFHeightpt, Frutiger_Black_Cond tempFHeightpt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 97 | image | %s/middle_white" % (imageRoot |  |
| 422 | 97 | image | %s/middle_white" % (imageRoot |  |

### CurrentConditionsSpanish

Typefaces: Frutiger_Bold_Cond 27pt, Frutiger_Bold 21pt, Frutiger_Bold modFHeightpt, Frutiger_Black_Cond tempFHeightpt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 97 | image | /rsrc/images/middle_white |  |
| 422 | 97 | image | /rsrc/images/middle_white |  |
| 41 | 250 | element | gr |  |

### CurrentWaterTemperatures

Typefaces: Frutiger_Black 18pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 404 | 384 | element | legend |  |
| 0 | 0 | image | /rsrc/images/map_curve_white |  |

### DaypartForecast

Typefaces: Frutiger_Bold 21pt, Frutiger_Bold 40pt, Frutiger_Bold_Cond 19pt, Frutiger_Bold 22pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 97 | image | IMAGE |  |
| 72 | 348 | image | IMAGE |  |

### DaypartForecastSpanish

Typefaces: Frutiger_Bold 21pt, Frutiger_Bold 40pt, Frutiger_Bold_Cond 19pt, Frutiger_Bold 24pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 97 | image | IMAGE |  |
| 72 | 348 | image | IMAGE |  |

### Destinations

Typefaces: Frutiger_Bold 24pt, Frutiger_Bold 18pt, Frutiger_Bold_Cond 28pt
_No positioned elements found — this product is data-only or fully templated._

### EstimatedPrecipitation

Typefaces: Frutiger_Bold_Cond 17pt, Frutiger_Black_Cond 17pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 438 | 377 | element | legend |  |
| 616 | 381 | text | txt | Frutiger_Bold_Cond 17pt |
| 0 | 0 | image | /rsrc/images/map_curve_white |  |

### ExtendedForecast

Typefaces: Frutiger_Bold_Cond 21pt, Frutiger_Bold_Cond 19pt, Frutiger_Bold 40pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 97 | image | IMAGE |  |
| 72 | 97 | image | IMAGE |  |
| 72 | 154 | image | IMAGE |  |
| 72 | 157 | image | IMAGE |  |
| 200 | 97 | image | IMAGE |  |
| 200 | 154 | image | IMAGE |  |
| 200 | 157 | image | IMAGE |  |
| 315 | 97 | image | IMAGE |  |
| 315 | 154 | image | IMAGE |  |
| 315 | 157 | image | IMAGE |  |
| 430 | 97 | image | IMAGE |  |
| 430 | 154 | image | IMAGE |  |
| 430 | 157 | image | IMAGE |  |
| 545 | 97 | image | IMAGE |  |
| 545 | 154 | image | IMAGE |  |
| 545 | 157 | image | IMAGE |  |
| 72 | 348 | image | IMAGE |  |

### ExtendedForecastSpanish

Typefaces: Frutiger_Bold_Cond 21pt, Frutiger_Bold_Cond 19pt, Frutiger_Bold 40pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 97 | image | IMAGE |  |
| 72 | 97 | image | IMAGE |  |
| 72 | 154 | image | IMAGE |  |
| 72 | 157 | image | IMAGE |  |
| 200 | 97 | image | IMAGE |  |
| 200 | 154 | image | IMAGE |  |
| 200 | 157 | image | IMAGE |  |
| 315 | 97 | image | IMAGE |  |
| 315 | 154 | image | IMAGE |  |
| 315 | 157 | image | IMAGE |  |
| 430 | 97 | image | IMAGE |  |
| 430 | 154 | image | IMAGE |  |
| 430 | 157 | image | IMAGE |  |
| 545 | 97 | image | IMAGE |  |
| 545 | 154 | image | IMAGE |  |
| 545 | 157 | image | IMAGE |  |
| 72 | 348 | image | IMAGE |  |

### FrostFreezeWarnings

Typefaces: Frutiger_Bold_Cond 19pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 550 | 379 | element | legend |  |
| 506 | 380 | text | txt | Frutiger_Bold_Cond 19pt |
| 0 | 0 | image | /rsrc/images/map_curve_white |  |

### GardeningForecast

Typefaces: Frutiger_Bold 28pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 9 | 8 | text | t | Frutiger_Bold_Cond 24pt |
| 0 | 0 | element | gr |  |
| 0 | 70 | element | pointer |  |
| 72 | 97 | image | IMAGE |  |
| 336 | 97 | image | IMAGE |  |
| 72 | 348 | image | IMAGE |  |
| 126 | 351 | text | <%-day%> | Frutiger_Bold 22pt |
| 96 | 153 | element | label |  |
| 131 | 109 | text | %d%%" % (precip) | Frutiger_Bold 34pt |
| 367 | 153 | element | label |  |
| 387 | 109 | text | %d%%" % (cloudCover) | Frutiger_Bold 34pt |
| 364 | 314 | element | label |  |
| 364 | 200 | element | slider |  |
| 364 | 260 | text | Not Applicable | Frutiger_Bold 28pt |
| 345 | 260 | text | Temporarily Unavailable | Frutiger_Bold 28pt |

### GolfCourseForecast

Typefaces: Frutiger_Bold 20pt, Frutiger_Bold 22pt, Frutiger_Bold 40pt, Frutiger_Bold 28pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 348 | image | IMAGE |  |
| 72 | 97 | image | IMAGE |  |
| 0 | 98 | image | BOTIMAGE |  |
| 100 | 150 | text | Golf Index | Frutiger_Bold 20pt |
| 286 | 97 | image | IMAGE |  |
| 286 | 98 | image | BOTIMAGE |  |
| 466 | 97 | image | IMAGE |  |
| 466 | 98 | image | BOTIMAGE |  |
| 125 | 352 | text | <%-courseName%> | Frutiger_Bold 22pt |

### HealthForecast

Typefaces: Frutiger_Bold_Cond 24pt, Frutiger_Bold 20pt, Frutiger_Bold_Cond 19pt, Frutiger_Bold 22pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 97 | image | /rsrc/images/middle_white |  |
| 72 | 220 | image | /rsrc/images/middle_white |  |
| 72 | 348 | image | /rsrc/images/middle_white |  |
| 131 | 353 | text | fcstForLabel | Frutiger_Bold 22pt |

### InternationalDestinations

Typefaces: Frutiger_Bold 24pt, Frutiger_Bold 18pt, Frutiger_Bold_Cond 28pt
_No positioned elements found — this product is data-only or fully templated._

### InternationalForecast

Typefaces: Frutiger_Bold 22pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 0 | image | /rsrc/images/map_curve_white |  |

### LocalAirportConditions

Typefaces: Frutiger_Bold 20pt, Frutiger_Bold tempFHeightpt, Frutiger_Bold 30pt, Frutiger_Bold 22pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 97 | image | /rsrc/images/middle_white |  |
| 72 | 233 | image | /rsrc/images/middle_white |  |
| 455 | 97 | image | /rsrc/images/middle_white |  |
| 72 | 348 | image | /rsrc/images/middle_white |  |
| 134 | 353 | text | strText | Frutiger_Bold 20pt |
| 108 | 103 | text | strText | Frutiger_Bold 16pt |
| 41 | 119 | text | strText | Frutiger_Bold 18pt |
| 469 | 114 | element | iconBox |  |

### LocalDoppler

Typefaces: Frutiger_Bold 17pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 549 | 396 | text | txt | Frutiger_Bold 17pt |
| -32 | 0 | text | txt | Frutiger_Bold 17pt |
| 5 | 0 | element | legendRainCr |  |
| 0 | 0 | element | legendRain1 |  |
| 13 | 0 | element | legendRain2 |  |
| 21 | 0 | element | legendRain3 |  |
| 32 | 0 | element | legendRain4 |  |
| 63 | 0 | text | txt | Frutiger_Bold 17pt |
| 95 | 0 | element | legendMixed |  |
| 128 | 0 | text | txt | Frutiger_Bold 17pt |
| 176 | 0 | element | legendSnow |  |
| 444 | 380 | element | cr |  |
| 446 | 380 | text | txt | Frutiger_Bold 17pt |
| 598 | 380 | text | txt | Frutiger_Bold 17pt |
| 493 | 378 | element | bb |  |
| 491 | 380 | element | legendBox |  |
| 0 | 0 | image | /rsrc/images/map_curve_white |  |

### LocalDopplerSpanish

Typefaces: Frutiger_Bold 17pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 528 | 396 | text | txt | Frutiger_Bold 17pt |
| -75 | 0 | text | txt | Frutiger_Bold 17pt |
| -25 | 0 | element | legendRainCr |  |
| 0 | 0 | element | legendRain1 |  |
| 13 | 0 | element | legendRain2 |  |
| 21 | 0 | element | legendRain3 |  |
| 32 | 0 | element | legendRain4 |  |
| 36 | 0 | text | txt | Frutiger_Bold 17pt |
| 95 | 0 | element | legendMixed |  |
| 131 | 0 | text | txt | Frutiger_Bold 17pt |
| 181 | 0 | element | legendSnow |  |
| 444 | 380 | element | cr |  |
| 449 | 380 | text | txt | Frutiger_Bold 17pt |
| 601 | 380 | text | txt | Frutiger_Bold 17pt |
| 497 | 378 | element | bb |  |
| 495 | 380 | element | legendBox |  |
| 0 | 0 | image | /rsrc/images/map_curve_white |  |

### LocalObservations

Typefaces: Frutiger_Bold_Cond 24pt, Frutiger_Bold_Cond 36pt, Frutiger_Bold_Cond 26pt
_No positioned elements found — this product is data-only or fully templated._

### Movie

Typefaces: Frutiger_Bold_Cond 34pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 0 | element | r |  |
| 290 | 300 | text | data.noDataAvailableText | Frutiger_Bold_Cond 34pt |

### NationalAirportConditions

Typefaces: Frutiger_Bold_Cond 24pt, Frutiger_Bold 28pt, Frutiger_Bold 26pt, Frutiger_Bold 22pt, Frutiger_Bold 16pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 97 | image | /rsrc/images/middle_white |  |
| 72 | 348 | image | /rsrc/images/middle_white |  |
| 388 | 353 | text | strText | Frutiger_Bold 18pt |

### NationalTravelWeather

Typefaces: Frutiger_Bold_Cond 34pt, Frutiger_Bold 17pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 190 | 240 | text | <%-params.noDataAvailableText%> | Frutiger_Bold_Cond 34pt |
| 338 | 381 | text | txt | Frutiger_Bold 17pt |
| 310 | 381 | element | box |  |
| 409 | 381 | text | txt | Frutiger_Bold 17pt |
| 382 | 381 | image | /rsrc/images/scattered_showers |  |
| 472 | 381 | text | txt | Frutiger_Bold 17pt |
| 444 | 381 | element | box |  |
| 531 | 381 | text | txt | Frutiger_Bold 17pt |
| 503 | 381 | element | box |  |
| 597 | 381 | text | txt | Frutiger_Bold 17pt |
| 570 | 381 | element | box |  |
| 0 | 0 | image | /rsrc/images/map_curve_white |  |

### NetworkIntro

Typefaces: Frutiger_Bold 38pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| -75 | -97 | image | /rsrc/images/ellipse |  |
| -200 | -144 | image | /rsrc/images/ellipse |  |
| -100 | -207 | image | /rsrc/images/ellipse |  |
| 0 | 348 | element | box |  |
| 91 | 383 | text | str | Frutiger_Bold 21pt |
| 93 | 380 | text | str | Frutiger_Bold 10pt |
| 182 | 125 | text | locName | Frutiger_Bold 38pt |

### OutdoorActivityForecast

Typefaces: Frutiger_Bold_Cond 24pt, Frutiger_Bold 36pt, Frutiger_Bold 22pt, Frutiger_Bold 18pt, Frutiger_Bold 45pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 97 | image | /rsrc/images/middle_white |  |
| 333 | 97 | image | /rsrc/images/middle_white |  |
| 72 | 348 | image | /rsrc/images/middle_white |  |
| 131 | 353 | text | fcstForLabel | Frutiger_Bold 22pt |
| 129 | 111 | text | str | apparentTempFont |
| 265 | 111 | text | str | apparentTempFont |

### PackageIntro

Typefaces: Frutiger_Bold 37pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| -70 | -154 | image | /rsrc/images/ellipse |  |
| -75 | -97 | image | /rsrc/images/ellipse |  |
| -200 | -144 | image | /rsrc/images/ellipse |  |
| -100 | -207 | image | /rsrc/images/ellipse |  |
| 0 | 0 | element | gr |  |
| 0 | 413 | element | gr |  |

### PalmerDroughtSeverity

Typefaces: Frutiger_Bold 19pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 484 | 378 | element | legend |  |
| 0 | 18 | text | txt | Frutiger_Bold 19pt |
| 0 | 0 | text | txt | Frutiger_Bold 19pt |
| 426 | 380 | element | cr |  |
| 0 | 18 | text | txt | Frutiger_Bold 19pt |
| 0 | 0 | image | /rsrc/images/map_curve_white |  |
| 90 | 102 | image | /rsrc/logos/noaaLogo |  |

### PrecipitationQpfForecast

Typefaces: Frutiger_Bold_Cond 18pt, Frutiger_Black_Cond 18pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 367 | 377 | element | legend |  |
| 618 | 381 | text | txt | Frutiger_Bold_Cond 18pt |
| 0 | 0 | image | /rsrc/images/map_curve_white |  |

### Promo

Typefaces: Frutiger_Bold 22pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 97 | image | promoImage |  |

### RadarSatelliteComposite

Typefaces: Frutiger_Bold 17pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 445 | 380 | text | txt | Frutiger_Bold 17pt |
| 597 | 380 | text | txt | Frutiger_Bold 17pt |
| 549 | 396 | text | txt | Frutiger_Bold 17pt |
| 493 | 378 | element | bb |  |
| 491 | 380 | element | legend |  |
| 0 | 0 | image | /rsrc/images/map_curve_white |  |

### RadarSatelliteCompositeSpanish

Typefaces: Frutiger_Bold 17pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 449 | 380 | text | txt | Frutiger_Bold 17pt |
| 601 | 380 | text | txt | Frutiger_Bold 17pt |
| 528 | 396 | text | txt | Frutiger_Bold 17pt |
| 497 | 378 | element | bb |  |
| 495 | 380 | element | legend |  |
| 0 | 0 | image | /rsrc/images/map_curve_white |  |

### RegionalForecastConditions

Typefaces: Frutiger_Bold_Cond 28pt, Frutiger_Bold_Cond 34pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 0 | image | /rsrc/images/map_curve_white |  |
| 90 | 386 | text | productTitle | Frutiger_Bold_Cond 28pt |
| 190 | 240 | text | allData.noDataAvailableText | Frutiger_Bold_Cond 34pt |

### RegionalGolfIndexForecast

Typefaces: Frutiger_Bold 19pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 360 | 379 | text | txt | Frutiger_Bold 19pt |
| 542 | 379 | text | txt | Frutiger_Bold 19pt |
| 469 | 378 | element | legend |  |
| 0 | 0 | image | /rsrc/images/map_curve_white |  |

### SevereWeatherMessage

Typefaces: Frutiger_Bold_Cond ptSizept

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 37 | 66 | image | IMAGE |  |

### SkiConditions

Typefaces: Frutiger_Bold 21pt, Frutiger_Bold_Cond 24pt, Frutiger_Bold 18pt, Frutiger_Bold 23pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 280 | image | /rsrc/images/middle_white |  |
| 72 | 345 | image | /rsrc/images/middle_white |  |
| 72 | 187 | image | /rsrc/images/middle_white |  |
| 72 | 250 | image | /rsrc/images/middle_white |  |
| 72 | 97 | image | /rsrc/images/middle_white |  |
| 72 | 157 | image | /rsrc/images/middle_white |  |

### SnowfallQpfForecast

Typefaces: Frutiger_Bold 15pt, Frutiger_Bold 17pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 457 | 378 | element | legend |  |
| 623 | 382 | text | txt | Frutiger_Bold 15pt |
| 0 | 0 | image | /rsrc/images/map_curve_white |  |

### SunSafetyFacts

Typefaces: Frutiger_Bold_Cond 24pt, Frutiger_Bold_Cond 13pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 97 | image | /rsrc/images/middle_white |  |
| 72 | 302 | image | /rsrc/images/middle_white |  |
| 115 | 302 | image | twc.findRsrc('/images/sunSafetyImage |  |
| 123 | 274 | text | fact | Frutiger_Bold_Cond 24pt |
| 105 | 105 | text | str | Frutiger_Bold_Cond 13pt |

### SurfReport

Typefaces: Frutiger_Bold 30pt, Frutiger_Bold 18pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 97 | image | IMAGE |  |
| 456 | 97 | image | IMAGE |  |
| 72 | 348 | image | IMAGE |  |
| 116 | 296 | text | label | Frutiger_Bold 23pt |
| 131 | 353 | text | <%-locName%> | Frutiger_Bold 21pt |
| 200 | 296 | text | windText | Frutiger_Bold 26pt |
| 277 | 244 | text | periodText | Frutiger_Bold 26pt |
| 5 | 2 | element | cr |  |
| 119 | 115 | element | gr |  |
| 527 | 115 | element | gr |  |

### TeeTimeForecast

Typefaces: Frutiger_Bold 22pt, Frutiger_Bold 18pt, Frutiger_Bold 40pt, Frutiger_Bold_Cond 19pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 97 | image | IMAGE |  |
| 72 | 348 | image | IMAGE |  |

### TextForecast

Typefaces: Frutiger_Bold_Cond 29pt, Frutiger_Bold_Cond 36pt, Frutiger_Bold_Cond 28pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 97 | image | /rsrc/images/middle_white |  |

### Tides

Typefaces: Frutiger_Bold_Cond 23pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 264 | image | IMAGE |  |
| 72 | 176 | image | IMAGE |  |
| 72 | 97 | image | IMAGE |  |
| 119 | NaN | text | loc | Frutiger_Bold_Cond 23pt |
| 282 | NaN | text | tide | Frutiger_Bold_Cond 23pt |
| 475 | NaN | text | tide | Frutiger_Bold_Cond 23pt |
| 119 | 145 | text | locName | Frutiger_Bold_Cond 23pt |

### TrafficOverview

Typefaces: Frutiger_Bold 21pt, Frutiger_Bold 18pt, Frutiger_Bold_Cond 18pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 63 | 382 | element | shad |  |
| 60 | 385 | element | ptr |  |
| 90 | 386 | text | <%-title%> | Frutiger_Bold_Cond 28pt |
| 76 | 117 | image | filename |  |
| 75 | 245 | image | filename |  |
| 74 | 346 | image | filename |  |
| 118 | 98 | text | Traffic from: Traffic Pulse | Frutiger_Bold_Cond 18pt |
| 111 | 123 | image | trafficMapFile[0] |  |

### TrafficReport

Typefaces: Frutiger_Bold_Cond 18pt, Frutiger_Bold 22pt, Frutiger_Bold 20pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 0 | image | data.impactBox |  |
| 3 | 5 | text | data.impact | Frutiger_Bold 20pt |
| 39 | NaN | element | impactButton |  |
| 45 | -15 | text | dataSource | Frutiger_Bold_Cond 18pt |
| 72 | 113 | element | data |  |

### UltravioletIndex

Typefaces: Frutiger_Bold 23pt, Frutiger_Bold 36pt, Frutiger_Bold 18pt, Frutiger_Bold 19pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 97 | image | /rsrc/images/middle_white |  |
| 236 | 97 | image | /rsrc/images/middle_white |  |
| 72 | 275 | image | /rsrc/images/middle_white |  |
| 72 | 301 | image | /rsrc/images/middle_white |  |
| 105 | 301 | image | twc.findRsrc('/images/sunSafetyImage |  |
| 275 | 180 | text | strText | Frutiger_Bold 23pt |

### WeatherBulletin

Typefaces: Frutiger_Bold_Cond 28pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 72 | 98 | image | /rsrc/images/middle_white |  |
| 329 | 389 | text | FROM THE NATIONAL WEATHER SERVICE | Frutiger_Bold_Italic 15pt |
| 120 | 345 | text | locName | Frutiger_Bold 24pt |
| 120 | 130 | text | line | Frutiger_Bold_Cond 28pt |

### _LocName

Typefaces: Frutiger_Bold 21pt
_No positioned elements found — this product is data-only or fully templated._

### _MapHandler


| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 0 | image | /rsrc/maps/defaultMap |  |

### _MapImageHandler


| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 0 | image | filename |  |

### _MapOverlay

Typefaces: fontName selfpt
_No positioned elements found — this product is data-only or fully templated._

### _Title

Typefaces: Frutiger_Bold_Cond 28pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 63 | 382 | element | shad |  |
| 60 | 385 | element | ptr |  |
| 90 | 386 | text | <%-params.title%> | Frutiger_Bold_Cond 28pt |

### Default

Typefaces: Interstate-Bold 15pt
_No positioned elements found — this product is data-only or fully templated._

### LocalDoppler

Typefaces: Interstate-Bold 12pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 12 | 111 | element | gBox |  |

### _MapHandler


| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 0 | image | /rsrc/maps/defaultMap |  |

### _MapImageHandler


| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| 0 | 0 | image | filename |  |

### _MapOverlay

Typefaces: fontName selfpt
_No positioned elements found — this product is data-only or fully templated._

### Video

Typefaces: Frutiger_Bold 24pt

| x | y | kind | element | typeface |
|---:|---:|---|---|---|
| -2 | -2 | element | bb |  |
| 280 | 438 | element | cr |  |
