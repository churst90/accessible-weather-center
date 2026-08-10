import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * No hook may be called after an early return in a component.
 *
 * This is a STATIC check, and it is static on purpose. The obvious approach —
 * render a component, flip its data, expect React to complain — does not
 * work: React 18.3.1's development build was measured against a deliberately
 * broken component in both directions (more hooks then fewer, fewer then
 * more) and reported nothing at all. No throw, no console.error, no
 * onRecoverableError. `tests/sceneViews.test.tsx` still renders every affected
 * view across a data flip and is worth having, but it would go green against
 * the broken code, so it cannot be the guard for this.
 *
 * The bug it guards against shipped in four views. Each returned its
 * "unavailable" markup before calling useArrowList/useArrowGrid, so the
 * number of hooks depended on whether the data had arrived. Harmless while a
 * scene was remounted on every entry; a live-data refresh re-prepares the
 * scene in place, so `storm` and `observation` now flip on a mounted
 * instance as a matter of course.
 *
 * The check: inside a component's top-level body, find the first `return`,
 * then look for any `useSomething(` after it at the same brace depth.
 * Deliberately conservative — it only looks at depth 1, so hooks inside
 * nested callbacks (where they would be a different error) are ignored.
 */

const ROOT = path.resolve(import.meta.dirname ?? ".", "..");
const HOOK = /\buse[A-Z]\w*\s*\(/;
const COMPONENT = /^(?:export\s+)?function\s+([A-Z]\w*)\s*\(/;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

interface Violation { file: string; component: string; line: number; text: string }

/**
 * The early return that matters is usually nested — `if (!data) { return ... }`
 * — so a depth-1-only rule misses the real shape entirely. But counting every
 * `return` at any depth would fire on the `return` inside an ordinary
 * callback defined above a hook, which is not a bug.
 *
 * So track what kind of block each brace opened. A return counts as an early
 * return only when no enclosing block is a function body; a hook counts only
 * when it is in the component's own body for the same reason.
 */
function findViolations(file: string): Violation[] {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const out: Violation[] = [];
  let component: string | null = null;
  let stack: ("fn" | "block")[] = [];
  let started = false;
  let sawReturn = false;

  const inFunction = () => stack.slice(1).includes("fn");

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    // Strip line comments and string bodies so braces inside them don't skew
    // the count. Crude, but a miscount only ever costs a false report.
    const code = raw.replace(/\/\/.*$/, "").replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');

    if (component === null) {
      const m = COMPONENT.exec(raw.trim());
      if (m) { component = m[1]; stack = []; started = false; sawReturn = false; }
      else continue;
    }

    if (started && stack.length === 1 && !inFunction()) {
      if (/^\s*return\b/.test(code)) sawReturn = true;
      else if (sawReturn && HOOK.test(code)) {
        out.push({ file: path.relative(ROOT, file), component, line: i + 1, text: raw.trim().slice(0, 80) });
      }
    } else if (started && !inFunction() && /^\s*return\b/.test(code)) {
      // A return inside `if (...) { ... }` in the component's own body.
      sawReturn = true;
    }

    // A line opening a brace is a function body if it declares one.
    const opensFn = /=>\s*\{|\bfunction\b[^;]*\{/.test(code);
    for (const ch of code) {
      if (ch === "{") { stack.push(opensFn ? "fn" : "block"); started = true; }
      else if (ch === "}") stack.pop();
    }
    if (started && stack.length === 0) { component = null; sawReturn = false; }
  }
  return out;
}

test("no component calls a hook after an early return", () => {
  const files = sourceFiles(path.join(ROOT, "src"));
  const violations = files.flatMap(findViolations);
  assert.deepEqual(
    violations, [],
    "hooks must run on every render.\n" +
    violations.map((v) => `  ${v.file}:${v.line} in ${v.component}\n      ${v.text}`).join("\n")
  );
});

test("the check actually detects the pattern it guards against", () => {
  // A guard nobody has seen fail is a guard nobody should trust — especially
  // this one, since the runtime refused to catch the same bug.
  const fixture = path.join(ROOT, ".hook-order-fixture.tsx");
  fs.writeFileSync(fixture, [
    "export function BrokenView({ data }: { data: { x?: number } }) {",
    "  const announcer = useAnnouncer();",
    "  if (!data.x) {",
    "    return <p>unavailable</p>;",
    "  }",
    "  const { index } = useArrowList(rows, describe, announcer);",
    "  return <p>{index}</p>;",
    "}",
  ].join("\n"), "utf8");
  try {
    const found = findViolations(fixture);
    assert.equal(found.length, 1, "the hook after the early return should be reported");
    assert.equal(found[0].component, "BrokenView");
    assert.match(found[0].text, /useArrowList/);
  } finally {
    fs.rmSync(fixture, { force: true });
  }
});
