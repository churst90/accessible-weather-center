import type { Place } from "../../types";
import type { Scene, SceneContext, RenderedScene } from "../Scene";
import type { FaaClient, AirportDelay } from "../../weather/FaaClient";

export interface AirportDelaysData {
  place: Place;
  /** True when the FAA feed fetched successfully. False = render the
   *  SceneUnavailable placeholder; `reason` will explain. */
  available: boolean;
  /** Delayed airports returned by the FAA — sorted by worst delay first.
   *  Empty array with available=true means "no delays reported". */
  delays: AirportDelay[];
  /** Fallback text shown when available=false. */
  reason: string;
  /** When the data was fetched (for the "as of" line). */
  fetchedAt: Date;
}

/**
 * Renders currently-delayed US airports from the FAA's NAS Status feed.
 * No geographic filter — the Weatherscan original showed a national
 * snapshot, not just the viewer's home airport, so we do the same.
 * Shows the unavailable state when the FAA endpoint is unreachable
 * (rate-limited, CORS-blocked, or just down).
 */
export class AirportDelaysScene implements Scene<AirportDelaysData> {
  readonly id = "airport";
  readonly title = "Airport Delays";
  readonly defaultHoldMs = 14_000;

  constructor(private readonly faa: FaaClient) {}

  async prepare(ctx: SceneContext): Promise<RenderedScene<AirportDelaysData>> {
    let data: AirportDelaysData;
    try {
      const delays = (await this.faa.getDelays()).sort((a, b) => {
        // Closures float to top with a synthetic weight; real delay minutes rank below.
        const weight = (d: AirportDelay) =>
          d.kind === "closure" ? Number.POSITIVE_INFINITY : (d.avgDelayMinutes ?? 0);
        return weight(b) - weight(a);
      });
      data = {
        place: ctx.place,
        available: true,
        delays,
        reason: "",
        fetchedAt: new Date(),
      };
    } catch {
      data = {
        place: ctx.place,
        available: false,
        delays: [],
        reason: "Airport delay data is not available right now.",
        fetchedAt: new Date(),
      };
    }
    return {
      id: this.id,
      title: this.title,
      data,
      speech: speak(data),
      holdMs: this.defaultHoldMs,
    };
  }
}

function speak(data: AirportDelaysData): string {
  if (!data.available) return `Airport delays — ${data.reason}`;
  if (data.delays.length === 0) return "No airport delays reported right now.";
  const top = data.delays.slice(0, 5).map((d) => {
    if (d.kind === "closure") {
      const reopen = d.closureReopen ? `, reopens ${d.closureReopen}` : "";
      return `${d.name} closed${reopen}`;
    }
    const mins = d.avgDelayMinutes != null ? `${d.avgDelayMinutes} minute` : "unspecified";
    return `${d.name}, ${d.kind.replace("-", " ")}, ${mins} delay`;
  });
  return `Airport delays: ${top.join(". ")}.`;
}
