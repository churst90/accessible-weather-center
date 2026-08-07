/**
 * Validates that every `/assets/...` path referenced in the source actually
 * exists on disk.
 *
 * The app builds asset URLs as plain strings — narration clips, background
 * pools, icons, fonts. Nothing type-checks them, and a missing file shows up
 * only at runtime as a silent 404: a background that doesn't paint, or worse
 * for this app's audience, a narration clip that simply never speaks. This
 * script is the compile-time-ish check that doesn't otherwise exist, and it
 * is what makes an asset re-encode (scripts/build-web-assets.mjs, which
 * changes .wav -> .mp3 and .png -> .webp) safe to land.
 *
 * Resolution strategy: literals are read directly; `${CONST}` interpolations
 * are resolved against single-line `const X = "..."` declarations in the same
 * file, which covers how every manifest in this repo is written. Paths that
 * interpolate a runtime value (a loop counter, a function parameter) can't be
 * resolved statically and are reported as "dynamic" so the count stays
 * visible rather than silently passing.
 *
 * Usage: node scripts/check-asset-refs.mjs [--assets assets] [--verbose]
 */
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flagIdx = argv.indexOf("--assets");
const ASSETS = path.resolve(ROOT, flagIdx >= 0 && argv[flagIdx + 1] ? argv[flagIdx + 1] : "assets");
const VERBOSE = argv.includes("--verbose");
const SRC_DIR = path.join(ROOT, "src");

async function walk(dir, acc = []) {
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

/** Single-line `const NAME = "value"` / backtick equivalents, with any
 *  already-known consts substituted so chained bases resolve. */
function collectConsts(source) {
  const consts = new Map();
  const re = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::\s*string)?\s*=\s*(["'`])([^"'`\n]*)\2\s*;/g;
  // Two passes so `const B = `${A}/sub`` resolves regardless of declaration order.
  for (let pass = 0; pass < 2; pass++) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(source))) {
      const [, name, , raw] = m;
      const resolved = raw.replace(/\$\{([A-Za-z_$][\w$]*)\}/g, (whole, ref) =>
        consts.has(ref) ? consts.get(ref) : whole
      );
      consts.set(name, resolved);
    }
  }
  return consts;
}

const results = { checked: 0, missing: [], dynamic: [], files: 0 };

function checkFile(file, source) {
  const consts = collectConsts(source);
  const rel = path.relative(ROOT, file);

  // Any quoted run that mentions /assets/ or interpolates a const we know.
  const literal = /(["'`])((?:[^"'`\\\n]|\\.)*?)\1/g;
  let m;
  while ((m = literal.exec(source))) {
    const raw = m[2];
    if (!raw.includes("/assets/") && !/^\$\{[A-Za-z_$][\w$]*\}/.test(raw)) continue;

    const resolved = raw.replace(/\$\{([A-Za-z_$][\w$]*)\}/g, (whole, ref) =>
      consts.has(ref) ? consts.get(ref) : whole
    );
    if (!resolved.startsWith("/assets/")) continue;
    // Needs an extension to be a file reference (bare dirs are icon-set bases).
    if (!path.extname(resolved)) continue;

    if (resolved.includes("${")) {
      results.dynamic.push({ file: rel, ref: resolved });
      continue;
    }
    results.checked++;
    const onDisk = path.join(ASSETS, resolved.slice("/assets/".length));
    if (!fs.existsSync(onDisk)) results.missing.push({ file: rel, ref: resolved });
  }
}

const files = await walk(SRC_DIR);
results.files = files.length;
for (const f of files) checkFile(f, await fsp.readFile(f, "utf8"));

console.log(`asset dir : ${ASSETS}`);
console.log(`sources   : ${results.files} files`);
console.log(`resolved  : ${results.checked} static refs`);
console.log(`dynamic   : ${results.dynamic.length} refs (runtime-interpolated, not checkable here)`);
console.log(`missing   : ${results.missing.length}`);

if (VERBOSE && results.dynamic.length) {
  const seen = new Set();
  console.log("\ndynamic patterns:");
  for (const d of results.dynamic) {
    const key = `${d.file}|${d.ref}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`  ${d.file}: ${d.ref}`);
  }
}

if (results.missing.length) {
  console.log("\nMISSING:");
  for (const m of results.missing.slice(0, 60)) console.log(`  ${m.file}: ${m.ref}`);
  if (results.missing.length > 60) console.log(`  … and ${results.missing.length - 60} more`);
  process.exit(1);
}
console.log("\nAll statically-resolvable asset references exist.");
