import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestCallSignForPlace, findStation, NWR_STATIONS } from "../src/audio/nwrStations";

test("city+state beats a same-named city in another state", () => {
  // The bundled list contains more than one city named the same in different
  // states only occasionally, but the regression this guards is concrete:
  // a place naming a state we have stations for must never be handed a
  // station from a different state purely on a city-substring hit.
  const columbus = NWR_STATIONS.filter((s) => s.city.toLowerCase().includes("columbus"));
  if (columbus.length > 0) {
    for (const station of columbus) {
      if (!station.state) continue;
      const suggested = suggestCallSignForPlace(`Columbus, ${station.state}`);
      const resolved = findStation(suggested);
      assert.equal(resolved?.state, station.state, `Columbus, ${station.state} suggested ${suggested} in ${resolved?.state}`);
    }
  }
});

test("state-only fallback picks a station in that state", () => {
  const anyStation = NWR_STATIONS.find((s) => s.state !== "");
  assert.ok(anyStation, "bundled list has stations with states");
  const suggested = suggestCallSignForPlace(`Nowhereville, ${anyStation!.state}`);
  const resolved = findStation(suggested);
  assert.equal(resolved?.state, anyStation!.state);
});

test("a place with a bundled city name matches that city", () => {
  const station = NWR_STATIONS[0];
  const suggested = suggestCallSignForPlace(`${station.city}, ${station.state}`);
  assert.equal(suggested, station.callSign);
});

test("no match returns null rather than a random station", () => {
  assert.equal(suggestCallSignForPlace("Reykjavik, Iceland"), null);
  assert.equal(suggestCallSignForPlace(""), null);
});

test("findStation is case-insensitive and null-safe", () => {
  const station = NWR_STATIONS[0];
  assert.equal(findStation(station.callSign.toLowerCase())?.callSign, station.callSign);
  assert.equal(findStation(null), null);
  assert.equal(findStation("ZZZ99"), null);
});
