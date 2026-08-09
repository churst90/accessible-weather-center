import { useEffect, useMemo, useRef, useState } from "react";
import { buildServices, FLAVORS } from "./bootstrap";
import type { RainViewerClient } from "./core/weather/RainViewerClient";
import { describeStorm, type StormEvent } from "./core/radar/StormScanner";
import { isSevereAlert, type AlertUpdate } from "./core/alerts/AlertWatcher";
import { getTheme, applyTheme, getSceneOrder, type ThemeId } from "./core/settings/themes";
import { getSceneBackground, pickBackground } from "./core/settings/backgroundCatalog";
import type { NarratorId } from "./audio/manifests/narratorSchema";
import type { SchedulerEvent } from "./core/scenes/SceneScheduler";
import type { CurrentConditionsData } from "./core/scenes/scenes/CurrentConditionsScene";
import type { ExtendedForecastData } from "./core/scenes/scenes/ExtendedForecastScene";
import type { HourlyForecastData } from "./core/scenes/scenes/HourlyForecastScene";
import type { AlertsData } from "./core/scenes/scenes/AlertsScene";
import type { LocalForecastData } from "./core/scenes/scenes/LocalForecastScene";
import type { OvernightForecastData } from "./core/scenes/scenes/OvernightForecastScene";
import type { WeekendForecastData } from "./core/scenes/scenes/WeekendForecastScene";

import { AnnouncerContext } from "./a11y/AnnouncerContext";
import { suggestCallSignForPlace, findStation } from "./audio/nwrStations";
import { composeCurrentConditions, composeExtendedForecast, composeHourlyForecast, composeAlerts, composeRadar, composeLocalForecast, composeOvernightForecast, composeWeekendForecast, composeSceneIntro } from "./audio/PhraseComposer";

import { setIconBase, setIconResolution, chooseIcon } from "./ui/weatherscan/WeatherIcon";
import { setProductEra } from "./audio/manifests/sceneSegments";
import { WeatherscanFrame } from "./ui/weatherscan/WeatherscanFrame";
import { AnnouncementRegion } from "./ui/semantic/AnnouncementRegion";
import { ErrorBoundary } from "./ui/semantic/ErrorBoundary";
import { HelpDialog } from "./ui/semantic/HelpDialog";
import { FirstRunSetup } from "./ui/semantic/FirstRunSetup";
import { SceneUnavailable } from "./ui/scenes/SceneUnavailable";
import { ProductUnavailable } from "./ui/scenes/ProductUnavailable";
import { getDevice, productAvailability, absentNote, resolveNarrator, type ProductId } from "./devices";
import { resolveSceneView } from "./ui/scenes/sceneRegistry";
import { PlacesMode } from "./ui/mapnav/PlacesMode";
import { MapNavView } from "./ui/mapnav/MapNavView";
import { SettingsPanel } from "./ui/settings/SettingsPanel";

import "./ui/weatherscan/weatherscan.css";

type ViewMode = "scenes" | "places" | "mapnav";

export default function App() {
  const services = useMemo(() => buildServices(), []);
  const [event, setEvent] = useState<SchedulerEvent>({ status: "stopped", index: 0, scene: null, interrupted: false, sceneToken: 0 });
  const [viewMode, setViewMode] = useState<ViewMode>("scenes");
  const [audioStarted, setAudioStarted] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [alertsList, setAlertsList] = useState<import("./core/types").WeatherAlert[]>([]);
  const alertsListRef = useRef<import("./core/types").WeatherAlert[]>([]);
  useEffect(() => { alertsListRef.current = alertsList; }, [alertsList]);
  const [alertTickerText, setAlertTickerText] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [placesList, setPlacesList] = useState(services.places.list());
  // Fresh install / fresh browser profile: nothing is in storage, so the
  // places list is a placeholder. Hold the scene cycle and every poller
  // until the user picks a home — otherwise we'd fetch and announce weather
  // for a location they never chose.
  const [needsSetup, setNeedsSetup] = useState(() => services.places.isFirstRun());
  const [activeThemeId, setActiveThemeId] = useState<ThemeId>(services.settings.get().theme as ThemeId);
  const [ldlIconName, setLdlIconName] = useState<string | undefined>(undefined);
  const startedRef = useRef(false);
  const audioStartedRef = useRef(false);
  /** The audio-unlock routine, exposed so a known-good user gesture (the
   *  first-run form submit) can trigger it directly rather than relying on
   *  the window-level listeners having seen the keystroke. */
  const unlockAudioRef = useRef<(() => void) | null>(null);
  const viewModeRef = useRef<ViewMode>(viewMode);
  viewModeRef.current = viewMode;
  /** Which scene is on screen, readable from service callbacks without
   *  re-subscribing them on every scene change. */
  const currentSceneIdRef = useRef<string | null>(null);
  currentSceneIdRef.current = event.scene?.id ?? null;

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
        // Same seam re-points NWS alert polling — the watcher resets its
        // seen-set so alerts already active at the new home announce fresh.
        services.alertWatcher.setPlace(home);
      }
    });
  }, [services]);

  // Keep the scheduler context's themeId in sync when the user changes
  // themes — scenes that read it (ExtendedForecastScene) re-render with
  // the era-appropriate title and period count.
  useEffect(() => {
    // Only re-enter the current scene when something the scheduler context
    // actually depends on changes — namely the home place or the active
    // theme. Without this guard, every settings update (volume nudges,
    // music toggle, NWR toggle, etc.) would call setContext() which
    // re-prepares the current scene and restarts narration. The user
    // perceives that as "pressing 1 keeps changing scenes."
    let lastPlaceKey: string | null = null;
    let lastThemeId: string | null = null;
    return services.settings.subscribe((s) => {
      const home = services.places.list().find((p) => p.isHome) ?? services.places.list()[0];
      if (!home) return;
      const placeKey = home.id;
      const themeId = s.theme as ThemeId;
      if (placeKey === lastPlaceKey && themeId === lastThemeId) return;
      lastPlaceKey = placeKey;
      lastThemeId = themeId;
      services.scheduler.setContext({
        place: home,
        weather: services.weather,
        themeId,
      });
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
  //
  // Only does expensive DOM/CSS work when the theme or contrast actually
  // changed — without this guard, every volume nudge (1 / Shift+1 / 2 /
  // Shift+2) would re-run applyTheme() and trigger a CSS transition
  // cascade, making the screen flash dark/light on every keypress.
  useEffect(() => {
    let prevThemeId: ThemeId | null = null;
    let prevContrast: boolean | null = null;
    const apply = (s: typeof services.settings extends { get(): infer R } ? R : never) => {
      const themeId = s.theme as ThemeId;
      const contrast = s.highContrast;
      const themeChanged = themeId !== prevThemeId;
      const contrastChanged = contrast !== prevContrast;
      if (!themeChanged && !contrastChanged) return;

      if (themeChanged) {
        setActiveThemeId(themeId);
        const theme = getTheme(themeId);
        applyTheme(theme);
        document.body.dataset.theme = themeId;
        setIconBase(theme.iconSet);
        // Narration must use the product names this hardware actually used —
        // "36 Hour Forecast" and "Daily Planner" before September 2004.
        setProductEra(themeId);
        setIconResolution(theme.iconResolution ?? null);
        try { services.music.setMusicTags(theme.musicTags); } catch { /* ignore */ }
        // Stop any playing narration first — the old clips belong to the
        // previous theme's narrator and shouldn't overlap into the new one.
        services.sequencer.stop();
        services.scheduler.setSceneOrder(getSceneOrder(themeId));
        prevThemeId = themeId;
      }
      if (contrastChanged) {
        document.body.dataset.contrast = contrast ? "high" : "normal";
        prevContrast = contrast;
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

  // Start the storm scanner and the NWS alert watcher. Both poll
  // independently of the scene cycle; both re-point on home change via the
  // places subscription above.
  useEffect(() => {
    if (needsSetup) return;
    const home = services.places.home();
    if (home) {
      services.stormScanner.start(home);
      services.alertWatcher.start(home);
    }
    return () => {
      services.stormScanner.stop();
      services.alertWatcher.stop();
    };
  }, [services, needsSetup]);

  // Keep weather data fresh independently of the scene loop, and push what
  // arrives onto the screen the user is actually looking at.
  //
  // Two failures used to combine here. First, WeatherService only fetched
  // when something asked it to, and the only thing that asked was a scene
  // entering — so a paused loop meant hours-old conditions with nothing
  // saying so. Second, and worse, even a successful background refresh went
  // nowhere: scene data is a snapshot taken at prepare() time, so refilling
  // the cache didn't change a single number on screen. The display only
  // moved when the cycle happened to come back around to that scene.
  //
  // So: poll every minute, then ask the scheduler to re-prepare the current
  // scene from the freshened caches. refreshCurrent() is silent — no clip
  // restart, no re-narration, no effect on the hold timer — so the numbers
  // update underneath the user without interrupting them.
  //
  // Alerts (AlertWatcher, 1 min) and radar (StormScanner, 2 min) poll on
  // their own; this closes the gap for observations and forecasts.
  useEffect(() => {
    if (needsSetup) return;
    const REFRESH_MS = 60_000;
    let stopped = false;
    const refresh = async () => {
      const home = services.places.home();
      if (!home) return;
      // Settle all three before re-preparing: a scene that reads more than
      // one product (Current Conditions reads observation + forecast) would
      // otherwise re-prepare against a half-updated cache and need a second
      // pass to show a consistent picture. allSettled — one product being
      // down must not stop the others from reaching the screen.
      await Promise.allSettled([
        services.weather.getObservation(home),
        services.weather.getForecast(home),
        services.weather.getHourly(home)
      ]);
      if (stopped) return;
      await services.scheduler.refreshCurrent();
    };
    void refresh();
    const id = setInterval(() => void refresh(), REFRESH_MS);
    // Background tabs get their timers throttled; catch up on return.
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [services, needsSetup]);

  // Tier 2 announcements: storm observations from radar (nowcasts).
  // Note this is SEPARATE from NWS alerts (Tier 1) polled below — both
  // routes can fire, with NWS always taking priority.
  useEffect(() => {
    return services.stormScanner.subscribe((e: StormEvent) => {
      const home = services.places.home();
      if (!home) return;
      // Every completed scan repositions the storms. The radar and storm
      // tracker scenes hold a snapshot from when they were entered, so
      // without this the plotted positions, distances and ETAs on screen
      // stayed at wherever the storms were minutes ago. Silent re-prepare:
      // no re-narration, just moved storms.
      if (e.kind === "updated") {
        const id = currentSceneIdRef.current;
        if (id === "radar" || id === "stormtracker") {
          void services.scheduler.refreshCurrent();
        }
      }
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

  // Safety net: the scene loop must never be permanently blocked by audio.
  //
  // `mnemonicDone` exists only to stop the first scene change from cutting
  // off the startup jingle, but it is set exclusively by the audio-unlock
  // path. If audio never unlocks — autoplay policy, a gesture the window
  // listeners didn't see, a clip that fails to load — the loop would sit on
  // "Loading" forever with no way out but pressing Tab. Weather on screen
  // matters more than a jingle, so release the gate after a bounded wait
  // once setup is out of the way.
  useEffect(() => {
    if (mnemonicDone || needsSetup) return;
    const t = setTimeout(() => {
      console.warn("[startup] audio never unlocked; starting the scene loop anyway");
      setMnemonicDone(true);
    }, 8000);
    return () => clearTimeout(t);
  }, [mnemonicDone, needsSetup]);

  // Start the loop on mount — but hold until the startup mnemonic has
  // finished playing. Otherwise the scheduler's first scene-change effect
  // calls sequencer.stop() mid-mnemonic and cuts off the three-bell jingle.
  useEffect(() => {
    if (startedRef.current) return;
    if (needsSetup) return;
    if (!mnemonicDone) return;
    startedRef.current = true;
    void services.announcer.announce(
      "Accessible Weather Center is ready. Use Tab and Shift+Tab to change scenes. " +
      "Arrow keys navigate within the current scene. Press M for favorites, " +
      "N for map navigation, comma for settings, question mark for help.",
      "polite"
    );
    void services.scheduler.start();
  }, [services, mnemonicDone, needsSetup]);

  // On every scene change: stop any playing clips and unduck music,
  // then announce via NVDA and optionally play AJ clips.
  //
  // "Scene change" means a real entry, not a live data refresh. The
  // scheduler re-prepares the on-screen scene every minute so the numbers
  // stay current, which hands us a new `scene` object each time — running
  // this effect on those would cut off the narration mid-sentence and start
  // it over once a minute, forever.
  const lastNarratedToken = useRef(-1);
  useEffect(() => {
    if (!event.scene) return;
    if (event.sceneToken === lastNarratedToken.current) return;
    lastNarratedToken.current = event.sceneToken;
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
    } else {
      // No per-scene art for this scene: fall back to the theme-level
      // background instead of leaving the previous scene's image up.
      document.documentElement.style.setProperty("--ws-bg-image", "var(--ws-theme-bg-image, none)");
    }

    // NVDA / announcer always reads the full scene text.
    void services.announcer.announce(scene.speech, "polite");

    // If voice is on, play clips in parallel (clips only, no TTS).
    // Narrator is either the user's explicit pick or the theme's default.
    if (settings.useAjVoice) {
      let script = null;
      // The machine decides whether it speaks, then the user decides who with.
      // Resolving it here rather than reading settings.narrator directly is
      // what stops a saved preference from putting a voice on a WeatherStar
      // 3000, which never had one.
      const narrator: NarratorId = resolveNarrator(settings.theme, settings.narrator);

      if (scene.id === "current") {
        const data = scene.data as CurrentConditionsData;
        if (data.observation) {
          script = composeCurrentConditions(data.observation, data.place.name, narrator, data.place.coord);
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
  }, [event.scene, event.sceneToken, services]);

  // Tier 1 alerts: the AlertWatcher service owns polling, home-change
  // re-pointing, and fresh-alert dedupe (core/alerts/AlertWatcher.ts).
  // This effect is pure presentation: announce, tone, notify, ticker,
  // and the severe scene interrupt.
  useEffect(() => {
    return services.alertWatcher.subscribe((u: AlertUpdate) => {
      setAlertCount(u.alerts.length);
      setAlertsList(u.alerts);

      // If the Alerts scene is what's on screen, re-prepare it so an alert
      // that expired or was upgraded isn't left standing there. Silent —
      // fresh alerts get their own announcement below.
      if (currentSceneIdRef.current === "alerts") {
        void services.scheduler.refreshCurrent();
      }

      for (const a of u.fresh) {
        if (isSevereAlert(a)) {
          // Quick attention tone — the NWS 4-beep pattern. The scene
          // interrupt below transitions to the alerts scene, which plays
          // the full per-narrator beep + spoken warning via composeAlerts.
          void services.clips.play("warning_beep");
        } else {
          void services.alertTones.playAdvisory();
        }
        void services.announcer.announce(`${a.event}. ${a.headline}`, "assertive");

        // OS-level toast so the user sees it even when minimized to the
        // tray. The IPC bridge no-ops when Notification isn't supported.
        if (window.awc?.notify) {
          void window.awc.notify(a.event, `${a.headline}\n${a.affectedAreaDescription}`);
        }
      }

      // Severe ticker text.
      const severeAlerts = u.alerts.filter(isSevereAlert);
      setAlertTickerText(
        severeAlerts.length > 0
          ? severeAlerts.map((a) => `${a.event}: ${a.headline}`).join("  ///  ")
          : ""
      );

      // Interrupt on fresh severe; clear when no severe remains active.
      if (u.fresh.some(isSevereAlert)) {
        void services.scheduler.interrupt("alerts");
      }
      if (!u.severeActive && services.scheduler.isInterrupted()) {
        void services.scheduler.clearInterrupt();
      }
    });
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
      // Scene-jump shortcuts on 1-5 retired in v0.9.4. Tab/Shift+Tab walks
      // every scene in order. The digit keys are reserved for instant audio
      // controls: 1 / Shift+1 = music vol, 2 / Shift+2 = NWR vol, 3 = read
      // active alerts on demand, 0 = toggle NWR.
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
              // No announcement here on the way IN. MapNavView announces
              // itself on activation with the storm and alert counts and the
              // same key hints; saying a generic version first meant the
              // user heard "Tab to switch modes, arrows to navigate, N or
              // Escape to exit" twice in a row on every N press.
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
        id: "music-volume-up", keys: "1", group: "Audio",
        description: "Raise music volume by 5%",
        handler: () => { adjustVolume(services, "music", +0.05); }
      }),
      r.register({
        id: "music-volume-down", keys: "shift+1", group: "Audio",
        description: "Lower music volume by 5%",
        handler: () => { adjustVolume(services, "music", -0.05); }
      }),
      r.register({
        id: "nwr-volume-up", keys: "2", group: "Audio",
        description: "Raise Weather Radio volume by 5%",
        handler: () => { adjustVolume(services, "radio", +0.05); }
      }),
      r.register({
        id: "nwr-volume-down", keys: "shift+2", group: "Audio",
        description: "Lower Weather Radio volume by 5%",
        handler: () => { adjustVolume(services, "radio", -0.05); }
      }),
      r.register({
        id: "read-alerts", keys: "3", group: "Alerts",
        description: "Speak active weather alerts",
        handler: () => {
          const alerts = alertsListRef.current;
          if (alerts.length === 0) {
            void services.announcer.announce("No active weather alerts.", "assertive");
            return;
          }
          // Build a concise announcement: count + each headline + area.
          // Severity goes first so the most urgent alert leads.
          const ordered = [...alerts].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
          const parts = [`${ordered.length} active weather alert${ordered.length === 1 ? "" : "s"}.`];
          for (const a of ordered) {
            const where = a.affectedAreaDescription ? ` for ${a.affectedAreaDescription}` : "";
            parts.push(`${a.event}${where}.`);
          }
          void services.announcer.announce(parts.join(" "), "assertive");
        }
      }),
      r.register({
        id: "toggle-nwr", keys: "0", group: "Audio",
        description: "Toggle NOAA Weather Radio stream",
        handler: () => {
          const cur = services.settings.get().nwrEnabled;
          services.settings.update({ nwrEnabled: !cur });
          if (cur) {
            void services.announcer.announce("Weather Radio off.", "assertive");
          } else {
            const s = services.settings.get();
            const home = services.places.home();
            const cs = s.nwrCallSign ?? (home ? suggestCallSignForPlace(home.name) : null);
            if (!cs) {
              void services.announcer.announce(
                "Weather Radio on, but no station configured. Open Settings with comma to choose a call sign.",
                "assertive"
              );
            } else {
              const stn = findStation(cs);
              const where = stn ? `${cs}, ${stn.city} ${stn.state}` : cs;
              void services.announcer.announce(`Weather Radio on. ${where}.`, "assertive");
            }
          }
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
        id: "stop-speech", keys: "Escape", group: "Speech",
        description: "Exit Favorites / Map Nav, otherwise silence current speech",
        handler: () => {
          // Priority 1: if we're in a non-scene view mode, Escape exits it.
          // This matches the announced contract ("N or Escape to exit")
          // and matches user expectation for modal-like overlays.
          const mode = viewModeRef.current;
          if (mode === "places" || mode === "mapnav") {
            services.announcer.cancel();
            services.sequencer.stop();
            setViewMode("scenes");
            void services.scheduler.resume();
            void services.announcer.announce("Returning to scenes.", "assertive");
            return;
          }
          // Priority 2: in scene mode, Escape silences the current
          // announcement and any playing narration clip.
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
      setAudioStarted(true);
      // Mnemonic cutoff fix: await ctx.resume() before playing the clip.
      // If the AudioContext is still transitioning from suspended → running,
      // MediaElementSource produces silence and the perceived clip is
      // truncated. Awaiting ensures the graph is live before play() runs.
      //
      // Timeout guard: if the clip fails to load (404, network stall, audio
      // element error), we still need to release the scheduler. Race the
      // play against a 6-second timer so setMnemonicDone always fires.
      void (async () => {
        try {
          if (ctx.state === "suspended") await ctx.resume();
          // Music must start AFTER the context is actually running. Starting
          // it before the resume settles worked on Electron (autoplay is
          // allowed, so the context was already running) and silently failed
          // in browsers: the media element's play() lands on a suspended
          // graph and produces nothing. The symptom was music that only
          // began after toggling Ctrl+M twice, because by then a gesture had
          // been processed and the context was live.
          void services.music.start();

          const play = services.clips.play("mnemonic").catch((err) => {
            console.warn("[mnemonic] clip playback failed:", err);
          });
          const timeout = new Promise<void>((resolve) => setTimeout(resolve, 6000));
          await Promise.race([play, timeout]);
        } catch (err) {
          console.warn("[mnemonic] startup sequence failed:", err);
        } finally {
          setMnemonicDone(true);
        }
      })();
    };
    unlockAudioRef.current = start;
    // Attempt immediate start — works in Electron where autoplay is allowed.
    const ctx = services.mixer.ensureStarted();
    if (ctx.state === "running") {
      start();
      return;
    }
    // The ref guard inside start() prevents double-firing if both the
    // ctx.resume() chain and a user gesture resolve close together.
    void ctx.resume().then(start).catch((err) => {
      // Autoplay blocked — wait for user gesture.
      console.warn("[audio] initial resume rejected, waiting for gesture:", err);
    });
    window.addEventListener("keydown", start, { once: true });
    window.addEventListener("click", start, { once: true });
    return () => {
      window.removeEventListener("keydown", start);
      window.removeEventListener("click", start);
    };
  }, [services]);

  // IntelliStar 2 severe takeover: the real LOT8s switched to a dedicated
  // severe background set, not a flat orange field. Swap the frame image
  // while interrupted; the theme's severe CSS lets --ws-bg-image show
  // through on this theme only.
  useEffect(() => {
    if (activeThemeId !== "intellistar2") return;
    const root = document.documentElement;
    if (event.interrupted) {
      const bg = pickBackground("intellistar2", true);
      if (bg) root.style.setProperty("--ws-bg-image", `url("${bg}")`);
    } else {
      root.style.setProperty("--ws-bg-image", "var(--ws-theme-bg-image, none)");
    }
  }, [event.interrupted, activeThemeId]);

  // NWR Weather Radio + volume sliders — reactive to settings changes.
  // Subscribes to the settings store; on every change syncs music + radio
  // volumes, and connects/disconnects the NWR stream as needed. The call
  // sign defaults to a fuzzy match against the home favorite location
  // when the user has not picked one explicitly.
  useEffect(() => {
    if (!audioStarted) return;
    // Don't fuzzy-match a call sign against the setup placeholder — that
    // could tune the radio to an arbitrary transmitter before the user has
    // told us where they are.
    if (needsSetup) return;
    const off = services.settings.subscribe((s) => {
      services.mixer.setMusicLevel(s.musicVolume);
      services.mixer.setRadioLevel(s.nwrVolume);
      if (!s.nwrEnabled) {
        services.nwr.disconnect();
        return;
      }
      const home = services.places.home();
      const desired = s.nwrCallSign ?? (home ? suggestCallSignForPlace(home.name) : null);
      if (!desired) {
        services.nwr.disconnect();
        return;
      }
      // Reconnect on a call-sign change, and also retry when the player has
      // given up ("failed" after 5 straight failures). Without the second
      // condition the failed state was sticky: the failure announcement says
      // "choose another station", but re-picking the same station — or any
      // other settings change after the network recovered — was a no-op.
      if (services.nwr.getCallSign() !== desired || services.nwr.getStatus() === "failed") {
        services.nwr.connect(desired);
      }
    });
    return () => {
      off();
      services.nwr.disconnect();
    };
  }, [services, audioStarted, needsSetup]);

  // NWR stream status announcements — tell the user when a stream starts,
  // fails, or is retrying. The player emits status changes; we translate
  // user-facing ones into aria-live announcements. Don't narrate every
  // reconnect attempt (too noisy) — just the final failure and recovery.
  useEffect(() => {
    let lastAnnouncedStatus: string | null = null;
    const off = services.nwr.subscribeStatus((status, info) => {
      const cs = info.callSign ?? "Weather Radio";
      if (status === lastAnnouncedStatus) return;
      if (status === "streaming") {
        services.announcer.announce(`Weather Radio streaming from ${cs}.`, "polite");
        lastAnnouncedStatus = status;
      } else if (status === "failed") {
        const reason = info.error ? ` (${info.error})` : "";
        services.announcer.announce(
          `Weather Radio stream for ${cs} is unavailable${reason}. Press comma to open settings and choose another station, or disable Weather Radio.`,
          "assertive"
        );
        lastAnnouncedStatus = status;
      } else if (status === "idle") {
        lastAnnouncedStatus = null;
      }
      // "connecting" and "reconnecting" are intentionally silent.
    });
    return off;
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
            settings={services.settings}
            active
          />
        ) : (
          <ErrorBoundary resetKey={`${event.scene?.id ?? "none"}:${event.index}`}>
            <SceneStage event={event} themeId={activeThemeId} rainviewer={services.rainviewer} alerts={alertsList} />
          </ErrorBoundary>
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
      <FirstRunSetup
        open={needsSetup}
        announcer={services.announcer}
        onComplete={(place) => {
          // Submitting this form is the most reliable user gesture the app
          // will ever get, so unlock audio here rather than trusting that
          // the window-level keydown/click listeners saw something while a
          // modal owned the keyboard. Idempotent — no-ops if already run.
          unlockAudioRef.current?.();
          // completeFirstRun notifies subscribers, which re-points the
          // scheduler, storm scanner and alert watcher at the new home.
          // Clearing needsSetup then releases the start effects.
          services.places.completeFirstRun(place);
          setNeedsSetup(false);
        }}
      />
    </AnnouncerContext.Provider>
  );
}

/** Severity rank for sorting alert announcements (highest first). */
function severityRank(s: import("./core/types").AlertSeverity): number {
  switch (s) {
    case "Extreme": return 4;
    case "Severe": return 3;
    case "Moderate": return 2;
    case "Minor": return 1;
    default: return 0;
  }
}

/** Apply a delta to the music or NWR volume and announce the new level.
 *  Clamps to [0, 1]. Used by the `1`/`Shift+1` and `2`/`Shift+2` shortcuts. */
function adjustVolume(
  services: ReturnType<typeof buildServices>,
  target: "music" | "radio",
  delta: number
): void {
  const s = services.settings.get();
  const cur = target === "music" ? s.musicVolume : s.nwrVolume;
  const next = Math.max(0, Math.min(1, cur + delta));
  if (target === "music") services.settings.update({ musicVolume: next });
  else services.settings.update({ nwrVolume: next });
  const label = target === "music" ? "Music" : "Weather Radio";
  void services.announcer.announce(`${label} volume ${Math.round(next * 100)} percent.`, "assertive");
}

function SceneStage({
  event,
  themeId,
  rainviewer,
  alerts = []
}: {
  event: SchedulerEvent;
  themeId: ThemeId;
  rainviewer: RainViewerClient;
  alerts?: import("./core/types").WeatherAlert[];
}) {
  const scene = event.scene;
  if (!scene) return <p>Loading…</p>;
  // SceneScheduler's prepare-failure fallback keeps the real scene id but
  // substitutes `{ error }` for the data — the views would cast and crash
  // on it, so catch that shape before resolving a view.
  const maybeError = (scene.data as { error?: unknown } | null | undefined)?.error;
  if (typeof maybeError === "string") {
    return (
      <SceneUnavailable
        title={scene.title}
        reason="This scene could not load its data right now. It will retry on the next cycle."
      />
    );
  }
  // The selected machine may not have had this product at all — switching
  // from a 4000 to a 3000 while on the radar screen, for instance. Say so in
  // that unit's own typography rather than rendering a screen it never had.
  if (productAvailability(themeId, scene.id as ProductId) === "absent") {
    return (
      <ProductUnavailable
        title={scene.title}
        deviceLabel={getDevice(themeId).label}
        reason={absentNote(themeId, scene.id as ProductId)}
      />
    );
  }

  const render = resolveSceneView(themeId, scene.id);
  if (!render) return <p>{scene.title}</p>;
  return render({ data: scene.data, rainviewer, alerts });
}
