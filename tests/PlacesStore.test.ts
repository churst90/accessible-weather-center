import { test } from "node:test";
import assert from "node:assert/strict";
import { PlacesStore, defaultPlaces, SETUP_PENDING_ID } from "../src/core/places/PlacesStore";
import type { Place } from "../src/core/types";

/**
 * Minimal localStorage stand-in. PlacesStore feature-detects the global and
 * no-ops without it, so these tests install one to exercise the real
 * persist/load paths.
 */
function installStorage(seed?: Record<string, string>) {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    }
  };
  return map;
}

const KEY = "awc.places.v1";

const NASHVILLE: Place = {
  id: "zip_37201",
  name: "Nashville",
  state: "TN",
  coord: { lat: 36.1665, lon: -86.7844 }
};

test("the seed list is a placeholder, not a real city", () => {
  const seed = defaultPlaces();
  assert.equal(seed.length, 1, "exactly one placeholder");
  assert.equal(seed[0].id, SETUP_PENDING_ID);
  // The regression this guards: a hard-coded home meant every new user, and
  // every visitor to the web build, started in the author's hometown.
  assert.equal(seed[0].state, "");
});

test("empty storage reports first run", () => {
  installStorage();
  const store = new PlacesStore(defaultPlaces());
  assert.equal(store.isFirstRun(), true);
});

test("first run does not persist the placeholder", () => {
  const map = installStorage();
  new PlacesStore(defaultPlaces());
  // If construction wrote the seed, the next launch would look configured
  // and the setup prompt would never appear again.
  assert.equal(map.has(KEY), false);
});

test("completeFirstRun replaces the placeholder and marks home", () => {
  installStorage();
  const store = new PlacesStore(defaultPlaces());
  store.completeFirstRun(NASHVILLE);

  assert.equal(store.isFirstRun(), false);
  assert.equal(store.list().length, 1, "placeholder is gone");
  assert.equal(store.list()[0].id, NASHVILLE.id);
  assert.equal(store.home()?.name, "Nashville");
  assert.equal(store.home()?.isHome, true);
  assert.ok(
    !store.list().some((p) => p.id === SETUP_PENDING_ID),
    "placeholder must not survive setup"
  );
});

test("completeFirstRun notifies subscribers so pollers re-point", () => {
  installStorage();
  const store = new PlacesStore(defaultPlaces());
  let seen: readonly Place[] | null = null;
  store.subscribe((list) => { seen = list; });
  store.completeFirstRun(NASHVILLE);
  assert.ok(seen, "subscriber fired");
  assert.equal(seen![0].name, "Nashville");
});

test("a completed setup survives a reload and is not a first run", () => {
  const map = installStorage();
  new PlacesStore(defaultPlaces()).completeFirstRun(NASHVILLE);
  assert.ok(map.has(KEY), "setup persisted");

  const reloaded = new PlacesStore(defaultPlaces());
  assert.equal(reloaded.isFirstRun(), false);
  assert.equal(reloaded.home()?.name, "Nashville");
});

test("upsert during first run completes setup instead of appending", () => {
  installStorage();
  const store = new PlacesStore(defaultPlaces());
  // The Favorites ZIP field is the other way into the store; it must not
  // leave the placeholder behind as a second, unusable "location".
  store.upsert(NASHVILLE);
  assert.equal(store.isFirstRun(), false);
  assert.equal(store.list().length, 1);
  assert.equal(store.list()[0].id, NASHVILLE.id);
  assert.equal(store.home()?.isHome, true);
});

test("upsert after setup appends normally", () => {
  installStorage();
  const store = new PlacesStore(defaultPlaces());
  store.completeFirstRun(NASHVILLE);
  store.upsert({ id: "zip_37403", name: "Chattanooga", state: "TN", coord: { lat: 35.05, lon: -85.31 } });
  assert.equal(store.list().length, 2);
  assert.equal(store.home()?.name, "Nashville", "home unchanged by a plain add");
});
