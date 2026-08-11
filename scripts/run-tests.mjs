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
import { readdirSync, rmSync, readFileSync } from "node:fs";
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

/**
 * `--test-force-exit` is load-bearing and also the reason for the check below.
 *
 * Without it the run never terminates: happy-dom's window, the frame clock's
 * 1s interval and the radar animation timers all keep handles open long after
 * the assertions are done, and `node --test` waits for a quiet event loop.
 *
 * With it, Node exits "once all KNOWN tests have finished". With files running
 * in parallel that set can drain while the slowest file is still working, and
 * the process is killed mid-file. The tests that had not run yet are not
 * reported as failed or skipped — they simply never happened, and the run
 * still prints `fail 0` and exits 0.
 *
 * This is not hypothetical. Measured here across eight consecutive runs of an
 * unchanged tree: four reported 244 tests and four reported 234. The missing
 * ten were always the last ten declared in devices.test.ts, the largest file.
 * Every one of those runs exited 0.
 *
 * A suite that can quietly shrink is worse than a smaller suite, because the
 * green tick means something different from run to run — and the whole
 * verification story of this project rests on these files.
 *
 * Two changes, and they do different jobs:
 *
 * `--test-concurrency=1` is the FIX. Run one file at a time and the known set
 * cannot drain early, because there is never a queued file waiting behind a
 * slow one. It costs about 4 seconds (2.7s -> 7s for 29 files), which is a
 * cheap price for a number that means the same thing twice. Verified over 17
 * consecutive runs: 244 every time, versus 4 short runs in the 8 before it.
 *
 * The count check is the BACKSTOP, kept because the fix is a workaround for
 * runner behaviour that could change under us on any Node upgrade, and the
 * failure mode is silent by nature. The human output still comes from the
 * spec reporter; a second junit reporter writes machine-readable results
 * carrying `file=` per testcase, and every file must report as many tests as
 * it declares.
 *
 * The expectation is derived, not maintained: `^test(` at the start of a line
 * counts top-level declarations, which is how every file here is written.
 * Anything registering tests inside a loop or a helper would undercount and
 * trip this check — the fix then is to make the expectation explicit, not to
 * loosen it.
 */
const resultsPath = path.join(outDir, "results.xml");
const result = spawnSync(
  process.execPath,
  [
    "--test",
    "--test-force-exit",
    // One file at a time. See the comment above — this is what stops the
    // suite silently dropping tests, not a performance preference.
    "--test-concurrency=1",
    "--test-reporter=spec", "--test-reporter-destination=stdout",
    "--test-reporter=junit", `--test-reporter-destination=${resultsPath}`,
    ...bundled
  ],
  { stdio: "inherit", cwd: root }
);

/** How many tests each source file declares at the top level. */
const declared = new Map();
for (const src of entryPoints) {
  const text = readFileSync(src, "utf8");
  const bundle = path.join(outDir, path.basename(src).replace(/\.tsx?$/, ".mjs"));
  declared.set(bundle, (text.match(/^test\(/gm) ?? []).length);
}

/** How many each actually reported. */
const reported = new Map(bundled.map((f) => [f, 0]));
let readable = true;
try {
  const xml = readFileSync(resultsPath, "utf8");
  for (const m of xml.matchAll(/\bfile="([^"]+)"/g)) {
    if (reported.has(m[1])) reported.set(m[1], reported.get(m[1]) + 1);
  }
} catch {
  readable = false; // No results file at all — a total loss, not a pass.
}

rmSync(outDir, { recursive: true, force: true });

const short = readable
  ? bundled
      .map((f) => ({ f, want: declared.get(f) ?? 0, got: reported.get(f) ?? 0 }))
      .filter((r) => r.got < r.want)
  : [{ f: "(all)", want: 0, got: 0 }];

if (short.length > 0) {
  const lost = short.reduce((a, r) => a + (r.want - r.got), 0);
  console.error(
    `\n✖ ${lost} test(s) never ran, in ${short.length} file(s):\n` +
      short
        .map((r) => `    ${path.basename(String(r.f)).replace(/\.mjs$/, "")}: ran ${r.got} of ${r.want}`)
        .join("\n") +
      `\n\n  The run was cut short by --test-force-exit; "fail 0" above does not\n` +
      `  cover the tests that never executed. Re-run.\n`
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
