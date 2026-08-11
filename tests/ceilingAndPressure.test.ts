import { test } from "node:test";
import assert from "node:assert/strict";
import { WeatherService } from "../src/core/weather/WeatherService";
import type { NwsClient } from "../src/core/weather/NwsClient";
import type { Observation, Place } from "../src/core/types";

/**
 * Ceiling and the pressure trend arrow.
 *
 * Both come off one reference capture — the v2 Current Conditions screen
 * shows "Ceiling:Unlimited" and "Pressure: 29.96↓" — and both are the kind of
 * field that is easy to get subtly, silently wrong.
 *
 * Ceiling is not "the lowest cloud". A sky with scattered cloud at 3,000 feet
 * has no ceiling at all and reads Unlimited, which looks like a bug to
 * anybody who has not met the aviation definition, and which a well-meaning
 * change to "lowest layer" would quietly break.
 *
 * The pressure trend is derived, because NWS publishes no tendency field.
 * Deriving means the two failure modes are reporting a trend that is really
 * sensor noise, and reporting one from readings too far apart to mean
 * anything. Both are guarded here.
 */

const PLACE: Place = {
  id: "p1", name: "Testville", state: "TN",
  coord: { lat: 36, lon: -82 }, isHome: true
};

function obs(over: Partial<Observation> = {}): Observation {
  return {
    placeId: "p1",
    observedAt: new Date("2026-05-10T12:00:00Z"),
    temperatureF: 66, feelsLikeF: 66, dewpointF: 52, humidityPct: 60,
    windDirDeg: 315, windSpeedMph: 5, windGustMph: null,
    pressureInHg: 29.96, visibilityMi: 10,
    conditionText: "Sunny", conditionIcon: null,
    ceilingFt: null, pressureTrend: null,
    ...over
  };
}

/** A WeatherService whose only real behaviour is the observation it returns. */
function serviceReturning(queue: Observation[]): WeatherService {
  let i = 0;
  const nws = {
    resolveGridpoint: async () => ({ office: "X", gridX: 1, gridY: 1, observationStationsUrl: "u", forecastUrl: "f", forecastHourlyUrl: "h" }),
    getLatestObservation: async () => queue[Math.min(i++, queue.length - 1)] ?? null
  } as unknown as NwsClient;
  return new WeatherService(nws);
}

/**
 * Fetch past the observation cache.
 *
 * OBS_TTL_MS is 45 seconds, so back-to-back calls would be served the first
 * observation and the queue would never advance — which is exactly what the
 * first draft of this file did, and it made four tests fail for a reason that
 * had nothing to do with the code under test. Advancing the clock the way
 * WeatherService.test.ts does is the established seam here.
 */
async function fetchFresh(svc: WeatherService, place: Place): Promise<Observation | null> {
  const realNow = Date.now;
  fetchFresh.tick += 60_000;
  const offset = fetchFresh.tick;
  Date.now = () => realNow() + offset;
  try {
    return await svc.getObservation(place);
  } finally {
    Date.now = realNow;
  }
}
fetchFresh.tick = 0;

// ---------------------------------------------------------------- ceiling

test("a broken or overcast layer is a ceiling; scattered and few are not", async () => {
  // Exercised through the client's own parser via a hand-built response is
  // awkward, so the rule is asserted on the shape the client produces: only
  // BKN/OVC/VV set ceilingFt, and the value is the lowest such layer.
  const { __test_ceilingFrom: ceilingFrom } = await import("../src/core/weather/NwsClient");
  assert.equal(ceilingFrom([{ amount: "SCT", base: { value: 900 } }]), null,
    "scattered cloud is not a ceiling, however low");
  assert.equal(ceilingFrom([{ amount: "FEW", base: { value: 300 } }]), null);
  assert.equal(ceilingFrom([{ amount: "CLR", base: null }]), null);
  assert.equal(ceilingFrom([]), null, "a clear sky reports no layers at all");
  assert.equal(ceilingFrom(null), null, "stations that do not report layers");
  assert.equal(ceilingFrom(undefined), null);

  // 1000 m -> 3280.84 ft -> reported to the nearest 100.
  assert.equal(ceilingFrom([{ amount: "BKN", base: { value: 1000 } }]), 3300);
  assert.equal(ceilingFrom([{ amount: "OVC", base: { value: 1000 } }]), 3300);
  // Vertical visibility: an obscured sky does have a ceiling.
  assert.equal(ceilingFrom([{ amount: "VV", base: { value: 60 } }]), 200);
});

test("the ceiling is the LOWEST qualifying layer, not the first listed", async () => {
  const { __test_ceilingFrom: ceilingFrom } = await import("../src/core/weather/NwsClient");
  assert.equal(
    ceilingFrom([
      { amount: "SCT", base: { value: 300 } },   // ignored, scattered
      { amount: "OVC", base: { value: 2000 } },
      { amount: "BKN", base: { value: 900 } },   // this one — 2953 ft -> 3000
    ]),
    3000
  );
});

test("a layer with no base cannot set a ceiling", async () => {
  const { __test_ceilingFrom: ceilingFrom } = await import("../src/core/weather/NwsClient");
  assert.equal(ceilingFrom([{ amount: "OVC", base: null }]), null);
  assert.equal(ceilingFrom([{ amount: "OVC", base: { value: null } }]), null);
});

// --------------------------------------------------------------- pressure

test("no trend from a single observation", async () => {
  const svc = serviceReturning([obs()]);
  const o = await fetchFresh(svc, PLACE);
  assert.equal(o?.pressureTrend, null, "one reading cannot have a direction");
});

test("a rise beyond the noise floor reads as rising", async () => {
  const svc = serviceReturning([
    obs({ observedAt: new Date("2026-05-10T12:00:00Z"), pressureInHg: 29.90 }),
    obs({ observedAt: new Date("2026-05-10T13:00:00Z"), pressureInHg: 30.05 }),
  ]);
  await fetchFresh(svc, PLACE);
  const second = await fetchFresh(svc, { ...PLACE, id: "p1" });
  assert.equal(second?.pressureTrend, "rising");
});

test("a fall beyond the noise floor reads as falling", async () => {
  const svc = serviceReturning([
    obs({ observedAt: new Date("2026-05-10T12:00:00Z"), pressureInHg: 30.10 }),
    obs({ observedAt: new Date("2026-05-10T13:00:00Z"), pressureInHg: 29.96 }),
  ]);
  await fetchFresh(svc, PLACE);
  assert.equal((await fetchFresh(svc, PLACE))?.pressureTrend, "falling");
});

test("drift under 0.02 inHg is steady, not a trend", async () => {
  // The failure this prevents is an arrow that flickers up and down all day
  // on station noise, which reads as weather doing something when it is not.
  const svc = serviceReturning([
    obs({ observedAt: new Date("2026-05-10T12:00:00Z"), pressureInHg: 29.960 }),
    obs({ observedAt: new Date("2026-05-10T13:00:00Z"), pressureInHg: 29.971 }),
  ]);
  await fetchFresh(svc, PLACE);
  assert.equal((await fetchFresh(svc, PLACE))?.pressureTrend, "steady");
});

test("two readings minutes apart give no trend at all", async () => {
  // The 60-second poll re-reads the same hourly observation. Comparing those
  // would report a trend off nothing.
  const svc = serviceReturning([
    obs({ observedAt: new Date("2026-05-10T12:00:00Z"), pressureInHg: 29.90 }),
    obs({ observedAt: new Date("2026-05-10T12:05:00Z"), pressureInHg: 30.20 }),
  ]);
  await fetchFresh(svc, PLACE);
  assert.equal((await fetchFresh(svc, PLACE))?.pressureTrend, null,
    "five minutes is not a barometric trend even with a big delta");
});

test("a reading from yesterday is too old to compare against", async () => {
  const svc = serviceReturning([
    obs({ observedAt: new Date("2026-05-09T12:00:00Z"), pressureInHg: 29.50 }),
    obs({ observedAt: new Date("2026-05-10T13:00:00Z"), pressureInHg: 30.20 }),
  ]);
  await fetchFresh(svc, PLACE);
  assert.equal((await fetchFresh(svc, PLACE))?.pressureTrend, null);
});

test("re-reading the same observation does not flatten the trend", async () => {
  // The poll runs every 60s against an hourly feed, so the same timestamp
  // arrives many times. If each were logged, the newest "earlier" reading
  // would eventually be the current one and everything would read steady.
  const first = obs({ observedAt: new Date("2026-05-10T12:00:00Z"), pressureInHg: 29.80 });
  const second = obs({ observedAt: new Date("2026-05-10T13:00:00Z"), pressureInHg: 30.10 });
  const svc = serviceReturning([first, first, first, second, second, second]);
  for (let i = 0; i < 3; i++) await fetchFresh(svc, PLACE);
  await fetchFresh(svc, PLACE);
  const again = await fetchFresh(svc, PLACE);
  assert.equal(again?.pressureTrend, "rising",
    "duplicate timestamps must not collapse the comparison window");
});

test("a null pressure yields no trend and does not poison the log", async () => {
  const svc = serviceReturning([
    obs({ observedAt: new Date("2026-05-10T12:00:00Z"), pressureInHg: 29.80 }),
    obs({ observedAt: new Date("2026-05-10T13:00:00Z"), pressureInHg: null }),
    obs({ observedAt: new Date("2026-05-10T14:00:00Z"), pressureInHg: 30.10 }),
  ]);
  await fetchFresh(svc, PLACE);
  assert.equal((await fetchFresh(svc, PLACE))?.pressureTrend, null);
  assert.equal((await fetchFresh(svc, PLACE))?.pressureTrend, "rising",
    "the gap should not break the comparison either side of it");
});
