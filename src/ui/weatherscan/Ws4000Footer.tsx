import { useEffect, useState } from "react";
import type { Observation } from "../../core/types";

/**
 * The WeatherStar 4000 v2 always-on footer bar.
 *
 * The defining chrome element of the 2005 redesign: a full-width band across
 * the bottom of every screen, carrying a rotating readout of the local
 * observation while whatever product is on air plays out above it.
 *
 * WHAT IS MEASURED. Four captures in `docs/reference/ws4000/` show the bar on
 * four different products, and they agree to within a fifth of a percent:
 *
 *     band height      14.9%, 14.9%, 15.1%, 15.2%  of frame height
 *     band colour      rgb(44, 62, 144) in all four, exactly
 *     text left inset  11.0%, 11.0%, 11.0%  (the fourth read caught a border
 *                      pixel at x=0 and is discarded)
 *     cap height       4.8%, 4.9%, 5.0%, 5.1%  of frame height
 *
 * Those four numbers are the layout. Everything below about *content* is on
 * softer ground, so it is separated out.
 *
 * WHAT IS INFERRED. The four captures were taken at 8:56, 8:57, 8:59 and 9:15
 * and show four different strings:
 *
 *     Latest Observations   "Humidity:  60%   Dewpoint: 52°F"
 *     Travel Cities         "May Precipitation: 1.20 in"
 *     Current Conditions    "Conditions at Bellingham"
 *     Extended Forecast     "Clear"
 *
 * None of those binds to the product above it — there is no reason Travel
 * Cities would own month-to-date precipitation. They are consistent with one
 * rotation over the current observation, sampled at four moments: a location
 * label, then the observation read out a field or two at a time. That reading
 * is what this implements.
 *
 * The rotation list is therefore part-observed and part-extrapolated, and the
 * code says which is which. Wind and pressure are extrapolated: they are on
 * the v2 Current Conditions screen in the same capture, so the data existed,
 * but no capture catches the bar showing them.
 *
 * Month-to-date precipitation is deliberately ABSENT even though it is one of
 * the four confirmed strings, because nothing in this application knows that
 * number — not the observation, not the almanac. Rendering "May
 * Precipitation: 1.20 in" would mean printing a decimal nobody measured onto
 * a weather display. Recorded as a gap on the profile instead.
 *
 * ACCESSIBILITY. Rotating text is the worst thing to put in a live region, so
 * it is not in one. The visible band is `aria-hidden` and the same facts are
 * published once, statically, in a screen-reader-only list — which means
 * assistive tech gets the whole rotation at once instead of having to wait
 * out a carousel to hear the third item. The real hardware could not do that.
 */

/** Band height as a fraction of frame height (measured: .149-.152). */
export const FOOTER_HEIGHT_PCT = 15;
/** Text inset from the left edge (measured: 11.0% on three captures). */
export const FOOTER_TEXT_INSET_PCT = 11;
/** The band colour, identical in all four captures. */
export const FOOTER_BG = "rgb(44, 62, 144)";

/** How long each item holds. Not measured — the captures are a minute apart. */
const DWELL_MS = 5_000;

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                 "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

/**
 * Build the rotation for one observation.
 *
 * Items whose data is missing drop out rather than printing "--": the bar is
 * a rotation, so a gap simply means one fewer stop, where a dash would be a
 * fact the display is asserting.
 */
export function footerItems(obs: Observation | null, placeName: string | null): string[] {
  const out: string[] = [];
  if (placeName) out.push(`Conditions at ${placeName}`);      // confirmed
  if (!obs) return out;

  if (obs.conditionText) out.push(obs.conditionText);          // confirmed

  // confirmed — both fields on one line, in this order
  if (obs.humidityPct !== null && obs.dewpointF !== null) {
    out.push(`Humidity: ${Math.round(obs.humidityPct)}%   Dewpoint: ${Math.round(obs.dewpointF)}°F`);
  }

  // extrapolated from the v2 Current Conditions field set, not from a capture
  if (obs.windSpeedMph !== null) {
    if (obs.windSpeedMph === 0) {
      out.push("Wind: Calm");
    } else {
      const dir = obs.windDirDeg === null ? "" : `${COMPASS[Math.round(obs.windDirDeg / 22.5) % 16]} `;
      out.push(`Wind: ${dir}${Math.round(obs.windSpeedMph)} mph`);
    }
  }
  if (obs.pressureInHg !== null) out.push(`Pressure: ${obs.pressureInHg.toFixed(2)}`);

  return out;
}

interface Props {
  observation: Observation | null;
  placeName: string | null;
}

export function Ws4000Footer({ observation, placeName }: Props) {
  const items = footerItems(observation, placeName);
  const [index, setIndex] = useState(0);

  // Rotate. The modulo is applied at read time rather than here because the
  // list length changes when an observation arrives or a field goes null, and
  // an index clamped at set-time would stick to the old length.
  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => setIndex((i) => i + 1), DWELL_MS);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return <footer className="ws4000-footer" aria-hidden="true" />;

  return (
    <footer className="ws4000-footer" aria-label="Conditions bar">
      <span className="ws4000-footer-text" aria-hidden="true">{items[index % items.length]}</span>
      {/* Published once, in full, not rotated. No live region: this band sits
          under every scene and must never interrupt the narration above it. */}
      <ul className="sr-only">
        {items.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </footer>
  );
}
