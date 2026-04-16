import type { Place } from "../types";

const STORAGE_KEY = "awc.places.v1";

/**
 * User's home + favorites. Persisted to localStorage so restarts keep the
 * list. Seed defaults are used only when nothing is stored yet.
 */
export class PlacesStore {
  private places: Place[] = [];
  private listeners = new Set<(places: Place[]) => void>();

  constructor(initial: Place[]) {
    const loaded = this.load();
    this.places = loaded ?? [...initial];
    if (!loaded) this.persist();
  }

  list(): readonly Place[] {
    return this.places;
  }

  home(): Place | undefined {
    return this.places.find((p) => p.isHome) ?? this.places[0];
  }

  byId(id: string): Place | undefined {
    return this.places.find((p) => p.id === id);
  }

  upsert(place: Place): void {
    const i = this.places.findIndex((p) => p.id === place.id);
    if (i >= 0) this.places[i] = place;
    else this.places.push(place);
    this.persist();
    this.notify();
  }

  remove(id: string): void {
    const wasHome = this.places.find((p) => p.id === id)?.isHome;
    this.places = this.places.filter((p) => p.id !== id);
    // If we removed the home, promote the first remaining entry.
    if (wasHome && this.places.length > 0) {
      this.places[0] = { ...this.places[0], isHome: true };
    }
    this.persist();
    this.notify();
  }

  /** Mark one place as home; clear the flag on everyone else. */
  setHome(id: string): void {
    if (!this.places.some((p) => p.id === id)) return;
    this.places = this.places.map((p) => ({ ...p, isHome: p.id === id }));
    this.persist();
    this.notify();
  }

  subscribe(fn: (places: Place[]) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn(this.places);
  }

  private persist(): void {
    if (typeof localStorage === "undefined") return;
    try {
      // Strip nwsGrid cache — it's re-resolved on load and we don't want
      // stale grid URLs hanging around in storage forever.
      const clean = this.places.map(({ nwsGrid: _drop, ...rest }) => rest);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch {
      // Ignore quota errors.
    }
  }

  private load(): Place[] | null {
    if (typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Place[];
      if (!Array.isArray(parsed) || parsed.length === 0) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}

export function defaultPlaces(): Place[] {
  return [
    { id: "home",         name: "Greeneville",    state: "TN", coord: { lat: 36.1626, lon: -82.8307 }, isHome: true },
    { id: "knoxville",    name: "Knoxville",      state: "TN", coord: { lat: 35.9606, lon: -83.9207 } },
    { id: "asheville",    name: "Asheville",      state: "NC", coord: { lat: 35.5951, lon: -82.5515 } },
    { id: "johnson_city", name: "Johnson City",   state: "TN", coord: { lat: 36.3134, lon: -82.3535 } },
    { id: "bristol",      name: "Bristol",        state: "TN", coord: { lat: 36.5951, lon: -82.1887 } },
    { id: "kingsport",    name: "Kingsport",      state: "TN", coord: { lat: 36.5484, lon: -82.5618 } },
    { id: "pigeon_forge", name: "Pigeon Forge",   state: "TN", coord: { lat: 35.7884, lon: -83.5543 } }
  ];
}
