import type { Place, WeatherAlert } from "../../types";
import type { Scene, SceneContext, RenderedScene } from "../Scene";

export interface AlertsData {
  place: Place;
  alerts: WeatherAlert[];
}

/**
 * The alerts scene is conditional: if there are no active alerts, the
 * scheduler should skip it. Skipping is enforced upstream by checking
 * `data.alerts.length`. We still produce a benign rendering for safety.
 */
export class AlertsScene implements Scene<AlertsData> {
  readonly id = "alerts";
  readonly title = "Active Alerts";
  readonly defaultHoldMs = 18_000;

  async prepare(ctx: SceneContext): Promise<RenderedScene<AlertsData>> {
    const alerts = await ctx.weather.getActiveAlerts(ctx.place);
    const data: AlertsData = { place: ctx.place, alerts };
    return {
      id: this.id,
      title: this.title,
      data,
      speech: speak(data),
      holdMs: this.defaultHoldMs,
    };
  }
}

function speak(data: AlertsData): string {
  if (data.alerts.length === 0) return `No active alerts for ${data.place.name}.`;
  const parts: string[] = [`${data.alerts.length} active alert${data.alerts.length === 1 ? "" : "s"} for ${data.place.name}.`];
  for (const a of data.alerts) {
    const expiresAt = a.expires.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    parts.push(`${a.event}, severity ${a.severity}, urgency ${a.urgency}, expires ${expiresAt}. ${a.headline}.`);
  }
  return parts.join(" ");
}
