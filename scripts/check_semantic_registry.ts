/**
 * Smoke test for the semantic registry — verifies that each category
 * resolves to a relPath that actually exists in the reference table
 * (or at least points at a path the filesystem has). Run with:
 *
 *   npx tsx scripts/check_semantic_registry.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getLibrary, Sem, type SemanticId } from "../src/audio/manifests/semanticRegistry";
import type { NarratorId } from "../src/audio/manifests/narratorSchema";

const ROOT = join(__dirname, "..");
const TABLE = JSON.parse(
  readFileSync(join(ROOT, "src/audio/data/clipReferenceTable.json"), "utf-8")
);

const NARRATOR_DIRS: Record<NarratorId, string> = {
  "allan-jackson": "assets/narration/Alan Jackson",
  "jim-cantore":   "assets/narration/Jim Cantore",
  "amy-bargeron":  "assets/narration/Amy Bargeron",
  "chandler":      "assets/narration/Chandler",
};

interface ProbeCase {
  label: string;
  narrator: NarratorId;
  id: SemanticId;
  expectNull?: boolean;
}

const probes: ProbeCase[] = [
  // Periods
  { label: "AJ period MON",              narrator: "allan-jackson", id: Sem.period("MON") },
  { label: "AJ period TONIGHT",          narrator: "allan-jackson", id: Sem.period("TONIGHT") },
  { label: "AJ period TUE_NIGHT (null)", narrator: "allan-jackson", id: Sem.period("TUE_NIGHT"), expectNull: true },
  { label: "JC period TUE_NIGHT",        narrator: "jim-cantore",   id: Sem.period("TUE_NIGHT") },
  { label: "JC period OVERNIGHT",        narrator: "jim-cantore",   id: Sem.period("OVERNIGHT") },

  // Temps
  { label: "AJ temp 72",          narrator: "allan-jackson", id: Sem.temp(72) },
  { label: "AJ temp 0",           narrator: "allan-jackson", id: Sem.temp(0) },
  { label: "AJ temp -5",          narrator: "allan-jackson", id: Sem.temp(-5) },
  { label: "AJ temp 140 (null)",  narrator: "allan-jackson", id: Sem.temp(140), expectNull: true },
  { label: "JC temp 72",          narrator: "jim-cantore",   id: Sem.temp(72) },
  { label: "AJ high of 85",       narrator: "allan-jackson", id: Sem.tempHigh(85) },
  { label: "AJ low of 32",        narrator: "allan-jackson", id: Sem.tempLow(32) },
  { label: "AJ tempRange H80S",   narrator: "allan-jackson", id: Sem.tempRange("H80S") },
  { label: "AJ tempHighRange L30S", narrator: "allan-jackson", id: Sem.tempHighRange("L30S") },
  { label: "AJ tempRange2 M50S",  narrator: "allan-jackson", id: Sem.tempRange2("M50S") },

  // Conditions
  { label: "AJ cc 1600",          narrator: "allan-jackson", id: Sem.cc(1600) },
  { label: "AJ ccsh 400 (padded)",narrator: "allan-jackson", id: Sem.ccsh(400) },
  { label: "AJ ccsh 1600",        narrator: "allan-jackson", id: Sem.ccsh(1600) },
  { label: "JC ccsh 400 (no pad)",narrator: "jim-cantore",   id: Sem.ccsh(400) },
  { label: "AJ ccef 4000",        narrator: "allan-jackson", id: Sem.ccef(4000) },

  // Wind
  { label: "AJ windDir1 NE",      narrator: "allan-jackson", id: Sem.windDir1("NE") },
  { label: "AJ windDir2 W",       narrator: "allan-jackson", id: Sem.windDir2("W") },
  { label: "AJ windDir3 SW",      narrator: "allan-jackson", id: Sem.windDir3("SW") },
  { label: "AJ windAtSpeed 10_15",narrator: "allan-jackson", id: Sem.windAtSpeed("10_15") },
  { label: "AJ windAndInc 15_25", narrator: "allan-jackson", id: Sem.windAndInc("15_25") },
  { label: "AJ windAndDim 5_10",  narrator: "allan-jackson", id: Sem.windAndDim("5_10") },
  { label: "AJ windBecoming NW",  narrator: "allan-jackson", id: Sem.windBecoming("NW") },
  { label: "AJ windShifting SE",  narrator: "allan-jackson", id: Sem.windShifting("SE") },
  { label: "AJ windCalm",         narrator: "allan-jackson", id: Sem.windCalm() },
  { label: "JC windCalm",         narrator: "jim-cantore",   id: Sem.windCalm() },

  // Precip
  { label: "AJ precipProb 30",         narrator: "allan-jackson", id: Sem.precipProb(30) },
  { label: "JC precipProb 10 (null)",  narrator: "jim-cantore",   id: Sem.precipProb(10), expectNull: true },
  // 5% rounds up to 10% and AJ does have P9011, so this is NOT null for AJ.
  { label: "AJ precipProb 5 (rounds to 10)", narrator: "allan-jackson", id: Sem.precipProb(5) },

  // Qualifiers / Rate-OP
  { label: "AJ qualifier 8060",    narrator: "allan-jackson", id: Sem.qualifier(8060) },
  { label: "JC rateOp 8011",       narrator: "jim-cantore",   id: Sem.rateOp(8011) },

  // Named
  { label: "AJ named current_intro", narrator: "allan-jackson", id: Sem.named("current_intro") },
];

let pass = 0, fail = 0;
const problems: string[] = [];

for (const probe of probes) {
  const lib = getLibrary(probe.narrator);
  const res = lib.resolve(probe.id);
  if (probe.expectNull) {
    if (res === null) { pass++; continue; }
    fail++; problems.push(`${probe.label}: expected null, got ${res.src}`);
    continue;
  }
  if (!res) {
    fail++; problems.push(`${probe.label}: unexpected null`);
    continue;
  }
  // Check the resolved relPath against the reference table (if present)
  const rel = res.src.replace(`/${NARRATOR_DIRS[probe.narrator]}/`, "");
  const refEntry = TABLE.clips?.[probe.narrator]?.[rel];
  const diskPath = join(ROOT, NARRATOR_DIRS[probe.narrator], rel);
  const onDisk = existsSync(diskPath);
  const tag =
    refEntry ? "[ref]" : onDisk ? "[disk]" : "[MISSING]";
  if (!refEntry && !onDisk) {
    fail++;
    problems.push(`${probe.label} ${tag}: no ref entry AND no file at ${diskPath}`);
  } else {
    pass++;
    console.log(`  ${probe.label}: ${tag} ${res.confidence} "${res.text}"`);
  }
}

console.log(`\nPass: ${pass}   Fail: ${fail}`);
if (problems.length) {
  console.log("\nProblems:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
