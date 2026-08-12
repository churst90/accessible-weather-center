/**
 * Rasterize the AWC mark into every size the app and its installers need.
 *
 * Sources are `build/icon.svg` (full mark) and `build/icon-tray.svg` (the
 * detail-stripped small variant). Outputs are committed, so this only needs
 * running when the artwork changes — a fresh clone builds installers without
 * it.
 *
 * Where the outputs go, and why:
 *
 *   build/icon.png        electron-builder's app icon. It derives the Windows
 *                         .ico, the macOS .icns and the Linux icon set from
 *                         this one file, and wants >=512px.
 *
 *   public/tray-icon.png  the system tray. It lives in public/ rather than
 *                         assets/ because assets/ is the gitignored 1.3 GB
 *                         media library that most installs never download —
 *                         the tray icon pointed into it until v0.13.0 and was
 *                         silently blank in every packaged build. Vite copies
 *                         public/ into dist/, which electron-builder ships.
 *
 *   public/awc-mark.png   the in-theme station logo slot, same reasoning.
 *
 * Requires rsvg-convert (librsvg). Fonts come from the media library when it
 * is present: the mark is set in Interstate Bold, the typeface Weatherscan
 * and the IntelliStar actually used. Without it, rsvg falls back through the
 * font-family list and the letterforms differ — which is why the PNGs are
 * committed rather than generated at build time.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Below this, the full mark's range rings, sweep wedge and intensity ramp
 * stop being legible and start being noise around the letters, so small
 * sizes are rendered from the stripped-down tray variant instead. This is
 * the whole reason two source SVGs exist.
 */
const SIMPLIFY_AT_OR_BELOW = 32;

/** Sizes electron-builder wants in a Linux icon set. */
const ICON_SET_SIZES = [16, 32, 48, 64, 128, 256, 512, 1024];

/** [source svg, output path, pixel size] */
const TARGETS = [
  ["build/icon.svg", "build/icon.png", 1024],
  ["build/icon.svg", "public/awc-mark.png", 512],
  ["build/icon-tray.svg", "public/tray-icon.png", 64],
  // Explicit per-size set. Handed a single PNG, electron-builder emits only
  // that one size, so a 1024px image ends up scaled into a 16px menu slot by
  // whatever the desktop environment happens to use.
  ...ICON_SET_SIZES.map((size) => [
    size <= SIMPLIFY_AT_OR_BELOW ? "build/icon-tray.svg" : "build/icon.svg",
    `build/icons/${size}x${size}.png`,
    size
  ])
];

function requireRsvg() {
  try {
    execFileSync("rsvg-convert", ["--version"], { stdio: "ignore" });
  } catch {
    console.error(
      "rsvg-convert not found. Install librsvg:\n" +
        "  Debian/Ubuntu  sudo apt install librsvg2-bin\n" +
        "  Gentoo         sudo emerge gnome-base/librsvg\n" +
        "  macOS          brew install librsvg\n\n" +
        "The generated PNGs are committed, so this is only needed to change the artwork."
    );
    process.exit(1);
  }
}

/**
 * Point fontconfig at the media library's fonts so Interstate Bold resolves.
 * Written to a temp dir rather than the repo: it embeds absolute paths and a
 * cache location, neither of which should be committed.
 */
function fontconfigEnv() {
  const fontsDir = path.join(root, "assets", "shared", "fonts");
  if (!existsSync(fontsDir)) {
    console.warn(
      "[icons] assets/shared/fonts is missing — falling back to system fonts.\n" +
        "[icons] The mark will not be set in Interstate Bold. Run `npm run assets:fetch` first."
    );
    return {};
  }
  const confDir = path.join(os.tmpdir(), "awc-icon-fontconfig");
  mkdirSync(path.join(confDir, "cache"), { recursive: true });
  const conf = path.join(confDir, "fonts.conf");
  writeFileSync(
    conf,
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontsDir}</dir>
  <dir>/usr/share/fonts</dir>
  <dir>/usr/local/share/fonts</dir>
  <dir>~/.local/share/fonts</dir>
  <cachedir>${path.join(confDir, "cache")}</cachedir>
</fontconfig>
`
  );
  return { FONTCONFIG_FILE: conf };
}

requireRsvg();
const env = { ...process.env, ...fontconfigEnv() };

for (const [src, out, size] of TARGETS) {
  const srcPath = path.join(root, src);
  const outPath = path.join(root, out);
  if (!existsSync(srcPath)) {
    console.error(`[icons] missing source: ${src}`);
    process.exit(1);
  }
  mkdirSync(path.dirname(outPath), { recursive: true });
  execFileSync(
    "rsvg-convert",
    ["-w", String(size), "-h", String(size), srcPath, "-o", outPath],
    { env, stdio: "inherit" }
  );
  console.log(`[icons] ${out} (${size}x${size})`);
}

// rsvg leaves nothing behind, but the fontconfig cache is ours to clean.
rmSync(path.join(os.tmpdir(), "awc-icon-fontconfig", "cache"), {
  recursive: true,
  force: true
});

console.log("[icons] done");
