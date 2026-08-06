import { NwsClient } from "./core/weather/NwsClient";
import { RainViewerClient } from "./core/weather/RainViewerClient";
import { FaaClient } from "./core/weather/FaaClient";
import { WeatherService } from "./core/weather/WeatherService";
import { StormScanner } from "./core/radar/StormScanner";
import { AlertWatcher } from "./core/alerts/AlertWatcher";
import { PlacesStore, defaultPlaces } from "./core/places/PlacesStore";
import { SettingsStore } from "./core/settings/SettingsStore";
import { getSceneOrder, type ThemeId } from "./core/settings/themes";
import { SceneScheduler } from "./core/scenes/SceneScheduler";
import { CurrentConditionsScene } from "./core/scenes/scenes/CurrentConditionsScene";
import { HourlyForecastScene } from "./core/scenes/scenes/HourlyForecastScene";
import { ExtendedForecastScene } from "./core/scenes/scenes/ExtendedForecastScene";
import { AlertsScene } from "./core/scenes/scenes/AlertsScene";
import { LocalRadarScene } from "./core/scenes/scenes/LocalRadarScene";
import { LocalForecastScene } from "./core/scenes/scenes/LocalForecastScene";
import { DetailedConditionsScene } from "./core/scenes/scenes/DetailedConditionsScene";
import { FeelsLikeScene } from "./core/scenes/scenes/FeelsLikeScene";
import { PrecipOutlookScene } from "./core/scenes/scenes/PrecipOutlookScene";
import { WeekendForecastScene } from "./core/scenes/scenes/WeekendForecastScene";
import { OvernightForecastScene } from "./core/scenes/scenes/OvernightForecastScene";
import { AlmanacScene } from "./core/scenes/scenes/AlmanacScene";
import { TravelCitiesScene } from "./core/scenes/scenes/TravelCitiesScene";
import { StormTrackerScene } from "./core/scenes/scenes/StormTrackerScene";
import { TemperatureTrendScene } from "./core/scenes/scenes/TemperatureTrendScene";
import { TrafficScene } from "./core/scenes/scenes/TrafficScene";
import { AirportDelaysScene } from "./core/scenes/scenes/AirportDelaysScene";
import type { Scene } from "./core/scenes/Scene";
import { AnnouncementQueue } from "./a11y/AnnouncementQueue";
import { KeyboardRouter } from "./a11y/KeyboardRouter";
import { AudioMixer } from "./audio/AudioMixer";
import { MusicPlayer } from "./audio/MusicPlayer";
import { ClipLibrary } from "./audio/ClipLibrary";
import { AlertTones } from "./audio/AlertTones";
import { PhraseSequencer } from "./audio/PhraseSequencer";
import { NwrPlayer } from "./audio/NwrPlayer";

/**
 * Constructs every service the application uses, wired together, exactly
 * once. Pure construction — no DOM access, no subscriptions, no timers
 * started (services start when App's effects call start()). Extracted from
 * App.tsx so the component file is wiring/UI only.
 */

/** All known flavors — order doesn't matter here, the theme determines display order. */
export const FLAVORS: ReadonlyArray<{ id: string; title: string }> = [
  { id: "current",      title: "Current Conditions" },
  { id: "localforecast", title: "Local Forecast" },
  { id: "radar",        title: "Local Radar" },
  { id: "extended",     title: "Extended Forecast" },
  { id: "hourly",       title: "Hourly Forecast" },
  { id: "travel",       title: "Travel Cities" },
  { id: "almanac",      title: "Almanac" },
  { id: "detailed",     title: "Detailed Conditions" },
  { id: "feelslike",    title: "Feels Like" },
  { id: "stormtracker", title: "Storm Tracker" },
  { id: "overnight",    title: "Overnight Forecast" },
  { id: "weekend",      title: "Weekend Forecast" },
  { id: "precip",       title: "Precipitation Outlook" },
  { id: "temptrend",    title: "Temperature Trend" },
  { id: "traffic",      title: "Traffic" },
  { id: "airport",      title: "Airport Delays" },
  { id: "alerts",       title: "Alerts" }
];

export type Services = ReturnType<typeof buildServices>;

export function buildServices() {
  const settings = new SettingsStore();
  // No built-in TTS by design: announcements reach the user through the
  // aria-live regions (their screen reader speaks them), and the only
  // app-generated speech is the recorded narrator clips.
  const announcer = new AnnouncementQueue();
  const router = new KeyboardRouter();

  const mixer = new AudioMixer();
  const music = new MusicPlayer(mixer);
  music.setEnabled(settings.get().musicEnabled);
  const sequencer = new PhraseSequencer(mixer);
  const clips = new ClipLibrary(sequencer);
  const alertTones = new AlertTones(mixer);
  const nwr = new NwrPlayer(mixer);

  const nws = new NwsClient("AccessibleWeatherCenter/0.12.0 (contact: codythurst@gmail.com)");
  const faa = new FaaClient();
  const rainviewer = new RainViewerClient();
  const weather = new WeatherService(nws);
  const places = new PlacesStore(defaultPlaces());
  const stormScanner = new StormScanner(rainviewer);
  const alertWatcher = new AlertWatcher(weather);

  const home = places.home()!;
  const sceneList: Scene[] = [
    new CurrentConditionsScene(),
    new LocalForecastScene(),
    new LocalRadarScene(stormScanner),
    new ExtendedForecastScene(),
    new HourlyForecastScene(),
    new TravelCitiesScene(() => places.list()),
    new AlmanacScene(),
    new DetailedConditionsScene(),
    new FeelsLikeScene(),
    new StormTrackerScene(stormScanner),
    new OvernightForecastScene(),
    new WeekendForecastScene(),
    new PrecipOutlookScene(),
    new TemperatureTrendScene(),
    new TrafficScene(),
    new AirportDelaysScene(faa),
    new AlertsScene()
  ];
  const scheduler = new SceneScheduler(
    sceneList,
    { place: home, weather },
    (id) => settings.isFlavorEnabled(id)
  );
  // Apply the initial theme's authentic scene order
  const initialTheme = settings.get().theme as ThemeId;
  scheduler.setSceneOrder(getSceneOrder(initialTheme));

  return {
    settings, announcer, router,
    mixer, music, clips, alertTones, sequencer, nwr,
    nws, faa, rainviewer, weather, places, scheduler, stormScanner, alertWatcher
  };
}
