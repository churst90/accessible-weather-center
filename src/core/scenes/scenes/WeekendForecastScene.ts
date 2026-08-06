import type { ForecastPeriod, Place } from "../../types";
import type { Scene, SceneContext, RenderedScene } from "../Scene";
import type { DayForecast } from "./ExtendedForecastScene";

export interface WeekendForecastData {
  place: Place;
  periods: ForecastPeriod[];
  days: DayForecast[];
  available: boolean;
}

export class WeekendForecastScene implements Scene<WeekendForecastData> {
  readonly id = "weekend";
  readonly title = "Weekend Forecast";
  readonly defaultHoldMs = 14_000;

  async prepare(ctx: SceneContext): Promise<RenderedScene<WeekendForecastData>> {
    const allPeriods = await ctx.weather.getForecast(ctx.place);

    const weekendPeriods = allPeriods.filter((p) => isWeekendPeriod(p.name));
    const days = buildWeekendDays(allPeriods);
    const available = days.length > 0;

    const data: WeekendForecastData = {
      place: ctx.place,
      periods: weekendPeriods,
      days,
      available,
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

function isWeekendPeriod(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes("saturday") || lower.includes("sunday");
}

function buildWeekendDays(periods: ForecastPeriod[]): DayForecast[] {
  const days: DayForecast[] = [];
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    if (!p.isDaytime) continue;
    const name = p.name.toLowerCase();
    if (!name.startsWith("saturday") && !name.startsWith("sunday")) continue;
    const night = periods[i + 1];
    days.push({
      key: p.startTime.toISOString(),
      label: name.startsWith("saturday") ? "SAT" : "SUN",
      name: p.name,
      shortForecast: p.shortForecast,
      detailedForecast: p.detailedForecast,
      isDaytime: true,
      highF: p.temperatureF,
      lowF: night && !night.isDaytime ? night.temperatureF : null,
    });
  }
  return days;
}

function speak(data: WeekendForecastData): string {
  const { place, periods, available } = data;

  if (!available) {
    return `Weekend forecast for ${place.name}, ${place.state} is not yet available.`;
  }

  const parts: string[] = [`Weekend forecast for ${place.name}, ${place.state}.`];

  for (const period of periods) {
    parts.push(`${period.name}: ${period.detailedForecast}`);
  }

  return parts.join(" ");
}
