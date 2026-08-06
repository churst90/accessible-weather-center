import type { Place } from "../types";
import type { WeatherService } from "../weather/WeatherService";
import type { ThemeId } from "../settings/themes";

/**
 * A Scene is one screen in the Weatherscan loop. Each scene is a self-contained
 * unit that knows: how to fetch its own data, how long it should hold, what
 * to speak, what music cue to use, and how to render itself.
 *
 * Splitting render() (a React node) from speak() (a string) is the whole game:
 * the visual skin and the screen reader output never go out of sync because
 * they're produced by the same scene from the same data snapshot.
 */
export interface SceneContext {
  place: Place;
  weather: WeatherService;
  /** Active theme id — lets scenes adjust era-specific behavior (scene
   *  title, how many forecast periods to render, etc.). */
  themeId?: ThemeId;
}

export interface RenderedScene<TData = unknown> {
  /** Stable id for keying React components and shortcut numbers. */
  id: string;
  /** Human-readable label, e.g. "Current Conditions". */
  title: string;
  /** Pre-fetched, normalized data the view will render. */
  data: TData;
  /** Plain-text TTS script to read on entry. */
  speech: string;
  /** Suggested hold time in milliseconds. */
  holdMs: number;
}

export interface Scene<TData = unknown> {
  readonly id: string;
  readonly title: string;
  readonly defaultHoldMs: number;
  prepare(ctx: SceneContext): Promise<RenderedScene<TData>>;
}
