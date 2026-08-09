import { useEffect, useRef, useState } from "react";
import type { Place, Observation } from "../../core/types";
import type { WeatherService } from "../../core/weather/WeatherService";
import type { AnnouncementQueue } from "../../a11y/AnnouncementQueue";
import type { PlacesStore } from "../../core/places/PlacesStore";
import { isModalOpen } from "../../a11y/modality";
import { resolveZipToPlace } from "../../core/places/zipLookup";

interface Props {
  places: readonly Place[];
  weather: WeatherService;
  announcer: AnnouncementQueue;
  store: PlacesStore;
  active: boolean;
  /** Called when the user presses Enter to commit a place as the active
   *  location and return to the scene cycle. */
  onDrillIn: (place: Place) => void;
}

/**
 * Favorites mode: a flat focusable list of saved places. Up/Down walks the
 * list and announces conditions at the focused place. A ZIP entry field at
 * the top adds new places. Enter drills into the focused place — setting it
 * as home and switching back to the scene cycle so the full app reflects the
 * new location.
 *
 * The entry/exit announcement is handled by the toggle shortcut in App.tsx,
 * not here — that way the user hears the transition immediately on M press,
 * even if this component is still mounting.
 */
export function PlacesMode({ places, weather, announcer, store, active, onDrillIn }: Props) {
  const [focusIdx, setFocusIdx] = useState(0);
  const [obs, setObs] = useState<Record<string, Observation | null>>({});
  const obsRef = useRef(obs);
  obsRef.current = obs;
  const [zipInput, setZipInput] = useState("");
  const [adding, setAdding] = useState(false);
  const zipInputRef = useRef<HTMLInputElement | null>(null);

  // Clamp focus into range on activation or when the list shrinks.
  useEffect(() => {
    if (!active) return;
    setFocusIdx((i) => Math.min(Math.max(0, i), Math.max(0, places.length - 1)));
  }, [active, places.length]);

  // Announce the focused place, then fill in its conditions.
  //
  // This used to announce nothing until getObservation() resolved, so every
  // arrow press was answered by silence for as long as the network took —
  // and on a cold list, by several places' worth of readouts arriving at
  // once in whatever order the requests happened to finish. Name first,
  // immediately, on the interrupting navigation channel; the temperature
  // follows only if we didn't already have it cached and the user is still
  // sitting on that place.
  useEffect(() => {
    if (!active) return;
    const place = places[focusIdx];
    if (!place) return;
    const known = obsRef.current[place.id];
    announcer.announce(describePlace(place, known ?? null), "navigation");
    if (known !== undefined) return;
    let cancelled = false;
    void weather.getObservation(place).then((o) => {
      if (cancelled) return;
      setObs((prev) => ({ ...prev, [place.id]: o }));
      announcer.announce(describePlace(place, o), "navigation");
    }).catch(() => { /* the name was already spoken; nothing to add */ });
    return () => {
      cancelled = true;
    };
    // `obs` is read through a ref on purpose: including it would re-run this
    // effect (and re-announce) the moment its own fetch stored a result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusIdx, active, places, weather, announcer]);

  // Arrow key handling — only while this mode is active. Bail out when the
  // ZIP input is focused so the user can type digits without hijacking.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (isModalOpen()) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx((i) => Math.min(i + 1, places.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Home") {
        e.preventDefault();
        setFocusIdx(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setFocusIdx(Math.max(0, places.length - 1));
      } else if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        zipInputRef.current?.focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        const p = places[focusIdx];
        if (!p) return;
        onDrillIn(p);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const p = places[focusIdx];
        if (!p) return;
        store.remove(p.id);
        void announcer.announce(`${p.name} removed.`, "assertive");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, places, focusIdx, store, announcer, onDrillIn]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adding) return;
    const zip = zipInput.trim();
    if (!zip) return;
    setAdding(true);
    try {
      const place = await resolveZipToPlace(zip);
      // Avoid clobbering a matching manual entry with the same id.
      store.upsert(place);
      setZipInput("");
      void announcer.announce(
        `Added ${place.name}, ${place.state} for ZIP ${zip}.`,
        "assertive"
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error.";
      void announcer.announce(`Could not add ZIP ${zip}. ${msg}`, "assertive");
    } finally {
      setAdding(false);
    }
  };

  return (
    <section aria-label="Favorites">
      <p style={{ color: "var(--ws-text-dim)", marginTop: 0 }}>
        {places.length} favorite{places.length === 1 ? "" : "s"}. Up/down walks the list, Enter sets as home and returns to scenes, Z adds a ZIP, Delete removes.
      </p>
      <form
        onSubmit={handleAdd}
        style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}
      >
        <label htmlFor="awc-zip-input" style={{ color: "var(--ws-text)" }}>
          Add by ZIP:
        </label>
        <input
          id="awc-zip-input"
          ref={zipInputRef}
          type="text"
          inputMode="numeric"
          pattern="\d{5}"
          maxLength={5}
          value={zipInput}
          onChange={(e) => setZipInput(e.target.value.replace(/\D/g, "").slice(0, 5))}
          disabled={adding}
          placeholder="12345"
          style={{
            padding: "6px 10px",
            background: "var(--ws-bg-mid)",
            color: "var(--ws-text)",
            border: "1px solid var(--ws-accent)",
            width: 100
          }}
          aria-describedby="awc-zip-help"
        />
        <button type="submit" disabled={adding || zipInput.length !== 5} style={{ padding: "6px 12px" }}>
          {adding ? "Adding…" : "Add"}
        </button>
        <span id="awc-zip-help" className="sr-only">
          Enter a five digit US ZIP code and press Add to save the location.
        </span>
      </form>
      <ul
        className="ws-list"
        role="listbox"
        aria-activedescendant={places[focusIdx] ? `place-${places[focusIdx].id}` : undefined}
      >
        {places.map((p, i) => (
          <li
            key={p.id}
            id={`place-${p.id}`}
            className="ws-list-row"
            role="option"
            aria-selected={i === focusIdx}
            data-focused={i === focusIdx}
          >
            <span className="ws-list-row-name">
              {p.isHome ? "★ " : ""}{p.name}, {p.state}
            </span>
            <span className="ws-list-row-detail">
              {obs[p.id]?.temperatureF != null ? `${obs[p.id]!.temperatureF}°F` : "…"}
              {obs[p.id]?.conditionText ? ` · ${obs[p.id]!.conditionText}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function describePlace(place: Place, obs: Observation | null): string {
  if (!obs) return `${place.name}, ${place.state}. Loading.`;
  const temp = obs.temperatureF != null ? `${obs.temperatureF} degrees` : "temperature unavailable";
  const cond = obs.conditionText ?? "conditions unavailable";
  return `${place.name}, ${place.state}. ${cond}. ${temp}.`;
}
