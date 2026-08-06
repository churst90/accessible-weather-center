import type { Place } from "../../types";
import type { Scene, SceneContext, RenderedScene } from "../Scene";

export interface TravelCity {
  name: string;
  state: string;
  tempF: number | null;
  condition: string | null;
}

export interface TravelCitiesData {
  place: Place;
  cities: TravelCity[];
}

export class TravelCitiesScene implements Scene<TravelCitiesData> {
  readonly id = "travel";
  readonly title = "Travel Cities";
  readonly defaultHoldMs = 16_000;

  constructor(private readonly getPlaces: () => readonly Place[]) {}

  async prepare(ctx: SceneContext): Promise<RenderedScene<TravelCitiesData>> {
    const allPlaces = this.getPlaces();
    const others = allPlaces
      .filter((p) => p.id !== ctx.place.id)
      .slice(0, 6);

    const cities = await Promise.all(
      others.map(async (p): Promise<TravelCity> => {
        try {
          const obs = await ctx.weather.getObservation(p);
          return {
            name: p.name,
            state: p.state,
            tempF: obs?.temperatureF ?? null,
            condition: obs?.conditionText ?? null
          };
        } catch {
          return { name: p.name, state: p.state, tempF: null, condition: null };
        }
      })
    );

    const data: TravelCitiesData = { place: ctx.place, cities };
    return {
      id: this.id,
      title: this.title,
      data,
      speech: speak(data),
      holdMs: this.defaultHoldMs,
    };
  }
}

function speak(data: TravelCitiesData): string {
  if (data.cities.length === 0) return "Travel cities. No cities available.";
  const parts: string[] = ["Travel cities."];
  for (const c of data.cities) {
    if (c.tempF != null && c.condition) {
      parts.push(`${c.name}, ${c.state}: ${c.tempF} degrees, ${c.condition}.`);
    } else if (c.tempF != null) {
      parts.push(`${c.name}, ${c.state}: ${c.tempF} degrees.`);
    } else {
      parts.push(`${c.name}, ${c.state}: not available.`);
    }
  }
  return parts.join(" ");
}
