import { useEffect, useState } from "react";
import { RadarMapCanvas } from "../scenes/RadarMapCanvas";
import type { Observation, LatLon, WeatherAlert } from "../../core/types";
import type { RainViewerClient } from "../../core/weather/RainViewerClient";
import type { TrackedStorm } from "../../core/radar/StormTracker";

/**
 * The Weatherscan V2 L-bar.
 *
 * From September 2005 the main panel stopped filling the screen. TWC shrank
 * the IntelliStar graphics package into a window at top right and wrapped it
 * in an L: a permanent left column carrying the logo, the observations for
 * the main site and a long-range radar loop, with a crawling city ticker
 * along the bottom. It is the layout the channel ran until the December 15,
 * 2022 shutdown, and it is what people picture when they picture Weatherscan.
 *
 * GEOMETRY, and how much of it is actually sourced. Two numbers come out of
 * TWC's own render scripts in `twc_wxscan_dynamic-2.13`, and they are
 * complementary:
 *
 *     products/ext/ticker/CityTicker.rs    tickerWidth  = 496  (fallback when
 *                                          tickerHeight =  19   the headend
 *                                                               config is absent)
 *     products/pm/Radar/LocalDoppler.prod  renderUtil.gradientBox(224, 19)
 *                                          — the radar legend, drawn inside
 *                                            the 'radar' viewport
 *
 * 224 + 496 = 720, the NTSC raster width exactly. So the left column is 224px
 * and everything to its right is 496px, which is why the ticker is 496 wide:
 * it spans the main panel and stops at the column. That split is measured,
 * not guessed, and it is the one proportion this component treats as fixed.
 *
 * What is NOT sourced: the height of the bottom strip, and the vertical
 * division of the left column. `products/misc/setupLayers.rs` reads all of it
 * from `dsm.configGet('viewports')` — headend configuration that never
 * shipped inside the package — so the only heights available are the 19px
 * ticker text row and the legend row. The strip height below is a design
 * choice sized to hold that 19px row with padding, and the column's internal
 * proportions are ours. Stated plainly because this measurement has been got
 * wrong before by reading a coordinate and assuming it was global when it was
 * local to a layer.
 *
 * ACCESSIBILITY. The L-bar is persistent, and persistent decoration is how a
 * screen reader gets ruined. Three rules hold it in place:
 *
 *   1. No `aria-live`, anywhere in this subtree. The observations update every
 *      60 seconds underneath the user; if any of it were live, every scene
 *      narration would be interrupted by a temperature. The scene stage owns
 *      the speech channels and the L-bar never speaks.
 *   2. Not in the tab order. Tab cycles scenes. The column is reachable by
 *      landmark navigation (it is a labelled `complementary`) and by browse
 *      mode, which is how a persistent sidebar should be reached.
 *   3. The radar canvas is `aria-hidden` and carries a text summary beside it.
 *      The accessible radar lives in the Local Doppler scene, which can be
 *      walked storm by storm; duplicating it here would mean two different
 *      answers to the same question.
 *   4. The loop honours `prefers-reduced-motion`. It is drawn onto a canvas
 *      in JavaScript, so no media query reaches it on its own, and unlike the
 *      radar scene it would otherwise animate for the whole session on every
 *      screen. Reduced motion pins it to the newest frame.
 *   5. The date and clock are `aria-hidden`. They tick once a second under
 *      every scene; the only reason they are here rather than only in the
 *      frame header is that this is where the hardware put them.
 */

/** Left column width in the 720-wide NTSC raster (CityTicker.rs / LocalDoppler.prod). */
export const LBAR_COLUMN_PX = 224;
/** Main panel and ticker width — the rest of the raster. */
export const LBAR_MAIN_PX = 496;
/** The raster these were measured on. */
export const LBAR_RASTER_PX = 720;

interface Props {
  place: { name: string; state?: string; coord: LatLon } | null;
  observation: Observation | null;
  rainviewer: RainViewerClient;
  storms: TrackedStorm[];
  alerts: WeatherAlert[];
}

function n(value: number | null | undefined, unit = "", digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${value.toFixed(digits)}${unit}`;
}

/** 16-point compass, matching the wind wording the narrators use. */
const COMPASS = [
  "north", "north northeast", "northeast", "east northeast",
  "east", "east southeast", "southeast", "south southeast",
  "south", "south southwest", "southwest", "west southwest",
  "west", "west northwest", "northwest", "north northwest"
];

function windText(o: Observation): string {
  if (o.windSpeedMph === null || o.windSpeedMph === 0) return "Calm";
  const dir = o.windDirDeg === null ? "" : `${COMPASS[Math.round(o.windDirDeg / 22.5) % 16]} `;
  const gust = o.windGustMph ? `, gusting ${Math.round(o.windGustMph)}` : "";
  return `${dir}${Math.round(o.windSpeedMph)} mph${gust}`;
}

/**
 * `prefers-reduced-motion`, as a value JavaScript can act on.
 *
 * The radar loop is drawn frame by frame onto a canvas, so the CSS media
 * query that freezes the ticker crawl cannot reach it. On the Local Doppler
 * scene an unstoppable loop is at least bounded by how long you stay on that
 * scene; in the L-bar it would sweep for the entire session, in the corner of
 * the eye, on every screen. That is exactly what the preference is for.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    // Safari below 14 has no addEventListener on MediaQueryList.
    if (mq.addEventListener) {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);
  return reduced;
}

export function WeatherscanLBar({ place, observation, rainviewer, storms, alerts }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  // With seconds, per the era notes. One interval for both readouts; they are
  // aria-hidden, so a per-second re-render costs the screen reader nothing.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const dateText = now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const clockText = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });

  const o = observation;
  const where = place ? [place.name, place.state].filter(Boolean).join(", ") : "";

  // The radar summary that stands in for the canvas. Deliberately a count and
  // a direction rather than a full walk — the Local Doppler scene is where
  // storms get enumerated, and saying it twice invites the two readouts to
  // disagree the moment one of them is a scan behind.
  const radarSummary =
    storms.length === 0
      ? "No precipitation within 150 miles."
      : `${storms.length} area${storms.length === 1 ? "" : "s"} of precipitation within 150 miles.` +
        (alerts.length ? ` ${alerts.length} active alert${alerts.length === 1 ? "" : "s"}.` : "");

  return (
    <aside className="ws-lbar-col" role="complementary" aria-label="L bar: conditions and radar at a glance">
      {/* docs/weatherscan-eras.md, Era 3: "TWC logo + weatherscan wordmark
          stacked, with date and clock (with seconds) underneath". The frame
          header's clock is suppressed on this machine so the time is not
          shown twice. */}
      <div className="ws-lbar-logo" aria-hidden="true">
        <span className="ws-lbar-logo-word">WEATHERSCAN</span>
        <span className="ws-lbar-date">{dateText}</span>
        <span className="ws-lbar-clock">{clockText}</span>
      </div>

      <section className="ws-lbar-obs" aria-label={`Current conditions${where ? ` at ${where}` : ""}`}>
        {where && <h3 className="ws-lbar-place">{where}</h3>}
        {o ? (
          <>
            <p className="ws-lbar-temp">
              <span className="ws-lbar-temp-num">{n(o.temperatureF)}</span>
              <span className="ws-lbar-temp-deg" aria-hidden="true">°</span>
              <span className="sr-only"> degrees</span>
            </p>
            {o.conditionText && <p className="ws-lbar-cond">{o.conditionText}</p>}
            <dl className="ws-lbar-facts">
              <dt>Feels like</dt><dd>{n(o.feelsLikeF, "°")}</dd>
              <dt>Humidity</dt><dd>{n(o.humidityPct, "%")}</dd>
              <dt>Wind</dt><dd>{windText(o)}</dd>
              <dt>Pressure</dt><dd>{n(o.pressureInHg, " inches", 2)}</dd>
              <dt>Visibility</dt><dd>{n(o.visibilityMi, " miles")}</dd>
            </dl>
          </>
        ) : (
          <p className="ws-lbar-cond">Observations loading.</p>
        )}
      </section>

      <section className="ws-lbar-radar" aria-label="Long range radar">
        {place && (
          <RadarMapCanvas
            center={place.coord}
            storms={storms}
            rainviewer={rainviewer}
            alerts={alerts}
            // Wider than the Local Doppler scene's default 7. The L-bar loop
            // was the long-range one; the close-in view is the radar product.
            zoom={5}
            animate={!reducedMotion}
            className="ws-lbar-radar-canvas"
          />
        )}
        <p className="ws-lbar-radar-note">
          {radarSummary}
          {reducedMotion && " Loop paused; showing the latest frame."}
        </p>
      </section>
    </aside>
  );
}
