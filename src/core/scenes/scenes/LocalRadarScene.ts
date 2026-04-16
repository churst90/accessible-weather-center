import type { Place } from "../../types";
import type { Scene, SceneContext, RenderedScene } from "../Scene";
import type { StormScanner } from "../../radar/StormScanner";
import { describeStorm } from "../../radar/StormScanner";
import type { TrackedStorm } from "../../radar/StormTracker";

/**
 * Live radar scene, backed by the StormScanner service. The scene is a
 * thin adapter: it reads the scanner's current snapshot and turns it into
 * something the view can render + something the announcer can read.
 *
 * The scene does NOT trigger a fetch on prepare(). The scanner polls
 * independently on a timer, so by the time this scene is entered, there's
 * already a fresh snapshot sitting in memory. Jumping to the scene gives
 * an instant view instead of a loading flicker.
 */

export interface LocalRadarData {
  place: Place;
  capturedAt: Date | null;
  storms: TrackedStorm[];
  /** Plain-text summary: "3 storms near you, closest heavy rain 12 miles west." */
  summary: string;
  /** Non-null if the last scan errored — surfaced in the view as a banner. */
  error: string | null;
}

export class LocalRadarScene implements Scene<LocalRadarData> {
  readonly id = "radar";
  readonly title = "Local Radar";
  readonly defaultHoldMs = 14_000;

  constructor(private readonly scanner: StormScanner) {}

  async prepare(ctx: SceneContext): Promise<RenderedScene<LocalRadarData>> {
    const snap = this.scanner.getSnapshot();
    const data: LocalRadarData = {
      place: ctx.place,
      capturedAt: snap.capturedAt,
      storms: snap.storms,
      summary: summarize(ctx.place.name, snap.storms),
      error: snap.lastError?.message ?? null
    };
    return {
      id: this.id,
      title: this.title,
      data,
      speech: speak(data),
      holdMs: this.defaultHoldMs,
      musicCue: null,
      jacksonCue: null
    };
  }
}

function summarize(placeName: string, storms: TrackedStorm[]): string {
  if (storms.length === 0) {
    return `No precipitation within radar range near ${placeName}. All clear.`;
  }
  const nearest = storms[0];
  return `${storms.length} storm${storms.length === 1 ? "" : "s"} near ${placeName}. ` +
    `Closest: ${describeStorm(nearest, nearest.centroid)}`;
}

function speak(data: LocalRadarData): string {
  const parts: string[] = [`Local radar for ${data.place.name}.`];
  if (data.storms.length === 0) {
    parts.push("No precipitation within 150 miles. All clear.");
    return parts.join(" ");
  }
  parts.push(`${data.storms.length} storm${data.storms.length === 1 ? "" : "s"} detected.`);
  // Speak the nearest two on scene entry; the user can walk the full list
  // with arrow keys once they're focused.
  const top = data.storms.slice(0, 2);
  for (let i = 0; i < top.length; i++) {
    parts.push(`Storm ${i + 1}: ${describeStorm(top[i], top[i].centroid)}`);
  }
  if (data.storms.length > 2) {
    parts.push(`Up and down arrows to walk the rest.`);
  }
  return parts.join(" ");
}
