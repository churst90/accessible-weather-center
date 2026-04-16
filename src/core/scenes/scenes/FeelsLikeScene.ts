import type { Place } from "../../types";
import type { Scene, SceneContext, RenderedScene } from "../Scene";

export interface FeelsLikeData {
  place: Place;
  actualF: number | null;
  feelsLikeF: number | null;
  windChillActive: boolean;
  heatIndexActive: boolean;
  advisory: string;
}

export class FeelsLikeScene implements Scene<FeelsLikeData> {
  readonly id = "feelslike";
  readonly title = "Feels Like";
  readonly defaultHoldMs = 10_000;

  async prepare(ctx: SceneContext): Promise<RenderedScene<FeelsLikeData>> {
    const observation = await ctx.weather.getObservation(ctx.place);

    const actualF = observation?.temperatureF ?? null;
    const feelsLikeF = observation?.feelsLikeF ?? null;

    const windChillActive =
      actualF != null && feelsLikeF != null && feelsLikeF < actualF - 5;
    const heatIndexActive =
      actualF != null && feelsLikeF != null && feelsLikeF > actualF + 5;

    let advisory = "";
    if (windChillActive) {
      const diff = Math.round(actualF! - feelsLikeF!);
      advisory = `Wind chill advisory: feels ${diff} degrees colder than actual temperature.`;
    } else if (heatIndexActive) {
      const diff = Math.round(feelsLikeF! - actualF!);
      advisory = `Heat index warning: feels ${diff} degrees warmer than actual temperature.`;
    }

    const data: FeelsLikeData = {
      place: ctx.place,
      actualF,
      feelsLikeF,
      windChillActive,
      heatIndexActive,
      advisory,
    };

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

function speak(data: FeelsLikeData): string {
  const { place, actualF, feelsLikeF, advisory } = data;

  if (actualF == null) {
    return `Feels like information for ${place.name}, ${place.state} is not available.`;
  }

  const parts: string[] = [`Feels like conditions for ${place.name}, ${place.state}.`];
  parts.push(`Actual temperature ${actualF} degrees.`);

  if (feelsLikeF != null && feelsLikeF !== actualF) {
    parts.push(`Feels like ${feelsLikeF} degrees.`);
  } else {
    parts.push("No significant wind chill or heat index at this time.");
  }

  if (advisory) {
    parts.push(advisory);
  }

  return parts.join(" ");
}
