import type { LatLon, RadarFrame, RadarCell } from "../types";
import { classifyMmPerHour } from "../radar/IntensityLegend";

/**
 * RainViewer is the easy on-ramp for radar in v1: free, no key, global coverage,
 * a JSON manifest of frames, and tile URLs we can fetch as PNG.
 *
 * For accessibility we don't render tiles directly — we sample them into a
 * sparse RadarFrame of cells with intensity already classified. Sampling is
 * done in the renderer (it needs a canvas to read pixels), so this client is
 * limited to the manifest fetch and URL templating.
 */
export class RainViewerClient {
  private readonly manifestUrl = "https://api.rainviewer.com/public/weather-maps.json";

  async getManifest(): Promise<RainViewerManifest> {
    const res = await fetch(this.manifestUrl);
    if (!res.ok) throw new Error(`RainViewer manifest ${res.status}`);
    return (await res.json()) as RainViewerManifest;
  }

  /**
   * Build a tile URL for a specific frame at a given zoom/x/y.
   * Color scheme 4 is the original NWS-ish palette; size 256, smooth=1.
   */
  buildTileUrl(frame: RainViewerFrame, host: string, z: number, x: number, y: number): string {
    return `${host}${frame.path}/256/${z}/${x}/${y}/4/1_1.png`;
  }
}

/**
 * Convert a list of decoded pixel samples into a RadarFrame. Pixel decoding
 * (PNG → mm/h) is the renderer's job because it requires a canvas; this is
 * the framework-agnostic step that wraps the result for the rest of the app.
 */
export function buildRadarFrame(
  capturedAt: Date,
  bounds: RadarFrame["bounds"],
  samples: Array<{ coord: LatLon; mmPerHour: number }>
): RadarFrame {
  const cells: RadarCell[] = samples
    .filter((s) => s.mmPerHour > 0)
    .map((s) => {
      const row = classifyMmPerHour(s.mmPerHour);
      return {
        lat: s.coord.lat,
        lon: s.coord.lon,
        dbz: null,
        mmPerHour: s.mmPerHour,
        band: row.band,
        colorName: row.colorName
      };
    });
  return {
    capturedAt,
    source: "rainviewer",
    bounds,
    cells
  };
}

export interface RainViewerManifest {
  version: string;
  generated: number;
  host: string;
  radar: {
    past: RainViewerFrame[];
    nowcast: RainViewerFrame[];
  };
}

export interface RainViewerFrame {
  time: number;
  path: string;
}
