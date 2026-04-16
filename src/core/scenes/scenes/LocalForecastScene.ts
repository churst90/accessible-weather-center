import type { ForecastPeriod, Place } from "../../types";
import type { Scene, SceneContext, RenderedScene } from "../Scene";

export interface LocalForecastData {
  place: Place;
  periods: ForecastPeriod[];
}

export class LocalForecastScene implements Scene<LocalForecastData> {
  readonly id = "localforecast";
  readonly title = "Local Forecast";
  readonly defaultHoldMs = 18_000;

  async prepare(ctx: SceneContext): Promise<RenderedScene<LocalForecastData>> {
    const allPeriods = await ctx.weather.getForecast(ctx.place);
    const periods = allPeriods.slice(0, 3);
    const data: LocalForecastData = { place: ctx.place, periods };
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

function speak(data: LocalForecastData): string {
  const { place, periods } = data;
  if (periods.length === 0) {
    return `Local forecast for ${place.name}, ${place.state} is not available.`;
  }
  const parts: string[] = [`Local forecast for ${place.name}, ${place.state}.`];
  for (const period of periods) {
    parts.push(`${period.name}: ${period.detailedForecast}`);
  }
  return parts.join(" ");
}
