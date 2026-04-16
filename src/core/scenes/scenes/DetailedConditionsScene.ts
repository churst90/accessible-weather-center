import type { Observation, Place } from "../../types";
import type { Scene, SceneContext, RenderedScene } from "../Scene";

export interface DetailedConditionsData {
  place: Place;
  observation: Observation | null;
}

export class DetailedConditionsScene implements Scene<DetailedConditionsData> {
  readonly id = "detailed";
  readonly title = "Detailed Conditions";
  readonly defaultHoldMs = 12_000;

  async prepare(ctx: SceneContext): Promise<RenderedScene<DetailedConditionsData>> {
    const observation = await ctx.weather.getObservation(ctx.place);
    const data: DetailedConditionsData = { place: ctx.place, observation };
    return {
      id: this.id,
      title: this.title,
      data,
      speech: speak(data),
      holdMs: this.defaultHoldMs,
      musicCue: null,
      jacksonCue: null,
    };
  }
}

function speak(data: DetailedConditionsData): string {
  const { place, observation } = data;
  if (!observation) {
    return `Detailed conditions for ${place.name}, ${place.state} are not available.`;
  }

  const parts: string[] = [`Detailed conditions for ${place.name}, ${place.state}.`];

  if (observation.windSpeedMph != null && observation.windSpeedMph > 0) {
    const dir = observation.windDirDeg != null ? compass(observation.windDirDeg) : "variable";
    let wind = `Wind ${dir} at ${observation.windSpeedMph} miles per hour`;
    if (observation.windGustMph != null && observation.windGustMph > observation.windSpeedMph) {
      wind += `, gusts to ${observation.windGustMph}`;
    }
    parts.push(`${wind}.`);
  } else if (observation.windSpeedMph === 0) {
    parts.push("Winds calm.");
  }

  if (observation.humidityPct != null) {
    parts.push(`Humidity ${observation.humidityPct} percent.`);
  }
  if (observation.dewpointF != null) {
    parts.push(`Dewpoint ${observation.dewpointF} degrees.`);
  }
  if (observation.pressureInHg != null) {
    parts.push(`Barometric pressure ${observation.pressureInHg} inches.`);
  }
  if (observation.visibilityMi != null) {
    parts.push(`Visibility ${observation.visibilityMi} miles.`);
  }

  return parts.join(" ");
}

function compass(deg: number): string {
  const dirs = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  return dirs[Math.round(deg / 45) % 8];
}
