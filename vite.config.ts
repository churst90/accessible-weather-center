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
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
