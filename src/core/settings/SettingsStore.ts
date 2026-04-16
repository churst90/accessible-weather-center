import type { AnnouncerMode } from "../../a11y/AnnouncementQueue";

/**
 * User-facing settings. Persisted to localStorage in v0.2; disk persistence
 * via Electron's userData path is on the TODO list. The store is reactive —
 * subscribers are notified on every change so the UI and the scheduler can
 * respond without a global event bus.
 */

export interface Settings {
  /** Map of flavor (scene) id → whether it's enabled in the cycle. */
  enabledFlavors: Record<string, boolean>;
  /** Music master enable. */
  musicEnabled: boolean;
  /** Confidence threshold for using AJ clips vs TTS fallback. */
  clipConfidence: "confirmed" | "likely" | "guess";
  /** Use the AJ phrase composer at all (vs always TTS). */
  useAjVoice: boolean;
  /** How announcements are spoken. "live-region" (default): push text to
   *  the aria-live DOM region only — the user's screen reader (NVDA, JAWS,
   *  VoiceOver) handles speech. "tts": use the built-in Web Speech API.
   *  "both": push to both, for users experimenting with layered speech.
   *  "off": no announcements at all. Default is "live-region" because
   *  running both alongside NVDA causes double-speech. */
  announcerMode: AnnouncerMode;
  /** Built-in TTS voice name (whatever Web Speech API exposes). Only used
   *  when announcerMode is "tts" or "both". */
  ttsVoice: string | null;
  /** TTS rate, 0.5 .. 2.0. Only used when announcerMode is "tts" or "both". */
  ttsRate: number;
  /** Use high-contrast theme. */
  highContrast: boolean;
  /** Automatically advance scenes on their hold timer. When false, scenes
   *  only change on explicit user input (left/right/1-5). */
  autoCycle: boolean;
  /** Use the bundled Severe Weather Alert tone.mp3 instead of synthesized chime. */
  useBundledAlertTone: boolean;
  /** Active visual theme. */
  theme:
    | "ws3000"
    | "ws4000-v1"
    | "ws4000-v2"
    | "wsjr"
    | "weatherstarxl"
    | "weatherscan-local"
    | "weatherscan-v1"
    | "weatherscan-v2"
    | "intellistar1"
    | "intellistar2";
  /** Voice narrator selection. Null = use theme default. */
  narrator: string | null;
  /** Seconds to wait after narration finishes before transitioning. */
  postNarrationDelay: number;
  /** Music bus volume, 0..1. */
  musicVolume: number;
  /** NOAA Weather Radio stream master enable. */
  nwrEnabled: boolean;
  /** NWR transmitter call sign (e.g. "KEC49"). Null = use favorite location. */
  nwrCallSign: string | null;
  /** NWR bus volume, 0..1. */
  nwrVolume: number;
}

const STORAGE_KEY = "awc.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  enabledFlavors: {
    // Core Weatherscan loop (default theme) — ON by default
    current: true,
    localforecast: true,
    radar: true,
    extended: true,
    hourly: true,
    travel: true,
    almanac: true,
    alerts: true,
    // Value-add scenes — OFF by default (toggled in Settings)
    detailed: false,
    feelslike: false,
    stormtracker: false,
    overnight: false,
    weekend: false,
    precip: false,
    temptrend: false,
    traffic: false,
    airport: false,
  },
  musicEnabled: true,
  clipConfidence: "likely",
  useAjVoice: true,
  announcerMode: "live-region",
  ttsVoice: null,
  ttsRate: 1.0,
  highContrast: false,
  autoCycle: true,
  useBundledAlertTone: false,
  theme: "ws4000-v2" as const,
  narrator: null,
  postNarrationDelay: 3,
  musicVolume: 0.6,
  nwrEnabled: false,
  nwrCallSign: null,
  nwrVolume: 0.5,
};

export class SettingsStore {
  private state: Settings = { ...DEFAULT_SETTINGS };
  private listeners = new Set<(s: Settings) => void>();

  constructor() {
    this.load();
  }

  get(): Settings {
    return this.state;
  }

  update(patch: Partial<Settings>): void {
    this.state = { ...this.state, ...patch };
    this.persist();
    this.notify();
  }

  setFlavorEnabled(flavorId: string, enabled: boolean): void {
    this.state = {
      ...this.state,
      enabledFlavors: { ...this.state.enabledFlavors, [flavorId]: enabled }
    };
    this.persist();
    this.notify();
  }

  isFlavorEnabled(flavorId: string): boolean {
    const v = this.state.enabledFlavors[flavorId];
    if (v !== undefined) return v;
    // Fall back to the default for this flavor (value-add scenes default OFF)
    const d = DEFAULT_SETTINGS.enabledFlavors[flavorId];
    return d !== undefined ? d : false;
  }

  subscribe(fn: (s: Settings) => void): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private load(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Settings>;
      // Migrate old "intellistar" theme ID to "intellistar1"
      if ((parsed as Record<string, unknown>).theme === "intellistar") {
        parsed.theme = "intellistar1";
      }
      // Migrate retired themes: classic90s was a soft duplicate of WS4000;
      // intellistar2jr was consolidated into the unified "intellistar2"
      // theme (IntelliStar 2 / 2 Jr HD). The single "weatherscan" theme
      // was split into three era-specific themes in v0.5 — existing users
      // land on V1 since the screenshots that shipped matched that era.
      const retired = (parsed as Record<string, unknown>).theme;
      if (retired === "classic90s") parsed.theme = "ws4000-v2";
      if (retired === "intellistar2jr") parsed.theme = "intellistar2";
      if (retired === "weatherscan") parsed.theme = "weatherscan-v1";
      // v0.6: WS4000 split into v1 (2001-2004 flat-orange header) and
      // v2 (2005-2009 floating pane / footer). Existing users land on
      // v2 since it's the more polished and longer-lived broadcast look.
      if (retired === "ws4000") parsed.theme = "ws4000-v2";
      // High Contrast was never a TWC hardware unit — retired as a theme.
      // The `highContrast` boolean remains as an overlay on any theme.
      if (retired === "highcontrast") parsed.theme = "weatherscan-v1";
      this.state = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        enabledFlavors: { ...DEFAULT_SETTINGS.enabledFlavors, ...(parsed.enabledFlavors ?? {}) }
      };
    } catch {
      // Ignore corrupt settings; fall back to defaults.
    }
  }

  private persist(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore quota errors.
    }
  }

  private notify(): void {
    for (const fn of this.listeners) fn(this.state);
  }
}
