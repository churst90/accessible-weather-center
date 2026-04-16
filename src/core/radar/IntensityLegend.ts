import type { PrecipBand } from "../types";

/**
 * Maps radar reflectivity (dBZ) and precipitation rate (mm/h) to plain-language
 * bands and the color name a sighted user would see. Centralizing this here is
 * the *whole point* of accessible radar: every place that talks about a cell —
 * the TTS announcer, the visual renderer, the alert engine — pulls from one
 * source of truth so a "yellow" on screen is always "moderate rain" in audio.
 *
 * Mapping ranges roughly follow the RainViewer/NWS convention.
 */

interface IntensityRow {
  minMmPerHour: number;
  band: PrecipBand;
  colorName: string;
  /** Plain-English label for TTS, e.g. "moderate rain". */
  speech: string;
}

const TABLE: IntensityRow[] = [
  { minMmPerHour: 50, band: "extreme",     colorName: "purple", speech: "extreme rain, more than two inches per hour" },
  { minMmPerHour: 25, band: "very-heavy",  colorName: "magenta", speech: "very heavy rain, around one to two inches per hour" },
  { minMmPerHour: 10, band: "heavy",       colorName: "red",    speech: "heavy rain, around half an inch per hour" },
  { minMmPerHour: 5,  band: "moderate",    colorName: "orange", speech: "moderate rain, around a quarter inch per hour" },
  { minMmPerHour: 2,  band: "moderate",    colorName: "yellow", speech: "moderate rain" },
  { minMmPerHour: 0.5, band: "light",      colorName: "green",  speech: "light rain" },
  { minMmPerHour: 0.05, band: "trace",     colorName: "light green", speech: "drizzle" },
  { minMmPerHour: 0,    band: "none",      colorName: "clear",  speech: "no precipitation" }
];

export function classifyMmPerHour(mmPerHour: number): IntensityRow {
  for (const row of TABLE) {
    if (mmPerHour >= row.minMmPerHour) return row;
  }
  return TABLE[TABLE.length - 1];
}

/**
 * Marshall-Palmer-ish dBZ → mm/h. Z = 200 * R^1.6, so R = (Z/200)^(1/1.6).
 * Z = 10^(dBZ/10).
 */
export function dbzToMmPerHour(dbz: number): number {
  if (dbz <= 5) return 0;
  const z = Math.pow(10, dbz / 10);
  return Math.pow(z / 200, 1 / 1.6);
}

export function describeCell(mmPerHour: number, includeColor = true): string {
  const row = classifyMmPerHour(mmPerHour);
  if (row.band === "none") return row.speech;
  return includeColor ? `${row.speech}, ${row.colorName} on radar` : row.speech;
}

export function mmPerHourToInPerHour(mmPerHour: number): number {
  return mmPerHour / 25.4;
}
