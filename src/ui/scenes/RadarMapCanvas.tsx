import { useEffect, useRef, useCallback } from "react";
import type { LatLon, WeatherAlert } from "../../core/types";
import type { TrackedStorm } from "../../core/radar/StormTracker";
import type { RainViewerClient, RainViewerManifest, RainViewerFrame } from "../../core/weather/RainViewerClient";
import { MapTileCache, type BaseMapStyle } from "../../core/radar/MapTileCache";
import { BAND_INFO, bandInfo } from "../../core/radar/IntensityLegend";
import {
  TILE_SIZE,
  lonToTileX,
  latToTileY,
  tilesCoveringBox,
  boxAround
} from "../../core/radar/TileMath";

/**
 * Animated radar map rendered on an HTML5 Canvas — TV-style.
 *
 * Layers (bottom to top):
 *   1. CartoDB base tiles (geography/roads/labels) — dark matter, or
 *      positron on the machines whose radar ran on a light map
 *   2. RainViewer radar tiles (animated, same NEXRAD source as TV)
 *   3. NWS alert/warning polygons (red=warning, yellow=watch, cyan=advisory)
 *   4. Radar range rings + compass crosshair
 *   5. Storm markers with movement arrows
 *   6. Home location marker
 *   7. Highlight crosshair (for map nav focus)
 *   8. Precipitation legend + timestamp
 *
 * This component is purely decorative — aria-hidden. All meaningful content
 * is in the accessible storm table rendered alongside it.
 */

interface Props {
  center: LatLon;
  storms: TrackedStorm[];
  rainviewer: RainViewerClient;
  /** Active NWS alerts with polygon data. Drawn as colored outlines. */
  alerts?: WeatherAlert[];
  /** Map zoom level. Default 7 (covers ~150 mi radius). */
  zoom?: number;
  /** Radar tile opacity 0-1. Default 0.75. */
  radarOpacity?: number;
  /** Optional CSS class for the canvas wrapper. */
  className?: string;
  /** If provided, highlights this location on the map. */
  highlightCoord?: LatLon | null;
  /** Base map set. The WeatherStar 4000 v2 radar ran on a light map. */
  baseMap?: BaseMapStyle;
  /**
   * Loop through the radar frames. Default true.
   *
   * Set false to draw only the newest frame and stop. The Weatherscan V2
   * L-bar mounts this beside every scene rather than on one, so its loop
   * would run for the whole session — and this component animates in
   * JavaScript, where a `prefers-reduced-motion` media query does not reach
   * it. The L-bar passes the user's preference in.
   */
  animate?: boolean;
}

const DEFAULT_ZOOM = 7;
const FRAME_DELAY_MS = 600;
const LAST_FRAME_PAUSE_MS = 2000;
const RADIUS_MI = 150;

export function RadarMapCanvas({
  center,
  storms,
  rainviewer,
  alerts = [],
  zoom = DEFAULT_ZOOM,
  radarOpacity = 0.75,
  className,
  highlightCoord,
  animate: shouldAnimate = true,
  baseMap = "dark"
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef(new MapTileCache());
  const manifestRef = useRef<RainViewerManifest | null>(null);
  const frameIndexRef = useRef(0);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const stormsRef = useRef(storms);
  stormsRef.current = storms;
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const highlightRef = useRef(highlightCoord);
  highlightRef.current = highlightCoord;

  const getFrames = useCallback((): RainViewerFrame[] => {
    const m = manifestRef.current;
    if (!m) return [];
    return [...m.radar.past, ...m.radar.nowcast];
  }, []);

  /** Convert a lat/lon to canvas pixel position. */
  const coordToCanvas = useCallback(
    (coord: LatLon, canvasW: number, canvasH: number) => {
      const bbox = boxAround(center, RADIUS_MI);
      const tiles = tilesCoveringBox(bbox, zoom);
      if (tiles.length === 0) return { x: 0, y: 0 };
      const minTx = Math.min(...tiles.map((t) => t.x));
      const maxTx = Math.max(...tiles.map((t) => t.x));
      const minTy = Math.min(...tiles.map((t) => t.y));
      const maxTy = Math.max(...tiles.map((t) => t.y));

      const gridW = (maxTx - minTx + 1) * TILE_SIZE;
      const gridH = (maxTy - minTy + 1) * TILE_SIZE;

      const tileX = lonToTileX(coord.lon, zoom);
      const tileY = latToTileY(coord.lat, zoom);
      const px = (tileX - minTx) * TILE_SIZE;
      const py = (tileY - minTy) * TILE_SIZE;

      return {
        x: (px / gridW) * canvasW,
        y: (py / gridH) * canvasH
      };
    },
    [center, zoom]
  );

  /** Draw one complete frame to the canvas. */
  const drawFrame = useCallback(
    async (frameIdx: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const manifest = manifestRef.current;
      const cache = cacheRef.current;

      const w = canvas.width;
      const h = canvas.height;

      // Calculate tiles covering the view.
      const bbox = boxAround(center, RADIUS_MI);
      const tiles = tilesCoveringBox(bbox, zoom);
      if (tiles.length === 0) return;

      const minTx = Math.min(...tiles.map((t) => t.x));
      const maxTx = Math.max(...tiles.map((t) => t.x));
      const minTy = Math.min(...tiles.map((t) => t.y));
      const maxTy = Math.max(...tiles.map((t) => t.y));

      const gridCols = maxTx - minTx + 1;
      const gridRows = maxTy - minTy + 1;
      const tileW = w / gridCols;
      const tileH = h / gridRows;

      // Clear canvas — use the theme's deep background color.
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--ws-bg-deep").trim() || "#080c18";
      ctx.fillRect(0, 0, w, h);

      // Layer 1: Base map tiles.
      for (const t of tiles) {
        const url = MapTileCache.baseUrl(zoom, t.x, t.y, baseMap);
        const img = await cache.getTile(url);
        if (img) {
          const dx = (t.x - minTx) * tileW;
          const dy = (t.y - minTy) * tileH;
          ctx.drawImage(img, dx, dy, tileW, tileH);
        }
      }

      // Layer 2: Radar tiles (with opacity).
      if (manifest) {
        const frames = getFrames();
        const frame = frames[frameIdx];
        if (frame) {
          ctx.globalAlpha = radarOpacity;
          for (const t of tiles) {
            const url = MapTileCache.radarUrl(manifest.host, frame.path, zoom, t.x, t.y);
            const img = await cache.getTile(url);
            if (img) {
              const dx = (t.x - minTx) * tileW;
              const dy = (t.y - minTy) * tileH;
              ctx.drawImage(img, dx, dy, tileW, tileH);
            }
          }
          ctx.globalAlpha = 1;
        }
      }

      // Layer 3: NWS alert/warning polygons.
      const currentAlerts = alertsRef.current;
      for (const alert of currentAlerts) {
        if (alert.polygon && alert.polygon.length >= 3) {
          drawAlertPolygon(ctx, alert, w, h, coordToCanvas);
        }
      }

      // Layer 4: Radar range rings + crosshair.
      drawRadarOverlay(ctx, w, h, coordToCanvas(center, w, h));

      // Layer 5: Storm markers with movement arrows.
      const currentStorms = stormsRef.current;
      for (const storm of currentStorms) {
        const pos = coordToCanvas(storm.centroid, w, h);
        drawStormMarker(ctx, pos.x, pos.y, storm.band);
        // Movement arrow.
        if (storm.movementDeg != null && storm.movementMph != null && storm.movementMph > 0) {
          drawMovementArrow(ctx, pos.x, pos.y, storm.movementDeg, storm.movementMph);
        }
      }

      // Layer 6: Home marker.
      const home = coordToCanvas(center, w, h);
      drawHomeMarker(ctx, home.x, home.y);

      // Layer 7: Highlight marker (for map nav focus).
      const hl = highlightRef.current;
      if (hl) {
        const pos = coordToCanvas(hl, w, h);
        drawHighlightMarker(ctx, pos.x, pos.y);
      }

      // Layer 8: Precipitation legend + timestamp.
      drawPrecipLegend(ctx, w, h);

      if (manifest) {
        const frames = getFrames();
        const frame = frames[frameIdx];
        if (frame) {
          const time = new Date(frame.time * 1000);
          const label = time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          const isNowcast = frameIdx >= manifest.radar.past.length;
          const tag = isNowcast ? `${label} (forecast)` : label;

          ctx.font = "bold 14px sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          const metrics = ctx.measureText(tag);
          const pad = 6;
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
          ctx.fillRect(8, 8, metrics.width + pad * 2, 24);
          ctx.fillStyle = isNowcast ? "#ffcc00" : "#ffffff";
          ctx.fillText(tag, 8 + pad, 12);
        }
      }
    },
    [center, zoom, radarOpacity, coordToCanvas, getFrames, baseMap]
  );

  /** Animation loop: advance through radar frames. */
  const animate = useCallback(() => {
    if (!mountedRef.current) return;
    const frames = getFrames();
    if (frames.length === 0) {
      animTimerRef.current = setTimeout(animate, 2000);
      return;
    }

    // Still, by request: draw the newest frame and stop. No timer is armed,
    // so nothing reschedules — the map still updates when the manifest
    // refreshes, it just does not sweep.
    if (!shouldAnimate) {
      frameIndexRef.current = frames.length - 1;
      void drawFrame(frames.length - 1);
      return;
    }

    const idx = frameIndexRef.current % frames.length;
    void drawFrame(idx).then(() => {
      if (!mountedRef.current) return;
      frameIndexRef.current = idx + 1;
      const isLast = idx === frames.length - 1;
      const delay = isLast ? LAST_FRAME_PAUSE_MS : FRAME_DELAY_MS;
      animTimerRef.current = setTimeout(animate, delay);
    });
  }, [drawFrame, getFrames, shouldAnimate]);

  // Fetch manifest and preload tiles on mount / center change.
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const init = async () => {
      try {
        const manifest = await rainviewer.getManifest();
        if (cancelled) return;
        manifestRef.current = manifest;

        const bbox = boxAround(center, RADIUS_MI);
        const tiles = tilesCoveringBox(bbox, zoom);
        const baseUrls = tiles.map((t) => MapTileCache.baseUrl(zoom, t.x, t.y, baseMap));
        await cacheRef.current.preload(baseUrls);

        const frames = [...manifest.radar.past, ...manifest.radar.nowcast];
        const radarUrls = frames.flatMap((f) =>
          tiles.map((t) => MapTileCache.radarUrl(manifest.host, f.path, zoom, t.x, t.y))
        );
        void cacheRef.current.preload(radarUrls);

        frameIndexRef.current = 0;
        animate();
      } catch {
        void drawFrame(0);
      }
    };

    void init();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
    // `baseMap` is listed even though `drawFrame` already changes identity
    // with it, so the effect was re-running correctly anyway. Naming it makes
    // the base-tile preload at the top of this effect self-evidently correct
    // rather than correct-by-transitivity through another hook's dep array.
  }, [center, zoom, rainviewer, animate, drawFrame, baseMap]);

  // Re-draw the current frame when storms, alerts, or highlight change.
  useEffect(() => {
    const frames = getFrames();
    if (frames.length === 0) return;
    const idx = Math.max(0, (frameIndexRef.current - 1) % frames.length);
    void drawFrame(idx);
  }, [storms, alerts, highlightCoord, drawFrame, getFrames]);

  return (
    <div className={`ws-radar-map ${className ?? ""}`} aria-hidden="true">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ width: "100%", height: "auto", borderRadius: 6 }}
      />
    </div>
  );
}

// ─── Drawing helpers ───

/** Draw an NWS alert polygon as a colored outline + semi-transparent fill. */
function drawAlertPolygon(
  ctx: CanvasRenderingContext2D,
  alert: WeatherAlert,
  w: number,
  h: number,
  toCanvas: (coord: LatLon, w: number, h: number) => { x: number; y: number }
): void {
  const poly = alert.polygon!;
  if (poly.length < 3) return;

  const color = alertPolygonColor(alert);

  ctx.save();
  ctx.beginPath();
  // NWS polygons use [lon, lat] ordering.
  const first = toCanvas({ lat: poly[0][1], lon: poly[0][0] }, w, h);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < poly.length; i++) {
    const pt = toCanvas({ lat: poly[i][1], lon: poly[i][0] }, w, h);
    ctx.lineTo(pt.x, pt.y);
  }
  ctx.closePath();

  // Semi-transparent fill.
  ctx.fillStyle = color.fill;
  ctx.fill();

  // Solid outline.
  ctx.strokeStyle = color.stroke;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Label at centroid.
  let cx = 0, cy = 0;
  for (const pt of poly) {
    const p = toCanvas({ lat: pt[1], lon: pt[0] }, w, h);
    cx += p.x;
    cy += p.y;
  }
  cx /= poly.length;
  cy /= poly.length;

  const shortLabel = alertShortLabel(alert.event);
  if (shortLabel) {
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const m = ctx.measureText(shortLabel);
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(cx - m.width / 2 - 3, cy - 7, m.width + 6, 14);
    ctx.fillStyle = color.stroke;
    ctx.fillText(shortLabel, cx, cy);
  }

  ctx.restore();
}

function alertPolygonColor(alert: WeatherAlert): { stroke: string; fill: string } {
  const ev = alert.event.toLowerCase();
  // Tornado — bright red
  if (/tornado/.test(ev)) return { stroke: "#ff0000", fill: "rgba(255, 0, 0, 0.15)" };
  // Severe thunderstorm — orange
  if (/severe thunderstorm/.test(ev)) return { stroke: "#ff8800", fill: "rgba(255, 136, 0, 0.12)" };
  // Flash flood — dark green
  if (/flash flood/.test(ev)) return { stroke: "#00cc44", fill: "rgba(0, 204, 68, 0.10)" };
  // Flood — green
  if (/flood/.test(ev)) return { stroke: "#00aa33", fill: "rgba(0, 170, 51, 0.10)" };
  // Winter storm / blizzard — pink
  if (/winter|blizzard|ice|freezing/.test(ev)) return { stroke: "#ff66cc", fill: "rgba(255, 102, 204, 0.10)" };
  // Based on severity
  if (alert.severity === "Extreme") return { stroke: "#ff0000", fill: "rgba(255, 0, 0, 0.12)" };
  if (alert.severity === "Severe") return { stroke: "#ff6600", fill: "rgba(255, 102, 0, 0.10)" };
  // Watch — yellow
  if (/watch/.test(ev)) return { stroke: "#ffcc00", fill: "rgba(255, 204, 0, 0.08)" };
  // Advisory — cyan
  if (/advisory/.test(ev)) return { stroke: "#00ccff", fill: "rgba(0, 204, 255, 0.08)" };
  // Default — yellow
  return { stroke: "#ffcc00", fill: "rgba(255, 204, 0, 0.08)" };
}

function alertShortLabel(event: string): string {
  const ev = event.toLowerCase();
  if (/tornado warning/.test(ev)) return "TOR";
  if (/severe thunderstorm warning/.test(ev)) return "SVR";
  if (/flash flood warning/.test(ev)) return "FFW";
  if (/flood warning/.test(ev)) return "FLW";
  if (/winter storm warning/.test(ev)) return "WSW";
  if (/blizzard/.test(ev)) return "BZW";
  if (/ice storm/.test(ev)) return "ISW";
  if (/tornado watch/.test(ev)) return "TOA";
  if (/severe thunderstorm watch/.test(ev)) return "SVA";
  if (/flood watch|flash flood watch/.test(ev)) return "FFA";
  if (/winter storm watch/.test(ev)) return "WSA";
  if (/wind advisory/.test(ev)) return "WND";
  if (/heat advisory/.test(ev)) return "HT";
  if (/freeze/.test(ev)) return "FRZ";
  if (/fog/.test(ev)) return "FOG";
  return "";
}

/** Draw radar range rings and crosshairs centered on home. */
function drawRadarOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  homePos: { x: number; y: number }
): void {
  ctx.save();
  ctx.strokeStyle = "rgba(0, 200, 100, 0.15)";
  ctx.lineWidth = 1;

  const maxR = Math.min(w, h) * 0.48;
  for (const frac of [0.33, 0.66, 1.0]) {
    const r = maxR * frac;
    ctx.beginPath();
    ctx.arc(homePos.x, homePos.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Crosshair through home.
  ctx.beginPath();
  ctx.moveTo(homePos.x, 0);
  ctx.lineTo(homePos.x, h);
  ctx.moveTo(0, homePos.y);
  ctx.lineTo(w, homePos.y);
  ctx.stroke();

  // Compass labels.
  ctx.font = "10px sans-serif";
  ctx.fillStyle = "rgba(0, 200, 100, 0.30)";
  ctx.textAlign = "center";
  const labelR = maxR * 0.66 + 12;
  ctx.fillText("N", homePos.x, homePos.y - labelR);
  ctx.fillText("S", homePos.x, homePos.y + labelR + 10);
  ctx.textAlign = "left";
  ctx.fillText("E", homePos.x + labelR + 4, homePos.y + 4);
  ctx.textAlign = "right";
  ctx.fillText("W", homePos.x - labelR - 4, homePos.y + 4);

  // Range labels.
  ctx.textAlign = "left";
  ctx.font = "9px sans-serif";
  ctx.fillStyle = "rgba(0, 200, 100, 0.25)";
  ctx.fillText("50 mi", homePos.x + maxR * 0.33 + 3, homePos.y - 3);
  ctx.fillText("100 mi", homePos.x + maxR * 0.66 + 3, homePos.y - 3);
  ctx.fillText("150 mi", homePos.x + maxR + 3, homePos.y - 3);

  ctx.restore();
}

function drawHomeMarker(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(78, 201, 255, 0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#4ec9ff";
  ctx.fill();

  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("HOME", x, y + 14);
}

function drawStormMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  band: string
): void {
  const color = stormColor(band);
  ctx.beginPath();
  ctx.moveTo(x, y - 8);
  ctx.lineTo(x - 6, y + 4);
  ctx.lineTo(x + 6, y + 4);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Draw an arrow from a storm marker showing its movement direction and speed. */
function drawMovementArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  headingDeg: number,
  speedMph: number
): void {
  // Arrow length proportional to speed — min 15px, max 50px.
  const len = Math.min(50, Math.max(15, speedMph * 1.5));
  // Convert heading (0=north, clockwise) to canvas angle (0=right, counterclockwise math).
  const rad = ((headingDeg - 90) * Math.PI) / 180;
  const ex = x + Math.cos(rad) * len;
  const ey = y + Math.sin(rad) * len;

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // Arrowhead.
  const headLen = 8;
  const a1 = rad + Math.PI * 0.8;
  const a2 = rad - Math.PI * 0.8;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex + Math.cos(a1) * headLen, ey + Math.sin(a1) * headLen);
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex + Math.cos(a2) * headLen, ey + Math.sin(a2) * headLen);
  ctx.stroke();

  // Speed label.
  ctx.font = "bold 9px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const lx = x + Math.cos(rad) * (len * 0.5);
  const ly = y + Math.sin(rad) * (len * 0.5) - 4;
  ctx.fillText(`${Math.round(speedMph)}`, lx, ly);

  ctx.restore();
}

function drawHighlightMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
): void {
  ctx.strokeStyle = "#ffd24d";
  ctx.lineWidth = 2;
  const size = 14;
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x - 4, y);
  ctx.moveTo(x + 4, y);
  ctx.lineTo(x + size, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y - 4);
  ctx.moveTo(x, y + 4);
  ctx.lineTo(x, y + size);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.stroke();
}

/** Draw the precipitation intensity legend in the bottom-right corner.
 *  Colors and labels come from IntensityLegend's BAND_INFO — the same
 *  table the storm markers and every spoken description use, so the
 *  legend can never disagree with the dots again (it used to call the
 *  moderate color "Heavy"). */
function drawPrecipLegend(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const entries = (["trace", "light", "moderate", "heavy", "very-heavy", "extreme"] as const)
    .map((band) => ({ color: BAND_INFO[band].color, label: BAND_INFO[band].label }));

  const boxW = 90;
  const rowH = 14;
  const pad = 6;
  const totalH = entries.length * rowH + pad * 2 + 14; // +14 for title
  const x0 = w - boxW - 12;
  const y0 = h - totalH - 12;

  ctx.save();

  // Background.
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(x0, y0, boxW, totalH);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, boxW, totalH);

  // Title.
  ctx.font = "bold 10px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("PRECIP", x0 + pad, y0 + pad);

  // Entries.
  ctx.font = "9px sans-serif";
  for (let i = 0; i < entries.length; i++) {
    const ey = y0 + pad + 14 + i * rowH;
    // Color swatch.
    ctx.fillStyle = entries[i].color;
    ctx.fillRect(x0 + pad, ey + 1, 10, 10);
    // Label.
    ctx.fillStyle = "#cccccc";
    ctx.fillText(entries[i].label, x0 + pad + 14, ey + 1);
  }

  ctx.restore();
}

function stormColor(band: string): string {
  return bandInfo(band).color;
}
