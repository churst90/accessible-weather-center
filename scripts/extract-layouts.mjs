/**
 * Reads TWC's own render scripts and writes out what they say about layout.
 *
 * The production packages (`twc_wxscan_dynamic-*.tgz`, fetched by
 * scripts/fetch-sources.mjs) contain `.prod` and `.rs` files: readable Python
 * templates that drew the actual broadcast screens. They name every element's
 * pixel position, typeface and point size.
 *
 *     f  = TTFont("/rsrc/fonts/Frutiger_Bold", 24)
 *     gr = Text(f, "Average"); gr.setPosition(119, 317)
 *     gr = TIFF_Image("middle_white", x1=0, y1=0, x2=.53, y2=1)
 *     gr.setPosition(72, 97)
 *
 * Nine of the ten machines carry a gap in docs/asset-gaps.md phrased roughly
 * as "not built — needs a full-frame still to lay out faithfully". Measuring a
 * still is guesswork: it has been through somebody's crop and rescale, the
 * text is anti-aliased, and a baseline is a judgement call. These files are
 * what the still was rendered FROM. There is nothing to measure.
 *
 * What this does NOT do is generate layout code. The extraction is a
 * reference document — a screen's real geometry, in one place, for a human
 * building the React view to work against. Machine-translating a 2003 Python
 * render script into JSX would produce something nobody could maintain and
 * that no test could check.
 *
 * Usage:
 *   node scripts/extract-layouts.mjs                  # all packages in sources/
 *   node scripts/extract-layouts.mjs --product Almanac
 *   node scripts/extract-layouts.mjs --out docs/reference/layouts
 */
import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };

const SRC = path.resolve(ROOT, flag("src", "sources/weatherscan-packages"));
const OUT = path.resolve(ROOT, flag("out", "docs/reference/layouts"));
const ONLY = flag("product", null);

/** Which package maps to which of our device profiles. */
const PACKAGES = [
  { file: "twc_wxscan_dynamic-2.13_p1.tgz", device: "weatherscan-v2", label: "Weatherscan v2 (L-bar, 2005-2022)" },
  { file: "twc_wxscan_dynamic-2.12_p1.tgz", device: "weatherscan-v2", label: "Weatherscan v2, earlier revision" },
  { file: "twc_wxscan_dynamic-1.2_p1.tgz", device: "weatherscan-v1", label: "Weatherscan v1 (2003-2005)" },
  { file: "twc_domestic_dynamic-2.10_p1.tgz", device: "intellistar1", label: "IntelliStar 1 domestic" },
];

const step = (m) => console.log(`\n==> ${m}`);
const log = (m) => console.log(`    ${m}`);

/**
 * Pull the layout facts out of one render script.
 *
 * Deliberately regex rather than a Python parser. These are templates with
 * `<%- %>` interpolation holes in them, so they are not valid Python to begin
 * with, and the goal is a reference for a human rather than a faithful AST.
 */
function parseRenderScript(text) {
  const fonts = new Map();   // variable name -> {family, size}
  const items = [];
  const lines = text.split(/\r?\n/);

  // f = TTFont("/rsrc/fonts/Frutiger_Bold", 24, shadow=0)
  // f = TTFont('%s/Frutiger_Bold_Cond' % (fontRoot), 27)
  const FONT = /^\s*(\w+)\s*=\s*TTFont\(\s*['"]?(?:%s\/|\/rsrc\/fonts\/)?([\w.\-]+)['"]?[^,]*,\s*(\w+)/;
  // gr = Text(f, "Average")   |   Text(fontTemp, "%d" % temp)
  const TEXT = /^\s*(\w+)\s*=\s*Text\(\s*(\w+)\s*,\s*(.+?)\s*\)\s*$/;
  // gr = TIFF_Image("middle_white", ...)  |  TIFF_Image(TOPIMAGE, 0, 0, .46, 1)
  const IMAGE = /^\s*(\w+)\s*=\s*(?:TIFF_Image|Image)\(\s*([^,)]+)/;
  // gr.setPosition(119, 317)
  const POS = /^\s*(\w+)\.setPosition\(\s*([\-\d]+)\s*,\s*([\-\d]+)/;

  const pending = new Map(); // variable -> partial item awaiting a position

  for (const raw of lines) {
    let m;
    if ((m = FONT.exec(raw))) {
      fonts.set(m[1], { family: m[2], size: m[3] });
      continue;
    }
    if ((m = TEXT.exec(raw))) {
      const font = fonts.get(m[2]);
      pending.set(m[1], {
        kind: "text",
        content: m[3].replace(/^["']|["']$/g, "").slice(0, 60),
        font: font ? `${font.family} ${font.size}pt` : m[2],
      });
      continue;
    }
    if ((m = IMAGE.exec(raw))) {
      pending.set(m[1], { kind: "image", content: m[2].trim().replace(/^["']|["']$/g, "").slice(0, 60) });
      continue;
    }
    if ((m = POS.exec(raw))) {
      const item = pending.get(m[1]);
      // A position on a variable we never saw defined still tells you a slot
      // exists at those coordinates, which is worth recording.
      items.push({ ...(item ?? { kind: "element", content: m[1] }), x: Number(m[2]), y: Number(m[3]) });
      pending.delete(m[1]);
    }
  }
  return { fonts: [...new Set([...fonts.values()].map((f) => `${f.family} ${f.size}pt`))], items };
}

function renderMarkdown(pkg, product, parsed) {
  const out = [];
  out.push(`### ${product}`);
  out.push("");
  if (parsed.fonts.length) out.push(`Typefaces: ${parsed.fonts.join(", ")}`);
  if (!parsed.items.length) { out.push("_No positioned elements found — this product is data-only or fully templated._", ""); return out.join("\n"); }
  out.push("");
  out.push("| x | y | kind | element | typeface |");
  out.push("|---:|---:|---|---|---|");
  for (const it of parsed.items) {
    const esc = (s) => String(s).replace(/\|/g, "\\|");
    out.push(`| ${it.x} | ${it.y} | ${it.kind} | ${esc(it.content)} | ${esc(it.font ?? "")} |`);
  }
  out.push("");
  return out.join("\n");
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`\nERROR: ${path.relative(ROOT, SRC)} not found — run: node scripts/fetch-sources.mjs --only weatherscan-packages\n`);
    process.exit(1);
  }
  await fsp.mkdir(OUT, { recursive: true });
  const tmp = path.join(ROOT, ".layout-extract");
  await fsp.rm(tmp, { recursive: true, force: true });
  await fsp.mkdir(tmp, { recursive: true });

  let wrote = 0;
  for (const pkg of PACKAGES) {
    const archive = path.join(SRC, pkg.file);
    if (!fs.existsSync(archive)) { log(`skip ${pkg.file} (not fetched)`); continue; }
    step(`${pkg.file} — ${pkg.label}`);
    const dir = path.join(tmp, pkg.file.replace(/\W+/g, "_"));
    await fsp.mkdir(dir, { recursive: true });
    try { await run("tar", ["xzf", archive, "-C", dir]); } catch { /* trailing-block warnings are fine */ }

    const scripts = [];
    const walk = async (d) => {
      for (const e of await fsp.readdir(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) await walk(full);
        else if (/\.(prod|rs)$/.test(e.name)) scripts.push(full);
      }
    };
    try { await walk(dir); } catch { /* empty package */ }
    if (!scripts.length) { log("no render scripts in this package"); continue; }

    const sections = [];
    let found = 0;
    for (const s of scripts.sort()) {
      const product = path.basename(s).replace(/\.(prod|rs)$/, "");
      if (ONLY && !product.toLowerCase().includes(ONLY.toLowerCase())) continue;
      const text = await fsp.readFile(s, "utf8");
      const parsed = parseRenderScript(text);
      if (!parsed.items.length && !parsed.fonts.length) continue;
      sections.push(renderMarkdown(pkg, product, parsed));
      found++;
    }
    if (!found) { log("nothing positioned"); continue; }

    const doc = [
      `# ${pkg.label} — screen layouts`,
      "",
      "Extracted by `npm run layouts:extract` from TWC's own render scripts",
      `(\`${pkg.file}\`, product package \`${path.basename(SRC)}\`). Do not edit by hand.`,
      "",
      "Coordinates are the machine's own, in its native raster. These are not",
      "measurements taken off a screenshot — they are the values the hardware",
      "drew with, so a view built against them is exact rather than close.",
      "",
      `Device profile: \`src/devices/profiles/${pkg.device}.ts\``,
      "",
      "---",
      "",
      ...sections,
    ].join("\n");

    const outFile = path.join(OUT, `${pkg.file.replace(/\.tgz$/, "")}.md`);
    await fsp.writeFile(outFile, doc, "utf8");
    log(`${found} products -> ${path.relative(ROOT, outFile)}`);
    wrote += found;
  }

  await fsp.rm(tmp, { recursive: true, force: true });
  step("Done");
  log(`${wrote} product layouts extracted into ${path.relative(ROOT, OUT)}/`);
}

main().catch((e) => { console.error(`\nERROR: ${e.message}`); process.exit(1); });
