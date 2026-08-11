import type { ReactElement } from "react";
import type { ThemeId } from "../../core/settings/themes";
import type { RainViewerClient } from "../../core/weather/RainViewerClient";
import type { WeatherAlert } from "../../core/types";

import { CurrentConditionsView } from "./CurrentConditionsView";
import { HourlyForecastView } from "./HourlyForecastView";
import { ExtendedForecastView } from "./ExtendedForecastView";
import { AlertsView } from "./AlertsView";
import { LocalRadarView } from "./LocalRadarView";
import { LocalForecastView } from "./LocalForecastView";
import { DetailedConditionsView } from "./DetailedConditionsView";
import { FeelsLikeView } from "./FeelsLikeView";
import { PrecipOutlookView } from "./PrecipOutlookView";
import { WeekendForecastView } from "./WeekendForecastView";
import { OvernightForecastView } from "./OvernightForecastView";
import { AlmanacView } from "./AlmanacView";
import { TravelCitiesView } from "./TravelCitiesView";
import { TemperatureTrendView } from "./TemperatureTrendView";
import { TrafficView } from "./TrafficView";
import { AirportDelaysView } from "./AirportDelaysView";

import type { CurrentConditionsData } from "../../core/scenes/scenes/CurrentConditionsScene";
import type { HourlyForecastData } from "../../core/scenes/scenes/HourlyForecastScene";
import type { ExtendedForecastData } from "../../core/scenes/scenes/ExtendedForecastScene";
import type { AlertsData } from "../../core/scenes/scenes/AlertsScene";
import type { LocalRadarData } from "../../core/scenes/scenes/LocalRadarScene";
import type { LocalForecastData } from "../../core/scenes/scenes/LocalForecastScene";
import type { DetailedConditionsData } from "../../core/scenes/scenes/DetailedConditionsScene";
import type { FeelsLikeData } from "../../core/scenes/scenes/FeelsLikeScene";
import type { PrecipOutlookData } from "../../core/scenes/scenes/PrecipOutlookScene";
import type { WeekendForecastData } from "../../core/scenes/scenes/WeekendForecastScene";
import type { OvernightForecastData } from "../../core/scenes/scenes/OvernightForecastScene";
import type { AlmanacData } from "../../core/scenes/scenes/AlmanacScene";
import type { TravelCitiesData } from "../../core/scenes/scenes/TravelCitiesScene";
import type { TemperatureTrendData } from "../../core/scenes/scenes/TemperatureTrendScene";
import type { TrafficData } from "../../core/scenes/scenes/TrafficScene";
import type { AirportDelaysData } from "../../core/scenes/scenes/AirportDelaysScene";

/**
 * (themeId, sceneId) → view resolution.
 *
 * The default table is what every theme renders today. THEME_VIEWS is the
 * extension point the era-authentic renderers plug into WITHOUT touching
 * the default views or the stage: the WS3000/WSJr text-page stack, the
 * IntelliStar 2 LOT8s windowed layout, and the Weatherscan V2 L-bar are
 * all per-theme *structural* variants (different DOM, not different CSS),
 * which the previous flat switch statement had no seam for.
 *
 * Accessibility invariant for theme overrides: a variant view renders the
 * SAME scene data with the same semantic structure (headings, tables,
 * sr-only content) — only the visual arrangement may differ.
 */

export interface SceneRenderContext {
  data: unknown;
  rainviewer: RainViewerClient;
  alerts: WeatherAlert[];
}

export type SceneRenderer = (ctx: SceneRenderContext) => ReactElement;

const DEFAULT_VIEWS: Record<string, SceneRenderer> = {
  current:       (c) => <CurrentConditionsView data={c.data as CurrentConditionsData} />,
  detailed:      (c) => <DetailedConditionsView data={c.data as DetailedConditionsData} />,
  feelslike:     (c) => <FeelsLikeView data={c.data as FeelsLikeData} />,
  radar:         (c) => <LocalRadarView data={c.data as LocalRadarData} rainviewer={c.rainviewer} alerts={c.alerts} />,
  localforecast: (c) => <LocalForecastView data={c.data as LocalForecastData} />,
  hourly:        (c) => <HourlyForecastView data={c.data as HourlyForecastData} />,
  extended:      (c) => <ExtendedForecastView data={c.data as ExtendedForecastData} />,
  overnight:     (c) => <OvernightForecastView data={c.data as OvernightForecastData} />,
  weekend:       (c) => <WeekendForecastView data={c.data as WeekendForecastData} />,
  precip:        (c) => <PrecipOutlookView data={c.data as PrecipOutlookData} />,
  temptrend:     (c) => <TemperatureTrendView data={c.data as TemperatureTrendData} />,
  almanac:       (c) => <AlmanacView data={c.data as AlmanacData} />,
  travel:        (c) => <TravelCitiesView data={c.data as TravelCitiesData} />,
  traffic:       (c) => <TrafficView data={c.data as TrafficData} />,
  airport:       (c) => <AirportDelaysView data={c.data as AirportDelaysData} />,
  alerts:        (c) => <AlertsView data={c.data as AlertsData} />,
};

/** Per-theme structural overrides. Empty today — the v1.0 era renderers
 *  (WS3000 text pages, LOT8s frame, L-bar) register here. */
const THEME_VIEWS: Partial<Record<ThemeId, Partial<Record<string, SceneRenderer>>>> = {
  "ws4000-v2": {
    /**
     * The 2005 radar redesign, and the first entry in this table.
     *
     * `WS4000_Simulator_v2_-_Local_Radar.jpg` shows a light off-white
     * basemap with red state borders, where every other machine's radar sat
     * on dark navy. Same view, same data, same storm table; one different
     * tile set. That is the split this table exists for, and it beats
     * threading a themeId into a view with no other use for one.
     *
     * The pink header and its PRECIP ramp are NOT here: the capture puts the
     * ramp inside the header band, which is frame chrome, not scene content.
     */
    radar: (c) => (
      <LocalRadarView
        data={c.data as LocalRadarData}
        rainviewer={c.rainviewer}
        alerts={c.alerts}
        baseMap="light"
      />
    ),
  },
};

export function resolveSceneView(themeId: ThemeId, sceneId: string): SceneRenderer | null {
  return THEME_VIEWS[themeId]?.[sceneId] ?? DEFAULT_VIEWS[sceneId] ?? null;
}
