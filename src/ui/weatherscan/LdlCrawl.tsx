import { useEffect, useState } from "react";
import type { FaaClient, AirportDelay } from "../../core/weather/FaaClient";

interface Props {
  faa: FaaClient;
  /** Additional static items to prepend (e.g. current temp, scene title). */
  leadItems?: string[];
  /** Optional TWC-style tiny icon code (without `_Xsm.png`) shown next to
   *  the section label — sourced from /assets/icons/tiny/. */
  leadIconName?: string;
}

const TINY_BASE = "/assets/icons/tiny";

/** Map of weather condition key → tiny TWC code stem (without _Xsm.png). */
export const TINY_MAP: Record<string, string> = {
  "sunny":         "Sun",
  "clear":         "NClr",
  "mostly-clear":  "Fair",
  "partly-cloudy": "DPc",
  "partly-clear":  "NPc",
  "mostly-cloudy": "DMc",
  "cloudy":        "Cld",
  "rain":          "Ra",
  "showers":       "Sh",
  "thunderstorm":  "Ts",
  "thunderstorms": "Ts",
  "snow":          "Sn",
  "light-snow":    "Drz",
  "fog":           "Fog",
  "windy":         "CldWnd",
};

/**
 * IntelliStar 2 HD Lower Display Line — a persistent crawl bar that
 * runs across the bottom of the screen showing a rundown of national
 * airport delays and other quick-reference items. On the original IS2
 * HD this is where Airport Delays appeared (not as a standalone scene).
 *
 * Accessibility: the animated strip is aria-hidden. The same content
 * is exposed as a static screen-reader-only list so AT users can walk
 * it deliberately rather than chasing a moving marquee.
 */
export function LdlCrawl({ faa, leadItems = [], leadIconName }: Props) {
  const [delays, setDelays] = useState<AirportDelay[] | null>(null);
  // Tick the clock on its own cadence so the LDL content refreshes every
  // minute even when the crawl marquee is mid-scroll. Real Weatherscan
  // LDLs rotated current time through the strip alongside observations
  // and airport delays.
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const d = await faa.getDelays();
        if (!cancelled) setDelays(d);
      } catch {
        if (!cancelled) setDelays([]);
      }
    };
    void refresh();
    const id = setInterval(refresh, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [faa]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const items = buildItems(leadItems, delays, now);
  if (items.length === 0) return null;
  // Duplicate the list so the marquee can loop seamlessly.
  const strip = items.join("   •   ");

  // Only render the tiny icon when the condition is actually in TINY_MAP —
  // guessing the raw condition key as a filename stem produced broken
  // images for anything unmapped (e.g. "scattered-showers_Xsm.png").
  const iconStem = leadIconName ? TINY_MAP[leadIconName] ?? null : null;

  return (
    <div className="ws-ldl">
      <div className="ws-ldl-label" aria-hidden="true">
        {iconStem && (
          <img
            className="ws-ldl-icon"
            src={`${TINY_BASE}/${iconStem}_Xsm.png`}
            alt=""
            aria-hidden="true"
          />
        )}
        <span>NATIONAL</span>
      </div>
      <div className="ws-ldl-track" aria-hidden="true">
        <div className="ws-ldl-content">
          {strip}&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;{strip}
        </div>
      </div>
      <ul className="sr-only" aria-label="National airport status rundown">
        {items.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  );
}

function buildItems(lead: string[], delays: AirportDelay[] | null, now: Date): string[] {
  const items: string[] = [...lead];
  // Current time rides in the LDL between the scene label and the airport
  // rundown, matching how Weatherscan V1/V2 cycled observations and time
  // through the lower display line.
  const clockText = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  items.push(`TIME ${clockText}`);
  if (delays == null) return items;
  if (delays.length === 0) {
    items.push("AIRPORT STATUS: No delays reported nationwide");
    return items;
  }
  // Closures first, then worst delays.
  const closures = delays.filter((d) => d.kind === "closure");
  const active = delays.filter((d) => d.kind !== "closure")
    .sort((a, b) => (b.avgDelayMinutes ?? 0) - (a.avgDelayMinutes ?? 0))
    .slice(0, 8);

  for (const c of closures.slice(0, 5)) {
    const reopen = c.closureReopen ? ` — reopens ${c.closureReopen}` : "";
    items.push(`${c.iata} CLOSED${reopen}`);
  }
  for (const d of active) {
    const mins = d.avgDelayMinutes != null ? `${d.avgDelayMinutes} MIN` : "—";
    items.push(`${d.iata} ${kindShort(d.kind)} ${mins}`);
  }
  return items;
}

function kindShort(k: AirportDelay["kind"]): string {
  switch (k) {
    case "ground-delay": return "GND DELAY";
    case "ground-stop":  return "GND STOP";
    case "arrival":      return "ARR";
    case "departure":    return "DEP";
    case "closure":      return "CLOSED";
    default:             return "DELAY";
  }
}
