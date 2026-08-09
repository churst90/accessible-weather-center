/**
 * Music catalog. Hand-curated for the user's two music collections:
 *   1. Weatherscan in-house production music (jazz1.mp3 .. jazz41.mp3)
 *   2. Trammell Starks - Music for Local Forecast (1995, 39 named tracks)
 *
 * Each track has mood tags so the scene scheduler can pick something
 * appropriate. The jazz1..41 set has no per-track metadata so it's tagged
 * with a generic "ambient" mood and the random picker rotates through them.
 */

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  collection: string;
  src: string;
  /** Mood tags. A scene asks for "calm" and any matching track is fair game. */
  moods: string[];
}

const WS_BASE =
  "/assets/shared/music/The Weather Channel Weatherscan In-house production music (4 disk set)";

const TS_BASE =
  "/assets/shared/music/Trammell Starks - Music for Local Forecast (3 disk set) 1995";

/** Build the 41 generic Weatherscan jazz tracks programmatically. */
function buildWeatherscanJazz(): MusicTrack[] {
  const ranges: Array<{ disk: number; start: number; end: number }> = [
    { disk: 1, start: 1, end: 10 },
    { disk: 2, start: 11, end: 20 },
    { disk: 3, start: 21, end: 30 },
    { disk: 4, start: 31, end: 41 }
  ];
  const out: MusicTrack[] = [];
  for (const r of ranges) {
    for (let i = r.start; i <= r.end; i++) {
      out.push({
        id: `ws_jazz_${i}`,
        title: `Weatherscan Jazz ${i}`,
        artist: "The Weather Channel (in-house production)",
        collection: `Weatherscan Music Collection Disk ${r.disk}`,
        src: `${WS_BASE}/Weatherscan Music Collection Disk ${r.disk}/jazz${i}.mp3`,
        moods: ["ambient", "weatherscan-inhouse", "weatherscan", "any"]
      });
    }
  }
  return out;
}

const trammellStarks: MusicTrack[] = [
  // Disk 1
  ts("d1", "01 Fair Weather",            ["calm", "fair", "any"]),
  ts("d1", "02 Good Ole Days",           ["calm", "nostalgic", "any"]),
  ts("d1", "03 Crazy Pianos Jumpin",     ["upbeat", "any"]),
  ts("d1", "04 40 Below Life",           ["winter", "cold"]),
  ts("d1", "05 Easy Times",              ["calm", "any"]),
  ts("d1", "06 Pier 32 Evening",         ["calm", "evening", "any"]),
  ts("d1", "07 Smooth Sailing",          ["calm", "any"]),
  ts("d1", "08 Thundersnow A New Day",   ["storm", "winter"]),
  ts("d1", "09 The Setting Sun",         ["calm", "evening", "any"]),
  ts("d1", "10 Seasons on the Edge",     ["moderate", "any"]),
  ts("d1", "11 Jamaican Jam",            ["upbeat", "tropical"]),
  ts("d1", "12 Good Times",              ["upbeat", "any"]),
  ts("d1", "13 Care Free",               ["calm", "any"]),
  // Disk 2
  ts("d2", "01 Lazy Days",               ["calm", "any"]),
  ts("d2", "02 It Never Ends Beach Frolic", ["upbeat", "tropical"]),
  ts("d2", "03 Winter Tundra",           ["winter", "cold"]),
  ts("d2", "04 Rainy Days",              ["rain", "moderate"]),
  ts("d2", "05 Midnight Cruise",         ["calm", "night"]),
  ts("d2", "06 Cool Cats",               ["upbeat", "any"]),
  ts("d2", "07 In the Summer",           ["upbeat", "summer"]),
  ts("d2", "08 The Passing Time",        ["calm", "any"]),
  ts("d2", "09 Havin Fun",               ["upbeat", "any"]),
  ts("d2", "10 That Latin Beat",         ["upbeat", "any"]),
  ts("d2", "11 Takin it Easy",           ["calm", "any"]),
  ts("d2", "12 The Chase",               ["upbeat", "alert"]),
  ts("d2", "13 Funk Dance",              ["upbeat", "any"]),
  // Disk 3
  ts("d3", "01 Small Town",              ["calm", "any"]),
  ts("d3", "02 The Promise of Tomorrow", ["uplift", "any"]),
  ts("d3", "03 Contemporary Jive",       ["upbeat", "any"]),
  ts("d3", "04 Light Jazz Tonight",      ["calm", "night"]),
  ts("d3", "05 Pastel",                  ["calm", "any"]),
  ts("d3", "06 Tropical Breeze",         ["calm", "tropical"]),
  ts("d3", "07 Going Home",              ["calm", "evening"]),
  ts("d3", "08 Brighter Days",           ["uplift", "any"]),
  ts("d3", "09 Reflections in Time",     ["calm", "any"]),
  ts("d3", "10 Memories of the Past",    ["calm", "nostalgic"]),
  ts("d3", "11 Late Night Cafe",         ["calm", "night"]),
  ts("d3", "12 The End of the Journey",  ["calm", "evening"]),
  ts("d3", "13 A Little Jazz",           ["calm", "any"])
];

function ts(disk: "d1" | "d2" | "d3", filename: string, moods: string[]): MusicTrack {
  const diskNum = disk === "d1" ? 1 : disk === "d2" ? 2 : 3;
  const title = filename.replace(/^\d+\s+/, "");
  // Every Trammell Starks track gets the "trammell-starks" collection tag
  // so Weatherscan Local (1999-2003 era) can filter exclusively to this
  // pool — that era used Starks' Music for Local Forecast catalog end-to-
  // end, before Weatherscan moved to in-house jazz in 2003.
  return {
    id: `ts_${disk}_${filename.split(" ")[0]}`,
    title,
    artist: "Trammell Starks",
    collection: `Music for Local Forecast - Disk ${diskNum}`,
    src: `${TS_BASE}/Music for Local Forecast - Disk ${diskNum}/${filename}.mp3`,
    moods: ["trammell-starks", ...moods]
  };
}

// ─── IntelliStar 1 music ───

const I1_BASE = "/assets/shared/music/intellistar1";

const intellistar1Music: MusicTrack[] = [
  // All IS1 tracks tagged with `intellistar1` so the IS1 theme can filter
  // exclusively to this pool, keeping the IS2 catalog out. The generic
  // `intellistar` and `any` tags remain for legacy compatibility.
  i1("becker_proc.mp3",    "Becker",   ["ambient", "intellistar1", "intellistar", "any"]),
  i1("chaquico_proc.mp3",  "Chaquico", ["calm", "intellistar1", "intellistar", "any"]),
  i1("cooling_proc.mp3",   "Cooling",  ["calm", "intellistar1", "intellistar", "any"]),
  i1("howard_proc.mp3",    "Howard",   ["ambient", "intellistar1", "intellistar", "any"]),
  i1("hughes_proc.mp3",    "Hughes",   ["ambient", "intellistar1", "intellistar", "any"]),
  i1("sample_proc.mp3",    "Sample",   ["ambient", "intellistar1", "intellistar", "any"]),
];

function i1(filename: string, title: string, moods: string[]): MusicTrack {
  return {
    id: `i1_${filename.replace(".mp3", "")}`,
    title,
    artist: "IntelliStar Music",
    collection: "IntelliStar 1 Production Music",
    src: `${I1_BASE}/${filename}`,
    moods
  };
}

// ─── IntelliStar 2 music ───

const I2_BASE = "/assets/shared/music/intellistar2";

const intellistar2Music: MusicTrack[] = [
  // All IS2 tracks tagged with `intellistar2` so the IS2 theme filters
  // exclusively to this HD-era pool, keeping the older IS1 catalog out.
  i2("BEACH NIGHT.mp3",          "Beach Night",          ["calm", "night", "intellistar2", "intellistar", "any"]),
  i2("BEAUTIFUL DAY.mp3",        "Beautiful Day",        ["uplift", "intellistar2", "intellistar", "any"]),
  i2("BELL TOLLS.mp3",           "Bell Tolls",           ["moderate", "intellistar2", "intellistar", "any"]),
  i2("BRIGHT SUN ABOVE.mp3",     "Bright Sun Above",     ["upbeat", "intellistar2", "intellistar", "any"]),
  i2("BRIGHT SUN ABOVE 60.mp3",  "Bright Sun Above 60",  ["upbeat", "intellistar2", "intellistar", "any"]),
  i2("CORDUROY GLOW.mp3",        "Corduroy Glow",        ["calm", "intellistar2", "intellistar", "any"]),
  i2("DEEP TRIP.mp3",            "Deep Trip",            ["moderate", "intellistar2", "intellistar", "any"]),
  i2("DESOLATION.mp3",           "Desolation",           ["calm", "intellistar2", "intellistar"]),
  i2("DESTINATION GROOVE.mp3",   "Destination Groove",   ["upbeat", "intellistar2", "intellistar", "any"]),
  i2("HAPPY PANTS.mp3",          "Happy Pants",          ["upbeat", "intellistar2", "intellistar", "any"]),
  i2("HAPPY TRAVELS.mp3",        "Happy Travels",        ["upbeat", "intellistar2", "intellistar", "any"]),
  i2("LEADED.mp3",               "Leaded",               ["moderate", "intellistar2", "intellistar", "any"]),
  i2("THREADED.mp3",             "Threaded",             ["moderate", "intellistar2", "intellistar", "any"]),
  i2("WINDS MOVE SLOW.mp3",      "Winds Move Slow",      ["calm", "intellistar2", "intellistar", "any"]),
];

function i2(filename: string, title: string, moods: string[]): MusicTrack {
  return {
    id: `i2_${filename.replace(".mp3", "").replace(/ /g, "_").toLowerCase()}`,
    title,
    artist: "IntelliStar Music",
    collection: "IntelliStar 2 Production Music",
    src: `${I2_BASE}/${encodeURIComponent(filename)}`,
    moods
  };
}

export function musicCatalog(): MusicTrack[] {
  return [...buildWeatherscanJazz(), ...trammellStarks, ...intellistar1Music, ...intellistar2Music];
}

/** Pick a track for a mood. Returns null if catalog is empty. */
export function pickByMood(catalog: MusicTrack[], mood: string): MusicTrack | null {
  const matches = catalog.filter((t) => t.moods.includes(mood));
  const pool = matches.length > 0 ? matches : catalog;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
