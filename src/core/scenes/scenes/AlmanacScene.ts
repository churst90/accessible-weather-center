import type { Place } from "../../types";
import type { Scene, SceneContext, RenderedScene } from "../Scene";
import { getSunTimes, getMoonInfo } from "../../weather/SunCalc";

export interface AlmanacData {
  place: Place;
  sunrise: string;
  sunset: string;
  dayLengthHrs: number;
  dayLengthMin: number;
  moonPhase: string;
  moonIllumination: number;
}

export class AlmanacScene implements Scene<AlmanacData> {
  readonly id = "almanac";
  readonly title = "Almanac";
  readonly defaultHoldMs = 12_000;

  async prepare(ctx: SceneContext): Promise<RenderedScene<AlmanacData>> {
    const now = new Date();
    const sun = getSunTimes(ctx.place.coord, now);
    const moon = getMoonInfo(now);

    const totalMin = Math.max(0, Math.round(sun.dayLengthMin));
    const data: AlmanacData = {
      place: ctx.place,
      sunrise: sun.sunrise.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      sunset: sun.sunset.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      dayLengthHrs: Math.floor(totalMin / 60),
      dayLengthMin: totalMin % 60,
      moonPhase: moon.phaseName,
      moonIllumination: moon.illuminationPct
    };
    return {
      id: this.id,
      title: this.title,
      data,
      speech: speak(data),
      holdMs: this.defaultHoldMs,
      musicCue: null,
      jacksonCue: null
    };
  }
}

function speak(data: AlmanacData): string {
  const { place } = data;
  const parts: string[] = [
    `Almanac for ${place.name}, ${place.state}.`,
    `Sunrise at ${data.sunrise}.`,
    `Sunset at ${data.sunset}.`,
    `Day length ${data.dayLengthHrs} hours ${data.dayLengthMin} minutes.`,
    `Moon phase: ${data.moonPhase}, ${data.moonIllumination}% illuminated.`
  ];
  return parts.join(" ");
}
