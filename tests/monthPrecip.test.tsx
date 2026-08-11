// Import the DOM shim before anything that touches React or `document`.
import { mount, React } from "./dom";
import { test } from "node:test";
import assert from "node:assert/strict";
import { NwsClient, cliLocationFor, parseMonthToDatePrecip } from "../src/core/weather/NwsClient";
import { WeatherService } from "../src/core/weather/WeatherService";
import { Ws4000Footer, footerItems } from "../src/ui/weatherscan/Ws4000Footer";
import { WeatherscanLBar } from "../src/ui/weatherscan/WeatherscanLBar";
import type { Observation, LatLon } from "../src/core/types";
import type { RainViewerClient } from "../src/core/weather/RainViewerClient";

/**
 * Month-to-date precipitation, and the L-bar clock.
 *
 * The precipitation number was the last of the four confirmed footer strings
 * to be rendered, and it was held back on purpose: no observation or forecast
 * product carries a month-to-date total, so printing one would have been
 * inventing a measurement. The NWS Climatological Report does carry it.
 *
 * The parse is the risky part, and specifically its boundaries. A CLI has TWO
 * lines reading "MONTH TO DATE" — one under PRECIPITATION and one under
 * SNOWFALL — and the naive grep returns whichever comes first in whatever
 * order the office writes them. In August the snow total is 0.0 and the bug
 * looks exactly like a dry month.
 */

// Trimmed from a real product: api.weather.gov CLISEW, 2026-08-11.
const CLI_SEW = `
CLIMATE REPORT
NATIONAL WEATHER SERVICE SEATTLE
616 PM PDT MON AUG 10 2026

TEMPERATURE (F)
  TODAY
  MAXIMUM         77    3:35 PM  97 1981  77      0     84
  MINIMUM         57    5:03 AM  47 1962  57      0     58

PRECIPITATION (IN)
  TODAY            0.00          0.68 2019     0.00
  MONTH TO DATE    0.02                        0.39
  SINCE OCT 1     33.00                       30.96
  SINCE JAN 1     16.77                       14.82

SNOWFALL (IN)
  TODAY           MM                           0.0
  MONTH TO DATE    0.0                         0.0
  SINCE OCT 1      6.6                         6.8

DEGREE DAYS
  HEATING
  MONTH TO DATE   44                          38
`;

// ------------------------------------------------------------------- parse

test("the month-to-date total comes from the PRECIPITATION block", () => {
  assert.equal(parseMonthToDatePrecip(CLI_SEW), 0.02);
});

test("the snowfall block's own MONTH TO DATE cannot be mistaken for rain", () => {
  // The failure this prevents: 0.0 in August, which reads as a dry month
  // rather than as the wrong section being scraped.
  const parsed = parseMonthToDatePrecip(CLI_SEW);
  assert.notEqual(parsed, 0.0, "0.0 here is the snow line");
  assert.equal(parsed, 0.02);
});

test("...nor can the degree-days block, which also has one", () => {
  // Reordered so PRECIPITATION comes last: a scan that does not stop at the
  // next section header would run past it into DEGREE DAYS and return 44.
  const reordered = `
DEGREE DAYS
  MONTH TO DATE   44                          38

PRECIPITATION (IN)
  MONTH TO DATE    1.20                        0.39

SNOWFALL (IN)
  MONTH TO DATE    0.0                         0.0
`;
  assert.equal(parseMonthToDatePrecip(reordered), 1.2);
});

test("a precipitation block with no month line falls through to nothing", () => {
  // THIS is what the section boundary actually protects, and the two tests
  // above do not: they both have the precip month line before the snow one,
  // so the scan returns before it could get confused. Some offices issue a
  // short-form CLI whose precipitation block has only TODAY — and there, a
  // scan that does not stop at the next header sails on into SNOWFALL and
  // reports the snow total as rainfall.
  const shortForm = `
PRECIPITATION (IN)
  TODAY            0.00          0.68 2019     0.00

SNOWFALL (IN)
  MONTH TO DATE    3.4                         0.0
`;
  assert.equal(parseMonthToDatePrecip(shortForm), null,
    "no precipitation month line means no answer, not the snowfall figure");
});

test("a trace is zero and a missing reading is null", () => {
  // Different claims. "T" means it rained but under a hundredth of an inch;
  // "MM" means the gauge reported nothing, which is not the same as no rain.
  assert.equal(parseMonthToDatePrecip("PRECIPITATION (IN)\n  MONTH TO DATE    T"), 0);
  assert.equal(parseMonthToDatePrecip("PRECIPITATION (IN)\n  MONTH TO DATE    MM"), null);
  assert.equal(parseMonthToDatePrecip("PRECIPITATION (IN)\n  MONTH TO DATE    M"), null);
});

test("a product with no precipitation block yields null, not a guess", () => {
  assert.equal(parseMonthToDatePrecip("TEMPERATURE (F)\n  MAXIMUM 77"), null);
  assert.equal(parseMonthToDatePrecip(""), null);
});

test("column layouts differ by office and the first number always wins", () => {
  // Seattle prints three columns, Bristol five. Observed is always first.
  assert.equal(
    parseMonthToDatePrecip("PRECIPITATION (IN)\n  MONTH TO DATE    2.03    1.45   0.58     1.34"),
    2.03
  );
});

// ---------------------------------------------------------------- location

test("station identifiers map to CLI location codes", () => {
  assert.equal(cliLocationFor("KSEA"), "SEA");
  assert.equal(cliLocationFor("kbli"), "BLI");
  // Alaska and Hawaii are listed verbatim, not K-stripped.
  assert.equal(cliLocationFor("PANC"), "PANC");
  assert.equal(cliLocationFor("PHNL"), "PHNL");
});

test("junk identifiers are rejected rather than turned into URLs", () => {
  assert.equal(cliLocationFor(null), null);
  assert.equal(cliLocationFor(""), null);
  assert.equal(cliLocationFor("not a station"), null);
  assert.equal(cliLocationFor("../../etc"), null);
});

// ------------------------------------------------------------------- fetch

function clientWith(handler: (url: string) => unknown): NwsClient {
  const c = new NwsClient("test");
  (c as unknown as { get: (u: string) => Promise<unknown> }).get = async (url) => {
    const out = handler(url);
    if (out === undefined) throw new Error(`404 ${url}`);
    return out;
  };
  return c;
}

test("a station with no climate report is a null, not a thrown error", async () => {
  // Most stations have none. This is the common path, not the exception.
  const c = clientWith((url) => (url.includes("/products/types/CLI/") ? undefined : {}));
  assert.equal(await c.getMonthToDatePrecipIn("KXYZ"), null);
});

test("an empty product list is a null too", async () => {
  const c = clientWith(() => ({ "@graph": [] }));
  assert.equal(await c.getMonthToDatePrecipIn("KSEA"), null);
});

test("the newest report is the one read", async () => {
  const seen: string[] = [];
  const c = clientWith((url) => {
    seen.push(url);
    if (url.includes("/locations/SEA")) {
      return { "@graph": [{ id: "newest" }, { id: "older" }] };
    }
    return { productText: CLI_SEW };
  });
  assert.equal(await c.getMonthToDatePrecipIn("KSEA"), 0.02);
  assert.ok(seen.some((u) => u.endsWith("/products/newest")), seen.join("\n"));
  assert.ok(!seen.some((u) => u.endsWith("/products/older")));
});

test("the daily product is cached, not refetched every minute", async () => {
  // CLI is issued once a day and the refresh loop runs every 60s. Without a
  // cache this would be 60 requests an hour for identical text.
  let fetches = 0;
  const nws = {
    getMonthToDatePrecipIn: async () => { fetches++; return 1.2; }
  } as unknown as NwsClient;
  const svc = new WeatherService(nws);
  for (let i = 0; i < 5; i++) await svc.getMonthToDatePrecipIn("KSEA");
  assert.equal(fetches, 1);

  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 4 * 60 * 60_000; // past the 3h TTL
    await svc.getMonthToDatePrecipIn("KSEA");
  } finally {
    Date.now = realNow;
  }
  assert.equal(fetches, 2);
});

test("no station means no request at all", async () => {
  let called = false;
  const nws = { getMonthToDatePrecipIn: async () => { called = true; return 1; } } as unknown as NwsClient;
  assert.equal(await new WeatherService(nws).getMonthToDatePrecipIn(null), null);
  assert.equal(called, false);
});

// ------------------------------------------------------------------ footer

const OBS: Observation = {
  placeId: "p1", observedAt: new Date("2026-05-10T20:59:00Z"),
  temperatureF: 66, feelsLikeF: 66, dewpointF: 52, humidityPct: 60,
  windDirDeg: null, windSpeedMph: 0, windGustMph: null,
  pressureInHg: 29.96, visibilityMi: 10,
  conditionText: "Sunny", conditionIcon: null,
  ceilingFt: null, stationId: "KBLI", pressureTrend: null,
};

test("the precipitation stop matches the captured wording", () => {
  // "May Precipitation: 1.20 in" — month spelled in full, two decimals.
  const items = footerItems(OBS, "Bellingham", 1.2, new Date("2026-05-10T12:00:00Z"));
  assert.ok(items.includes("May Precipitation: 1.20 in"), JSON.stringify(items));
});

test("no climate report means no stop, never a printed zero", () => {
  const items = footerItems(OBS, "Bellingham", null);
  for (const i of items) assert.doesNotMatch(i, /precipitation/i);
});

test("a genuine zero month IS printed — it is a measurement", () => {
  // Distinct from the null case above: the gauge reported, and it read dry.
  const items = footerItems(OBS, "Bellingham", 0, new Date("2026-05-10T12:00:00Z"));
  assert.ok(items.includes("May Precipitation: 0.00 in"), JSON.stringify(items));
});

test("the footer renders the stop in its static list", () => {
  const m = mount(<Ws4000Footer observation={OBS} placeName="Bellingham" monthToDatePrecipIn={1.2} />);
  const listed = [...m.container.querySelectorAll("li")].map((li) => li.textContent);
  assert.ok(listed.some((t) => /Precipitation: 1\.20 in/.test(t ?? "")), listed.join(" | "));
  m.unmount();
});

// ------------------------------------------------------------- L-bar clock

const COORD: LatLon = { lat: 48.7, lon: -122.5 };
const RV = { getManifest: async () => ({ radar: { past: [] } }) } as unknown as RainViewerClient;

test("the L-bar carries its own date and clock, under the wordmark", () => {
  const m = mount(
    <WeatherscanLBar
      place={{ name: "Bellingham", state: "WA", coord: COORD }}
      observation={OBS} rainviewer={RV} storms={[]} alerts={[]}
    />
  );
  const logo = m.container.querySelector(".ws-lbar-logo")!;
  assert.ok(logo.querySelector(".ws-lbar-date"), "the date belongs in the logo block");
  assert.ok(logo.querySelector(".ws-lbar-clock"), "...and the clock beneath it");
  m.unmount();
});

test("the clock shows seconds, as the era notes specify", () => {
  const m = mount(
    <WeatherscanLBar
      place={{ name: "Bellingham", state: "WA", coord: COORD }}
      observation={OBS} rainviewer={RV} storms={[]} alerts={[]}
    />
  );
  const text = m.container.querySelector(".ws-lbar-clock")!.textContent ?? "";
  assert.match(text, /\d{1,2}:\d{2}:\d{2}/, `expected h:mm:ss, got "${text}"`);
  m.unmount();
});

test("neither ticks into a live region", () => {
  // They update every second under every scene. A live region here would be
  // the single most disruptive thing in the application.
  const m = mount(
    <WeatherscanLBar
      place={{ name: "Bellingham", state: "WA", coord: COORD }}
      observation={OBS} rainviewer={RV} storms={[]} alerts={[]}
    />
  );
  assert.equal(m.container.querySelectorAll("[aria-live], [role=status], [role=timer]").length, 0);
  assert.equal(m.container.querySelector(".ws-lbar-logo")!.getAttribute("aria-hidden"), "true");
  m.unmount();
});
