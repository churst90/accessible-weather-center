import { useEffect, useState } from "react";
import type { SettingsStore, Settings } from "../../core/settings/SettingsStore";
import { THEMES, getTheme, THEME_CORE_SCENES, VALUE_ADD_SCENES, type ThemeId } from "../../core/settings/themes";
import { NARRATORS } from "../../audio/manifests/narratorSchema";
import { BUNDLED_STATIONS, fetchActiveNwrStations, type NwrStation } from "../../audio/nwrStations";
import { ModalDialog } from "../semantic/ModalDialog";

interface Props {
  store: SettingsStore;
  open: boolean;
  onClose: () => void;
  flavors: ReadonlyArray<{ id: string; title: string }>;
}

/**
 * Modal settings panel. Reachable via the , (comma) shortcut.
 *
 * Focus management, Tab trap, Escape handling, portal, and inert-on-root
 * all live in ModalDialog. This component is just the content.
 */
export function SettingsPanel({ store, open, onClose, flavors }: Props) {
  const [settings, setSettings] = useState<Settings>(store.get());
  const [stations, setStations] = useState<NwrStation[]>(BUNDLED_STATIONS);
  const [stationFetchError, setStationFetchError] = useState<string | null>(null);

  useEffect(() => store.subscribe(setSettings), [store]);

  // On modal open: pull the live weatherUSA mount list so the call-sign
  // autocomplete reflects actually-streaming stations, not the (shorter)
  // bundled snapshot. The bundled list stays as the initial render and
  // as the fallback if the IPC fetch fails (e.g. when running in the
  // Vite browser preview with no Electron bridge).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const result = await fetchActiveNwrStations();
      if (cancelled || !result) return;
      if (result.ok) {
        // updateLiveStations mutated the internal array; mirror it to
        // React state so the datalist re-renders with the live list.
        // Rebuild from the (now-updated) bundled+live merged order.
        const merged = [...BUNDLED_STATIONS];
        const bundledCs = new Set(BUNDLED_STATIONS.map((s) => s.callSign.toUpperCase()));
        for (const live of result.stations) {
          const cs = live.callSign.toUpperCase();
          if (bundledCs.has(cs)) continue;
          merged.push({ callSign: live.callSign, city: live.name || live.description || live.callSign, state: "" });
        }
        merged.sort((a, b) => (a.state + a.city).localeCompare(b.state + b.city));
        setStations(merged);
        setStationFetchError(null);
      } else {
        setStationFetchError(result.error);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  return (
    <ModalDialog open={open} onClose={onClose} labelledBy="awc-settings-title">
      <h2 id="awc-settings-title" style={{ marginTop: 0 }}>Settings</h2>

        <fieldset style={{ border: "1px solid var(--ws-accent)", padding: 12, marginBottom: 16 }}>
          <legend>Accessibility</legend>
          <label style={{ display: "block", marginBottom: 8 }}>
            Announcement mode:{" "}
            <select
              value={settings.announcerMode}
              onChange={(e) => store.update({ announcerMode: e.target.value as Settings["announcerMode"] })}
            >
              <option value="live-region">Screen reader only (NVDA / JAWS / VoiceOver) — recommended</option>
              <option value="tts">Built-in speech (Web Speech API) — no screen reader</option>
              <option value="both">Both (not recommended — causes double speech)</option>
              <option value="off">Silent</option>
            </select>
          </label>
          <p style={{ marginTop: 4, fontSize: 12, color: "var(--ws-text-dim)" }}>
            Use "Screen reader only" if you run NVDA, JAWS, Narrator, or VoiceOver — the app will push
            announcements to an aria-live region for your screen reader to read. Use "Built-in speech"
            only when running the app without any screen reader.
          </p>
        </fieldset>

        <fieldset style={{ border: "1px solid var(--ws-accent)", padding: 12, marginBottom: 16 }}>
          <legend>Theme</legend>
          <label style={{ display: "block" }}>
            Visual theme:{" "}
            <select
              value={settings.theme}
              onChange={(e) => store.update({ theme: e.target.value as ThemeId })}
            >
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
        </fieldset>

        <fieldset style={{ border: "1px solid var(--ws-accent)", padding: 12, marginBottom: 16 }}>
          <legend>Audio</legend>
          <label style={{ display: "block", marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={settings.musicEnabled}
              onChange={(e) => store.update({ musicEnabled: e.target.checked })}
            />{" "}
            Play background music
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            Music volume: {Math.round(settings.musicVolume * 100)}%{" "}
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(settings.musicVolume * 100)}
              onChange={(e) => store.update({ musicVolume: Number(e.target.value) / 100 })}
              style={{ verticalAlign: "middle" }}
            />
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={settings.useAjVoice}
              onChange={(e) => store.update({ useAjVoice: e.target.checked })}
            />{" "}
            Use voice clips for narration (falls back to TTS for missing pieces)
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            Voice narrator:{" "}
            <select
              value={settings.narrator ?? ""}
              onChange={(e) => store.update({ narrator: e.target.value || null })}
            >
              <option value="">Theme default ({getTheme(settings.theme as ThemeId).defaultNarrator.replace(/-/g, " ")})</option>
              {NARRATORS.map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            Clip confidence threshold:{" "}
            <select
              value={settings.clipConfidence}
              onChange={(e) => store.update({ clipConfidence: e.target.value as Settings["clipConfidence"] })}
            >
              <option value="confirmed">Confirmed only (most TTS)</option>
              <option value="likely">Likely or better (recommended)</option>
              <option value="guess">Any clip available (most clips)</option>
            </select>
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={settings.useBundledAlertTone}
              onChange={(e) => store.update({ useBundledAlertTone: e.target.checked })}
            />{" "}
            Use bundled severe weather alert tone (instead of synthesized chime)
          </label>
          <label style={{ display: "block" }}>
            Post-narration delay: {settings.postNarrationDelay}s{" "}
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={settings.postNarrationDelay}
              onChange={(e) => store.update({ postNarrationDelay: Number(e.target.value) })}
              style={{ verticalAlign: "middle" }}
            />
          </label>
        </fieldset>

        <fieldset style={{ border: "1px solid var(--ws-accent)", padding: 12, marginBottom: 16 }}>
          <legend>NOAA Weather Radio</legend>
          <p style={{ marginTop: 0, fontSize: 12, color: "var(--ws-text-dim)" }}>
            Live NWR transmitter stream from weatherUSA. Plays in the background regardless of the active scene.
            May contain EAS Attention Signals — pass-through only, this app is not an EAS originator.
          </p>
          <label style={{ display: "block", marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={settings.nwrEnabled}
              onChange={(e) => store.update({ nwrEnabled: e.target.checked })}
            />{" "}
            Enable Weather Radio stream
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            Call sign:{" "}
            <input
              type="text"
              list="awc-nwr-stations"
              value={settings.nwrCallSign ?? ""}
              placeholder="e.g. KEB98 (auto from favorite if blank)"
              onChange={(e) => store.update({ nwrCallSign: e.target.value.toUpperCase() || null })}
              style={{ width: 320 }}
            />
            <datalist id="awc-nwr-stations">
              {stations.map((s) => (
                <option key={s.callSign} value={s.callSign}>
                  {s.state ? `${s.city}, ${s.state}` : s.city}{s.note ? ` — ${s.note}` : ""}
                </option>
              ))}
            </datalist>
          </label>
          <p style={{ marginTop: 0, marginBottom: 8, fontSize: 11, color: "var(--ws-text-dim)" }}>
            {stationFetchError
              ? `Using bundled station list (live fetch failed: ${stationFetchError}). Some mounts may be offline.`
              : `${stations.length} stations listed — live mount list refreshed from weatherUSA on open. Unlisted call signs can be typed directly.`}
          </p>
          <label style={{ display: "block" }}>
            Weather Radio volume: {Math.round(settings.nwrVolume * 100)}%{" "}
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(settings.nwrVolume * 100)}
              onChange={(e) => store.update({ nwrVolume: Number(e.target.value) / 100 })}
              style={{ verticalAlign: "middle" }}
            />
          </label>
        </fieldset>

        <fieldset style={{ border: "1px solid var(--ws-accent)", padding: 12, marginBottom: 16 }}>
          <legend>Scene Cycle</legend>
          <label style={{ display: "block", marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={settings.autoCycle}
              onChange={(e) => store.update({ autoCycle: e.target.checked })}
            />{" "}
            Automatically advance scenes (uncheck to step manually with left/right)
          </label>

          {/* Core loop — scenes authentic to the current theme's era */}
          {(() => {
            const themeId = settings.theme as ThemeId;
            const coreIds = THEME_CORE_SCENES[themeId] ?? THEME_CORE_SCENES["weatherscan-v1"];
            const flavorMap = new Map(flavors.map((f) => [f.id, f]));
            const coreScenes = coreIds.map((id) => flavorMap.get(id)).filter(Boolean) as { id: string; title: string }[];
            const valueAddScenes = VALUE_ADD_SCENES.map((id) => flavorMap.get(id)).filter(Boolean) as { id: string; title: string }[];
            // Alerts is always available but separate
            const alertsFlavor = flavorMap.get("alerts");
            return (
              <>
                <div style={{ marginTop: 8, marginBottom: 4, fontWeight: "bold", color: "var(--ws-accent)" }}>
                  Core Loop
                </div>
                {coreScenes.map((f) => {
                  const enabled = settings.enabledFlavors[f.id] ?? true;
                  return (
                    <label key={f.id} style={{ display: "block", marginBottom: 4 }}>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => store.setFlavorEnabled(f.id, e.target.checked)}
                      />{" "}
                      {f.title}
                    </label>
                  );
                })}

                <div style={{ marginTop: 12, marginBottom: 4, fontWeight: "bold", color: "var(--ws-accent-warm, var(--ws-accent))" }}>
                  Value-Add Scenes
                </div>
                {valueAddScenes.map((f) => {
                  const enabled = settings.enabledFlavors[f.id] ?? false;
                  return (
                    <label key={f.id} style={{ display: "block", marginBottom: 4 }}>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => store.setFlavorEnabled(f.id, e.target.checked)}
                      />{" "}
                      {f.title}
                    </label>
                  );
                })}

                {alertsFlavor && (
                  <>
                    <div style={{ marginTop: 12, marginBottom: 4, fontWeight: "bold", color: "var(--ws-alert)" }}>
                      Alerts
                    </div>
                    <label style={{ display: "block", marginBottom: 4 }}>
                      <input
                        type="checkbox"
                        checked={settings.enabledFlavors[alertsFlavor.id] ?? true}
                        onChange={(e) => store.setFlavorEnabled(alertsFlavor.id, e.target.checked)}
                      />{" "}
                      {alertsFlavor.title}
                    </label>
                  </>
                )}
              </>
            );
          })()}
        </fieldset>

        <fieldset style={{ border: "1px solid var(--ws-accent)", padding: 12, marginBottom: 16 }}>
          <legend>Display</legend>
          <label style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={settings.highContrast}
              onChange={(e) => store.update({ highContrast: e.target.checked })}
            />{" "}
            High contrast theme
          </label>
        </fieldset>

      <button onClick={onClose} style={{ padding: "8px 16px" }}>
        Close (Esc)
      </button>
    </ModalDialog>
  );
}
