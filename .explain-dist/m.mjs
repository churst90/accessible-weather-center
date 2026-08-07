// src/audio/manifests/sceneSegments.ts
var THEME_PRODUCT_ERA = {
  ws3000: "pre-2004",
  wsjr: "pre-2004",
  "ws4000-v1": "pre-2004",
  "weatherscan-local": "pre-2004",
  weatherstarxl: "pre-2004",
  "ws4000-v2": "post-2004",
  "weatherscan-v1": "post-2004",
  "weatherscan-v2": "post-2004",
  intellistar1: "post-2004",
  intellistar2: "post-2004"
};
var SEGMENT_LABELS = {
  localforecast: { "pre-2004": "36 Hour Forecast", "post-2004": "Local Forecast" },
  hourly: { "pre-2004": "Daily Planner", "post-2004": "Daypart Forecast" },
  extended: { "pre-2004": "Extended Forecast", "post-2004": "Extended Forecast" },
  current: { "pre-2004": "Latest Observations", "post-2004": "Current Conditions" },
  radar: { "pre-2004": "Local Doppler Radar", "post-2004": "Local Doppler Radar" }
};
var ERA_INTRO_KEYS = {
  localforecast: {
    "pre-2004": ["thirtySixHour", "localForecast"],
    "post-2004": ["localForecast", "thirtySixHour"]
  },
  hourly: {
    "pre-2004": ["dailyPlanner", "hourly"],
    "post-2004": ["hourly", "dailyPlanner"]
  }
};
var activeProductEra = "post-2004";
function setProductEra(themeId) {
  activeProductEra = THEME_PRODUCT_ERA[themeId] ?? "post-2004";
}
function getProductEra() {
  return activeProductEra;
}
function eraIntroKeys(sceneId) {
  return ERA_INTRO_KEYS[sceneId.toLowerCase()]?.[activeProductEra] ?? [];
}
function segmentLabel(sceneId, era = activeProductEra) {
  return SEGMENT_LABELS[sceneId.toLowerCase()]?.[era] ?? null;
}

// src/audio/manifests/narratorSchema.ts
var AJ_NARRATION = "/assets/narration/Alan Jackson";
var JC_NARRATION = "/assets/narration/Jim Cantore";
var AB_NARRATION = "/assets/narration/Amy Bargeron";
var CH_NARRATION = "/assets/narration/Chandler";
var AJ_TEMPS_BASE = `${AJ_NARRATION}/temps`;
var AJ_GENERAL_BASE = `${AJ_NARRATION}/general`;
var AJ_VOCALLOCAL_BASE = `${AJ_NARRATION}/VocalLocal`;
var JC_VOCALLOCAL_BASE = `${JC_NARRATION}/Vocal Local`;
var NARRATORS = [
  {
    id: "allan-jackson",
    label: "Allan Jackson (Weatherscan)",
    hasTemps: true,
    hasConditions: true,
    hasWind: true,
    sceneIntros: {
      current: [
        { file: `${AJ_GENERAL_BASE}/Your Current Conditions.mp3`, text: "Your current conditions" },
        { file: `${AJ_GENERAL_BASE}/The Current Conditions for Your Area.mp3`, text: "The current conditions for your area" },
        { file: `${AJ_GENERAL_BASE}/Currently In Your Area.mp3`, text: "Currently in your area" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Curr_Cond/CC_DEFAULT1.mp3`, text: "Our current conditions" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Curr_Cond/CC_DEFAULT2.mp3`, text: "The current conditions for our area" }
      ],
      radar: [
        { file: `${AJ_GENERAL_BASE}/Your Local Doppler Radar.mp3`, text: "Your local Doppler radar" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Local_Radar/LRADAR_DEFAULT1.mp3`, text: "Here's our local Doppler radar" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Local_Radar/LRADAR_DEFAULT2.mp3`, text: "Our local Doppler radar" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Local_Radar/Heres your Local Doppler Radar.mp3`, text: "Here's your local Doppler radar" }
      ],
      extended: [
        // "Extended Forecast" phrasing — fits the 5-day WeatherStar-era
        // branding. "Your/Our extended forecast" reads naturally before
        // a 5-day rundown and was the TWC term through the early 2000s.
        { file: `${AJ_GENERAL_BASE}/Your Extended Forecast.mp3`, text: "Your extended forecast", eras: ["5-day"] },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Ext_Fcast/EXT_DEFAULT1.mp3`, text: "Our extended forecast", eras: ["5-day"] },
        // "7-Day Outlook" / "Week Ahead" phrasing — Weatherscan-era
        // branding for the full 7-day rundown.
        { file: `${AJ_GENERAL_BASE}/Your 7-Day Outlook.mp3`, text: "Your seven-day outlook", eras: ["7-day"] },
        { file: `${AJ_GENERAL_BASE}/Heres your 7-Day Outlook.mp3`, text: "Here's your seven-day outlook", eras: ["7-day"] },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_7Day_Fcast/7DAY_DEFAULT1.mp3`, text: "Here's our 7-day-out look", eras: ["7-day"] },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_7Day_Fcast/7DAY_DEFAULT2.mp3`, text: "Our 7-day Outlook", eras: ["7-day"] },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_7Day_Fcast/7DAY_DEFAULT3.mp3`, text: "Our week ahead", eras: ["7-day"] },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_7Day_Fcast/7DAY_DEFAULT4.mp3`, text: "The week ahead", eras: ["7-day"] },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Ext_Fcast/EXT_DEFAULT3.mp3`, text: "The week ahead", eras: ["7-day"] },
        // EXT_DEFAULT2 transcribed as "Hour week ahead" — almost
        // certainly "Your week ahead"; keeping as 7-day until verified.
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Ext_Fcast/EXT_DEFAULT2.mp3`, text: "Hour week ahead", eras: ["7-day"] }
      ],
      hourly: [
        { file: `${AJ_GENERAL_BASE}/Your Local Forecast.mp3`, text: "Your local forecast" },
        { file: `${AJ_GENERAL_BASE}/The Forecast for Your Area.mp3`, text: "The forecast for your area" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Daypart/DAYPART_DEFAULT1.mp3`, text: "Our local forecast" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Daypart/DAYPART_DEFAULT2.mp3`, text: "The forecast for our area" }
        // DAYPART_DEFAULT3 ("Our Daily Planner") lives in `dailyPlanner`, not
        // here: TWC renamed the hour-by-hour forecast from "Daily Planner" to
        // "Daypart Forecast" in September 2004, so a post-2004 unit must not
        // announce the older name. sceneSegments.ts routes pre-2004 themes to
        // the dailyPlanner pool first.
      ],
      alerts: [
        { file: `${AJ_GENERAL_BASE}/Is in effect for Your Area.mp3`, text: "Is in effect for your area" },
        { file: `${AJ_GENERAL_BASE}/Has been issued for Your Area.mp3`, text: "Has been issued for your area" }
      ],
      localForecast: [
        { file: `${AJ_GENERAL_BASE}/Your Local Forecast.mp3`, text: "Your local forecast" }
      ],
      observations: [
        { file: `${AJ_GENERAL_BASE}/Your Local Observations.mp3`, text: "Your local observations" },
        { file: `${AJ_GENERAL_BASE}/Local Observations for Your Area.mp3`, text: "Local observations for your area" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Local_Obs/LOBS_DEFAULT1.mp3`, text: "Our local observations" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Local_Obs/LOBS_DEFAULT2.mp3`, text: "Local observations for our area" }
      ],
      weekAhead: [
        { file: `${AJ_GENERAL_BASE}/Your Week Ahead.mp3`, text: "You're a week ahead" }
      ],
      // AJ has no dedicated "Your Weekend Forecast" clip; WEEK3 ("heading
      // into the weekend") is the only single-phrase weekend reference in
      // the library. Sounds natural as a scene opener before the Sat/Sun
      // rundown plays.
      weekend: [
        { file: `${AJ_VOCALLOCAL_BASE}/Periods2/WEEK3.mp3`, text: "Heading into the weekend" }
      ],
      // Pre-September-2004 name for the hour-by-hour forecast. Selected for
      // themes whose hardware predates the rename — see sceneSegments.ts.
      dailyPlanner: [
        { file: `${AJ_GENERAL_BASE}/Your Daily Planner.mp3`, text: "Your Daily Planner" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Daypart/DAYPART_DEFAULT3.mp3`, text: "Our Daily Planner" }
      ],
      // Pre-September-2004 name for the Local Forecast, which became a
      // 48-hour product under the new name. Reached via sceneSegments.ts.
      thirtySixHour: [
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_36_Hr_Fcast/36HR_DEFAULT1.mp3`, text: "Your 36-hour forecast" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_36_Hr_Fcast/36HR_DEFAULT2.mp3`, text: "Your forecast for the next 36 hours" }
      ],
      traffic: [
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Traffic_Flow/TRFLO_DEFAULT1.mp3`, text: "Traffic flow for our area" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Traffic_Flow/TRFLO_DEFAULT2.mp3`, text: "The current average trip times for our area" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Traffic_Overview/TRORV_DEFAULT1.mp3`, text: "Traffic conditions around our area" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Traffic_Overview/TRORV_DEFAULT2.mp3`, text: "Traffic congestion for our area" },
        { file: `${AJ_VOCALLOCAL_BASE}/Default_Phrases_Traffic_Report/TRREP_DEFAULT1.mp3`, text: "Incidents and construction impacting our area" }
      ]
    }
  },
  {
    id: "jim-cantore",
    label: "Jim Cantore (IntelliStar)",
    hasTemps: true,
    hasConditions: true,
    hasWind: true,
    sceneIntros: {
      current: [
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Now/CC_INTRO1.mp3`, text: "Currently, the temperature is.." },
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Now/CC_INTRO2.mp3`, text: "Currently in our area" },
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Now/CC_INTRO3.mp3`, text: "Currently in your area" },
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Now/CC_INTRO4.mp3`, text: "Currently, it's.." },
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Now/CC_INTRO5.mp3`, text: "Right now it's" }
      ],
      // No radar intros. `Default_Phrases_Local_Radar/RADAR_DEFAULT{1,2}` were
      // listed here from the initial commit, but that directory has never
      // existed in Jim Cantore's library — the entries resolved to 404s and
      // the radar scene played silence instead of falling back to spoken
      // text. Removed rather than faked; add real clips if they surface.
      // Caught by `npm run clips:sweep`.
      extended: [
        // JC's extended pool is entirely 7-day / week-ahead phrasing —
        // IntelliStar never ran a 5-day version. Tagged so 5-day themes
        // (WS4000, WS3000, WSJr) fall to TTS rather than hearing "seven
        // day outlook" over a 5-day rundown.
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_7Day_Fcast/7DAY_DEFAULT1.mp3`, text: "Here's our seven day outlook", eras: ["7-day"] },
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_7Day_Fcast/7DAY_DEFAULT2.mp3`, text: "Our seven-day outlook", eras: ["7-day"] },
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_7Day_Fcast/7DAY_DEFAULT3.mp3`, text: "Our week ahead", eras: ["7-day"] }
      ],
      hourly: [
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Daypart/DAYPART_DEFAULT1.mp3`, text: "Our local forecast" },
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Daypart/DAYPART_DEFAULT2.mp3`, text: "The forecast for our area" }
        // DAYPART_DEFAULT3 ("Our Daily Planner") moved to `dailyPlanner` —
        // the name was retired in September 2004 and Jim Cantore narrates
        // IntelliStar-era themes, which are all post-rename.
      ],
      // Pre-September-2004 name, kept for themes that predate the rename.
      dailyPlanner: [
        { file: `${JC_VOCALLOCAL_BASE}/Default_Phrases_Daypart/DAYPART_DEFAULT3.mp3`, text: "Our Daily Planner" }
      ],
      alerts: [
        { file: `${JC_NARRATION}/Weatherscan severe/SEVERE_DEFAULT.mp3`, text: "Severe weather alert" },
        { file: `${JC_NARRATION}/Weatherscan severe/TORNADO_DEFAULT.mp3`, text: "Tornado warning" },
        { file: `${JC_NARRATION}/Weatherscan severe/FFLOOD_DEFAULT.mp3`, text: "Flash flood warning" }
      ],
      weekend: [
        { file: `${JC_VOCALLOCAL_BASE}/Periods2/WEEKEND2.mp3`, text: "This weekend" }
      ]
    }
  },
  {
    id: "amy-bargeron",
    label: "Amy Bargeron (Weatherscan)",
    hasTemps: false,
    hasConditions: false,
    hasWind: false,
    // Amy's full Weatherscan voice pack is 9 clips (all verified). Each
    // entry here maps a clip to the scene she actually narrated it on.
    // Scenes she narrated historically but for which we don't have the
    // preserved clip (7-Day Outlook, Almanac, Local Observations,
    // Weekly Outlook) are intentionally omitted rather than back-filled
    // with mismatched clips — they fall through to TTS.
    sceneIntros: {
      current: [
        { file: `${AB_NARRATION}/Local-CurrentConditions.mp3`, text: "Your current conditions" }
      ],
      radar: [
        { file: `${AB_NARRATION}/Local-LocalDoppler.mp3`, text: "The local Doppler radar" }
      ],
      // `extended` intentionally omitted — our Regional Forecast clip
      // ("Local-RegionalForecastConditions.mp3") is for the Weatherscan
      // Regional Forecast scene (nearby-cities map), not the 7-Day
      // Outlook. Using it on Extended would mislabel the screen. Move
      // that clip here if/when a dedicated Regional scene is added.
      hourly: [
        // Weatherscan's "Daypart Forecast" was the closest historical
        // analog of our hour-by-hour scene; Amy's DaypartForecast clip
        // fits as an opener.
        { file: `${AB_NARRATION}/Local-DaypartForecast.mp3`, text: "Your local forecast" }
      ],
      localForecast: [
        { file: `${AB_NARRATION}/Local-TextForecast.mp3`, text: "Your local forecast" }
      ],
      traffic: [
        { file: `${AB_NARRATION}/Local-TrafficFlow.mp3`, text: "Traffic flow" },
        { file: `${AB_NARRATION}/Local-TrafficOverview.mp3`, text: "Traffic conditions across your area" }
      ],
      airport: [
        { file: `${AB_NARRATION}/Local-LocalAirportConditions.mp3`, text: "Local airport delays" }
      ],
      // Pollen report clip exists but the app has no allergy scene
      // yet. Kept as a placeholder for when an allergy scene is added
      // — until then, this entry is a no-op (scheduler never fires an
      // `allergy` scene).
      allergy: [
        { file: `${AB_NARRATION}/Local-AllergyReport.mp3`, text: "The pollen report for your area" }
      ]
    }
  },
  {
    id: "chandler",
    label: "Chandler (IntelliStar)",
    hasTemps: false,
    hasConditions: false,
    hasWind: false,
    sceneIntros: {
      // Current conditions — only use the simple "The current conditions" clips (16-22, 25)
      current: chandlerClips("cc", [
        [16, "current-conditions", "The current conditions"],
        [17, "current-conditions", "The current conditions"],
        [18, "current-conditions", "The current conditions"],
        [19, "current-conditions", "The current conditions"],
        [20, "current-conditions", "The current conditions"],
        [21, "current-conditions", "The current conditions"],
        [22, "current-conditions", "The current conditions"],
        [25, "current-local-conditions", "The current local conditions"]
      ]),
      // Radar — current radar with intensity description
      radar: chandlerClips("cr", [
        [3, "current-radar-precip-intensity", "The current radar"],
        [4, "current-radar-precip-intensity", "The current radar"],
        [5, "current-radar-precip-intensity", "The current radar"],
        [6, "current-radar-precip-intensity", "The current radar"],
        [7, "current-radar-precip-intensity", "The current radar"],
        [8, "current-radar-precip-intensity", "The current radar"]
      ]),
      // Extended forecast
      extended: chandlerRange("ex", "extended-forecast", "The extended forecast", 1, 19),
      // 36-hour / hourly forecast — use "Your local 36 hour forecast" clips
      hourly: chandlerClips("hr", [
        [15, "local-36hr-forecast", "Your local 36 hour forecast"],
        [16, "local-36hr-forecast", "Your local 36 hour forecast"],
        [17, "local-36hr-forecast", "Your local 36 hour forecast"],
        [18, "local-36hr-forecast", "Your local 36 hour forecast"],
        [19, "local-36hr-forecast", "Your local 36 hour forecast"],
        [20, "local-36hr-forecast", "Your local 36 hour forecast"]
      ]),
      // Local forecast — use the simple 36hr clips
      localForecast: chandlerClips("hr", [
        [1, "36hr-forecast", "The 36 hour forecast"],
        [2, "36hr-forecast", "The 36 hour forecast"],
        [3, "36hr-forecast", "The 36 hour forecast"]
      ]),
      // Alerts
      alerts: chandlerRange("al", "special-regional-info", "Special regional information", 1, 10),
      // Regional forecast
      regional: chandlerRange("rf", "regional-forecast", "The regional forecast", 1, 21),
      // Outlook
      outlook: chandlerRange("ol", "long-range-outlook", "Your region's long range outlook", 1, 7),
      // Regional conditions
      regionalConditions: chandlerRange("rc", "current-regional-conditions", "Current regional conditions", 1, 6),
      // Travel / cities
      travelForecast: chandlerRange("tf", "forecast-cities-nationwide", "The forecast for cities nationwide", 1, 10),
      // Local update (NWS)
      localUpdate: chandlerClips("lu", [
        [3, "local-update-nws", "An update on local weather conditions from the National Weather Service"],
        [4, "local-update-nws", "An update on local weather conditions from the National Weather Service"]
      ])
    }
  },
  // Silent narrator — for eras that predate TWC's local-voice overlay
  // (WeatherStar 3000 etc.). No clips; the composer falls through to
  // TTS/NVDA for every scene.
  {
    id: "silent",
    label: "None (TTS / NVDA only)",
    hasTemps: false,
    hasConditions: false,
    hasWind: false,
    sceneIntros: {}
  }
];
function ch(category, num, desc, text) {
  const n = String(num).padStart(2, "0");
  return { file: `${CH_NARRATION}/${category}/${category}_${n}_${desc}.mp3`, text };
}
function chandlerClips(category, entries) {
  return entries.map(([num, desc, text]) => ch(category, num, desc, text));
}
function chandlerRange(category, desc, text, from, to) {
  const clips = [];
  for (let i = from; i <= to; i++) clips.push(ch(category, i, desc, text));
  return clips;
}
var NARRATOR_MAP = new Map(NARRATORS.map((n) => [n.id, n]));
function getNarrator(id) {
  return NARRATOR_MAP.get(id) ?? NARRATORS[0];
}
var SCENE_INTRO_ALIASES = {
  detailed: ["observations", "regionalConditions", "current"],
  feelslike: ["observations", "current"],
  temptrend: ["observations", "current"],
  stormtracker: ["radar"],
  travel: ["travelForecast"]
};
function introsFor(narrator, sceneId) {
  const direct = narrator.sceneIntros[sceneId];
  if (direct?.length) return direct;
  const wanted = sceneId.toLowerCase();
  for (const [key, clips] of Object.entries(narrator.sceneIntros)) {
    if (key.toLowerCase() === wanted && clips?.length) return clips;
  }
  return void 0;
}
function pickSceneIntro(narratorId, sceneId, era) {
  const narrator = getNarrator(narratorId);
  const candidates = [
    ...eraIntroKeys(sceneId),
    sceneId,
    ...SCENE_INTRO_ALIASES[sceneId.toLowerCase()] ?? []
  ];
  for (const candidate of candidates) {
    const intros = introsFor(narrator, candidate);
    if (!intros || intros.length === 0) continue;
    const pool = era ? intros.filter((c) => !c.eras || c.eras.includes(era)) : intros;
    if (pool.length === 0) continue;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return null;
}

// src/core/settings/backgroundCatalog.ts
var I1_BASE = "/assets/backgrounds/intellistar1/clean";
var I2_BASE = "/assets/backgrounds/intellistar2/Generic";
var I2JR_BASE = "/assets/backgrounds/intellistar2jr/AMHQ";
var XL_CLOUDS_BASE = "/assets/backgrounds/weatherstarxl-clouds";
var XL_CLOUDS = [
  `${XL_CLOUDS_BASE}/Background-Normal.webp`,
  `${XL_CLOUDS_BASE}/Background-OutdoorActivity.webp`
];
function buildNumbered(base, count) {
  const out = [];
  for (let i = 1; i <= count; i++) {
    const num = String(i).padStart(3, "0");
    out.push(`${base}/generic_generic_${num}.webp`);
  }
  return out;
}
function buildI2JrNumbered(base, count) {
  const out = [];
  for (let i = 1; i <= count; i++) {
    const num = String(i).padStart(3, "0");
    out.push(`${base}/generic_generic-blur_${num}.webp`);
  }
  return out;
}
var I1_BACKGROUNDS = buildNumbered(I1_BASE, 254);
var I2_BACKGROUNDS = [
  ...buildNumbered(I2_BASE, 254),
  // 28, not 56. The AMHQ folder holds 28 `-blur_NNN` files alongside 28
  // non-blur `generic_generic_NNN` ones; counting the folder rather than the
  // blur series meant paths 029-056 were generated for files that have never
  // existed, so half of this pool 404'd. Found by scripts/check-asset-refs.mjs.
  ...buildI2JrNumbered(I2JR_BASE, 28)
];
var WS_BG_BASE = "/assets/themes/weatherscan/backgrounds";
var WS_LOCAL_BASE = "/assets/themes/weatherscan/backgrounds/local-era/neighborhood";
var WS_LOCAL_BACKGROUNDS = [
  `${WS_LOCAL_BASE}/now.webp`,
  `${WS_LOCAL_BASE}/extended.webp`,
  `${WS_LOCAL_BASE}/almanac.webp`,
  `${WS_LOCAL_BASE}/nearby.webp`,
  `${WS_LOCAL_BASE}/36hr.webp`
];
var WS_CITY_BACKGROUNDS = [
  `${WS_BG_BASE}/city_bg.webp`,
  `${WS_BG_BASE}/core_city_bg.webp`,
  `${WS_BG_BASE}/atlanta_bg.webp`,
  `${WS_BG_BASE}/baltimore_bg.webp`,
  `${WS_BG_BASE}/boston_bg.webp`,
  `${WS_BG_BASE}/charlotte_bg.webp`,
  `${WS_BG_BASE}/chicago_bg.webp`,
  `${WS_BG_BASE}/cleveland_bg.webp`,
  `${WS_BG_BASE}/dallas_bg.webp`,
  `${WS_BG_BASE}/denver_bg.webp`,
  `${WS_BG_BASE}/detroit_bg.webp`,
  `${WS_BG_BASE}/ftworth_bg.webp`,
  `${WS_BG_BASE}/hartford_bg.webp`,
  `${WS_BG_BASE}/houston_bg.webp`,
  `${WS_BG_BASE}/indianapolis_bg.webp`,
  `${WS_BG_BASE}/los_angeles_bg.webp`,
  `${WS_BG_BASE}/miami_bg.webp`,
  `${WS_BG_BASE}/minneapolis_bg.webp`,
  `${WS_BG_BASE}/nashville_bg.webp`,
  `${WS_BG_BASE}/new_haven_bg.webp`,
  `${WS_BG_BASE}/new_york_bg.webp`,
  `${WS_BG_BASE}/north_carolina_bg.webp`,
  `${WS_BG_BASE}/oklahoma_city_bg.webp`,
  `${WS_BG_BASE}/orange_county_bg.webp`,
  `${WS_BG_BASE}/orlando_bg.webp`,
  `${WS_BG_BASE}/philadelphia_bg.webp`,
  `${WS_BG_BASE}/phoenix_bg.webp`,
  `${WS_BG_BASE}/pittsburgh_bg.webp`,
  `${WS_BG_BASE}/portland_bg.webp`,
  `${WS_BG_BASE}/sacramento_bg.webp`,
  `${WS_BG_BASE}/san_diego_bg.webp`,
  `${WS_BG_BASE}/san_francisco_bg.webp`,
  `${WS_BG_BASE}/seattle_bg.webp`,
  `${WS_BG_BASE}/stlouis_bg.webp`,
  `${WS_BG_BASE}/tampa_bg.webp`,
  `${WS_BG_BASE}/washington_dc_bg.webp`
];
var WS4000_BG_BASE = "/assets/backgrounds";
var WS4000_SCENE_BACKGROUNDS = {
  current: `${WS4000_BG_BASE}/BackGround1.webp`,
  localforecast: `${WS4000_BG_BASE}/BackGround1_2.webp`,
  extended: `${WS4000_BG_BASE}/BackGround2.webp`,
  hourly: `${WS4000_BG_BASE}/BackGround3.webp`,
  almanac: `${WS4000_BG_BASE}/BackGround3_1.webp`,
  travel: `${WS4000_BG_BASE}/BackGround4.webp`,
  radar: `${WS4000_BG_BASE}/BackGround5.webp`,
  temptrend: `${WS4000_BG_BASE}/BackGround1_1_Chart.webp`,
  feelslike: `${WS4000_BG_BASE}/BackGround1_1.webp`,
  overnight: `${WS4000_BG_BASE}/BackGround1_3_1.webp`,
  weekend: `${WS4000_BG_BASE}/BackGround2_1.webp`,
  precip: `${WS4000_BG_BASE}/BackGround5_1.webp`,
  detailed: `${WS4000_BG_BASE}/BackGround1_2_1.webp`,
  stormtracker: `${WS4000_BG_BASE}/BackGround5_2.webp`,
  traffic: `${WS4000_BG_BASE}/BackGround4_1.webp`,
  airport: `${WS4000_BG_BASE}/BackGround4_2.webp`,
  alerts: `${WS4000_BG_BASE}/BackGround6.webp`
};
var WSJR_SCENE_BACKGROUNDS = {
  current: `${WS4000_BG_BASE}/BackGround2.webp`,
  localforecast: `${WS4000_BG_BASE}/BackGround2_1.webp`,
  extended: `${WS4000_BG_BASE}/BackGround2_2.webp`,
  hourly: `${WS4000_BG_BASE}/BackGround3_2.webp`,
  almanac: `${WS4000_BG_BASE}/BackGround3.webp`,
  travel: `${WS4000_BG_BASE}/BackGround4.webp`,
  radar: `${WS4000_BG_BASE}/BackGround5.webp`
};
var WS_LOCAL_SCENE_BACKGROUNDS = {
  current: `${WS_LOCAL_BASE}/now.webp`,
  localforecast: `${WS_LOCAL_BASE}/now.webp`,
  extended: `${WS_LOCAL_BASE}/extended.webp`,
  hourly: `${WS_LOCAL_BASE}/36hr.webp`,
  almanac: `${WS_LOCAL_BASE}/almanac.webp`,
  travel: `${WS_LOCAL_BASE}/nearby.webp`,
  overnight: `${WS_LOCAL_BASE}/now.webp`,
  weekend: `${WS_LOCAL_BASE}/extended.webp`,
  radar: "/assets/themes/weatherscan/backgrounds/local-era/local-doppler-skeleton.webp"
};

// src/core/settings/themes.ts
var THEMES = [
  {
    // WeatherStar 4000 v1 (~2001-2004). Mid-era look: flat orange header
    // strip with a dark-blue diagonal cut on the right, full-bleed solid
    // blue content pane with a cyan inner border, yellow Star4000 Extended
    // titles, gold/yellow Star4000 Large temps, 1998 cartoon icon set.
    // Extended Forecast is 3 vertical day-panels (Feb 1991 redesign).
    // Almanac has an orange-top / purple-bottom split background unique
    // to that scene. Radar has its own dark-blue chrome with a cyan title
    // and inline intensity legend. No persistent bottom footer.
    //
    // Reference: docs/reference/ws4000/4000-v1-*.jpg — seven measured stills.
    id: "ws4000-v1",
    label: "WeatherStar 4000 v1 (2001\u20132004)",
    defaultNarrator: "allan-jackson",
    iconSet: "/assets/icons",
    // WS4000-era predates the Weatherscan in-house jazz catalog (2003+).
    // TWC flagship Local on the 8s ran on Trammell Starks' Music for
    // Local Forecast throughout this period — era-authentic pool.
    musicTags: ["trammell-starks"],
    backgroundImage: "/assets/backgrounds/BackGround1.webp",
    extendedStyle: "3-day",
    extendedTitle: "Extended Forecast",
    vars: {
      "--ws-bg-deep": "#050d28",
      "--ws-bg-mid": "#0a1f4a",
      "--ws-bg-top": "#1b3b87",
      "--ws-accent": "#4ec9ff",
      "--ws-accent-warm": "#ff9933",
      "--ws-text": "#ffffff",
      "--ws-text-dim": "#b8c6e0",
      "--ws-led": "#ffd24d",
      "--ws-alert": "#ff5050",
      "--ws-font-display": '"Star4000", "Star4000 Extended", "Lato", "Helvetica Neue", "Arial", sans-serif',
      "--ws-font-led": '"Star4000 Large", "Star4000", "Courier New", monospace',
      "--ws-font-small": '"Star4000 Small", "Star4000", "Arial", sans-serif'
    }
  },
  {
    // WeatherStar 4000 v2 (~2005-2009). Late-era redesign on the same
    // hardware: skewed/parallelogram orange header strip layered over a
    // narrow dark-blue band, floating cyan-glow content box with drop
    // shadow on an orange-to-purple vertical gradient background, always-
    // on footer bar carrying contextual data ("Conditions at <city>",
    // "<Month> Precipitation: n.nn in", etc.). Radar uses a pink/purple
    // header with an expanded 7-step PRECIP legend plus an Incomplete
    // Data swatch, and the basemap switched from dark-navy to a light
    // off-white map with red state borders. Current Conditions adds a
    // pressure trend arrow and a Ceiling field.
    //
    // Reference: docs/reference/ws4000/WS4000_Simulator_v2_*.jpg — five
    // simulator stills (high fidelity; simulator, not raw broadcast).
    id: "ws4000-v2",
    label: "WeatherStar 4000 v2 (2005\u20132009)",
    defaultNarrator: "allan-jackson",
    iconSet: "/assets/icons",
    musicTags: ["trammell-starks"],
    // v2 renders an orange-to-purple vertical gradient as the frame bg
    // and a floating content pane on top. Using empty here so the CSS
    // custom property takes over (--ws-bg-image is set to none, and the
    // CSS body[data-theme="ws4000-v2"] rule paints the gradient).
    backgroundImage: "",
    extendedStyle: "3-day",
    extendedTitle: "Extended Forecast",
    vars: {
      // Orange-to-purple gradient stops (darker deep, warmer top). The
      // actual gradient is painted in CSS; these vars give fallback
      // solid colors for any component that reads them directly.
      "--ws-bg-deep": "#2a0a3c",
      "--ws-bg-mid": "#5c2a3c",
      "--ws-bg-top": "#c85a1c",
      "--ws-accent": "#7ae0ff",
      "--ws-accent-warm": "#ff9933",
      "--ws-text": "#ffffff",
      "--ws-text-dim": "#d8bcc8",
      "--ws-led": "#ffd24d",
      "--ws-alert": "#ff5050",
      "--ws-font-display": '"Star4000", "Star4000 Extended", "Lato", "Helvetica Neue", "Arial", sans-serif',
      "--ws-font-led": '"Star4000 Large", "Star4000", "Courier New", monospace',
      "--ws-font-small": '"Star4000 Small", "Star4000", "Arial", sans-serif'
    }
  },
  {
    // Weatherscan Local (1999-2003). Pre-IntelliStar era on the WeatherStar
    // XL platform. Visual language: regional photo backgrounds (neighborhood,
    // forest, ocean, mountain, southwest) drawn from the XL's regional pool,
    // Akzidenz-Grotesk typography, UDL+LDL text strips framing the content,
    // and Trammell Starks' Music for Local Forecast as the soundtrack. No
    // skyline cityscapes, no yellow wedge accents — those came in Era 2.
    id: "weatherscan-local",
    label: "Weatherscan Local (1999\u20132003)",
    defaultNarrator: "allan-jackson",
    iconSet: "/assets/icons",
    musicTags: ["trammell-starks"],
    // Fallback image — authentic pre-2003 Weatherscan Local "neighborhood"
    // regional theme Current Conditions background (soft-focus picket fence
    // at golden hour), sourced from the JesseWx2011 Weatherscan Local sim.
    // Real Weatherscan Local rotated scene-specific backgrounds via
    // getSceneBackground(), so this only shows when no per-scene map exists.
    backgroundImage: "/assets/themes/weatherscan/backgrounds/local-era/neighborhood/now.webp",
    extendedStyle: "7-day",
    extendedTitle: "7-Day Outlook",
    vars: {
      "--ws-bg-deep": "#040915",
      "--ws-bg-mid": "#0a1838",
      "--ws-bg-top": "#14295c",
      "--ws-accent": "#8ec8e8",
      "--ws-accent-warm": "#e4c878",
      "--ws-text": "#f0f4fa",
      "--ws-text-dim": "#a6b4cc",
      "--ws-led": "#e4c878",
      "--ws-alert": "#ff4040",
      "--ws-font-display": '"AkzidenzGroteskBE-BoldEx", "AkzidenzGroteskBE", "Helvetica Neue", "Arial", sans-serif',
      "--ws-font-led": '"AkzidenzGroteskBE", "Helvetica Neue", "Courier New", monospace',
      "--ws-font-small": '"AkzidenzGroteskBE-MdEx", "AkzidenzGroteskBE", "Helvetica", "Arial", sans-serif'
    }
  },
  {
    // Weatherscan IntelliStar V1 (Feb 2003 – Sept 2005). First era on the
    // IntelliStar platform. Visual signature: city-skyline background with
    // the TWC "weatherscan" wordmark rendered over it in blue Frutiger,
    // color-coded "arc-side" curves per segment (yellow for local forecast,
    // orange traffic, blue travel/airport, green garden/golf, teal health,
    // purple ski). 15-track in-house jazz music catalog, Amy Bargeron as
    // the voice of Weatherscan.
    id: "weatherscan-v1",
    label: "Weatherscan V1 (2003\u20132005)",
    defaultNarrator: "amy-bargeron",
    iconSet: "/assets/icons",
    musicTags: ["weatherscan-inhouse"],
    backgroundImage: "/assets/themes/weatherscan/backgrounds/city_bg.webp",
    extendedStyle: "7-day",
    extendedTitle: "7-Day Outlook",
    vars: {
      "--ws-bg-deep": "#020818",
      "--ws-bg-mid": "#061233",
      "--ws-bg-top": "#0c1f5a",
      "--ws-accent": "#00c8ff",
      "--ws-accent-warm": "#ffcc33",
      "--ws-text": "#ffffff",
      "--ws-text-dim": "#8899bb",
      "--ws-led": "#ffffff",
      "--ws-alert": "#ff3333",
      "--ws-font-display": '"Frutiger", "Lato", "Helvetica Neue", sans-serif',
      "--ws-font-led": '"Frutiger", "Courier New", monospace',
      "--ws-font-small": '"Frutiger", "Arial", sans-serif'
    }
  },
  {
    // Weatherscan V2 / L-bar era (Sept 2005 – Dec 2022). Final visual
    // redesign. Interstate Bold for the outer chrome (logo wordmark, clock,
    // L-bar labels); Frutiger retained inside the main content panel. Same
    // city-skyline backgrounds as V1, same color-coded segment accents.
    // 33-track remastered-in-stereo in-house jazz catalog. Amy Bargeron
    // continued as the voice.
    // NOTE: The L-bar layout (persistent left column with logo/obs/radar +
    // bottom horizontal strip) is not yet wired into WeatherscanFrame — for
    // now V2 renders with the standard frame shell, differentiated from V1
    // by typography and accent palette only.
    id: "weatherscan-v2",
    label: "Weatherscan V2 L-bar (2005\u20132022)",
    defaultNarrator: "amy-bargeron",
    iconSet: "/assets/icons",
    musicTags: ["weatherscan-inhouse"],
    backgroundImage: "/assets/themes/weatherscan/backgrounds/city_bg.webp",
    extendedStyle: "7-day",
    extendedTitle: "7-Day Outlook",
    vars: {
      "--ws-bg-deep": "#020a1c",
      "--ws-bg-mid": "#071638",
      "--ws-bg-top": "#0d246a",
      "--ws-accent": "#00b4e8",
      "--ws-accent-warm": "#ffd24d",
      "--ws-text": "#ffffff",
      "--ws-text-dim": "#8aa0c0",
      "--ws-led": "#ffffff",
      "--ws-alert": "#ff3333",
      "--ws-font-display": '"Interstate", "Frutiger", "Helvetica Neue", "Arial", sans-serif',
      "--ws-font-led": '"Interstate", "InterstateMono", "Courier New", monospace',
      "--ws-font-small": '"Frutiger", "Interstate", "Arial", sans-serif'
    }
  },
  {
    id: "weatherstarxl",
    label: "WeatherStar XL",
    defaultNarrator: "allan-jackson",
    iconSet: "/assets/icons/large",
    iconResolution: 42,
    // WeatherStar XL (1998-2014) shared the TWC flagship channel's music
    // pool, which was Trammell Starks' Music for Local Forecast throughout
    // its production life. XL never played the Weatherscan-exclusive
    // in-house jazz — that was a separate catalog for the Weatherscan
    // channel only.
    musicTags: ["trammell-starks"],
    backgroundImage: "",
    extendedStyle: "7-day",
    extendedTitle: "Extended Forecast",
    vars: {
      "--ws-bg-deep": "#000000",
      "--ws-bg-mid": "#0a1930",
      "--ws-bg-top": "#152a50",
      "--ws-accent": "#5eaacc",
      "--ws-accent-warm": "#debd69",
      "--ws-text": "#d4d4d4",
      "--ws-text-dim": "#9eaabb",
      "--ws-led": "#debd69",
      "--ws-alert": "#ff4444",
      "--ws-font-display": '"AkzidenzGroteskBE-BoldEx", "AkzidenzGroteskBE", "Helvetica Neue", "Arial", sans-serif',
      "--ws-font-led": '"AkzidenzGroteskBE", "Helvetica Neue", "Courier New", monospace',
      "--ws-font-small": '"AkzidenzGroteskBE-MdEx", "AkzidenzGroteskBE", "Helvetica", "Arial", sans-serif'
    }
  },
  {
    id: "intellistar1",
    label: "IntelliStar 1",
    defaultNarrator: "jim-cantore",
    iconSet: "/assets/icons/large",
    iconResolution: 42,
    // IS1 (2003-2013) had its own dedicated production-music pool (Becker,
    // Chaquico, Cooling, Howard, Hughes, Sample). Strict filter keeps the
    // IS2 HD-era catalog out of the mix.
    musicTags: ["intellistar1"],
    backgroundImage: "",
    extendedStyle: "7-day",
    extendedTitle: "Week Ahead",
    // Typography: Interstate was the IS1 chrome/titles typeface from the
    // Feb 2003 launch onward (Wikipedia + HandWiki). The Jun 2, 2008 LDL
    // redesign swapped LDL body text to Helvetica Neue, but Interstate
    // remained in chrome. Earlier assumption of Akzidenz-Grotesk was
    // incorrect — that was WS XL / Weatherscan-Local typography, not IS1.
    vars: {
      "--ws-bg-deep": "#001030",
      "--ws-bg-mid": "#002060",
      "--ws-bg-top": "#003399",
      "--ws-accent": "#33aaff",
      "--ws-accent-warm": "#ffcc00",
      "--ws-text": "#ffffff",
      "--ws-text-dim": "#aabbdd",
      "--ws-led": "#ffcc00",
      "--ws-alert": "#ff4444",
      "--ws-font-display": '"Interstate", "Helvetica Neue", "Arial", sans-serif',
      "--ws-font-led": '"Interstate", "InterstateMono", "Helvetica Neue", "Courier New", monospace',
      "--ws-font-small": '"Helvetica Neue", "Interstate", "Helvetica", "Arial", sans-serif'
    }
  },
  {
    id: "intellistar2",
    label: "IntelliStar 2 / 2 Jr HD",
    defaultNarrator: "chandler",
    iconSet: "/assets/icons/large",
    iconResolution: 68,
    // (IS2 keeps 68px HD WEBPs; IS1 below gets 42px — its /large GIF
    // fallback dir actually contains .apng files, so without a WEBP
    // resolution every icon 404ed.)
    // IS2 (2013+) used its own HD-era production music (Beach Night,
    // Beautiful Day, Destination Groove, etc.). Era-exclusive filter.
    musicTags: ["intellistar2"],
    backgroundImage: "",
    extendedStyle: "7-day",
    extendedTitle: "7-Day Outlook",
    vars: {
      "--ws-bg-deep": "#000714",
      "--ws-bg-mid": "#001e46",
      "--ws-bg-top": "#003a7a",
      "--ws-accent": "#3fa9ff",
      "--ws-accent-warm": "#ffc832",
      "--ws-text": "#ffffff",
      "--ws-text-dim": "#a6bbd0",
      "--ws-led": "#ffc832",
      "--ws-alert": "#ff4040",
      "--ws-font-display": '"Frutiger", "Interstate", "Helvetica Neue", "Arial", sans-serif',
      "--ws-font-led": '"Interstate", "Frutiger", "Helvetica Neue", "Courier New", monospace',
      "--ws-font-small": '"Frutiger", "Interstate", "Helvetica Neue", "Arial", sans-serif'
    }
  },
  {
    // WeatherStar 3000 (1988-1990). TWC's pre-WS4000 local unit. No
    // narration, no graphical weather icons — just blocky colored text
    // against a dark blue/purple field. Radar wasn't rendered locally on
    // the 3000, so the scene order drops it. Reference: twcarchive.com/
    // wiki/Weather_Star_III describes "blue and white text" on a blue/
    // purple background, decorative backgrounds discontinued in 1988.
    id: "ws3000",
    label: "WeatherStar 3000",
    defaultNarrator: "silent",
    iconSet: "/assets/icons/legacy/1990-regional",
    musicTags: ["any"],
    backgroundImage: "",
    extendedStyle: "5-day",
    extendedTitle: "Extended Forecast",
    vars: {
      "--ws-bg-deep": "#060028",
      "--ws-bg-mid": "#1a0858",
      "--ws-bg-top": "#2e1a90",
      "--ws-accent": "#e8ecff",
      "--ws-accent-warm": "#ffc840",
      "--ws-text": "#f4f6ff",
      "--ws-text-dim": "#b0b4cc",
      "--ws-led": "#ffc840",
      "--ws-alert": "#ff4040",
      "--ws-font-display": '"Star3000", "Star3000 Large", "Courier New", monospace',
      "--ws-font-led": '"Star3000 Large", "Star3000", "Courier New", monospace',
      "--ws-font-small": '"Star3000 Small", "Star3000", "Courier New", monospace'
    }
  },
  {
    // WeatherStar Jr (1993-2014). Budget Wegener unit for small cable
    // operators. Per research (docs/legacy-eras.md), WSJr inherited the
    // WS3000 product set and screen layouts — text-only pages on solid
    // color fields, no on-unit radar, no cartoon icons, no graphical
    // moon-phase almanac. The *only* WS4000 DNA is the cleaner typeface
    // (our "StarJR" family). Scene rendering should mirror WS3000, not
    // WS4000, once the WS3000 text-page renderer stack exists.
    //
    // NOTE: defaultNarrator marked allan-jackson for now, but this is
    // NOT source-confirmed — Allan Jackson is documented for WS XL and
    // IS1 eras, not specifically for WSJr. Revisit when aircheck audio
    // can confirm or refute.
    id: "wsjr",
    label: "WeatherStar Jr",
    defaultNarrator: "allan-jackson",
    iconSet: "/assets/icons",
    // WS Jr (1993-2014) rode the TWC flagship Trammell Starks music pool
    // just like WS4000.
    musicTags: ["trammell-starks"],
    backgroundImage: "/assets/backgrounds/BackGround2.webp",
    extendedStyle: "5-day",
    extendedTitle: "Extended Forecast",
    vars: {
      "--ws-bg-deep": "#060e26",
      "--ws-bg-mid": "#0c1f4c",
      "--ws-bg-top": "#1a3680",
      "--ws-accent": "#4fb8e0",
      "--ws-accent-warm": "#ffc448",
      "--ws-text": "#ffffff",
      "--ws-text-dim": "#a8bcd8",
      "--ws-led": "#ffc448",
      "--ws-alert": "#ff4848",
      "--ws-font-display": '"StarJR", "Star4000", "Star4000 Extended", "Lato", "Helvetica Neue", "Arial", sans-serif',
      "--ws-font-led": '"StarJR Large", "StarJR", "Courier New", monospace',
      "--ws-font-small": '"StarJR Small", "StarJR", "Arial", sans-serif'
    }
  }
];
var THEME_MAP = new Map(THEMES.map((t) => [t.id, t]));
export {
  NARRATORS,
  THEMES,
  THEME_PRODUCT_ERA,
  eraIntroKeys,
  getProductEra,
  pickSceneIntro,
  segmentLabel,
  setProductEra
};
