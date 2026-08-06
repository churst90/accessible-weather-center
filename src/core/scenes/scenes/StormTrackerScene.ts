import type { Place } from "../../types";
import type { Scene, SceneContext, RenderedScene } from "../Scene";
import { StormScanner, describeStorm } from "../../radar/StormScanner";
import type { TrackedStorm } from "../../radar/StormTracker";

export interface StormTrackerData {
  place: Place;
  storm: TrackedStorm | null;
  totalStorms: number;
  summary: string;
}

export class StormTrackerScene implements Scene<StormTrackerData> {
  readonly id = "stormtracker";
  readonly title = "Storm Tracker";
  readonly defaultHoldMs = 14_000;

  constructor(private readonly scanner: StormScanner) {}

  async prepare(ctx: SceneContext): Promise<RenderedScene<StormTrackerData>> {
    const snapshot = this.scanner.getSnapshot();
    const storms = snapshot.storms;

    // Pick the closest storm, or if multiple have ETAs, prefer the one arriving soonest
    let nearest: TrackedStorm | null = null;
    if (storms.length > 0) {
      nearest = storms.reduce((best, s) => {
        // Prefer storm with lowest ETA if one is approaching
        if (s.etaMinutes != null && (best.etaMinutes == null || s.etaMinutes < best.etaMinutes)) {
          return s;
        }
        // Otherwise pick the closest
        if (best.etaMinutes == null && s.distanceFromHomeMi < best.distanceFromHomeMi) {
          return s;
        }
        return best;
      });
    }

    const summary = nearest
      ? `${storms.length} storm${storms.length === 1 ? "" : "s"} detected. Nearest: ${describeStorm(nearest, ctx.place.coord)}`
      : "No storms detected. All clear.";

    const data: StormTrackerData = {
      place: ctx.place,
      storm: nearest,
      totalStorms: storms.length,
      summary
    };
    return {
      id: this.id,
      title: this.title,
      data,
      speech: speak(data),
      holdMs: this.defaultHoldMs,
    };
  }
}

function speak(data: StormTrackerData): string {
  const { place, summary } = data;
  return `Storm tracker for ${place.name}, ${place.state}. ${summary}`;
}
