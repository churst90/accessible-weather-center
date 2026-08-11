// Import the DOM shim before anything that touches React or `document`.
import { mount, React } from "./dom";
import { test } from "node:test";
import assert from "node:assert/strict";
import { CityTicker, tickerText } from "../src/ui/weatherscan/CityTicker";
import { WeatherscanFrame } from "../src/ui/weatherscan/WeatherscanFrame";
import { cityName } from "../src/core/weather/NwsClient";
import { NwsClient } from "../src/core/weather/NwsClient";
import { WeatherService } from "../src/core/weather/WeatherService";
import type { NearbyObservation, Place } from "../src/core/types";

/**
 * The Weatherscan city ticker.
 *
 * Two things are easy to get wrong here and both are guarded.
 *
 * The crawl is motion that never stops, sitting under every scene, in an
 * application whose primary interface is a screen reader. If it were exposed
 * — a live region, a tab stop, or simply not hidden — it would be the single
 * most disruptive element in the app. The moving copy is `aria-hidden` and
 * the cities are published once, statically, beside it.
 *
 * And the fetch costs six HTTP requests per refresh, against an API with
 * published rate limits, called from a loop that runs every sixty seconds.
 * The ten-minute cache is not an optimisation; without it the app would make
 * 360 requests an hour for data that changes hourly.
 */

const CITY = (over: Partial<NearbyObservation> = {}): NearbyObservation => ({
  name: "Bellingham",
  temperatureF: 47,
  conditionText: "Partly Cloudy",
  windSpeedMph: 8,
  windDirDeg: 315,
  ...over
});

const PLACE: Place = {
  id: "p1", name: "Testville", state: "WA",
  coord: { lat: 48.7, lon: -122.5 }, isHome: true
};

// ------------------------------------------------------------------ naming

test("station names are reduced to something a ticker can show", () => {
  assert.equal(cityName("Bellingham International Airport"), "Bellingham");
  assert.equal(cityName("Olympia, Olympia Regional Airport"), "Olympia");
  assert.equal(cityName("Seattle, Seattle-Tacoma International Airport"), "Seattle");
  assert.equal(cityName("Wenatchee Pangborn Memorial Airport"), "Wenatchee Pangborn");
});

test("a name that is nothing but facility words keeps its original", () => {
  // Stripping must never produce an empty tab. Better a long name than a
  // blank stop in the crawl.
  const out = cityName("Regional Airport");
  assert.ok(out && out.length > 0, `got ${JSON.stringify(out)}`);
});

test("missing names stay missing rather than becoming empty strings", () => {
  assert.equal(cityName(null), null);
  assert.equal(cityName(undefined), null);
  assert.equal(cityName(""), null);
});

// ------------------------------------------------------------------ wording

test("a stop reads city, temperature, sky", () => {
  assert.equal(tickerText(CITY()), "Bellingham 47° Partly Cloudy");
});

test("a stop with no sky or no temperature omits it rather than padding", () => {
  assert.equal(tickerText(CITY({ conditionText: null })), "Bellingham 47°");
  assert.equal(tickerText(CITY({ temperatureF: null })), "Bellingham Partly Cloudy");
  // No double spaces from a dropped field.
  for (const c of [CITY({ conditionText: null }), CITY({ temperatureF: null })]) {
    assert.doesNotMatch(tickerText(c), /\s{2}/);
  }
});

// ------------------------------------------------------------ accessibility

test("the crawl is hidden and the cities are published statically", () => {
  const cities = [CITY(), CITY({ name: "Everett", temperatureF: 51 })];
  const m = mount(<CityTicker cities={cities} />);
  assert.equal(m.container.querySelector(".ws-city-ticker-track")!.getAttribute("aria-hidden"), "true");
  const listed = [...m.container.querySelectorAll("li")].map((li) => li.textContent);
  assert.deepEqual(listed, cities.map(tickerText));
  m.unmount();
});

test("the ticker never speaks and never takes a tab stop", () => {
  const m = mount(<CityTicker cities={[CITY()]} />);
  assert.equal(m.container.querySelectorAll("[aria-live], [role=status], [role=alert], [role=log]").length, 0);
  assert.equal(m.container.querySelectorAll("[tabindex], a, button, input").length, 0);
  m.unmount();
});

test("an empty list renders nothing at all", () => {
  // An empty crawling bar reads as "no conditions anywhere" rather than
  // "still loading", which is worse than no strip.
  const m = mount(<CityTicker cities={[]} />);
  assert.equal(m.container.querySelector(".ws-city-ticker"), null);
  m.unmount();
});

// -------------------------------------------------------------------- crawl

test("the crawl speed stays constant as the list grows", () => {
  // 2.8 px/frame at 30fps in CityTicker.rs. A fixed duration would make the
  // crawl faster the more cities there are, which is the obvious wrong
  // implementation.
  const dur = (n: number) => {
    const m = mount(
      <CityTicker cities={Array.from({ length: n }, (_, i) => CITY({ name: `City${i}` }))} />
    );
    const run = m.container.querySelector(".ws-city-ticker-run") as HTMLElement;
    const d = parseFloat(run.style.animationDuration);
    m.unmount();
    return d;
  };
  const short = dur(2);
  const long = dur(8);
  assert.ok(long > short, `8 cities (${long}s) should take longer than 2 (${short}s)`);
  // Roughly proportional — four times the content, not four times the speed.
  assert.ok(long > short * 2, `${short}s -> ${long}s is not proportional enough`);
});

test("the track is duplicated so the loop has no visible seam", () => {
  const cities = [CITY(), CITY({ name: "Everett" })];
  const m = mount(<CityTicker cities={cities} />);
  const stops = m.container.querySelectorAll(".ws-city-ticker-stop");
  assert.equal(stops.length, cities.length * 2,
    "the -50% keyframe only lands on an identical frame if the list is doubled");
  m.unmount();
});

// -------------------------------------------------------------- frame slot

test("a severe crawl takes the bottom strip back from the ticker", () => {
  const m = mount(
    <WeatherscanFrame
      sceneTitle="Severe Weather"
      alertCount={1}
      severeInterrupt
      tickerText="TORNADO WARNING"
      cityTicker={<div id="cities" />}
    >
      <p>scene</p>
    </WeatherscanFrame>
  );
  assert.equal(m.container.querySelector("#cities"), null, "the ticker must yield to an emergency");
  assert.ok(m.container.querySelector(".ws-ticker"));
  m.unmount();
});

test("the ticker outranks the LDL and the hotkey bar", () => {
  const m = mount(
    <WeatherscanFrame sceneTitle="Current Conditions" alertCount={0} cityTicker={<div id="cities" />}>
      <p>scene</p>
    </WeatherscanFrame>
  );
  assert.ok(m.container.querySelector("#cities"), "the V2 default bottom content is the ticker");
  assert.equal(m.container.querySelector(".ws-status-bar"), null);
  m.unmount();
});

// -------------------------------------------------------------------- fetch

test("nearby observations are cached, because each refresh costs six requests", async () => {
  let stationListCalls = 0;
  let obsCalls = 0;
  const nws = {
    resolveGridpoint: async () => ({
      office: "SEW", gridX: 1, gridY: 1,
      observationStationsUrl: "stations", forecastUrl: "f", forecastHourlyUrl: "h"
    }),
    getNearbyObservations: async () => {
      stationListCalls++;
      obsCalls += 6;
      return [CITY()];
    }
  } as unknown as NwsClient;
  const svc = new WeatherService(nws);

  await svc.getNearbyObservations(PLACE);
  await svc.getNearbyObservations(PLACE);
  await svc.getNearbyObservations(PLACE);
  assert.equal(stationListCalls, 1, "three calls inside the TTL must be one fetch");
  assert.equal(obsCalls, 6);

  // Past the ten-minute TTL it refetches.
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 11 * 60_000;
    await svc.getNearbyObservations(PLACE);
  } finally {
    Date.now = realNow;
  }
  assert.equal(stationListCalls, 2, "past the TTL it should refetch exactly once");
});

test("stations without a name or a temperature never reach the ticker", async () => {
  // Filtered at the client, so nothing downstream has to defend against a
  // stop that renders as a bare degree sign.
  const client = new NwsClient("test");
  const calls: string[] = [];
  (client as unknown as { get: (u: string) => Promise<unknown> }).get = async (url: string) => {
    calls.push(url);
    if (url === "stations") {
      return {
        features: [
          { id: "s1", properties: { name: "Bellingham International Airport" } },
          { id: "s2", properties: { name: "Nowhere Field" } },
          { id: "s3", properties: { name: null, stationIdentifier: null } },
        ]
      };
    }
    // s2 reports no temperature; s3 has no name at all.
    const temp = url.startsWith("s1") ? { value: 8 } : null;
    return { properties: { timestamp: "2026-05-10T12:00:00Z", temperature: temp, textDescription: "Clear", windSpeed: null, windDirection: null } };
  };

  const out = await client.getNearbyObservations(
    { office: "X", gridX: 1, gridY: 1, observationStationsUrl: "stations", forecastUrl: "f", forecastHourlyUrl: "h" },
    3
  );
  assert.equal(out.length, 1, `expected only the usable station, got ${JSON.stringify(out)}`);
  assert.equal(out[0].name, "Bellingham");
});

test("one failing station does not take the whole ticker down", async () => {
  const client = new NwsClient("test");
  (client as unknown as { get: (u: string) => Promise<unknown> }).get = async (url: string) => {
    if (url === "stations") {
      return {
        features: [
          { id: "ok", properties: { name: "Everett" } },
          { id: "bad", properties: { name: "Broken" } },
        ]
      };
    }
    if (url.startsWith("bad")) throw new Error("station is down");
    return { properties: { timestamp: "2026-05-10T12:00:00Z", temperature: { value: 10 }, textDescription: "Fair", windSpeed: null, windDirection: null } };
  };

  const out = await client.getNearbyObservations(
    { office: "X", gridX: 1, gridY: 1, observationStationsUrl: "stations", forecastUrl: "f", forecastHourlyUrl: "h" },
    2
  );
  assert.deepEqual(out.map((o) => o.name), ["Everett"]);
});

test("asking for no cities makes no requests at all", async () => {
  const client = new NwsClient("test");
  let called = false;
  (client as unknown as { get: () => Promise<unknown> }).get = async () => { called = true; return {}; };
  const out = await client.getNearbyObservations(
    { office: "X", gridX: 1, gridY: 1, observationStationsUrl: "stations", forecastUrl: "f", forecastHourlyUrl: "h" },
    0
  );
  assert.deepEqual(out, []);
  assert.equal(called, false, "limit 0 must not even fetch the station list");
});
