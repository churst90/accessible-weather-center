/**
 * Where NOAA Weather Radio data comes from, per deployment target.
 *
 * weatherUSA's Icecast server (radio.weatherusa.net) sends **no**
 * `Access-Control-Allow-Origin` header on either the stream mounts or the
 * status endpoint. Verified 2026-08-06: a request carrying an `Origin`
 * header comes back with no `Access-Control-*` headers at all. That has two
 * consequences in a browser:
 *
 *   1. `fetch()` of the station directory is blocked outright.
 *   2. The MP3 mount can't feed WebAudio. `NwrPlayer` routes the stream
 *      through a `MediaElementAudioSourceNode` so it lands on the mixer's
 *      radio bus, and WebAudio refuses cross-origin media without CORS.
 *      (`crossOrigin="anonymous"` is required for the node to work at all,
 *      and that is exactly what the missing header rejects.)
 *
 * So the web build talks to a same-origin reverse proxy instead — see
 * `deploy/nginx/weather.codyhurst.com.conf` for the server side and the
 * `server.proxy` block in `vite.config.ts` for the dev equivalent. Packaged
 * Electron has no origin to proxy through (it loads from `file://`) and no
 * CORS enforcement problem for the status call, which the main process
 * makes over IPC, so it keeps talking to the upstream host directly.
 */

const UPSTREAM = "https://radio.weatherusa.net";
/** Path prefix the reverse proxy is mounted at, on our own origin. */
const PROXY_PREFIX = "/nwr";

/**
 * True when the page is loaded from disk, i.e. a packaged Electron build.
 * Dev Electron loads `http://localhost:5173` and therefore goes through the
 * Vite dev proxy along with the browser.
 */
export function isFileOrigin(): boolean {
  return typeof window !== "undefined" && window.location?.protocol === "file:";
}

/** Base URL for NWR requests: the upstream host, or our proxy. */
function base(): string {
  return isFileOrigin() ? UPSTREAM : PROXY_PREFIX;
}

/** Icecast MP3 mount for one transmitter call sign. */
export function nwrStreamUrl(callSign: string): string {
  return `${base()}/NWR/${encodeURIComponent(callSign)}.mp3`;
}

/** Icecast status document listing every currently-streaming mount. */
export function nwrStatusUrl(): string {
  return `${base()}/status-json.xsl`;
}
