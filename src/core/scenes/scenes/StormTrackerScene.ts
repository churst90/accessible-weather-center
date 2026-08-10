import type { Place } from "../../types";
import type { Scene, SceneContext, RenderedScene } from "../Scene";
import { StormScanner, describeStorm } from "../../radar/StormScanner";
import type { TrackedStorm } from "../../radar/StormTracker";

export interface StormTrackerData {
  place: Place;
  /** The storm the scene leads with — soonest to arrive, else the closest. */
  storm: TrackedStorm | null;
  /**
   * Every tracked storm, in the order the scene presents them: the same
   * priority that picks `storm` for the headline, applied to the whole set.
   *
   * The scene used to keep only the nearest, so arrow keys had nothing to
   * walk but that one storm's seven measurement rows — pressing Down on a
   * screen called "Storm Tracker" read "Radius", "Peak Rate", "ETA" instead
   * of the storms being tracked.
   */
  storms: TrackedStorm[];
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

    // Order the whole set once, by the priority the headline already used:
    // an approaching storm outranks a merely close one, and among approaching
    // storms the soonest wins. Sorting rather than reducing means the list the
    // user arrows through and the storm the scene leads with cannot disagree.
    const ordered = [...storms].sort((a, b) => {
      if (a.etaMinutes != null && b.etaMinutes != null) return a.etaMinutes - b.etaMinutes;
      if (a.etaMinutes != null) return -1;
      if (b.etaMinutes != null) return 1;
      return a.distanceFromHomeMi - b.distanceFromHomeMi;
    });
    const nearest: TrackedStorm | null = ordered[0] ?? null;

    const summary = nearest
      ? `${storms.length} storm${storms.length === 1 ? "" : "s"} detected. Nearest: ${describeStorm(nearest, ctx.place.coord)}`
      : "No storms detected. All clear.";

    const data: StormTrackerData = {
      place: ctx.place,
      storm: nearest,
      storms: ordered,
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
