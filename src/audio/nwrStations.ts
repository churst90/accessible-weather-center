/**
 * NOAA Weather Radio (NWR) transmitter directory — weatherUSA Icecast edition.
 *
 * weatherUSA's Icecast server (radio.weatherusa.net) doesn't serve the full
 * NWS transmitter catalog — it relays user-contributed SDR receiver feeds.
 * The active mount list changes as contributors start and stop their
 * streams, so *any* hardcoded list goes stale fast. Mount points that were
 * once live and are now dormant return HTTP 404, not audio.
 *
 * Architecture:
 *   1. `BUNDLED_STATIONS` — a curated snapshot of known-active mounts with
 *      city/state parsed from Icecast metadata. Used as the startup list
 *      and as a fallback when the live fetch fails.
 *   2. `fetchActiveNwrStations()` — IPC-backed call to the Electron main
 *      process, which fetches `/status-json.xsl`, parses it tolerantly
 *      (weatherUSA sometimes embeds malformed JSON), and returns the
 *      currently-streaming mount list. Use this to refresh the bundled
 *      list at runtime (e.g. when the user opens Settings).
 *
 * Stream URL pattern: https://radio.weatherusa.net/NWR/{callSign}.mp3
 * Status endpoint:    https://radio.weatherusa.net/status-json.xsl
 * weatherUSA listing: https://www.weatherusa.net/radio
 */

export interface NwrStation {
  callSign: string;
  city: string;
  state: string;
  /** Descriptive suffix (e.g. source name, SDR location). Optional —
   *  shown after the city/state in the autocomplete dropdown. */
  note?: string;
}

/**
 * Curated snapshot of currently-active weatherUSA NWR mounts, April 2026.
 * City/state parsed from the mount's `server_description` or `server_name`.
 * Entries with unparseable metadata (e.g. "Unspecified description") are
 * omitted from this bundled list but remain reachable via the live fetch.
 *
 * If a station disappears from weatherUSA, its mount starts returning 404.
 * The runtime `fetchActiveNwrStations()` reflects current reality — this
 * bundled list is a fallback only.
 */
export const BUNDLED_STATIONS: NwrStation[] = [
  // Northeast
  { callSign: "KEB98",    city: "Buffalo",        state: "NY" },
  { callSign: "KHB35_3",  city: "Boston",         state: "MA" },
  { callSign: "KIH28_3",  city: "Philadelphia",   state: "PA" },
  { callSign: "WXK97",    city: "Philadelphia",   state: "PA", note: "alternate feed" },
  { callSign: "KIH35",    city: "Pittsburgh",     state: "PA" },
  { callSign: "KHB37_3",  city: "Wakefield",      state: "VA", note: "KHB37 backup" },

  // Southeast
  { callSign: "KHB32",    city: "Riverview",      state: "FL" },
  { callSign: "KEC61_2",  city: "Mobile",         state: "AL" },
  { callSign: "WXM32",    city: "Columbus",       state: "GA" },
  { callSign: "WXK63",    city: "Beechgrove",     state: "TN" },

  // Midwest / Great Lakes
  { callSign: "KIG86",    city: "Columbus",       state: "OH" },
  { callSign: "KIH42_2",  city: "Covington",      state: "KY" },
  { callSign: "KEC60",    city: "Milwaukee",      state: "WI" },
  { callSign: "WXJ88",    city: "Menomonie",      state: "WI" },
  { callSign: "KEC65",    city: "Minneapolis",    state: "MN" },
  { callSign: "WNG676",   city: "Clearwater",     state: "MN" },
  { callSign: "WXL57",    city: "Des Moines",     state: "IA" },
  { callSign: "KIH61",    city: "Omaha",          state: "NE" },
  { callSign: "KZZ69",    city: "Friend",         state: "NE" },
  { callSign: "WXN99",    city: "West Olive",     state: "MI" },

  // Plains / South Central
  { callSign: "KEC55_2",  city: "Fort Worth",     state: "TX" },
  { callSign: "KHB37_2",  city: "Weatherford",    state: "TX" },
  { callSign: "KHB40",    city: "Galveston",      state: "TX" },
  { callSign: "KHB41_2",  city: "Corpus Christi", state: "TX" },
  { callSign: "KGG68",    city: "Tomball",        state: "TX" },
  { callSign: "KWN34",    city: "Palestine",      state: "TX" },
  { callSign: "WXK23",    city: "Lufkin",         state: "TX" },
  { callSign: "WXK30",    city: "College Station",state: "TX" },
  { callSign: "WXK38_2",  city: "Amarillo",       state: "TX" },
  { callSign: "WXK85",    city: "Oklahoma City",  state: "OK" },
  { callSign: "WXK86",    city: "Lawton",         state: "OK" },

  // Mountain / West
  { callSign: "WXM61",    city: "Lander",         state: "WY" },
  { callSign: "WWG20",    city: "Fernley",        state: "NV" },
  { callSign: "WXK58",    city: "Reno",           state: "NV" },
];

/** Active list used at runtime. Starts equal to BUNDLED_STATIONS; can be
 *  replaced by {@link updateLiveStations} after a successful live fetch. */
let activeStations: NwrStation[] = [...BUNDLED_STATIONS];

export const NWR_STATIONS: NwrStation[] = new Proxy(activeStations, {
  get(_, prop) {
    return Reflect.get(activeStations, prop);
  },
  has(_, prop) {
    return Reflect.has(activeStations, prop);
  },
  ownKeys() {
    return Reflect.ownKeys(activeStations);
  },
  getOwnPropertyDescriptor(_, prop) {
    return Reflect.getOwnPropertyDescriptor(activeStations, prop);
  }
});

/** Look up a station by call sign, case-insensitive. Checks the active list. */
export function findStation(callSign: string | null): NwrStation | null {
  if (!callSign) return null;
  const cs = callSign.toUpperCase();
  return activeStations.find((s) => s.callSign.toUpperCase() === cs) ?? null;
}

/** Pick a default call sign for a place name. Best-effort fuzzy match by
 *  city or state name. Null if nothing close. Only suggests from the
 *  active list, so we never default the user to a dead mount. */
export function suggestCallSignForPlace(placeName: string): string | null {
  if (!placeName) return null;
  const lower = placeName.toLowerCase();
  const byCity = activeStations.find((s) => lower.includes(s.city.toLowerCase()));
  if (byCity) return byCity.callSign;
  const byState = activeStations.find((s) => {
    const stateLower = s.state.toLowerCase();
    return lower.includes(`, ${stateLower}`) || lower.endsWith(` ${stateLower}`);
  });
  return byState?.callSign ?? null;
}

/** Replace the active station list with a fresh fetch result. Merges
 *  metadata: any entry already in BUNDLED_STATIONS keeps its clean
 *  city/state; purely-live entries get parsed best-effort. */
export function updateLiveStations(fetched: NwrActiveStation[]): void {
  const bundledByCS = new Map(BUNDLED_STATIONS.map((s) => [s.callSign.toUpperCase(), s]));
  const merged: NwrStation[] = [];
  for (const live of fetched) {
    const cs = live.callSign.toUpperCase();
    const bundled = bundledByCS.get(cs);
    if (bundled) {
      merged.push(bundled);
      continue;
    }
    const parsed = parseCityState(live.description, live.name);
    if (parsed) {
      merged.push({ callSign: live.callSign, city: parsed.city, state: parsed.state });
    } else {
      merged.push({ callSign: live.callSign, city: live.callSign, state: "" });
    }
  }
  // Sort by state then city for predictable autocomplete ordering.
  merged.sort((a, b) => (a.state + a.city).localeCompare(b.state + b.city));
  activeStations.length = 0;
  activeStations.push(...merged);
}

/** Attempt to pull the live mount list via Electron IPC. Returns null if
 *  IPC isn't available (e.g. in Vite browser preview) or if the fetch
 *  fails. On success, also updates {@link activeStations} in place. */
export async function fetchActiveNwrStations(): Promise<NwrFetchResult | null> {
  const bridge = (window as unknown as { awc?: { fetchActiveNwrStations?: () => Promise<NwrFetchResult> } }).awc;
  if (!bridge?.fetchActiveNwrStations) return null;
  try {
    const result = await bridge.fetchActiveNwrStations();
    if (result.ok) updateLiveStations(result.stations);
    return result;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Parse a "City, ST" pattern out of an Icecast description or name.
 * Examples that should match:
 *   - "NOAA WEATHER RADIO KEB98, BUFFALO, NY"       → Buffalo, NY
 *   - "Amarillo, TX - WXK38"                        → Amarillo, TX
 *   - "NOAA Weather Radio Weatherford TX"           → Weatherford, TX
 *   - "WXK86-weatherUSA" + desc "WXK86, Lawton, Oklahoma" → Lawton, OK
 */
function parseCityState(desc: string, name: string): { city: string; state: string } | null {
  const STATES = new Map(Object.entries({
    Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
    Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
    Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
    Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
    Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO",
    Montana: "MT", Nebraska: "NE", Nevada: "NV", Oklahoma: "OK", Oregon: "OR",
    Pennsylvania: "PA", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
    Virginia: "VA", Washington: "WA", Wisconsin: "WI", Wyoming: "WY", Ohio: "OH",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Rhode Island": "RI",
    "South Carolina": "SC", "South Dakota": "SD", "West Virginia": "WV"
  }));
  const haystack = `${desc} ${name}`;
  // Try "City, ST" pattern first
  const csMatch = haystack.match(/([A-Z][a-zA-Z. ]+?),\s*([A-Z]{2})(?![A-Z])/);
  if (csMatch) {
    return { city: csMatch[1].trim(), state: csMatch[2] };
  }
  // Try "City, StateName" (spelled out)
  const csFullMatch = haystack.match(/([A-Z][a-zA-Z. ]+?),\s*([A-Z][a-zA-Z ]+?)\b/);
  if (csFullMatch) {
    const stateAbbr = STATES.get(csFullMatch[2].trim());
    if (stateAbbr) return { city: csFullMatch[1].trim(), state: stateAbbr };
  }
  // Try "City ST" without comma (e.g. "Weatherford TX")
  const bareMatch = haystack.match(/\b([A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)?)\s+([A-Z]{2})\b/);
  if (bareMatch && bareMatch[1].length > 2) {
    return { city: bareMatch[1].trim(), state: bareMatch[2] };
  }
  return null;
}
