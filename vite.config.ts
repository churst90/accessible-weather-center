import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import * as path from "node:path";
import * as fs from "node:fs";

/**
 * Serves the project-root /assets directory at /assets/* in dev. The user's
 * music + clip libraries live there and are too large to copy under /public.
 * In Electron production builds we'll resolve /assets/* to a sibling folder
 * via a custom protocol — for now this only handles dev.
 */
function serveAssetsPlugin(): Plugin {
  const root = path.resolve(__dirname, "assets");
  return {
    name: "serve-assets",
    configureServer(server) {
      server.middlewares.use("/assets", (req, res, next) => {
        try {
          const decoded = decodeURIComponent((req.url ?? "/").split("?")[0]);
          const filePath = path.join(root, decoded);
          if (!filePath.startsWith(root)) {
            res.statusCode = 403;
            res.end("forbidden");
            return;
          }
          if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            next();
            return;
          }
          const ext = path.extname(filePath).toLowerCase();
          const type =
            ext === ".mp3" ? "audio/mpeg" :
            ext === ".ogg" ? "audio/ogg" :
            ext === ".json" ? "application/json" :
            ext === ".png" ? "image/png" :
            ext === ".svg" ? "image/svg+xml" :
            "application/octet-stream";
          res.setHeader("Content-Type", type);
          res.setHeader("Accept-Ranges", "bytes");
          fs.createReadStream(filePath).pipe(res);
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), serveAssetsPlugin()],
  base: "./",
  resolve: {
    alias: {
      "@core": fileURLToPath(new URL("./src/core", import.meta.url)),
      "@a11y": fileURLToPath(new URL("./src/a11y", import.meta.url)),
      "@audio": fileURLToPath(new URL("./src/audio", import.meta.url)),
      "@ui": fileURLToPath(new URL("./src/ui", import.meta.url)),
      "@platform": fileURLToPath(new URL("./src/platform", import.meta.url))
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Bundle output goes to dist/static/, NOT the default dist/assets/.
    //
    // Two unrelated things would otherwise both be called "assets": the
    // hashed JS/CSS/font bundle Vite emits, and the ~1.3 GB media library
    // served from the site root at /assets/. On the web deploy the app is
    // mounted at /app/, so the default would put the bundle at
    // /app/assets/* right next to /assets/* — two different directories,
    // one name, in the same nginx config. `static` keeps them legible.
    //
    // Note the split is real: files reachable from CSS (fonts, LDL.png) are
    // fingerprinted INTO the bundle by Vite, while the `/assets/...` strings
    // built at runtime in TypeScript pass through untouched and are served
    // from the media library.
    assetsDir: "static"
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Dev-time twin of the nginx `/nwr/` block in
      // deploy/nginx/weather.codyhurst.com.conf. radio.weatherusa.net sends
      // no CORS headers, so neither the station directory nor the WebAudio
      // stream can be loaded cross-origin from a browser. Proxying puts both
      // on our own origin. Applies to `npm run dev` in a browser AND to
      // dev-mode Electron, which loads from localhost:5173.
      "/nwr": {
        target: "https://radio.weatherusa.net",
        changeOrigin: true,
        // Live audio: don't let the dev server buffer the stream.
        ws: false,
        rewrite: (p) => p.replace(/^\/nwr/, "")
      }
    }
  }
});
