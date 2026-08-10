import { test } from "node:test";
import assert from "node:assert/strict";
import { Sem, getLibrary, type CompassDir, type WindRange, type PeriodKey } from "../src/audio/manifests/semanticRegistry";
import { setClipReferenceTable } from "../src/audio/data/clipReferenceTable";
import fullTable from "../src/audio/data/clipReferenceTable.json";
import type { NarratorId } from "../src/audio/manifests/narratorSchema";

setClipReferenceTable(fullTable as never);

/**
 * The phrase pools, checked for MEANING rather than existence.
 *
 * `npm run clips:sweep` already proves every clip the app can ask for is a
 * file that exists and resolves above the confidence threshold. It cannot
 * tell you whether the file says the right thing. tests/narrationMapping
 * closed that gap for scene intros; this closes it for the pools underneath,
 * which are the overwhelming majority of the library — roughly 1,900
 * resolvable ids per narrator against a few dozen intros.
 *
 * It matters most for the numeric families. A scene intro naming the wrong
 * screen is obvious the first time you hear it. A temperature clip off by one
 * is not: the app confidently says "seventy-three" over a screen reading 72,
 * sounds completely normal, and is wrong in the one way a weather application
 * must never be. Nothing in the codebase could previously have caught that.
 *
 * The check is deliberately loose about wording and strict about facts. It
 * does not care whether a clip says "chance of rain 30%" or "30 percent
 * chance of rain"; it cares that the number 30 is in there and the number 40
 * is not.
 */

const NARRATORS: NarratorId[] = ["allan-jackson", "jim-cantore"];

const COMPASS: CompassDir[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const COMPASS_WORD: Record<CompassDir, RegExp> = {
  N:  /\bnorth\b/i,      NE: /\bnorth\s*east\b/i,
  E:  /\beast\b/i,       SE: /\bsouth\s*east\b/i,
  S:  /\bsouth\b/i,      SW: /\bsouth\s*west\b/i,
  W:  /\bwest\b/i,       NW: /\bnorth\s*west\b/i,
};

const WIND_RANGES: WindRange[] = [
  "5_10", "10_20", "15_25", "20_30", "25_35", "30_40", "35_45", "40_50",
  "25_40", "35_50", "40_60", "50_70", "60_80", "70_90", "80_100",
];

const PERIOD_WORD: Partial<Record<PeriodKey, RegExp>> = {
  MON: /monday/i, TUE: /tuesday/i, WED: /wednesday/i, THU: /thursday/i,
  FRI: /friday/i, SAT: /saturday/i, SUN: /sunday/i,
  TODAY: /today/i, TONIGHT: /tonight/i, TOMORROW: /tomorrow/i,
};

/**
 * Semantic ids whose TRANSCRIPTION is wrong, not whose clip is.
 *
 * All homophones or formatting, from Whisper transcribing short spoken
 * numbers with no surrounding context to disambiguate them. Each is listed
 * with what the recording actually says, so the exemption states a fact
 * rather than waving the failure away — and so a genuine mis-mapping cannot
 * hide behind a vague allowance.
 *
 * Kept deliberately narrow: 6 ids out of roughly 500 checked here. If this
 * list starts growing, the transcriptions have a systematic problem worth
 * looking at rather than exempting.
 */
const KNOWN_MISTRANSCRIPTIONS: Record<string, string> = {
  // Keyed by NARRATOR + id, not id alone. Most of these are wrong for one
  // narrator and perfectly transcribed for the other, so a bare id would
  // switch the check off for a recording that is fine — which the staleness
  // guard below caught immediately.
  "allan-jackson|tempHigh:2":   '"High two" transcribed as "Hi, too"',
  "allan-jackson|tempHigh:4":   '"High four" transcribed as "Hi, for"',
  "jim-cantore|tempHigh:2":     '"High two" transcribed as "Hi, too"',
  "jim-cantore|tempHigh:80":    '"High eighty" transcribed as "Hi, Eddie"',
  "jim-cantore|tempHigh:110":   '"High one ten" transcribed as "Hi, 1-10"',
  "jim-cantore|tempHigh:116":   '"High one sixteen" transcribed as "Hi, 1-16"',
};

interface Wrong { narrator: string; id: string; says: string; why: string }

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};

/**
 * Every number a transcription states, whether written as digits or words.
 *
 * The library does both, and not by any rule worth relying on: the small
 * magnitudes come back as words ("six degrees", "minus four degrees") while
 * the larger ones come back as digits ("72"). Matching only digits made the
 * audit report every single-digit temperature as having no number in it —
 * a failure of the test, not of the recordings.
 *
 * Negatives count as their magnitude. "minus four degrees" yields 4, and the
 * caller compares against Math.abs, because the sign lives in a separate word
 * rather than in the number the clip names.
 */
function numbersIn(text: string): number[] {
  const found = [...text.matchAll(/\d+/g)].map((m) => Number(m[0]));
  const words = text.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const tens = TENS[words[i]];
    if (tens !== undefined) {
      const ones = ONES[words[i + 1]];
      // "seventy two" is one number, not two.
      if (ones !== undefined && ones < 10) { found.push(tens + ones); i++; }
      else found.push(tens);
      continue;
    }
    const one = ONES[words[i]];
    if (one !== undefined) {
      // "one hundred" / "one hundred five"
      if (words[i + 1] === "hundred") {
        const rest = ONES[words[i + 2]] ?? TENS[words[i + 2]] ?? 0;
        found.push(one * 100 + rest);
        i += rest ? 2 : 1;
      } else found.push(one);
    }
  }
  return found;
}

function check(
  narrator: NarratorId,
  id: string,
  verdict: (says: string) => string | null,
  out: Wrong[],
  counters: { checked: number; absent: number }
): void {
  if (KNOWN_MISTRANSCRIPTIONS[`${narrator}|${id}`]) { counters.absent++; return; }
  const clip = getLibrary(narrator).resolve(id as never);
  if (!clip) { counters.absent++; return; }
  const says = (clip.text ?? "").trim();
  if (!says) { counters.absent++; return; }
  counters.checked++;
  const why = verdict(says);
  if (why) out.push({ narrator, id, says, why });
}

test("temperature clips say the temperature they were asked for", () => {
  // The highest-stakes family in the library and the least self-evident when
  // wrong. AJ's temps are individual recordings per degree, so an off-by-one
  // in the resolver would be silent and systematic.
  const wrong: Wrong[] = [];
  const c = { checked: 0, absent: 0 };
  for (const n of NARRATORS) {
    for (let t = -20; t <= 120; t++) {
      check(n, Sem.temp(t), (says) => {
        const nums = numbersIn(says);
        if (nums.length === 0) return "no number in the transcription";
        return nums.includes(Math.abs(t)) ? null : `expected ${t}, transcription has ${nums.join("/")}`;
      }, wrong, c);
    }
  }
  assert.ok(c.checked > 100, `only ${c.checked} temperature clips checked`);
  assert.deepEqual(wrong.slice(0, 15), [], formatted(wrong));
});

test("high and low temperature clips say their number", () => {
  const wrong: Wrong[] = [];
  const c = { checked: 0, absent: 0 };
  for (const n of NARRATORS) {
    for (let t = 0; t <= 120; t++) {
      check(n, Sem.tempHigh(t), (says) =>
        numbersIn(says).includes(t) ? null : `high ${t}, transcription says "${says}"`, wrong, c);
      check(n, Sem.tempLow(t), (says) =>
        numbersIn(says).includes(t) ? null : `low ${t}, transcription says "${says}"`, wrong, c);
    }
  }
  assert.ok(c.checked > 100, `only ${c.checked} high/low clips checked`);
  assert.deepEqual(wrong.slice(0, 15), [], formatted(wrong));
});

test("precipitation probability clips say the right percentage AND the right kind", () => {
  // Both halves matter. The wrong percentage misinforms; the wrong kind
  // announces "chance of rain" over a snow forecast, which is how this family
  // was behaving until the three recorded sets were wired up.
  const wrong: Wrong[] = [];
  const c = { checked: 0, absent: 0 };
  const kindWord = { rain: /rain/i, snow: /snow/i, precip: /precip/i } as const;
  for (const n of NARRATORS) {
    for (const kind of ["rain", "snow", "precip"] as const) {
      for (let pct = 10; pct <= 100; pct += 10) {
        check(n, Sem.precipProb(pct, kind), (says) => {
          if (!numbersIn(says).includes(pct)) return `expected ${pct}%, says "${says}"`;
          if (!kindWord[kind].test(says)) return `expected ${kind}, says "${says}"`;
          return null;
        }, wrong, c);
      }
    }
  }
  assert.ok(c.checked > 40, `only ${c.checked} precip clips checked`);
  assert.deepEqual(wrong.slice(0, 15), [], formatted(wrong));
});

test("wind direction clips say their direction", () => {
  const wrong: Wrong[] = [];
  const c = { checked: 0, absent: 0 };
  for (const n of NARRATORS) {
    for (const d of COMPASS) {
      for (const id of [Sem.windDir1(d), Sem.windDir2(d), Sem.windDir3(d), Sem.windBecoming(d), Sem.windShifting(d)]) {
        check(n, id, (says) =>
          COMPASS_WORD[d].test(says) ? null : `expected ${d}, says "${says}"`, wrong, c);
      }
    }
  }
  assert.ok(c.checked > 30, `only ${c.checked} wind-direction clips checked`);
  assert.deepEqual(wrong.slice(0, 15), [], formatted(wrong));
});

test("wind speed clips say both ends of their range", () => {
  const wrong: Wrong[] = [];
  const c = { checked: 0, absent: 0 };
  for (const n of NARRATORS) {
    for (const r of WIND_RANGES) {
      const [lo, hi] = r.split("_").map(Number);
      for (const id of [Sem.windSpeed(r), Sem.windAtSpeed(r)]) {
        check(n, id, (says) => {
          const nums = numbersIn(says);
          if (!nums.includes(lo) || !nums.includes(hi)) return `expected ${lo}-${hi}, says "${says}"`;
          return null;
        }, wrong, c);
      }
    }
  }
  assert.ok(c.checked > 10, `only ${c.checked} wind-speed clips checked`);
  assert.deepEqual(wrong.slice(0, 15), [], formatted(wrong));
});

test("period clips say their day or part of day", () => {
  const wrong: Wrong[] = [];
  const c = { checked: 0, absent: 0 };
  for (const n of NARRATORS) {
    for (const [key, word] of Object.entries(PERIOD_WORD)) {
      check(n, Sem.period(key as PeriodKey), (says) =>
        word!.test(says) ? null : `expected ${key}, says "${says}"`, wrong, c);
    }
  }
  assert.ok(c.checked > 10, `only ${c.checked} period clips checked`);
  assert.deepEqual(wrong.slice(0, 15), [], formatted(wrong));
});

test("wind calm says calm", () => {
  const wrong: Wrong[] = [];
  const c = { checked: 0, absent: 0 };
  for (const n of NARRATORS) {
    check(n, Sem.windCalm(), (says) =>
      /calm/i.test(says) ? null : `says "${says}"`, wrong, c);
  }
  assert.deepEqual(wrong, [], formatted(wrong));
});

test("the pool audit can actually fail", () => {
  // Proof the assertions above are load-bearing: ask for one temperature and
  // insist the recording states a different one.
  const wrong: Wrong[] = [];
  const c = { checked: 0, absent: 0 };
  check("allan-jackson", Sem.temp(72), (says) =>
    numbersIn(says).includes(99) ? null : `deliberately wrong expectation, says "${says}"`, wrong, c);
  assert.equal(wrong.length, 1, "a false expectation must be reported");
  assert.match(wrong[0].says, /72/);
});

function formatted(w: Wrong[]): string {
  if (!w.length) return "";
  return `${w.length} pool clip(s) do not say what was asked for:\n` +
    w.slice(0, 15).map((x) => `  ${x.narrator} ${x.id}\n      ${x.why}`).join("\n");
}

test("every mistranscription exemption is still needed", () => {
  // Same discipline as the knowingly-silent lists and the Cantore label
  // differences: an exemption that has stopped being necessary must be
  // deleted, because a stale one is a place a real defect can hide.
  const stale: string[] = [];
  for (const [key, note] of Object.entries(KNOWN_MISTRANSCRIPTIONS)) {
    const [narrator, id] = key.split("|");
    const param = id.split(":")[1];
    const clip = getLibrary(narrator as NarratorId).resolve(id as never);
    if (!clip?.text) continue;                       // nothing to judge
    if (numbersIn(clip.text).includes(Number(param))) {
      stale.push(`  ${key} — transcription now reads correctly; remove it (${note})`);
    }
  }
  assert.deepEqual(stale, [], `stale exemptions:\n${stale.join("\n")}`);
});

test("REPORT: how much of the pools this audit covers", () => {
  // Not an assertion about correctness — a number to keep honest. If a future
  // change makes most ids unresolvable, the tests above still pass while
  // checking almost nothing, and this is what shows it.
  let resolvable = 0;
  for (const n of NARRATORS) {
    const lib = getLibrary(n);
    for (let t = -20; t <= 120; t++) if (lib.resolve(Sem.temp(t))) resolvable++;
    for (let t = 0; t <= 120; t++) {
      if (lib.resolve(Sem.tempHigh(t))) resolvable++;
      if (lib.resolve(Sem.tempLow(t))) resolvable++;
    }
    for (const d of COMPASS) for (const id of [Sem.windDir1(d), Sem.windDir2(d), Sem.windDir3(d), Sem.windBecoming(d), Sem.windShifting(d)])
      if (lib.resolve(id)) resolvable++;
    for (const r of WIND_RANGES) for (const id of [Sem.windSpeed(r), Sem.windAtSpeed(r)])
      if (lib.resolve(id)) resolvable++;
    for (const k of ["rain", "snow", "precip"] as const)
      for (let p = 10; p <= 100; p += 10) if (lib.resolve(Sem.precipProb(p, k))) resolvable++;
  }
  console.log(`      pool clips verified for meaning: ${resolvable}`);
  assert.ok(resolvable > 400, `only ${resolvable} pool clips resolvable — coverage has collapsed`);
});
