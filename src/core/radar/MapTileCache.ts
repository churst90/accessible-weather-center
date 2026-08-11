/** Which CARTO base set to draw under the radar. */
export type BaseMapStyle = "dark" | "light";

/**
 * Simple in-memory image cache for slippy map tiles. Loads tile PNGs into
 * HTMLImageElement instances so the canvas can drawImage() them directly.
 *
 * Two tile sources are supported:
 *   - Base map (CartoDB dark matter, or positron for the machines whose
 *     radar sat on a light map)
 *   - Radar overlay (RainViewer animated frames)
 *
 * The cache is bounded by a simple LRU eviction: once it exceeds MAX_ENTRIES,
 * the oldest entries are pruned. Tile images are small (~15-30 KB each) so
 * even a few hundred entries are fine in memory.
 */

const MAX_ENTRIES = 512;

export class MapTileCache {
  private readonly cache = new Map<string, HTMLImageElement>();
  private readonly inflight = new Map<string, Promise<HTMLImageElement>>();

  /**
   * Get or fetch a tile image. Returns the cached image if available,
   * otherwise fetches it and caches the result. Failed fetches return null
   * (the canvas just skips that tile).
   */
  async getTile(url: string): Promise<HTMLImageElement | null> {
    const cached = this.cache.get(url);
    if (cached) return cached;

    const existing = this.inflight.get(url);
    if (existing) return existing;

    const promise = this.loadImage(url);
    this.inflight.set(url, promise);
    try {
      const img = await promise;
      this.cache.set(url, img);
      this.evictIfNeeded();
      return img;
    } catch {
      return null;
    } finally {
      this.inflight.delete(url);
    }
  }

  /**
   * Preload a batch of tile URLs in parallel. Useful for preloading all
   * frames of a radar animation so playback doesn't stutter.
   */
  async preload(urls: string[]): Promise<void> {
    await Promise.all(urls.map((u) => this.getTile(u)));
  }

  /**
   * Build a CartoDB base tile URL.
   *
   * Dark matter by default, which suits every machine whose radar sat on a
   * dark navy map. The WeatherStar 4000 v2 is the exception: its 2005 radar
   * redesign moved to a light off-white map with red state borders
   * (`docs/reference/ws4000/WS4000_Simulator_v2_-_Local_Radar.jpg`), so it
   * asks for "light" and gets CARTO's positron.
   *
   * This is the closest available stand-in, not a match. The real basemap had
   * pale-blue water, black coastlines and red state borders; positron is
   * grey-on-white with no state emphasis.
   */
  static baseUrl(z: number, x: number, y: number, style: BaseMapStyle = "dark"): string {
    // Use subdomains a-d for connection parallelism.
    const sub = ["a", "b", "c", "d"][(x + y) % 4];
    const set = style === "light" ? "light_all" : "dark_all";
    return `https://${sub}.basemaps.cartocdn.com/${set}/${z}/${x}/${y}.png`;
  }

  /** Build a RainViewer radar tile URL for a specific frame. */
  static radarUrl(
    host: string,
    path: string,
    z: number,
    x: number,
    y: number
  ): string {
    // Scheme 2 ("Universal Blue") — the only one the server actually serves;
    // the value is ignored, so naming it honestly costs nothing. Smoothing
    // stays ON here because these tiles are DRAWN, not decoded: blended edges
    // look better on screen and nothing reads their pixels back. The sampler
    // in RainViewerClient requests smooth=0 for exactly the opposite reason.
    //
    // Zoom above 7 gets a "Zoom Level Not Supported" placeholder image.
    return `${host}${path}/256/${z}/${x}/${y}/2/1_1.png`;
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`tile load failed: ${url}`));
      img.src = url;
    });
  }

  private evictIfNeeded(): void {
    if (this.cache.size <= MAX_ENTRIES) return;
    // Map iteration order is insertion order — delete the oldest entries.
    const excess = this.cache.size - MAX_ENTRIES;
    let removed = 0;
    for (const key of this.cache.keys()) {
      if (removed >= excess) break;
      this.cache.delete(key);
      removed++;
    }
  }
}
