/**
 * Travel cities for the Travel Cities scene. 25 major US cities with
 * coordinates and NWS WFO codes. Sourced from the WeatherStar 4000
 * community project (MIT licensed).
 *
 * These are pre-seeded — the user doesn't manage them. They're separate
 * from the user's favorites in PlacesStore.
 */

import type { Place } from "../types";

export interface TravelCity {
  name: string;
  lat: number;
  lon: number;
  wfo: string;
}

const TRAVEL_CITIES: TravelCity[] = [
  { name: "Atlanta",        lat: 33.749,   lon: -84.388,   wfo: "FFC" },
  { name: "Boston",         lat: 42.3584,  lon: -71.0598,  wfo: "BOX" },
  { name: "Chicago",        lat: 41.9796,  lon: -87.9045,  wfo: "LOT" },
  { name: "Cleveland",      lat: 41.4995,  lon: -81.6954,  wfo: "CLE" },
  { name: "Dallas",         lat: 32.8959,  lon: -97.0372,  wfo: "FWD" },
  { name: "Denver",         lat: 39.7391,  lon: -104.9847, wfo: "BOU" },
  { name: "Detroit",        lat: 42.3314,  lon: -83.0457,  wfo: "DTX" },
  { name: "Hartford",       lat: 41.7637,  lon: -72.6851,  wfo: "BOX" },
  { name: "Houston",        lat: 29.7633,  lon: -95.3633,  wfo: "HGX" },
  { name: "Indianapolis",   lat: 39.7684,  lon: -86.158,   wfo: "IND" },
  { name: "Los Angeles",    lat: 34.0522,  lon: -118.2437, wfo: "LOX" },
  { name: "Miami",          lat: 25.7743,  lon: -80.1937,  wfo: "MFL" },
  { name: "Minneapolis",    lat: 44.98,    lon: -93.2638,  wfo: "MPX" },
  { name: "New York",       lat: 40.7142,  lon: -74.0059,  wfo: "OKX" },
  { name: "Norfolk",        lat: 36.8468,  lon: -76.2852,  wfo: "AKQ" },
  { name: "Orlando",        lat: 28.5383,  lon: -81.3792,  wfo: "MLB" },
  { name: "Philadelphia",   lat: 39.9523,  lon: -75.1638,  wfo: "PHI" },
  { name: "Pittsburgh",     lat: 40.4406,  lon: -79.9959,  wfo: "PBZ" },
  { name: "St. Louis",      lat: 38.6273,  lon: -90.1979,  wfo: "LSX" },
  { name: "San Francisco",  lat: 37.7749,  lon: -122.4194, wfo: "MTR" },
  { name: "Seattle",        lat: 47.6062,  lon: -122.3321, wfo: "SEW" },
  { name: "Syracuse",       lat: 43.0481,  lon: -76.1474,  wfo: "BGM" },
  { name: "Tampa",          lat: 27.9475,  lon: -82.4584,  wfo: "TBW" },
  { name: "Washington DC",  lat: 38.8951,  lon: -77.0364,  wfo: "LWX" },
];

export function getTravelCities(): TravelCity[] {
  return [...TRAVEL_CITIES];
}

/** Convert a TravelCity to a Place for use with the weather service. */
export function travelCityToPlace(city: TravelCity): Place {
  return {
    id: `travel-${city.name.toLowerCase().replace(/\s+/g, "-")}`,
    name: city.name,
    state: "",
    coord: { lat: city.lat, lon: city.lon },
  };
}
