/**
 * NOAA Weather Radio (NWR) transmitter directory.
 *
 * A small curated list of major NWR stations across the US — used to populate
 * the call-sign autocomplete in Settings. The user can type any call sign
 * directly; this is convenience, not authoritative.
 *
 * Stream URL pattern (weatherUSA Icecast): https://radio.weatherusa.net/NWR/{callSign}.mp3
 *
 * Full station directory: https://www.weather.gov/nwr/station_search
 * weatherUSA station list:  https://www.weatherusa.net/radio
 */

export interface NwrStation {
  callSign: string;
  city: string;
  state: string;
  /** Broadcast frequency, MHz. NWR uses 162.400, .425, .450, .475, .500, .525, .550. */
  frequency: string;
}

export const NWR_STATIONS: NwrStation[] = [
  // Northeast
  { callSign: "KWO35", city: "New York",      state: "NY", frequency: "162.550" },
  { callSign: "WXM48", city: "Boston",        state: "MA", frequency: "162.475" },
  { callSign: "KIH26", city: "Philadelphia",  state: "PA", frequency: "162.475" },
  { callSign: "WXJ68", city: "Pittsburgh",    state: "PA", frequency: "162.550" },
  { callSign: "KEC83", city: "Washington DC", state: "DC", frequency: "162.550" },
  { callSign: "KHB36", city: "Baltimore",     state: "MD", frequency: "162.400" },
  { callSign: "KEC49", city: "Buffalo",       state: "NY", frequency: "162.550" },
  { callSign: "WXJ42", city: "Albany",        state: "NY", frequency: "162.550" },
  { callSign: "WXJ47", city: "Hartford",      state: "CT", frequency: "162.475" },

  // Southeast
  { callSign: "WXJ52", city: "Atlanta",       state: "GA", frequency: "162.550" },
  { callSign: "WXJ41", city: "Miami",         state: "FL", frequency: "162.550" },
  { callSign: "KEC50", city: "Tampa",         state: "FL", frequency: "162.550" },
  { callSign: "WXK25", city: "Orlando",       state: "FL", frequency: "162.475" },
  { callSign: "KIH22", city: "Charlotte",     state: "NC", frequency: "162.550" },
  { callSign: "KZZ40", city: "Raleigh",       state: "NC", frequency: "162.550" },
  { callSign: "WXL58", city: "Nashville",     state: "TN", frequency: "162.550" },
  { callSign: "WXK22", city: "Knoxville",     state: "TN", frequency: "162.475" },
  { callSign: "WXJ73", city: "Memphis",       state: "TN", frequency: "162.475" },
  { callSign: "KIH21", city: "Birmingham",    state: "AL", frequency: "162.400" },
  { callSign: "KIH28", city: "New Orleans",   state: "LA", frequency: "162.550" },
  { callSign: "WXJ71", city: "Jacksonville",  state: "FL", frequency: "162.550" },
  { callSign: "WXJ43", city: "Columbia",      state: "SC", frequency: "162.400" },

  // Midwest
  { callSign: "KWO39", city: "Chicago",       state: "IL", frequency: "162.550" },
  { callSign: "KEC60", city: "Detroit",       state: "MI", frequency: "162.550" },
  { callSign: "WXJ67", city: "Cleveland",     state: "OH", frequency: "162.550" },
  { callSign: "WXJ75", city: "Cincinnati",    state: "OH", frequency: "162.550" },
  { callSign: "KIG65", city: "Indianapolis",  state: "IN", frequency: "162.550" },
  { callSign: "KEC55", city: "St Louis",      state: "MO", frequency: "162.550" },
  { callSign: "WXJ66", city: "Kansas City",   state: "MO", frequency: "162.550" },
  { callSign: "WXJ91", city: "Minneapolis",   state: "MN", frequency: "162.550" },
  { callSign: "KIH39", city: "Milwaukee",     state: "WI", frequency: "162.400" },
  { callSign: "WXL45", city: "Des Moines",    state: "IA", frequency: "162.550" },
  { callSign: "WXJ87", city: "Omaha",         state: "NE", frequency: "162.475" },
  { callSign: "KZZ57", city: "Columbus",      state: "OH", frequency: "162.550" },

  // Plains / South Central
  { callSign: "KEC54", city: "Dallas",        state: "TX", frequency: "162.400" },
  { callSign: "KHB40", city: "Houston",       state: "TX", frequency: "162.550" },
  { callSign: "KEC57", city: "San Antonio",   state: "TX", frequency: "162.550" },
  { callSign: "KEC58", city: "Austin",        state: "TX", frequency: "162.400" },
  { callSign: "WXK40", city: "Fort Worth",    state: "TX", frequency: "162.475" },
  { callSign: "KIH27", city: "Oklahoma City", state: "OK", frequency: "162.400" },
  { callSign: "KIH25", city: "Tulsa",         state: "OK", frequency: "162.550" },
  { callSign: "KEC56", city: "Little Rock",   state: "AR", frequency: "162.550" },

  // Mountain
  { callSign: "KEC59", city: "Denver",        state: "CO", frequency: "162.550" },
  { callSign: "KIH64", city: "Phoenix",       state: "AZ", frequency: "162.550" },
  { callSign: "WXK46", city: "Tucson",        state: "AZ", frequency: "162.400" },
  { callSign: "WXL47", city: "Albuquerque",   state: "NM", frequency: "162.400" },
  { callSign: "WXM87", city: "Salt Lake City",state: "UT", frequency: "162.550" },
  { callSign: "WNG574", city:"Boise",         state: "ID", frequency: "162.550" },
  { callSign: "WXJ85", city: "Las Vegas",     state: "NV", frequency: "162.550" },

  // West
  { callSign: "KIH37", city: "Los Angeles",   state: "CA", frequency: "162.550" },
  { callSign: "WXK28", city: "San Diego",     state: "CA", frequency: "162.400" },
  { callSign: "KEC95", city: "San Francisco", state: "CA", frequency: "162.400" },
  { callSign: "WXM86", city: "Sacramento",    state: "CA", frequency: "162.400" },
  { callSign: "KEC91", city: "Fresno",        state: "CA", frequency: "162.550" },
  { callSign: "KHB60", city: "Seattle",       state: "WA", frequency: "162.550" },
  { callSign: "KEC42", city: "Portland",      state: "OR", frequency: "162.550" },
  { callSign: "WXM85", city: "Spokane",       state: "WA", frequency: "162.400" },
  { callSign: "WXM98", city: "Bellingham",    state: "WA", frequency: "162.500" },

  // Alaska / Hawaii
  { callSign: "WXJ58", city: "Anchorage",     state: "AK", frequency: "162.550" },
  { callSign: "WXJ86", city: "Fairbanks",     state: "AK", frequency: "162.550" },
  { callSign: "KBA99", city: "Honolulu",      state: "HI", frequency: "162.550" },
];

/** Look up a station by call sign, case-insensitive. */
export function findStation(callSign: string | null): NwrStation | null {
  if (!callSign) return null;
  const cs = callSign.toUpperCase();
  return NWR_STATIONS.find((s) => s.callSign === cs) ?? null;
}

/** Pick a default call sign for a place name. Best-effort fuzzy match by
 *  city or state name; null if nothing close. Used when the user has not
 *  explicitly chosen a call sign in Settings. */
export function suggestCallSignForPlace(placeName: string): string | null {
  if (!placeName) return null;
  const lower = placeName.toLowerCase();
  // City-name match first (more specific)
  const byCity = NWR_STATIONS.find((s) => lower.includes(s.city.toLowerCase()));
  if (byCity) return byCity.callSign;
  // State-name / abbreviation fallback
  const byState = NWR_STATIONS.find((s) => {
    const stateLower = s.state.toLowerCase();
    return lower.includes(`, ${stateLower}`) || lower.endsWith(` ${stateLower}`);
  });
  return byState?.callSign ?? null;
}
