import type { Place } from "../../types";
import type { Scene, SceneContext, RenderedScene } from "../Scene";

export interface TemperatureTrendData {
  place: Place;
  hours: Array<{ time: Date; tempF: number }>;
  currentF: number | null;
  highF: number;
  lowF: number;
  trend: "rising" | "falling" | "steady";
  summary: string;
}

export class TemperatureTrendScene implements Scene<TemperatureTrendData> {
  readonly id = "temptrend";
  readonly title = "Temperature Trend";
  readonly defaultHoldMs = 12_000;

  async prepare(ctx: SceneContext): Promise<RenderedScene<TemperatureTrendData>> {
    const [hourly, observation] = await Promise.all([
      ctx.weather.getHourly(ctx.place),
      ctx.weather.getObservation(ctx.place)
    ]);

    const hours = hourly.slice(0, 12).map((h) => ({ time: h.time, tempF: h.temperatureF }));
    const currentF = observation?.temperatureF ?? null;

    const temps = hours.map((h) => h.tempF);
    const highF = temps.length > 0 ? Math.max(...temps) : 0;
    const lowF = temps.length > 0 ? Math.min(...temps) : 0;

    let trend: "rising" | "falling" | "steady" = "steady";
    if (temps.length >= 2) {
      const diff = temps[temps.length - 1] - temps[0];
      if (diff > 3) trend = "rising";
      else if (diff < -3) trend = "falling";
    }

    const currentStr = currentF != null ? `Currently ${currentF} degrees` : "Current temperature unavailable";
    const summary = hours.length > 0
      ? `Temperature ${trend} over the next 12 hours. ${currentStr}, reaching a high of ${highF} and a low of ${lowF}.`
      : `Temperature trend for ${ctx.place.name} is not available.`;

    const data: TemperatureTrendData = {
      place: ctx.place,
      hours,
      currentF,
      highF,
      lowF,
      trend,
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

function speak(data: TemperatureTrendData): string {
  const { place, summary } = data;
  return `Temperature trend for ${place.name}, ${place.state}. ${summary}`;
}
