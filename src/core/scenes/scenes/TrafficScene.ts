import type { Place } from "../../types";
import type { Scene, SceneContext, RenderedScene } from "../Scene";

/**
 * Traffic scene. There's no free public traffic API that works out of
 * the box at the Weatherscan "local trip times + incidents" granularity,
 * so this scene always renders the unavailable placeholder until a data
 * source is wired up. Narrator intros for traffic already exist in the
 * AJ / Amy pools — they play via composeSceneIntro("traffic"), and the
 * NVDA announcement uses the `speech` string below.
 */
export interface TrafficData {
  place: Place;
  available: false;
  /** Reason string shown to the user and read by NVDA. */
  reason: string;
}

export class TrafficScene implements Scene<TrafficData> {
  readonly id = "traffic";
  readonly title = "Traffic";
  readonly defaultHoldMs = 8_000;

  async prepare(ctx: SceneContext): Promise<RenderedScene<TrafficData>> {
    const data: TrafficData = {
      place: ctx.place,
      available: false,
      reason: "Traffic data is not available in this build.",
    };
    return {
      id: this.id,
      title: this.title,
      data,
      speech: `Traffic for ${ctx.place.name} — ${data.reason}`,
      holdMs: this.defaultHoldMs,
      musicCue: null,
      jacksonCue: null,
    };
  }
}
