/**
 * Device profiles — one declaration per machine we emulate.
 *
 * The project is an emulator, and this is the emulator pattern: a shared
 * kernel (data clients, scheduler, phrase composition, playback, the whole
 * accessibility layer) plus a per-machine definition of what that machine
 * actually was. Nothing here is behaviour; it is all declaration. Ten copies
 * of `composeCurrentConditions` would mean ten copies of every bug.
 *
 * Before this existed, answering "what does a WeatherStar 4000 v1 do?" meant
 * reading six files: themes.ts, getSceneOrder, backgroundCatalog.ts,
 * sceneRegistry.tsx, sceneSegments.ts, and the era tags buried in
 * narratorSchema.ts. Several real bugs lived in exactly that scatter — clips
 * wired under key names no scene id matched, a product renamed in 2004 being
 * announced by hardware from 1988, half a background pool pointing at files
 * that never existed.
 *
 * Rule for editing: if a fact is specific to one machine, it belongs here. If
 * it is an algorithm, it belongs in the kernel and takes the fact as input.
 *
 * Sources for the per-machine facts are cited inline in each profile, and
 * trace back to docs/legacy-eras.md, docs/weatherscan-eras.md and the
 * captures under docs/reference/.
 */

import type { NarratorId } from "../audio/manifests/narratorSchema";
import type { ProductEra } from "../audio/manifests/sceneSegments";

/** Scene ids, matching the ids the scene classes report. */
export type ProductId =
  | "current" | "localforecast" | "radar" | "extended" | "hourly"
  | "travel" | "almanac" | "detailed" | "feelslike" | "stormtracker"
  | "overnight" | "weekend" | "precip" | "temptrend" | "traffic"
  | "airport" | "alerts";

/**
 * How a machine treats one product.
 *
 *   core      — in the base rotation, always on
 *   optional  — the unit could show it, but only if the cable operator
 *               bought the package (Weatherscan Plus activity packs, IS1
 *               Air Quality, Traffic Pulse). User-toggleable in Settings.
 *   absent    — this hardware never had it. Selecting it should say so in
 *               the unit's own voice, not silently show a modern screen.
 */
export type ProductAvailability = "core" | "optional" | "absent";

export interface ProductSpec {
  availability: ProductAvailability;
  /** What THIS machine called the product on screen and in narration.
   *  Omitted where the generic scene title is already correct. */
  name?: string;
  /** Narrator intro pool keys to prefer, most period-accurate first. */
  intro?: readonly string[];
  /** Why it is absent — shown to the user and used in the docs. */
  absentNote?: string;
}

export interface DeviceCapabilities {
  /** Lower Display Line crawl along the bottom. */
  ldl: boolean;
  /** Persistent contextual footer bar (WeatherStar 4000 v2 only). */
  footer: boolean;
  /** Graphical weather icons. The 3000 and Jr were text-only. */
  icons: boolean;
  /** Can render radar on the unit at all. */
  radar: boolean;
  /** Has any recorded narration. The 3000 had a warning tone and nothing
   *  else — no local voice track ever existed for it. */
  narration: boolean;
  /** Local advertising / sponsor slot in the rotation. */
  sponsorSlot: boolean;
}

/**
 * Everything about how a machine looks.
 *
 * Lives with the machine rather than in a parallel themes table, so a unit's
 * palette, typeface stack, icon set and forecast branding are all readable in
 * one place alongside its products and capabilities.
 */
export interface DeviceVisuals {
  /** Icon pool root. The 3000 and Jr point at legacy text-era sets. */
  iconSet: string;
  /** HD WEBP icon resolution where the era had one. */
  iconResolution?: 28 | 42 | 68;
  /** Theme-level background, or "" when the unit uses a rotating pool. */
  backgroundImage: string;
  /** What this unit called its multi-day forecast on screen. */
  extendedTitle: string;
  /** CSS custom properties applied to :root when this machine is selected. */
  vars: Record<string, string>;
}

export interface Device {
  id: string;
  label: string;
  /** Production years, for documentation and era reasoning. */
  years: string;
  /** Which side of the September 2004 TWC product rename this unit sits on. */
  era: ProductEra;
  /** Narrator recorded for this hardware. */
  voice: NarratorId;
  /** Music pools era-matched to the unit. */
  musicTags: readonly string[];
  /** Multi-day forecast day count as this unit displayed it. */
  extendedDays: 3 | 5 | 7;
  capabilities: DeviceCapabilities;
  visuals: DeviceVisuals;
  /** Base rotation, in the order this unit ran it. */
  rundown: readonly ProductId[];
  /** Per-product availability and naming. Products not listed default to
   *  "optional" so newer value-add scenes stay user-toggleable. */
  products: Partial<Record<ProductId, ProductSpec>>;
  /** Known missing art, audio or layout work for this machine. Surfaced by
   *  `npm run device:report` and mirrored into docs/asset-gaps.md. */
  gaps?: readonly string[];
}

/** Availability for a product on a device, defaulting to optional. */
export function availabilityOf(device: Device, product: ProductId): ProductAvailability {
  return device.products[product]?.availability ?? "optional";
}

/** What this machine called a product, falling back to null for "use the
 *  generic scene title". */
export function productName(device: Device, product: ProductId): string | null {
  return device.products[product]?.name ?? null;
}
