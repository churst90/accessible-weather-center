import type { ForecastPeriod, Place } from "../../types";
import type { Scene, SceneContext, RenderedScene } from "../Scene";
import { getTheme, type ExtendedStyle } from "../../settings/themes";

/**
 * A single column on the Extended Forecast. Broadcast WS4000 / Weatherscan
 * always used one column per *day*, with the daytime high and overnight low
 * stacked inside that column — never separate day/night columns. When the
 * user is watching after sunset, the first column is a tonight-only entry
 * (low-only, no high).
 */
export interface DayForecast {
  key: string;
  label: string;
  name: string;
  shortForecast: string;
  detailedForecast: string;
  isDaytime: boolean;
  highF: number | null;
  lowF: number | null;
}

export interface ExtendedForecastData {
  place: Place;
  periods: ForecastPeriod[];
  days: DayForecast[];
  style: ExtendedStyle;
  title: string;
}

export class ExtendedForecastScene implements Scene<ExtendedForecastData> {
  readonly id = "extended";
  readonly title = "Extended Forecast";
  readonly defaultHoldMs = 16_000;

  async prepare(ctx: SceneContext): Promise<RenderedScene<ExtendedForecastData>> {
    const theme = ctx.themeId ? getTheme(ctx.themeId) : null;
    const style: ExtendedStyle = theme?.extendedStyle ?? "7-day";
    const title = theme?.extendedTitle ?? "Extended Forecast";
    // WS3000 (3-column text Extended) and WS4000 post-Feb 1991 (3-panel
    // graphical Extended) both display 3 days. 5-day/7-day stay as-is.
    const dayLimit = style === "3-day" ? 3 : style === "5-day" ? 5 : 7;
    const periods = await ctx.weather.getForecast(ctx.place);
    const days = buildDayForecasts(periods, dayLimit);
    const data: ExtendedForecastData = { place: ctx.place, periods, days, style, title };
    return {
      id: this.id,
      title,
      data,
      speech: speak(data),
      holdMs: this.defaultHoldMs,
      musicCue: "uplift",
      jacksonCue: "extended_forecast"
    };
  }
}

export function buildDayForecasts(periods: ForecastPeriod[], dayLimit: number): DayForecast[] {
  const days: DayForecast[] = [];
  let i = 0;

  if (periods[0] && !periods[0].isDaytime) {
    const p = periods[0];
    days.push({
      key: p.startTime.toISOString(),
      label: labelFor(p.name),
      name: p.name,
      shortForecast: p.shortForecast,
      detailedForecast: p.detailedForecast,
      isDaytime: false,
      highF: null,
      lowF: p.temperatureF,
    });
    i = 1;
  }

  while (i < periods.length && days.length < dayLimit) {
    const day = periods[i];
    if (day && day.isDaytime) {
      const night = periods[i + 1];
      days.push({
        key: day.startTime.toISOString(),
        label: labelFor(day.name),
        name: day.name,
        shortForecast: day.shortForecast,
        detailedForecast: day.detailedForecast,
        isDaytime: true,
        highF: day.temperatureF,
        lowF: night && !night.isDaytime ? night.temperatureF : null,
      });
      i += 2;
    } else {
      i += 1;
    }
  }
  return days;
}

function labelFor(name: string): string {
  const lower = name.toLowerCase();
  if (lower === "tonight" || lower === "overnight" || lower === "tonite") return "TONIGHT";
  if (lower === "today" || lower === "this afternoon" || lower === "this morning") return "TODAY";
  const days: Record<string, string> = {
    sunday: "SUN", monday: "MON", tuesday: "TUE", wednesday: "WED",
    thursday: "THU", friday: "FRI", saturday: "SAT",
  };
  for (const [k, v] of Object.entries(days)) {
    if (lower.startsWith(k)) return v;
  }
  return name.toUpperCase();
}

function speak(data: ExtendedForecastData): string {
  if (data.periods.length === 0) return `${data.title} for ${data.place.name} is not available.`;
  const parts: string[] = [`${data.title} for ${data.place.name}.`];
  for (const p of data.periods) {
    parts.push(`${p.name}, ${p.shortForecast}, ${p.isDaytime ? "high" : "low"} ${p.temperatureF}.`);
  }
  return parts.join(" ");
}
