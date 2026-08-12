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
  // __APP_VERSION__ mirrors the `define` in vite.config.ts. Without it any
  // test that pulls in bootstrap.ts dies on an undefined global.
  define: {
    "process.env.NODE_ENV": '"development"',
    __APP_VERSION__: JSON.stringify(
      JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version
    )
  },
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
 * No `--test-force-exit`, and that is the point.
 *
 * The suite used to run with it, and could silently shrink as a result.
 * Measured over eight consecutive runs of an unchanged tree: four reported
 * 244 tests and four reported 234, and **every one of them exited 0** with
 * "fail 0". The missing ten were always the last ten declared in the largest
 * file. They were not failed, skipped or cancelled — they never ran.
 *
 * The flag exits "once all KNOWN tests have finished", and with files running
 * in parallel that set drains while the slowest file is still going, killing
 * it mid-execution. So the flag was the mechanism. It was not the cause.
 *
 * The cause was one test file. `audioNodeReuse.test.ts` stubs the audio
 * element with one that fires `ended` on the next tick, and MusicPlayer's
 * `ended` handler advances to the next track — which plays, ends, and
 * advances again, forever. Three tests started a player and never stopped it.
 * A real element makes that same loop harmless by taking three minutes over
 * each track. Measured: 17 timers still pending five seconds after the last
 * assertion, all of them `FakeAudio.play -> playTrack -> advance`.
 *
 * With those players disposed, every one of the 29 files now terminates on
 * its own — verified individually, `node --test <file>` with no flag and a
 * 15-second timeout, none hit it. So the flag is gone, the event loop decides
 * when the run is over, and parallelism is back (7s -> 2.7s).
 *
 * The count check below stays. It is cheap, and it is the only thing that
 * would notice this class of failure returning — there is no failing test to
 * catch a test that never ran. If a future file leaks a handle the run will
 * hang rather than lie, which is the failure mode to prefer; if someone
 * reaches for `--test-force-exit` to fix that hang, this check is what stops
 * the lie coming back with it.
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
      `\n\n  "fail 0" above does not cover tests that never executed. This is\n` +
      `  the signature of the run being cut short — check for --test-force-exit\n` +
      `  having been reintroduced, or for a file that registers tests lazily.\n`
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
