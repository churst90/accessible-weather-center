/**
 * The device registry — every machine the emulator reproduces.
 *
 * This is the single place to answer "what was this hardware?". The kernel
 * (scheduler, composers, playback, accessibility layer) reads from here; it
 * never branches on a theme id of its own accord.
 */

import type { Device, ProductId, ProductAvailability } from "./types";
import type { NarratorId } from "../audio/manifests/narratorSchema";
import { DEVICES as DEVICE_LIST } from "./registry";

export * from "./types";

/** Declaration order matches the Settings theme list. */
export const DEVICES: readonly Device[] = DEVICE_LIST;

const BY_ID = new Map(DEVICES.map((d) => [d.id, d]));

/** The default machine — WeatherStar 4000 v2, matching SettingsStore. */
export const DEFAULT_DEVICE_ID = "ws4000-v2";

export function getDevice(id: string): Device {
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_DEVICE_ID)!;
}

export function hasDevice(id: string): boolean {
  return BY_ID.has(id);
}

/**
 * Which voice actually narrates on this machine, given the user's preference.
 *
 * One function so the answer cannot differ between the Settings dropdown and
 * the thing that plays the clips. It used to: Settings offered every narrator
 * in the registry against any machine, and App independently resolved
 * `settings.narrator ?? theme.defaultNarrator`. Pick a voice, switch to a
 * WeatherStar 3000, and you got narration on a machine whose entire point is
 * that it had none — the unit shipped with a warning tone and no voice track.
 *
 * Hardware capability wins over preference. A preference for something the
 * machine could not do is not a preference the emulator should honour, in the
 * same way the scene list refuses to show a 3000 a radar screen.
 */
export function resolveNarrator(
  deviceId: string,
  preferred: string | null | undefined
): NarratorId {
  const device = getDevice(deviceId);
  if (!device.capabilities.narration) return "silent";
  return (preferred as NarratorId) || device.voice;
}

/**
 * Can the user choose a voice for this machine at all?
 * False means the Settings panel should say why rather than offer a dropdown
 * that does nothing.
 */
export function canNarrate(deviceId: string): boolean {
  return getDevice(deviceId).capabilities.narration;
}

/**
 * Was this voice ever heard on this machine?
 *
 * Used to sort the Settings dropdown rather than to censor it. Playing Jim
 * Cantore over a WeatherStar 4000 is ahistorical, not harmful, and someone
 * may well want to hear it — but it should be labelled as the novelty it is,
 * not sat in the list looking equally correct. Mixing the two indiscriminately
 * is how the IntelliStar ended up assigned the wrong narrator for months.
 */
export function isAuthenticVoice(deviceId: string, narrator: string): boolean {
  return getDevice(deviceId).voice === narrator;
}

/**
 * Scene rotation for a machine: its own rundown, then whichever optional
 * products the user enabled, then alerts last.
 *
 * `absent` products are never offered. That is the emulator being honest —
 * a WeatherStar 3000 with a radar screen is not a WeatherStar 3000.
 */
export function deviceSceneOrder(
  id: string,
  isEnabled: (product: string) => boolean = () => true
): string[] {
  const device = getDevice(id);
  const core: ProductId[] = device.rundown.filter((p): p is ProductId => p !== "alerts");
  const optional = (Object.keys(device.products) as ProductId[])
    .filter((p) => device.products[p]?.availability === "optional")
    .filter((p) => !core.includes(p))
    .filter((p) => isEnabled(p));
  return [...core, ...optional, "alerts"];
}

/** Products this machine never had, for the "not available" message. */
export function absentProducts(id: string): ProductId[] {
  const device = getDevice(id);
  return (Object.keys(device.products) as ProductId[])
    .filter((p) => device.products[p]?.availability === "absent");
}

export function productAvailability(id: string, product: ProductId): ProductAvailability {
  return getDevice(id).products[product]?.availability ?? "optional";
}

/** Why a machine lacks a product, for the on-screen notice. */
export function absentNote(id: string, product: ProductId): string | null {
  return getDevice(id).products[product]?.absentNote ?? null;
}
