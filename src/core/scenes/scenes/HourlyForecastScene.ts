import type { HourlyForecastPoint, Place } from "../../types";
import type { Scene, SceneContext, RenderedScene } from "../Scene";

export interface HourlyForecastData {
  place: Place;
  hours: HourlyForecastPoint[];
}

export class HourlyForecastScene implements Scene<HourlyForecastData> {
  readonly id = "hourly";
  readonly title = "Hourly Forecast";
  readonly defaultHoldMs = 14_000;

  async prepare(ctx: SceneContext): Promise<RenderedScene<HourlyForecastData>> {
    const all = await ctx.weather.getHourly(ctx.place);
    const hours = all.slice(0, 12);
    const data: HourlyForecastData = { place: ctx.place, hours };
    return {
      id: this.id,
      title: this.title,
      data,
      speech: speak(data),
      holdMs: this.defaultHoldMs,
      musicCue: "calm",
      jacksonCue: "next_few_hours"
    };
  }
}

function speak(data: HourlyForecastData): string {
  if (data.hours.length === 0) return `Hourly forecast for ${data.place.name} is not available.`;
  const parts: string[] = [`Hourly forecast for ${data.place.name}.`];
  const samples = [data.hours[0], data.hours[3], data.hours[6], data.hours[9]].filter(Boolean);
  for (const h of samples) {
    const time = h.time.toLocaleTimeString([], { hour: "numeric" });
    const precip = h.precipProbabilityPct > 0 ? `, ${h.precipProbabilityPct} percent chance of precipitation` : "";
    parts.push(`At ${time}, ${h.temperatureF} degrees, ${h.shortForecast}${precip}.`);
  }
  return parts.join(" ");
}
