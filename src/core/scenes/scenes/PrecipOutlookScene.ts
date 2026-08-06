import type { Place } from "../../types";
import type { Scene, SceneContext, RenderedScene } from "../Scene";

export interface PrecipHour {
  time: Date;
  precipPct: number;
  forecast: string;
}

export interface PrecipOutlookData {
  place: Place;
  hours: PrecipHour[];
  maxPrecipPct: number;
  summary: string;
}

export class PrecipOutlookScene implements Scene<PrecipOutlookData> {
  readonly id = "precip";
  readonly title = "Precipitation Outlook";
  readonly defaultHoldMs = 14_000;

  async prepare(ctx: SceneContext): Promise<RenderedScene<PrecipOutlookData>> {
    const hourly = await ctx.weather.getHourly(ctx.place);
    const next12 = hourly.slice(0, 12);

    const hours: PrecipHour[] = next12.map((h) => ({
      time: new Date(h.time),
      precipPct: h.precipProbabilityPct ?? 0,
      forecast: h.shortForecast,
    }));

    const maxPrecipPct = hours.length > 0
      ? Math.max(...hours.map((h) => h.precipPct))
      : 0;

    const summary = buildSummary(hours, maxPrecipPct);

    const data: PrecipOutlookData = {
      place: ctx.place,
      hours,
      maxPrecipPct,
      summary,
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

function buildSummary(hours: PrecipHour[], maxPrecipPct: number): string {
  if (hours.length === 0) {
    return "Hourly forecast data is not available.";
  }

  if (maxPrecipPct < 20) {
    return "No precipitation expected in the next 12 hours.";
  }

  // Find the first hour with significant precipitation
  const firstPrecipHour = hours.find((h) => h.precipPct >= 20);
  if (!firstPrecipHour) {
    return "No precipitation expected in the next 12 hours.";
  }

  const timeStr = formatHour(firstPrecipHour.time);
  const descriptor = precipDescriptor(maxPrecipPct);

  return `${descriptor} after ${timeStr}, ${maxPrecipPct}% chance.`;
}

function precipDescriptor(pct: number): string {
  if (pct >= 70) return "Rain likely";
  if (pct >= 50) return "Chance of rain";
  if (pct >= 30) return "Slight chance of rain";
  return "Isolated precipitation possible";
}

function formatHour(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: undefined,
    hour12: true,
  });
}

function speak(data: PrecipOutlookData): string {
  const { place, summary, hours } = data;

  if (hours.length === 0) {
    return `Precipitation outlook for ${place.name}, ${place.state} is not available.`;
  }

  const parts: string[] = [`Precipitation outlook for ${place.name}, ${place.state}.`];
  parts.push(summary);

  return parts.join(" ");
}
