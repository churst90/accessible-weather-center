/**
 * Zero-dependency unit-test runner.
 *
 * Why not Vitest/Jest: this repo often lives on a drive where installing
 * new npm packages is unreliable, so the test stack uses only what's
 * already here — esbuild (a Vite dependency) to bundle the TypeScript
 * tests, and Node's built-in `node --test` runner to execute them.
 *
 * Usage: npm test          (all tests)
 *        npm test Storm    (only test files whose name contains "Storm")
 */
import { build } from "esbuild";
import { readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testsDir = path.join(root, "tests");
const outDir = path.join(root, ".test-dist");
const filter = process.argv[2] ?? "";

const entryPoints = readdirSync(testsDir)
  .filter((f) => (f.endsWith(".test.ts") || f.endsWith(".test.tsx")) && f.includes(filter))
  .map((f) => path.join(testsDir, f));

if (entryPoints.length === 0) {
  console.error(`No test files matching "${filter}" in tests/`);
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });

await build({
  entryPoints,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  outdir: outDir,
  // .mjs so Node treats the bundles as ESM — the repo's package.json has
  // no "type": "module" (Electron main is CJS).
  outExtension: { ".js": ".mjs" },
  sourcemap: "inline",
  // Force React's development build. Its rules-of-hooks checks, the
  // "rendered fewer hooks than expected" error, and the act() warnings exist
  // ONLY in that build — the production build strips them and silently
  // renders whatever it can. Without this the component tests went green
  // against deliberately broken components, which is worse than no tests: it
  // is a false all-clear on the exact bug class they were written to catch.
  define: { "process.env.NODE_ENV": '"development"' },
  // happy-dom stays external. Bundling it drags in `ws`, which uses dynamic
  // require() — legal in CJS, fatal once esbuild has flattened everything
  // into a single ESM file ("Dynamic require of 'events' is not supported").
  // It is a devDependency present at runtime, so Node resolves it fine.
  external: ["happy-dom"]
});

const bundled = readdirSync(outDir)
  .filter((f) => f.endsWith(".test.mjs"))
  .map((f) => path.join(outDir, f));

const result = spawnSync(process.execPath, ["--test", "--test-force-exit", ...bundled], {
  stdio: "inherit",
  cwd: root
});
rmSync(outDir, { recursive: true, force: true });
process.exit(result.status ?? 1);
