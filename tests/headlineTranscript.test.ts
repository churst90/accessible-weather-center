import { test } from "node:test";
import assert from "node:assert/strict";
import { getHeadlineClips, parseEventToVtec, AJ_HEADLINE_EVENTS, AJ_HEADLINE_ACTIONS } from "../src/audio/manifests/headlineSchema";
import { setClipReferenceTable } from "../src/audio/data/clipReferenceTable";
import fullTable from "../src/audio/data/clipReferenceTable.json";

setClipReferenceTable(fullTable as never);

const CLIPS = (fullTable as { clips: Record<string, Record<string, { text: string }>> })
  .clips["allan-jackson"];

/**
 * The bug this file exists to prevent.
 *
 * The Allan Jackson headline tables were written from the code numbering
 * alone, and every single one of the 31 entries named a different product
 * than the recording actually says. NPW013 was labelled "Excessive Heat
 * Warning"; it says "high wind watch". Action "B" was labelled "has been
 * issued"; it says "has ended". So a heat warning announced itself as a high
 * wind watch that had ended.
 *
 * Nothing could catch it: the file exists, so it resolves; the clip plays, so
 * there is no error; and the label was only ever compared against itself.
 * The only external check available is the transcription, which is derived
 * from the audio rather than from someone's reading of the code numbers.
 */

/** Compare a label to a transcription, ignoring case, articles and punctuation. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .replace(/^(a|an|the) /, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Codes where the LABEL is right and the TRANSCRIPTION is wrong — Whisper
 * mishearing a product name it does not know. Each is listed with what was
 * misheard, so the exception can be re-checked against the audio rather than
 * taken on trust, and so the guard stays strict for every other code.
 *
 * These are all the same kind of error: a compound weather term heard as one
 * word, or as an unrelated common word ("wind chill" -> "when you'll",
 * "sleet" -> "sleep", "lake" -> "like", "force" -> "Forrest").
 */
const KNOWN_MISTRANSCRIPTIONS: Record<string, string> = {
  NPW030: "WinChill advisory",
  NPW070: "Duststorm Warning",
  WSW031: "like snow advisory",
  WSW053: "Heavy sleep warning",
  WSW065: "Windchill warning",
  WSW068: "when you'll watch",
  WSW071: "Wynchill Advisory",
  WSW500: "like effect snow advisory",
  ZFP015: "Hurricane Forrest Wind Warning",
};

test("every AJ event label matches what the recording says", () => {
  const mismatches: string[] = [];
  for (const entry of AJ_HEADLINE_EVENTS) {
    const rec = CLIPS[`VocalLocal/Headline_Event/${entry.code}.mp3`];
    if (!rec) continue; // no transcription available; nothing to check against

    const known = KNOWN_MISTRANSCRIPTIONS[entry.code];
    if (known) {
      // The exception must still describe reality: if the transcription is
      // ever corrected, this entry should be removed rather than left to
      // silently excuse a genuine mismatch.
      assert.equal(
        rec.text.replace(/[.]+$/, "").trim(), known,
        `${entry.code}: recorded exception is stale — transcription now reads "${rec.text}"`
      );
      continue;
    }

    const label = normalize(entry.text);
    const said = normalize(rec.text);
    // Whisper mishears some product names, so accept either direction of
    // containment rather than demanding an exact string match.
    if (!label.includes(said) && !said.includes(label)) {
      mismatches.push(`  ${entry.code}: label "${entry.text}" vs recording "${rec.text}"`);
    }
  }
  assert.equal(
    mismatches.length, 0,
    `${mismatches.length} headline label(s) disagree with the recording:\n${mismatches.join("\n")}`
  );
});

test("every AJ action label matches what the recording says", () => {
  const mismatches: string[] = [];
  for (const entry of AJ_HEADLINE_ACTIONS) {
    const rec = CLIPS[`VocalLocal/Headline_Action/${entry.code}.mp3`];
    if (!rec) continue;
    const label = normalize(entry.text);
    const said = normalize(rec.text);
    if (!label.includes(said) && !said.includes(label)) {
      mismatches.push(`  ${entry.code}: label "${entry.text}" vs recording "${rec.text}"`);
    }
  }
  assert.equal(
    mismatches.length, 0,
    `${mismatches.length} action label(s) disagree with the recording:\n${mismatches.join("\n")}`
  );
});

/**
 * The composed headline must name the product the alert is actually for.
 * This is the end-to-end form of the user-visible bug: an Extreme Heat
 * Warning that announced itself as a high wind watch.
 */
test("a composed headline names the right product", () => {
  const cases: Array<[string, RegExp]> = [
    ["Extreme Heat Warning",    /heat warning/i],
    ["Excessive Heat Warning",  /heat warning/i],
    ["Extreme Heat Watch",      /heat watch/i],
    ["Heat Advisory",           /heat advisory/i],
    ["High Wind Warning",       /high wind warning/i],
    ["High Wind Watch",         /high wind watch/i],
    ["Winter Storm Warning",    /winter storm warning/i],
    ["Blizzard Warning",        /blizzard warning/i],
    ["Ice Storm Warning",       /ice storm warning/i],
    ["Hurricane Warning",       /hurricane warning/i],
    ["Tropical Storm Warning",  /tropical storm warning/i],
    ["Flood Advisory",          /flood advisory/i],
    ["Coastal Flood Warning",   /coastal flood warning/i],
    ["Wind Advisory",           /wind advisory/i],
    ["Dense Fog Advisory",      /dense fog advisory/i],
  ];
  for (const [event, expected] of cases) {
    assert.ok(parseEventToVtec(event), `${event} should parse`);
    const clips = getHeadlineClips(event, "allan-jackson");
    if (clips.length === 0) continue; // no recording for this product: silent, which is safe
    const spoken = clips.map((c) => c.text).join(" ");
    assert.match(spoken, expected, `${event} composed as "${spoken}"`);
  }
});

/**
 * The closing clip must not tell the user the alert is over. "B" says
 * "has ended"; the one that announces a new alert is "I".
 */
test("a new alert is not announced as having ended", () => {
  for (const event of ["Extreme Heat Warning", "Winter Storm Warning", "High Wind Warning"]) {
    const clips = getHeadlineClips(event, "allan-jackson");
    if (clips.length === 0) continue;
    const spoken = clips.map((c) => c.text).join(" ");
    assert.doesNotMatch(spoken, /has ended|has expired|no longer/i,
      `${event} announced as over: "${spoken}"`);
    assert.match(spoken, /has been issued|is in effect/i,
      `${event} should say it was issued: "${spoken}"`);
    for (const c of clips) {
      assert.doesNotMatch(c.src, /Headline_Action\/B\.mp3$/,
        `${event} still uses action B ("has ended")`);
    }
  }
});

/**
 * A composed headline must never open with a conjunction. Four codes have
 * the "and ..." take sitting in the Headline_A_Event slot; opening an alert
 * with "and excessive heat warning" is a non-sentence.
 */
test("no headline opens with a conjunction", () => {
  const conjunctionCodes = ["FLS007", "NPW035", "NPW073", "NPW076"];
  for (const code of conjunctionCodes) {
    const rec = CLIPS[`VocalLocal/Headline_A_Event/${code}A.mp3`];
    assert.ok(rec, `${code}A should exist`);
    assert.match(rec.text.trim(), /^and\b/i,
      `${code}A no longer starts with "and" — remove it from AJ_A_EVENT_IS_CONJUNCTION`);
  }
  for (const event of ["Extreme Heat Warning", "Air Stagnation Advisory", "Ashfall Advisory"]) {
    const clips = getHeadlineClips(event, "allan-jackson");
    if (clips.length === 0) continue;
    assert.doesNotMatch(clips[0].text.trim(), /^and\b/i,
      `${event} opens with a conjunction: "${clips[0].text}"`);
  }
});

/**
 * A product with no recording must produce no clip rather than the nearest
 * available one. Naming the wrong hazard is worse than saying nothing, and
 * the spoken fallback still reads the correct event name.
 */
test("unmapped products stay silent rather than borrowing a clip", () => {
  const clips = getHeadlineClips("Tornado Warning", "allan-jackson");
  for (const c of clips) {
    assert.doesNotMatch(c.text, /watch/i,
      `a Tornado Warning must never resolve to a watch recording: "${c.text}"`);
  }
});
