import type { ForecastPeriod, Place } from "../../types";
import type { Scene, SceneContext, RenderedScene } from "../Scene";

export interface OvernightForecastData {
  place: Place;
  period: ForecastPeriod | null;
  available: boolean;
}

export class OvernightForecastScene implements Scene<OvernightForecastData> {
  readonly id = "overnight";
  readonly title = "Overnight Forecast";
  readonly defaultHoldMs = 12_000;

  async prepare(ctx: SceneContext): Promise<RenderedScene<OvernightForecastData>> {
    const periods = await ctx.weather.getForecast(ctx.place);
    const tonight = periods.find((p) => !p.isDaytime) ?? null;
    const data: OvernightForecastData = {
      place: ctx.place,
      period: tonight,
      available: tonight != null
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

function speak(data: OvernightForecastData): string {
  const { place, period } = data;
  if (!period) {
    return `Tonight's forecast for ${place.name}, ${place.state} is not available.`;
  }
  return `Tonight's forecast for ${place.name}, ${place.state}. ${period.detailedForecast}`;
}
