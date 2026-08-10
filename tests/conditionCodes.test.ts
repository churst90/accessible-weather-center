import { test } from "node:test";
import assert from "node:assert/strict";
import {
  QUALIFIER_PATTERNS,
  guessConditionCode,
  guessCcshForecastCode,
  guessCcefForecastCode,
} from "../src/audio/PhraseComposer";
import { Sem, getLibrary } from "../src/audio/manifests/semanticRegistry";
import { setClipReferenceTable } from "../src/audio/data/clipReferenceTable";
import fullTable from "../src/audio/data/clipReferenceTable.json";
import type { NarratorId } from "../src/audio/manifests/narratorSchema";

setClipReferenceTable(fullTable as never);

/**
 * The code-keyed families: condition codes and qualifiers.
 *
 * These were the last pools with no meaning check, and the most dangerous
 * ones left, because they share the exact shape of the bug that put a freeze
 * warning on a fire alert: an opaque number standing between a fact and a
 * recording, with nothing verifying the two agree. Code 6803 is not
 * self-evidently "snow showers ending early" to anyone reading the source.
 *
 * The obstacle was that verifying "code 6803 should say X" needs a source of
 * truth for the numbering, which we do not have. So this checks something
 * better: the round trip the application actually performs.
 *
 *     forecast text -> guess*Code() -> clip -> transcription
 *
 * If "Snow showers ending early" comes back as a clip that says "rain", that
 * is wrong no matter what the numbering means. No external table needed —
 * the forecast text IS the source of truth, and it is the same text the
 * screen is displaying.
 *
 * Qualifiers are easier still: QUALIFIER_PATTERNS already carries the
 * canonical phrasing beside each code, so the two can simply be compared.
 */

const NARRATORS: NarratorId[] = ["allan-jackson", "jim-cantore"];

/**
 * Weather families that must not be confused with one another.
 *
 * Deliberately coarse. Whether a clip says "showers" or "rain" for a rain
 * forecast is wording; announcing snow for a thunderstorm forecast is a
 * different weather event, and that is all this is trying to catch.
 */
const FAMILIES: Array<{ name: string; input: RegExp; clip: RegExp }> = [
  { name: "snow",         input: /\bsnow\b/i,                    clip: /snow|flurr|wintry|winter/i },
  { name: "thunderstorm", input: /thunderstorm|t-?storm/i,       clip: /thunder|storm/i },
  // "sleet" comes back from Whisper as "sleep" in a few clips; the recording
  // is right, so the family accepts it rather than exempting ids one by one.
  { name: "freezing",     input: /freezing rain|ice|sleet/i,     clip: /freezing|ice|icy|sleet|sleep|wintry|mix/i },
  { name: "rain",         input: /\brain\b|\bshowers?\b|drizzle/i, clip: /rain|shower|drizzle|precip|storm|wet/i },
  { name: "fog",          input: /\bfog\b/i,                     clip: /fog|mist|haze/i },
  // "Partly sunny" and "partly cloudy" are the same sky in NWS usage, so a
  // clear-family forecast legitimately resolves to a cloud-worded clip.
  { name: "clear",        input: /\b(sunny|clear)\b/i,           clip: /sun|clear|fair|cloud/i },
  { name: "cloud",        input: /cloudy|clouds/i,               clip: /cloud|overcast|sun/i },
];

/** Realistic NWS forecast wordings, the strings the app actually receives. */
const FORECASTS = [
  "Sunny", "Mostly sunny", "Partly sunny", "Mostly cloudy", "Cloudy",
  "Clear", "Mostly clear",
  "Rain", "Showers", "Rain showers", "Chance of showers", "Light rain",
  "Heavy rain", "Rain likely", "Drizzle",
  "Snow", "Snow showers", "Light snow", "Heavy snow", "Chance of snow",
  "Snow likely", "Blowing snow",
  "Rain and snow", "Wintry mix", "Freezing rain", "Sleet",
  "Thunderstorms", "Chance of thunderstorms", "Severe thunderstorms",
  "Showers and thunderstorms likely",
  "Fog", "Patchy fog", "Areas of fog",
  "Windy", "Breezy",
  "Snow showers ending early", "Rain and snow early", "Rain ending early",
];

const HINTS = ["morning", "afternoon", "evening", "night"] as const;

interface Wrong { narrator: string; family: string; forecast: string; code: number; says: string }

function familyOf(text: string) {
  return FAMILIES.find((f) => f.input.test(text));
}

function auditGuesser(
  label: string,
  guess: (text: string, hint: (typeof HINTS)[number], windy: boolean) => number | null,
  sem: (code: number) => string
): { checked: number; unresolved: number; wrong: Wrong[] } {
  const wrong: Wrong[] = [];
  let checked = 0;
  let unresolved = 0;
  for (const n of NARRATORS) {
    for (const forecast of FORECASTS) {
      const fam = familyOf(forecast);
      if (!fam) continue;
      for (const hint of HINTS) {
        const code = guess(forecast, hint, false);
        if (code == null) continue;
        const clip = getLibrary(n).resolve(sem(code) as never);
        const says = clip?.text?.trim();
        if (!says) { unresolved++; continue; }
        checked++;
        if (!fam.clip.test(says)) {
          wrong.push({ narrator: n, family: fam.name, forecast, code, says });
        }
      }
    }
  }
  void label;
  return { checked, unresolved, wrong };
}

function report(label: string, wrong: Wrong[]): string {
  if (!wrong.length) return "";
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const w of wrong) {
    const k = `${w.forecast}|${w.code}`;
    if (seen.has(k)) continue;
    seen.add(k);
    lines.push(`  ${label} "${w.forecast}" (${w.family}) -> code ${w.code} says "${w.says}"`);
  }
  return `${wrong.length} condition clip(s) describe different weather than the forecast:\n${lines.slice(0, 15).join("\n")}`;
}

test("current-condition codes describe the same weather as the forecast", () => {
  const r = auditGuesser("cc", (t, _h, w) => guessConditionCode(t, w), (c) => Sem.cc(c));
  assert.ok(r.checked > 50, `only ${r.checked} current-condition clips checked`);
  assert.deepEqual(r.wrong.slice(0, 15), [], report("cc", r.wrong));
});

test("shortcast codes describe the same weather as the forecast", () => {
  const r = auditGuesser("ccsh", (t, h, w) => guessCcshForecastCode(t, h, w), (c) => Sem.ccsh(c));
  assert.ok(r.checked > 50, `only ${r.checked} shortcast clips checked`);
  assert.deepEqual(r.wrong.slice(0, 15), [], report("ccsh", r.wrong));
});

test("extended-forecast codes describe the same weather as the forecast", () => {
  const r = auditGuesser("ccef", (t, h, w) => guessCcefForecastCode(t, h, w), (c) => Sem.ccef(c));
  assert.ok(r.checked > 50, `only ${r.checked} extended-forecast clips checked`);
  assert.deepEqual(r.wrong.slice(0, 15), [], report("ccef", r.wrong));
});

test("every qualifier clip says what its pattern promises", () => {
  // QUALIFIER_PATTERNS carries the canonical phrasing beside each code, and
  // getQualifierClips deliberately substitutes that curated text for the
  // transcription when it plays. That substitution is only safe if the two
  // agree — otherwise the app displays one thing and speaks another.
  const wrong: string[] = [];
  let checked = 0;
  let untranscribed = 0;
  const strip = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  for (const n of NARRATORS) {
    for (const q of QUALIFIER_PATTERNS) {
      const clip = getLibrary(n).resolve(Sem.qualifier(q.code));
      const says = clip?.text?.trim();
      if (!says) continue;
      // semanticRegistry's deriveText() invents "qualifier 8060" when the
      // reference table has no transcription for a clip. That is the absence
      // of evidence, not evidence of a wrong mapping — Jim Cantore's
      // qualifier pool is untranscribed almost entirely. Count it and move
      // on rather than reporting it as drift.
      if (new RegExp(`^qualifier ${q.code}$`).test(says)) { untranscribed++; continue; }
      checked++;
      // Content words only: "storms could contain tornadoes" vs "Storms could
      // contain tornadoes." differs only in case and a full stop.
      const wanted = strip(q.text).split(" ").filter((w) => w.length > 3);
      const heard = strip(says);
      const missing = wanted.filter((w) => !heard.includes(w.replace(/s$/, "")));
      if (missing.length > wanted.length / 2) {
        wrong.push(`  ${n} qualifier ${q.code}: pattern text "${q.text}" but recording says "${says}"`);
      }
    }
  }
  console.log(`      qualifiers verified: ${checked}, untranscribed: ${untranscribed}`);
  assert.ok(checked > 40, `only ${checked} qualifier clips checked`);
  assert.deepEqual(wrong, [], `qualifier text and recording disagree:\n${wrong.join("\n")}`);
});

test("the condition audit can actually fail", () => {
  // A snow forecast pointed at a rain family must be reported, or the three
  // tests above prove nothing.
  const bogus = [{ name: "snow", input: /\bsnow\b/i, clip: /definitely-not-in-any-transcription/ }];
  const saved = FAMILIES.splice(0, FAMILIES.length, ...bogus);
  try {
    const r = auditGuesser("cc", (t, _h, w) => guessConditionCode(t, w), (c) => Sem.cc(c));
    assert.ok(r.wrong.length > 0, "an impossible expectation must produce failures");
    assert.equal(r.wrong[0].family, "snow");
  } finally {
    FAMILIES.splice(0, FAMILIES.length, ...saved);
  }
});
