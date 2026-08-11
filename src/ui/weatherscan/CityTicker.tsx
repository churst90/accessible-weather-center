import type { NearbyObservation } from "../../core/types";

/**
 * The Weatherscan city ticker.
 *
 * The crawl along the bottom of the L-bar, carrying nearby markets'
 * conditions on rotating tabs. Until now the V2 bottom strip ran the alert
 * crawl or the LDL and nothing else, which is why the profile carried it as a
 * gap: "the real V2 ran a city ticker there".
 *
 * FROM THE RENDER SCRIPTS, `products/ext/ticker/CityTicker.rs` in
 * `twc_wxscan_dynamic-2.13`:
 *
 *     tickerWidth  = 496            hardcoded fallback when the headend
 *     tickerHeight =  19            config has no 'ticker' viewport
 *     step         = 2.8            crawl rate, px per frame, default
 *     tab font     = Interstate-BoldCondensed 16pt, uppercase
 *     tab colours  = text rgb(20,20,20) on rgb(53,53,53)
 *
 * 496 is why the strip stops at the L-bar rather than running the full
 * screen: 224 + 496 = 720, the raster width. That is already what the layout
 * does — see WeatherscanLBar.
 *
 * The crawl rate converts: 2.8 px/frame at 30fps is 84 px/s across a 496px
 * viewport, so a tab crosses in about six seconds. The CSS animation is timed
 * from the content length to match that speed rather than a fixed duration,
 * because a fixed duration would crawl faster the more cities there are.
 *
 * WHAT IS NOT FROM THE SCRIPTS: which cities. The real unit took its list
 * from headend configuration — `dsm.defaultedConfigGet('CityTicker').playlist`
 * — naming products, not places. There is no way to recover a market's city
 * list from the package, so this uses the nearest reporting stations from the
 * NWS gridpoint, which is the same idea reached a different way.
 *
 * ACCESSIBILITY. A crawl is the worst possible thing to expose to a screen
 * reader: it is motion, it is repetitive, and it never ends. So the moving
 * text is `aria-hidden` and every city is published once, statically, in a
 * screen-reader-only list. No live region — this sits under every scene and
 * must never interrupt narration. Under `prefers-reduced-motion` the crawl
 * stops and the cities are laid out as a static row, which loses nothing:
 * the list was always the accessible copy.
 */

interface Props {
  cities: readonly NearbyObservation[];
  /** Shown on the leading tab. The real unit labelled its segments. */
  label?: string;
}

/** One stop, in the wording the ticker used: city, temperature, sky. */
export function tickerText(city: NearbyObservation): string {
  const temp = city.temperatureF === null ? "" : `${Math.round(city.temperatureF)}°`;
  const cond = city.conditionText ?? "";
  return [city.name, temp, cond].filter(Boolean).join(" ");
}

export function CityTicker({ cities, label = "Current Conditions" }: Props) {
  if (cities.length === 0) {
    // No strip at all rather than an empty crawling bar — an empty ticker
    // reads as "no conditions anywhere" instead of "not loaded yet".
    return null;
  }

  const stops = cities.map(tickerText);
  // 84 px/s — the script's 2.8 px/frame at 30fps. The track is doubled and
  // the keyframe travels -50%, so the distance covered per cycle is the
  // width of one copy of the list; duration is therefore that width over the
  // speed, and the crawl runs at 84 px/s whatever the list length.
  //
  // 9px per character is an estimate for the ticker's type size, and it is
  // the only soft number here. Getting it wrong scales the speed, not the
  // constant-speed property.
  //
  // The floor only guards the degenerate case of one very short city; set
  // any higher and it starts overriding the computed duration for real
  // lists, which is what makes a crawl speed up as cities are added.
  const chars = stops.join("   ").length;
  const seconds = Math.max(5, Math.round((chars * 9) / 84));

  return (
    <div className="ws-city-ticker" aria-label="Conditions in nearby cities">
      <span className="ws-city-ticker-tab" aria-hidden="true">{label.toUpperCase()}</span>
      <div className="ws-city-ticker-track" aria-hidden="true">
        <div
          className="ws-city-ticker-run"
          style={{ animationDuration: `${seconds}s` }}
        >
          {stops.map((s) => (
            <span key={s} className="ws-city-ticker-stop">{s}</span>
          ))}
          {/* A second copy so the loop has no visible gap at the wrap. */}
          {stops.map((s) => (
            <span key={`${s}-dup`} className="ws-city-ticker-stop" >{s}</span>
          ))}
        </div>
      </div>
      <ul className="sr-only">
        {cities.map((c) => <li key={c.name ?? tickerText(c)}>{tickerText(c)}</li>)}
      </ul>
    </div>
  );
}
