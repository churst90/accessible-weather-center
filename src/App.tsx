import { useEffect, useMemo, useRef, useState } from "react";
import { NwsClient } from "./core/weather/NwsClient";
import { RainViewerClient } from "./core/weather/RainViewerClient";
import { FaaClient } from "./core/weather/FaaClient";
import { WeatherService } from "./core/weather/WeatherService";
import { StormScanner, describeStorm, type StormEvent } from "./core/radar/StormScanner";
import { PlacesStore, defaultPlaces } from "./core/places/PlacesStore";
import { SettingsStore } from "./core/settings/SettingsStore";
import { getTheme, applyTheme, getSceneOrder, type ThemeId } from "./core/settings/themes";
import { getSceneBackground } from "./core/settings/backgroundCatalog";
import type { NarratorId } from "./audio/manifests/narratorSchema";
import { SceneScheduler, type SchedulerEvent } from "./core/scenes/SceneScheduler";
import { CurrentConditionsScene, type CurrentConditionsData } from "./core/scenes/scenes/CurrentConditionsScene";
import { HourlyForecastScene, type HourlyForecastData } from "./core/scenes/scenes/HourlyForecastScene";
import { ExtendedForecastScene, type ExtendedForecastData } from "./core/scenes/scenes/ExtendedForecastScene";
import { AlertsScene, type AlertsData } from "./core/scenes/scenes/AlertsScene";
import { LocalRadarScene, type LocalRadarData } from "./core/scenes/scenes/LocalRadarScene";
import { LocalForecastScene, type LocalForecastData } from "./core/scenes/scenes/LocalForecastScene";
import { DetailedConditionsScene, type DetailedConditionsData } from "./core/scenes/scenes/DetailedConditionsScene";
import { FeelsLikeScene, type FeelsLikeData } from "./core/scenes/scenes/FeelsLikeScene";
import { PrecipOutlookScene, type PrecipOutlookData } from "./core/scenes/scenes/PrecipOutlookScene";
import { WeekendForecastScene, type WeekendForecastData } from "./core/scenes/scenes/WeekendForecastScene";
import { OvernightForecastScene, type OvernightForecastData } from "./core/scenes/scenes/OvernightForecastScene";
import { AlmanacScene, type AlmanacData } from "./core/scenes/scenes/AlmanacScene";
import { TravelCitiesScene, type TravelCitiesData } from "./core/scenes/scenes/TravelCitiesScene";
import { StormTrackerScene, type StormTrackerData } from "./core/scenes/scenes/StormTrackerScene";
import { TemperatureTrendScene, type TemperatureTrendData } from "./core/scenes/scenes/TemperatureTrendScene";
import { TrafficScene, type TrafficData } from "./core/scenes/scenes/TrafficScene";
import { AirportDelaysScene, type AirportDelaysData } from "./core/scenes/scenes/AirportDelaysScene";
import type { Scene } from "./core/scenes/Scene";

import { WebSpeechTts } from "./a11y/TtsService";
import { AnnouncementQueue } from "./a11y/AnnouncementQueue";
import { KeyboardRouter } from "./a11y/KeyboardRouter";
import { AnnouncerContext } from "./a11y/AnnouncerContext";

import { AudioMixer } from "./audio/AudioMixer";
import { MusicPlayer } from "./audio/MusicPlayer";
import { ClipLibrary } from "./audio/ClipLibrary";
import { AlertTones } from "./audio/AlertTones";
import { PhraseSequencer } from "./audio/PhraseSequencer";
import { composeCurrentConditions, composeExtendedForecast, composeHourlyForecast, composeAlerts, composeRadar, composeLocalForecast, composeOvernightForecast, composeWeekendForecast, composeSceneIntro } from "./audio/PhraseComposer";

import { setIconBase, setIconResolution, chooseIcon } from "./ui/weatherscan/WeatherIcon";
import { WeatherscanFrame } from "./ui/weatherscan/WeatherscanFrame";
import { AnnouncementRegion } from "./ui/semantic/AnnouncementRegion";
import { HelpDialog } from "./ui/semantic/HelpDialog";
import { CurrentConditionsView } from "./ui/scenes/CurrentConditionsView";
import { HourlyForecastView } from "./ui/scenes/HourlyForecastView";
import { ExtendedForecastView } from "./ui/scenes/ExtendedForecastView";
import { AlertsView } from "./ui/scenes/AlertsView";
import { LocalRadarView } from "./ui/scenes/LocalRadarView";
import { LocalForecastView } from "./ui/scenes/LocalForecastView";
import { DetailedConditionsView } from "./ui/scenes/DetailedConditionsView";
import { FeelsLikeView } from "./ui/scenes/FeelsLikeView";
import { PrecipOutlookView } from "./ui/scenes/PrecipOutlookView";
import { WeekendForecastView } from "./ui/scenes/WeekendForecastView";
import { OvernightForecastView } from "./ui/scenes/OvernightForecastView";
import { AlmanacView } from "./ui/scenes/AlmanacView";
import { TravelCitiesView } from "./ui/scenes/TravelCitiesView";
import { StormTrackerView } from "./ui/scenes/StormTrackerView";
import { TemperatureTrendView } from "./ui/scenes/TemperatureTrendView";
import { TrafficView } from "./ui/scenes/TrafficView";
import { AirportDelaysView } from "./ui/scenes/AirportDelaysView";
import { PlacesMode } from "./ui/mapnav/PlacesMode";
import { MapNavView } from "./ui/mapnav/MapNavView";
import { SettingsPanel } from "./ui/settings/SettingsPanel";

import "./ui/weatherscan/weatherscan.css";

type ViewMode = "scenes" | "places" | "mapnav";

/** All known flavors — order doesn't matter here, the theme determines display order. */
const FLAVORS: ReadonlyArray<{ id: string; title: string }> = [
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

export default function App() {
  const services = useMemo(() => buildServices(), []);
  const [event, setEvent] = useState<SchedulerEvent>({ status: "stopped", index: 0, scene: null, interrupted: false });
  const [viewMode, setViewMode] = useState<ViewMode>("scenes");
  const [audioStarted, setAudioStarted] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [alertsList, setAlertsList] = useState<import("./core/types").WeatherAlert[]>([]);
  const [alertTickerText, setAlertTickerText] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [placesList, setPlacesList] = useState(services.places.list());
  const [activeThemeId, setActiveThemeId] = useState<ThemeId>(services.settings.get().theme as ThemeId);
  const [ldlIconName, setLdlIconName] = useState<string | undefined>(undefined);
  const startedRef = useRef(false);
  const audioStartedRef = useRef(false);
  const lastAlertIdsRef = useRef<Set<string>>(new Set());
  const viewModeRef = useRef<ViewMode>(viewMode);
  viewModeRef.current = viewMode;

  // Wire scheduler subscription.
  useEffect(() => services.scheduler.subscribe(setEvent), [services]);

  // Keep the places list reactive to store changes (add/remove/set home).
  // Also push the active home into the scheduler AND storm scanner so
  // both refetch for the new location when the user changes home.
  useEffect(() => {
    return services.places.subscribe((list) => {
      setPlacesList(list);
      const home = list.find((p) => p.isHome) ?? list[0];
      if (home) {
        const themeId = services.settings.get().theme as ThemeId;
        services.scheduler.setContext({ place: home, weather: services.weather, themeId });
        services.stormScanner.setPlace(home);
      }
    });
  }, [services]);

  // Keep the scheduler context's themeId in sync when the user changes
  // themes — scenes that read it (ExtendedForecastScene) re-render with
  // the era-appropriate title and period count.
  useEffect(() => {
    return services.settings.subscribe((s) => {
      const home = services.places.list().find((p) => p.isHome) ?? services.places.list()[0];
      if (home) {
        services.scheduler.setContext({
          place: home,
          weather: services.weather,
          themeId: s.theme as ThemeId,
        });
      }
    });
  }, [services]);

  // Reactive flavor predicate.
  useEffect(() => {
    services.scheduler.setEnabledPredicate((id) => services.settings.isFlavorEnabled(id));
    return services.settings.subscribe(() => {
      services.scheduler.setEnabledPredicate((id) => services.settings.isFlavorEnabled(id));
    });
  }, [services]);

  // Apply theme on mount and when settings change.
  // Also updates music filtering, icon set, and scene order to match the active theme.
  useEffect(() => {
    let prevThemeId: ThemeId | null = null;
    const apply = (s: typeof services.settings extends { get(): infer R } ? R : never) => {
      const themeId = s.theme as ThemeId;
      setActiveThemeId(themeId);
      const theme = getTheme(themeId);
      applyTheme(theme);
      document.body.dataset.theme = themeId;
      document.body.dataset.contrast = s.highContrast ? "high" : "normal";
      // Theme-specific icon set
      setIconBase(theme.iconSet);
      setIconResolution(theme.iconResolution ?? null);
      // Theme-specific music filtering — deferred to avoid disrupting
      // playback during initialization
      try { services.music.setMusicTags(theme.musicTags); } catch { /* ignore */ }
      // Reorder scenes to match the era-authentic loop when theme changes.
      // Stop any playing narration first — the old clips belong to the
      // previous theme's narrator and shouldn't overlap into the new one.
      if (themeId !== prevThemeId) {
        services.sequencer.stop();
        services.scheduler.setSceneOrder(getSceneOrder(themeId));
        prevThemeId = themeId;
      }
    };
    apply(services.settings.get());
    return services.settings.subscribe(apply);
  }, [services]);

  // Music master enable + auto-cycle: react to setting changes.
  useEffect(() => {
    return services.settings.subscribe((s) => {
      services.music.setEnabled(s.musicEnabled);
      services.scheduler.setAutoCycle(s.autoCycle);
      services.scheduler.setPostNarrationDelay(s.postNarrationDelay);
    });
  }, [services]);

  // Start the storm scanner. It polls independently of the scene cycle;
  // scenes read its snapshot on demand. Re-points on home change below.
  useEffect(() => {
    const home = services.places.home();
    if (home) services.stormScanner.start(home);
    return () => services.stormScanner.stop();
  }, [services]);

  // Tier 2 announcements: storm observations from radar (nowcasts).
  // Note this is SEPARATE from NWS alerts (Tier 1) polled below — both
  // routes can fire, with NWS always taking priority.
  useEffect(() => {
    return services.stormScanner.subscribe((e: StormEvent) => {
      const home = services.places.home();
      if (!home) return;
      if (e.kind === "storm-new" && e.storm) {
        void services.announcer.announce(
          `New storm detected. ${describeStorm(e.storm, home.coord)}`,
          "polite"
        );
      } else if (e.kind === "storm-approaching" && e.storm) {
        void services.announcer.announce(
          `Storm approaching. ${describeStorm(e.storm, home.coord)}`,
          "assertive"
        );
      } else if (e.kind === "storm-intensified" && e.storm) {
        void services.announcer.announce(
          `Storm has intensified. ${describeStorm(e.storm, home.coord)}`,
          "polite"
        );
      }
    });
  }, [services]);

  const [mnemonicDone, setMnemonicDone] = useState(false);

  // Start the loop on mount — but hold until the startup mnemonic has
  // finished playing. Otherwise the scheduler's first scene-change effect
  // calls sequencer.stop() mid-mnemonic and cuts off the three-bell jingle.
  useEffect(() => {
    if (startedRef.current) return;
    if (!mnemonicDone) return;
    startedRef.current = true;
    void services.announcer.announce(
      "Accessible Weather Center is ready. Use Tab and Shift+Tab to change scenes. " +
      "Arrow keys navigate within the current scene. Press M for favorites, " +
      "N for map navigation, comma for settings, question mark for help.",
      "polite"
    );
    void services.scheduler.start();
  }, [services, mnemonicDone]);

  // On every scene change: stop any playing clips and unduck music,
  // then announce via NVDA and optionally play AJ clips.
  useEffect(() => {
    if (!event.scene) return;
    const scene = event.scene;
    const settings = services.settings.get();

    // Always stop previous clips and restore music immediately.
    services.sequencer.stop();

    // Per-scene background swap for themes that rotated backgrounds per
    // scene authentically (WS4000, WSJr, Weatherscan Local). IS1/IS2/WSXL
    // and Weatherscan V1/V2 use a single theme-level background (rotating
    // pool or fixed) instead and return null here.
    const sceneBg = getSceneBackground(settings.theme as ThemeId, scene.id);
    if (sceneBg) {
      document.documentElement.style.setProperty("--ws-bg-image", `url("${sceneBg}")`);
    }

    // NVDA / announcer always reads the full scene text.
    void services.announcer.announce(scene.speech, "polite");

    // If voice is on, play clips in parallel (clips only, no TTS).
    // Narrator is either the user's explicit pick or the theme's default.
    if (settings.useAjVoice) {
      let script = null;
      const narrator: NarratorId = (settings.narrator as NarratorId) ?? getTheme(settings.theme as ThemeId).defaultNarrator;

      if (scene.id === "current") {
        const data = scene.data as CurrentConditionsData;
        if (data.observation) {
          script = composeCurrentConditions(data.observation, data.place.name, narrator);
          // Update the LDL section icon so it tracks the local condition.
          setLdlIconName(chooseIcon(data.observation.conditionText, true));
        }
      } else if (scene.id === "extended") {
        const data = scene.data as ExtendedForecastData;
        if (data.periods.length > 0) {
          // Narration era buckets: 3-day and 5-day share the "Extended
          // Forecast" phrasing pool; 7-day uses "7-Day Outlook" / "Week
          // Ahead" clips. Visual day count (data.style) is independent.
          const narrationEra = data.style === "7-day" ? "7-day" : "5-day";
          script = composeExtendedForecast(data.periods, data.place.name, narrator, narrationEra, data.title);
        }
      } else if (scene.id === "hourly") {
        const data = scene.data as HourlyForecastData;
        if (data.hours.length > 0) {
          script = composeHourlyForecast(data.hours, data.place.name, narrator);
        }
      } else if (scene.id === "radar") {
        script = composeRadar(narrator);
      } else if (scene.id === "alerts") {
        const data = scene.data as AlertsData;
        script = composeAlerts(data.alerts, data.place.name, narrator);
      } else if (scene.id === "localforecast") {
        const data = scene.data as LocalForecastData;
        if (data.periods.length > 0) {
          script = composeLocalForecast(data.periods, data.place.name, narrator);
        }
      } else if (scene.id === "overnight") {
        const data = scene.data as OvernightForecastData;
        script = composeOvernightForecast(data.period ?? null, data.place.name, narrator);
      } else if (scene.id === "weekend") {
        const data = scene.data as WeekendForecastData;
        if (data.periods.length > 0) {
          script = composeWeekendForecast(data.periods, data.place.name, narrator);
        }
      } else {
        // All other scenes: play a scene intro clip if available
        script = composeSceneIntro(scene.id, narrator);
      }

      if (script) {
        const narration = services.sequencer.play(script, settings.clipConfidence);
        services.scheduler.setNarrationPromise(narration);
      }
    }
  }, [event.scene, services]);

  // Poll active alerts. Severe/Extreme alerts trigger an interrupt:
  // auto-jump to alerts scene, orange visual takeover.
  useEffect(() => {
    const home = services.places.home();
    if (!home) return;
    let cancelled = false;
    const refresh = async () => {
      let list;
      try {
        list = await services.weather.getActiveAlerts(home);
      } catch {
        // Network error or NWS outage — keep polling, don't crash.
        // Previous alert state is preserved.
        return;
      }
      if (cancelled) return;
      setAlertCount(list.length);
      setAlertsList(list);
      const fresh = list.filter((a) => !lastAlertIdsRef.current.has(a.id));
      lastAlertIdsRef.current = new Set(list.map((a) => a.id));

      // Check if any active alert is severe-level.
      const hasSevere = list.some(
        (a) => a.severity === "Extreme" || a.severity === "Severe"
      );

      for (const a of fresh) {
        const severe = a.severity === "Extreme" || a.severity === "Severe";
        if (severe) {
          // Quick attention tone — the NWS 4-beep pattern. The scene
          // interrupt below will transition to the alerts scene, which
          // plays the full per-narrator beep + spoken warning sequence
          // via composeAlerts.
          void services.clips.play("warning_beep");
        } else {
          void services.alertTones.playAdvisory();
        }
        void services.announcer.announce(`${a.event}. ${a.headline}`, "assertive");

        // Fire an OS-level toast notification so the user sees it even when
        // minimized to the system tray. The IPC bridge is safe to call —
        // it no-ops if Notification isn't supported.
        if (window.awc?.notify) {
          void window.awc.notify(
            a.event,
            `${a.headline}\n${a.affectedAreaDescription}`
          );
        }
      }

      // Build ticker text from severe alerts.
      const severeAlerts = list.filter(
        (a) => a.severity === "Extreme" || a.severity === "Severe"
      );
      if (severeAlerts.length > 0) {
        const ticker = severeAlerts
          .map((a) => `${a.event}: ${a.headline}`)
          .join("  ///  ");
        setAlertTickerText(ticker);
      } else {
        setAlertTickerText("");
      }

      // Interrupt: if there are fresh severe alerts, jump to alerts scene.
      if (fresh.some((a) => a.severity === "Extreme" || a.severity === "Severe")) {
        void services.scheduler.interrupt("alerts");
      }
      // Clear interrupt when no more severe alerts are active.
      if (!hasSevere && services.scheduler.isInterrupted()) {
        void services.scheduler.clearInterrupt();
      }
    };
    void refresh();
    const id = setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [services]);

  // Register keyboard shortcuts.
  useEffect(() => {
    const r = services.router;
    const detach = r.attach(window);
    const offs = [
      r.register({
        id: "next-scene", keys: "Tab", group: "Scenes",
        description: "Next scene",
        handler: () => {
          if (viewModeRef.current !== "scenes") return;
          void services.scheduler.next();
        }
      }),
      r.register({
        id: "prev-scene", keys: "shift+Tab", group: "Scenes",
        description: "Previous scene",
        handler: () => {
          if (viewModeRef.current !== "scenes") return;
          void services.scheduler.prev();
        }
      }),
      r.register({
        id: "toggle-pause", keys: " ", group: "Scenes",
        description: "Pause or resume the loop",
        handler: () => {
          if (viewModeRef.current !== "scenes") return;
          if (services.scheduler.getStatus() === "running") {
            services.scheduler.pause();
            services.sequencer.stop();
            void services.announcer.announce("Paused.", "assertive");
          } else {
            services.scheduler.resume();
            void services.announcer.announce("Playing.", "assertive");
          }
        }
      }),
      r.register({
        id: "scene-1", keys: "1", group: "Scenes", description: "Jump to current conditions",
        handler: () => {
          if (viewModeRef.current !== "scenes") return;
          void services.scheduler.jumpToId("current");
        }
      }),
      r.register({
        id: "scene-2", keys: "2", group: "Scenes", description: "Jump to local radar",
        handler: () => {
          if (viewModeRef.current !== "scenes") return;
          void services.scheduler.jumpToId("radar");
        }
      }),
      r.register({
        id: "scene-3", keys: "3", group: "Scenes", description: "Jump to hourly forecast",
        handler: () => {
          if (viewModeRef.current !== "scenes") return;
          void services.scheduler.jumpToId("hourly");
        }
      }),
      r.register({
        id: "scene-4", keys: "4", group: "Scenes", description: "Jump to extended forecast",
        handler: () => {
          if (viewModeRef.current !== "scenes") return;
          void services.scheduler.jumpToId("extended");
        }
      }),
      r.register({
        id: "scene-5", keys: "5", group: "Scenes", description: "Jump to alerts",
        handler: () => {
          if (viewModeRef.current !== "scenes") return;
          void services.scheduler.jumpToId("alerts");
        }
      }),
      r.register({
        id: "toggle-favorites", keys: "m", group: "Favorites",
        description: "Toggle favorites list",
        handler: () => {
          setViewMode((v) => {
            const next: ViewMode = v === "scenes" ? "places" : "scenes";
            // Cancel any in-flight speech so the transition announcement is
            // the next thing the user hears, not queued behind a stale one.
            services.announcer.cancel();
            if (next === "places") {
              services.scheduler.pause();
              const list = services.places.list();
              const intro =
                list.length === 0
                  ? "Favorites. No places saved. Press Z to add a ZIP code. Press M to return to scenes."
                  : `Favorites. ${list.length} place${list.length === 1 ? "" : "s"} saved. Up and down arrows to walk the list. Enter to set as home. Z to add a ZIP. Delete to remove. M to return to scenes.`;
              void services.announcer.announce(intro, "assertive");
            } else {
              void services.scheduler.resume();
              void services.announcer.announce("Returning to scenes.", "assertive");
            }
            return next;
          });
        }
      }),
      r.register({
        id: "toggle-mapnav", keys: "n", group: "Map",
        description: "Toggle map navigation mode",
        handler: () => {
          setViewMode((v) => {
            const next: ViewMode = v === "mapnav" ? "scenes" : "mapnav";
            services.announcer.cancel();
            if (next === "mapnav") {
              services.scheduler.pause();
              void services.announcer.announce(
                "Entering map navigation. Tab to switch modes, arrows to navigate, N or Escape to exit.",
                "assertive"
              );
            } else {
              void services.scheduler.resume();
              void services.announcer.announce("Returning to scenes.", "assertive");
            }
            return next;
          });
        }
      }),
      r.register({
        id: "toggle-music", keys: "ctrl+m", group: "Audio",
        description: "Mute or unmute background music",
        handler: () => {
          const cur = services.settings.get().musicEnabled;
          services.settings.update({ musicEnabled: !cur });
          void services.announcer.announce(cur ? "Music muted." : "Music on.", "assertive");
        }
      }),
      r.register({
        id: "skip-music", keys: "ctrl+ArrowRight", group: "Audio",
        description: "Skip to next music track",
        handler: () => {
          void services.music.skip();
          void services.announcer.announce("Skipping music track.", "polite");
        }
      }),
      r.register({
        id: "open-settings", keys: ",", group: "Settings",
        description: "Open settings panel",
        handler: () => setSettingsOpen(true)
      }),
      r.register({
        id: "open-help", keys: "?", group: "Help", description: "Open help dialog",
        handler: () => setHelpOpen(true)
      }),
      r.register({
        id: "stop-speech", keys: "Escape", group: "Speech", description: "Silence current speech",
        handler: () => {
          services.announcer.cancel();
          services.sequencer.abort();
        }
      })
    ];
    return () => {
      offs.forEach((off) => off());
      detach();
    };
  }, [services]);

  // Audio unlock: Try to start immediately (Electron allows autoplay).
  // If the AudioContext is suspended (browser), fall back to first gesture.
  useEffect(() => {
    if (audioStartedRef.current) return;
    const start = () => {
      // Synchronous ref guard. setAudioStarted is async — without this,
      // a race between ctx.resume().then(start) and the keydown/click
      // listener fires start() twice, and the second clips.play("mnemonic")
      // routes through PhraseSequencer.playOne which stops the first.
      if (audioStartedRef.current) return;
      audioStartedRef.current = true;
      const ctx = services.mixer.ensureStarted();
      if (ctx.state === "suspended") void ctx.resume();
      setAudioStarted(true);
      void services.clips.play("mnemonic").finally(() => setMnemonicDone(true));
      void services.music.start();
    };
    // Attempt immediate start — works in Electron where autoplay is allowed.
    const ctx = services.mixer.ensureStarted();
    if (ctx.state === "running") {
      start();
      return;
    }
    void ctx.resume().then(start).catch(() => {
      // Autoplay blocked — wait for user gesture.
    });
    window.addEventListener("keydown", start, { once: true });
    window.addEventListener("click", start, { once: true });
    return () => {
      window.removeEventListener("keydown", start);
      window.removeEventListener("click", start);
    };
  }, [services]);

  return (
    <AnnouncerContext.Provider value={services.announcer}>
      <AnnouncementRegion queue={services.announcer} />
      <WeatherscanFrame
        sceneTitle={
          viewMode === "places" ? "Favorites"
          : viewMode === "mapnav" ? "Map Navigation"
          : event.scene?.title ?? "Loading"
        }
        alertCount={alertCount}
        statusHint={!audioStarted ? "Press any key to start audio" : undefined}
        severeInterrupt={event.interrupted}
        tickerText={alertTickerText}
        themeId={activeThemeId}
        faa={services.faa}
        ldlIconName={ldlIconName}
      >
        {viewMode === "places" ? (
          <PlacesMode
            places={placesList}
            weather={services.weather}
            announcer={services.announcer}
            store={services.places}
            active
            onDrillIn={(place) => {
              services.places.setHome(place.id);
              services.announcer.cancel();
              void services.announcer.announce(
                `${place.name}, ${place.state} is now home. Returning to scenes.`,
                "assertive"
              );
              setViewMode("scenes");
              void services.scheduler.resume();
              void services.scheduler.jumpToId("current");
            }}
          />
        ) : viewMode === "mapnav" ? (
          <MapNavView
            place={placesList.find((p) => p.isHome) ?? placesList[0]}
            stormScanner={services.stormScanner}
            rainviewer={services.rainviewer}
            weather={services.weather}
            announcer={services.announcer}
            active
          />
        ) : (
          <SceneStage event={event} rainviewer={services.rainviewer} alerts={alertsList} />
        )}
      </WeatherscanFrame>
      <SettingsPanel
        store={services.settings}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        flavors={FLAVORS}
      />
      <HelpDialog
        router={services.router}
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
    </AnnouncerContext.Provider>
  );
}

function SceneStage({
  event,
  rainviewer,
  alerts = []
}: {
  event: SchedulerEvent;
  rainviewer: RainViewerClient;
  alerts?: import("./core/types").WeatherAlert[];
}) {
  const scene = event.scene;
  if (!scene) return <p>Loading…</p>;
  switch (scene.id) {
    case "current":
      return <CurrentConditionsView data={scene.data as CurrentConditionsData} />;
    case "detailed":
      return <DetailedConditionsView data={scene.data as DetailedConditionsData} />;
    case "feelslike":
      return <FeelsLikeView data={scene.data as FeelsLikeData} />;
    case "radar":
      return <LocalRadarView data={scene.data as LocalRadarData} rainviewer={rainviewer} alerts={alerts} />;
    case "stormtracker":
      return <StormTrackerView data={scene.data as StormTrackerData} />;
    case "localforecast":
      return <LocalForecastView data={scene.data as LocalForecastData} />;
    case "hourly":
      return <HourlyForecastView data={scene.data as HourlyForecastData} />;
    case "extended":
      return <ExtendedForecastView data={scene.data as ExtendedForecastData} />;
    case "overnight":
      return <OvernightForecastView data={scene.data as OvernightForecastData} />;
    case "weekend":
      return <WeekendForecastView data={scene.data as WeekendForecastData} />;
    case "precip":
      return <PrecipOutlookView data={scene.data as PrecipOutlookData} />;
    case "temptrend":
      return <TemperatureTrendView data={scene.data as TemperatureTrendData} />;
    case "almanac":
      return <AlmanacView data={scene.data as AlmanacData} />;
    case "travel":
      return <TravelCitiesView data={scene.data as TravelCitiesData} />;
    case "traffic":
      return <TrafficView data={scene.data as TrafficData} />;
    case "airport":
      return <AirportDelaysView data={scene.data as AirportDelaysData} />;
    case "alerts":
      return <AlertsView data={scene.data as AlertsData} />;
    default:
      return <p>{scene.title}</p>;
  }
}

function buildServices() {
  const settings = new SettingsStore();
  const tts = new WebSpeechTts();
  const announcer = new AnnouncementQueue(tts, "both");
  const router = new KeyboardRouter();

  const mixer = new AudioMixer();
  const music = new MusicPlayer(mixer);
  music.setEnabled(settings.get().musicEnabled);
  const sequencer = new PhraseSequencer(mixer);
  const clips = new ClipLibrary(sequencer);
  const alertTones = new AlertTones(mixer);

  const nws = new NwsClient("AccessibleWeatherCenter/0.4 (contact: configure-me@example.com)");
  const faa = new FaaClient();
  const rainviewer = new RainViewerClient();
  const weather = new WeatherService(nws);
  const places = new PlacesStore(defaultPlaces());
  const stormScanner = new StormScanner(rainviewer);

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
    settings, tts, announcer, router,
    mixer, music, clips, alertTones, sequencer,
    nws, faa, rainviewer, weather, places, scheduler, stormScanner
  };
}
