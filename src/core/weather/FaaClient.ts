/**
 * Thin wrapper around the FAA's public Airport Status XML feed. Returns
 * every currently-delayed US airport in a single document — ground
 * delays, ground stops, arrival/departure delays, and closures.
 *
 * Endpoint: https://nasstatus.faa.gov/api/airport-status-information
 * Format: XML (`<AIRPORT_STATUS_INFORMATION>` root, per fly.faa.gov DTD).
 *
 * The feed has historically had intermittent CORS headers and has been
 * relocated more than once. Callers must treat a thrown error as "data
 * not available" and render the unavailable state.
 */

export interface AirportDelay {
  /** 3-letter IATA code (ATL, JFK, ORD, ...) */
  iata: string;
  /** Full airport name when the feed provides it; falls back to the IATA. */
  name: string;
  /** Delay category — what the FAA calls this kind of disruption. */
  kind: "ground-delay" | "ground-stop" | "arrival" | "departure" | "closure" | "other";
  /** Short human description, e.g. "weather / thunderstorms" or "volume". */
  reason: string;
  /** Average delay in minutes when the feed reports one. */
  avgDelayMinutes: number | null;
  /** Max delay in minutes when the feed reports a range. */
  maxDelayMinutes: number | null;
  /** For closures only: when the closure began (human text from feed). */
  closureStart: string | null;
  /** For closures only: when the airport is scheduled to reopen (human text). */
  closureReopen: string | null;
}

export class FaaClient {
  private readonly endpoint = "https://nasstatus.faa.gov/api/airport-status-information";
  /** 5-minute cache; the feed updates every few minutes server-side. */
  private cached: { at: number; delays: AirportDelay[] } | null = null;
  private readonly ttlMs = 5 * 60 * 1000;

  async getDelays(): Promise<AirportDelay[]> {
    if (this.cached && Date.now() - this.cached.at < this.ttlMs) {
      return this.cached.delays;
    }
    const res = await fetch(this.endpoint, {
      headers: { Accept: "application/xml, text/xml" },
    });
    if (!res.ok) throw new Error(`FAA NAS Status ${res.status}`);
    const xml = await res.text();
    const delays = parseAirportStatusXml(xml);
    this.cached = { at: Date.now(), delays };
    return delays;
  }
}

/**
 * Parse the NAS Status XML document into a flat AirportDelay[].
 *
 * The feed groups entries under `<Delay_type>` wrappers. Each group has a
 * `<Name>` tag that identifies the category, then a list of airport
 * entries with `<ARPT>`, `<Reason>`, `<Min>`/`<Max>`/`<Avg>` delay times,
 * optional `<Trend>`, and — for the closures group — `<Start>`/`<Reopen>`
 * timestamps.
 */
function parseAirportStatusXml(xml: string): AirportDelay[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return [];

  const out: AirportDelay[] = [];
  const groups = doc.getElementsByTagName("Delay_type");
  for (const group of Array.from(groups)) {
    const name = (group.querySelector("Name")?.textContent ?? "").toLowerCase();
    const kind = classifyKind(name);
    const rows = group.querySelectorAll("ARPT");
    for (const arptEl of Array.from(rows)) {
      const row = arptEl.parentElement;
      if (!row) continue;
      const iata = (arptEl.textContent ?? "").trim();
      if (!iata) continue;
      out.push({
        iata,
        name: iata,
        kind,
        reason: text(row, "Reason"),
        avgDelayMinutes: parseDelayMinutes(text(row, "Avg")) ?? parseRangeMid(text(row, "Min"), text(row, "Max")),
        maxDelayMinutes: parseDelayMinutes(text(row, "Max")),
        closureStart: kind === "closure" ? (text(row, "Start") || null) : null,
        closureReopen: kind === "closure" ? (text(row, "Reopen") || null) : null,
      });
    }
  }
  return out;
}

function classifyKind(groupName: string): AirportDelay["kind"] {
  if (groupName.includes("ground stop")) return "ground-stop";
  if (groupName.includes("ground delay")) return "ground-delay";
  if (groupName.includes("closure")) return "closure";
  if (groupName.includes("arriv")) return "arrival";
  if (groupName.includes("depart")) return "departure";
  return "other";
}

function text(scope: Element, tag: string): string {
  const el = scope.querySelector(tag);
  return (el?.textContent ?? "").trim();
}

/** Parse a delay string like "45 minutes", "1 hour 15 minutes", "2 hours". */
function parseDelayMinutes(raw: string): number | null {
  if (!raw) return null;
  let total = 0;
  const hrs = raw.match(/(\d+)\s*(?:hr|hour|hours)/i);
  const mns = raw.match(/(\d+)\s*(?:min|minute|minutes)/i);
  if (hrs) total += Number(hrs[1]) * 60;
  if (mns) total += Number(mns[1]);
  if (!hrs && !mns) {
    const bare = raw.match(/(\d+)/);
    if (bare) total = Number(bare[1]);
  }
  return total > 0 ? total : null;
}

function parseRangeMid(min: string, max: string): number | null {
  const lo = parseDelayMinutes(min);
  const hi = parseDelayMinutes(max);
  if (lo != null && hi != null) return Math.round((lo + hi) / 2);
  return lo ?? hi ?? null;
}
