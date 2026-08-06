import type { Place, WeatherAlert } from "../types";
import type { WeatherService } from "../weather/WeatherService";

/**
 * NWS active-alert poller — the Tier 1 (authoritative) alert source.
 *
 * Mirrors StormScanner's shape: one service owns the polling loop and the
 * seen-id bookkeeping, the UI just subscribes. This used to live inline in
 * an App.tsx effect, where it captured the boot-time home place and never
 * noticed home changes — the highest-stakes bug of the 2026-08 audit.
 * Here, `setPlace()` is the single re-pointing seam (App calls it from the
 * same places-store subscription that re-points the scheduler and the
 * storm scanner), and it resets the seen-set so alerts already active at
 * the new home are surfaced as fresh.
 *
 * What "fresh" means: an alert id not seen on the previous poll for this
 * place. Fresh alerts are what the UI announces / plays tones for / fires
 * OS notifications about; the full list is what the Alerts scene and the
 * ticker render.
 */

export interface AlertUpdate {
  /** All currently-active alerts for the watched place. */
  alerts: WeatherAlert[];
  /** Alerts not present on the previous poll (or active at a newly-set home). */
  fresh: WeatherAlert[];
  /** True while any active alert is Severe or Extreme. */
  severeActive: boolean;
}

export function isSevereAlert(a: WeatherAlert): boolean {
  return a.severity === "Extreme" || a.severity === "Severe";
}

export class AlertWatcher {
  private place: Place | null = null;
  private seenIds = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(u: AlertUpdate) => void>();
  private generation = 0;

  constructor(
    private readonly weather: WeatherService,
    private readonly pollMs = 60_000
  ) {}

  subscribe(fn: (u: AlertUpdate) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Begin polling. Safe to call repeatedly; no-ops while running. */
  start(place: Place): void {
    if (this.timer) return;
    this.place = place;
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), this.pollMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.generation++;
  }

  /** Re-point at a new home. Clears the seen-set so alerts already in
   *  effect there announce as fresh — the user must never silently sit
   *  inside a warning they weren't told about. */
  setPlace(place: Place): void {
    if (this.place && this.place.id === place.id) return;
    this.place = place;
    this.seenIds.clear();
    this.generation++;
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const place = this.place;
    if (!place) return;
    const gen = this.generation;
    let alerts: WeatherAlert[];
    try {
      alerts = await this.weather.getActiveAlerts(place);
    } catch {
      // Network error or NWS outage — keep polling, keep previous state.
      return;
    }
    // A setPlace()/stop() while we awaited makes this result stale.
    if (gen !== this.generation) return;

    const fresh = alerts.filter((a) => !this.seenIds.has(a.id));
    this.seenIds = new Set(alerts.map((a) => a.id));
    const update: AlertUpdate = {
      alerts,
      fresh,
      severeActive: alerts.some(isSevereAlert)
    };
    for (const fn of this.listeners) fn(update);
  }
}
