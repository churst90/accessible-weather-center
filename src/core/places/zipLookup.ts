import type { Place } from "../types";

/**
 * Resolve a US 5-digit ZIP code into a Place using Zippopotam.us. This is a
 * free, key-less public endpoint that returns place name, state abbreviation,
 * and lat/lon — everything we need to seed an NWS lookup.
 *
 * Throws on invalid ZIP or network failure so callers can surface a readable
 * error to the user.
 */
export async function resolveZipToPlace(zip: string): Promise<Place> {
  const trimmed = zip.trim();
  if (!/^\d{5}$/.test(trimmed)) {
    throw new Error("ZIP must be five digits.");
  }
  const res = await fetch(`https://api.zippopotam.us/us/${trimmed}`);
  if (res.status === 404) {
    throw new Error(`ZIP ${trimmed} not found.`);
  }
  if (!res.ok) {
    throw new Error(`ZIP lookup failed (${res.status}).`);
  }
  const json = (await res.json()) as ZipResponse;
  const first = json.places?.[0];
  if (!first) {
    throw new Error(`ZIP ${trimmed} returned no places.`);
  }
  return {
    id: `zip_${trimmed}`,
    name: first["place name"],
    state: first["state abbreviation"],
    coord: {
      lat: Number(first.latitude),
      lon: Number(first.longitude)
    }
  };
}

interface ZipResponse {
  "post code": string;
  places: Array<{
    "place name": string;
    "state abbreviation": string;
    latitude: string;
    longitude: string;
  }>;
}
