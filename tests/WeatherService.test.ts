import { test } from "node:test";
import assert from "node:assert/strict";
import { WeatherService } from "../src/core/weather/WeatherService";
import type { NwsClient } from "../src/core/weather/NwsClient";
import type { Place } from "../src/core/types";

const PLACE: Place = {
  id: "test-place",
  name: "Testville, TN",
  coord: { lat: 36.16, lon: -82.83 },
  isHome: true
};

const GRID = { office: "MRX", gridX: 1, gridY: 2, forecastZone: "TNZ001", county: "TNC059", observationStations: ["KGCY"] };

/** Build a WeatherService over a scriptable fake NwsClient. */
function makeService(overrides: Partial<Record<keyof NwsClient, unknown>>) {
  const fake = {
    resolveGridpoint: async () => GRID,
    getForecast: async () => [],
    getHourlyForecast: async () => [],
    getLatestObservation: async () => null,
    getActiveAlerts: async () => [],
    reverseGeocode: async () => ({ city: "Testville", state: "TN", county: "Unicoi" }),
    ...overrides
  };
  return { service: new WeatherService(fake as unknown as NwsClient), fake };
}

test("grid-resolution failure is NOT cached: next call retries and succeeds", async () => {
  let calls = 0;
  const { service } = makeService({
    resolveGridpoint: async () => {
      calls++;
      if (calls === 1) throw new Error("offline at launch");
      return GRID;
    }
  });
  await assert.rejects(() => service.getForecast(PLACE), /offline at launch/);
  // Pre-fix behavior: this second call rejected with the SAME cached error
  // forever. Post-fix it must retry and succeed.
  const forecast = await service.getForecast(PLACE);
  assert.deepEqual(forecast, []);
  assert.equal(calls, 2, "resolveGridpoint must have been retried");
});

test("stale-while-error: an expired cache entry is served when the refresh fails", async () => {
  let calls = 0;
  const { service } = makeService({
    getForecast: async () => {
      calls++;
      if (calls === 1) return [{ name: "Tonight" }];
      throw new Error("NWS 500");
    }
  });

  const realNow = Date.now;
  try {
    const first = await service.getForecast(PLACE);
    assert.equal((first[0] as { name: string }).name, "Tonight");

    // Jump past the 30-minute forecast TTL so the next call must refetch.
    Date.now = () => realNow() + 45 * 60_000;
    const second = await service.getForecast(PLACE);
    assert.equal((second[0] as { name: string }).name, "Tonight", "stale data served instead of throwing");
    assert.equal(calls, 2, "a refresh was attempted");
  } finally {
    Date.now = realNow;
  }
});

test("stale-while-error keeps the ORIGINAL fetch timestamp (age stays honest)", async () => {
  let calls = 0;
  const { service } = makeService({
    getForecast: async () => {
      calls++;
      if (calls === 1) return [{ name: "Tonight" }];
      throw new Error("NWS 500");
    }
  });
  const realNow = Date.now;
  try {
    await service.getForecast(PLACE);
    const firstAt = service.lastFetchedAt("forecast", PLACE.id);
    Date.now = () => realNow() + 45 * 60_000;
    await service.getForecast(PLACE); // fails, serves stale
    const afterAt = service.lastFetchedAt("forecast", PLACE.id);
    assert.equal(afterAt?.getTime(), firstAt?.getTime());
  } finally {
    Date.now = realNow;
  }
});

test("a genuinely empty cache still propagates the error", async () => {
  const { service } = makeService({
    getForecast: async () => { throw new Error("NWS down"); }
  });
  await assert.rejects(() => service.getForecast(PLACE), /NWS down/);
});

test("within TTL the cache is served without refetching", async () => {
  let calls = 0;
  const { service } = makeService({
    getForecast: async () => {
      calls++;
      return [];
    }
  });
  await service.getForecast(PLACE);
  await service.getForecast(PLACE);
  assert.equal(calls, 1);
});
