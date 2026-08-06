import type { Observation, Place } from "../../types";
import type { Scene, SceneContext, RenderedScene } from "../Scene";

export interface CurrentConditionsData {
  place: Place;
  observation: Observation | null;
}

export class CurrentConditionsScene implements Scene<CurrentConditionsData> {
  readonly id = "current";
  readonly title = "Current Conditions";
  readonly defaultHoldMs = 12_000;

  async prepare(ctx: SceneContext): Promise<RenderedScene<CurrentConditionsData>> {
    const observation = await ctx.weather.getObservation(ctx.place);
    const data: CurrentConditionsData = { place: ctx.place, observation };
    return {
      id: this.id,
      title: this.title,
      data,
      speech: speak(data),
      holdMs: this.defaultHoldMs,
    };
  }
}

function speak(data: CurrentConditionsData): string {
  const { place, observation } = data;
  if (!observation) {
    return `Current conditions for ${place.name}, ${place.state} are not available.`;
  }
  const parts: string[] = [`Currently in ${place.name}, ${place.state}.`];
  if (observation.conditionText) parts.push(`${observation.conditionText}.`);
  if (observation.temperatureF != null) parts.push(`Temperature ${observation.temperatureF} degrees.`);
  if (observation.feelsLikeF != null && observation.feelsLikeF !== observation.temperatureF) {
    parts.push(`Feels like ${observation.feelsLikeF}.`);
  }
  if (observation.humidityPct != null) parts.push(`Humidity ${observation.humidityPct} percent.`);
  if (observation.windSpeedMph != null && observation.windSpeedMph > 0) {
    const dir = observation.windDirDeg != null ? compass(observation.windDirDeg) : "";
    parts.push(`Wind ${dir} at ${observation.windSpeedMph} miles per hour.`);
  } else if (observation.windSpeedMph === 0) {
    parts.push("Winds calm.");
  }
  if (observation.pressureInHg != null) parts.push(`Pressure ${observation.pressureInHg} inches.`);
  return parts.join(" ");
}

function compass(deg: number): string {
  const dirs = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  return dirs[Math.round(deg / 45) % 8];
}
