import type { Place } from "../types";

const STORAGE_KEY = "awc.places.v1";

/**
 * User's home + favorites. Persisted to localStorage so restarts keep the
 * list. Seed defaults are used only when nothing is stored yet.
 *
 * First run: when storage holds nothing, the store falls back to the seed
 * (a neutral placeholder — see `defaultPlaces`) and reports `isFirstRun()`.
 * The seed is deliberately NOT persisted, so closing the app mid-setup
 * still presents the setup prompt next launch. `completeFirstRun()` is the
 * one call that turns a fresh install into a configured one.
 */
export class PlacesStore {
  private places: Place[] = [];
  private listeners = new Set<(places: Place[]) => void>();
  private firstRun: boolean;

  constructor(initial: Place[]) {
    const loaded = this.load();
    this.places = loaded ?? [...initial];
    this.firstRun = loaded == null;
  }

  /** True when nothing was restored from storage — the user has never
   *  chosen a home location, so the current list is placeholder data that
   *  must not be treated as a real place (no weather fetches, no polling). */
  isFirstRun(): boolean {
    return this.firstRun;
  }

  /** Seed the store from the user's first-run location choice. Replaces the
   *  placeholder list entirely — the placeholder must never survive setup —
   *  marks the place as home, and persists. */
  completeFirstRun(place: Place): void {
    this.places = [{ ...place, isHome: true }];
    this.firstRun = false;
    this.persist();
    this.notify();
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
    // Adding a place before setup finished (e.g. the Favorites ZIP field)
    // counts as finishing setup — otherwise the placeholder would linger
    // in the list as a second, unusable "location".
    if (this.firstRun) {
      this.completeFirstRun(place);
      return;
    }
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

/** Id of the placeholder seeded before the user has picked a home. Anything
 *  that could act on a place should check for it, or — better — gate on
 *  `PlacesStore.isFirstRun()`. */
export const SETUP_PENDING_ID = "awc_setup_pending";

/**
 * Seed list for a fresh install: one neutral placeholder, not a real city.
 *
 * This used to hard-code Greeneville TN plus six East Tennessee favorites,
 * which meant every new user — and, on the web build, every visitor —
 * landed in the author's hometown. The first-run setup flow replaces this
 * placeholder with the user's own ZIP before any weather is fetched, so the
 * coordinates below (the geographic center of the contiguous US) exist only
 * to keep the scheduler's context type non-null during setup.
 */
export function defaultPlaces(): Place[] {
  return [
    {
      id: SETUP_PENDING_ID,
      name: "Location not set",
      state: "",
      coord: { lat: 39.8283, lon: -98.5795 },
      isHome: true
    }
  ];
}
