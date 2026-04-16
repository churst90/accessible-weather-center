"""
Integrate AJ composite longform clips into longformSchema.ts.

- Inserts AJ_COMPOSITE_CLIPS array after JC_EXCLUSIVE_CLIPS
- Modifies findLongformMatch: when narrator is AJ, score both LONGFORM_CLIPS
  and AJ_COMPOSITE_CLIPS, pick the higher-scoring clip

Idempotent.
"""
import os, re

BASE = os.path.dirname(__file__)
SCHEMA = os.path.join(BASE, "..", "src", "audio", "manifests", "longformSchema.ts")
ENTRIES = os.path.join(BASE, "out", "aj_composite_entries.ts")

with open(SCHEMA, "r", encoding="utf-8") as f:
    content = f.read()

with open(ENTRIES, "r", encoding="utf-8") as f:
    comp_block = f.read()

# ── 1. Insert AJ_COMPOSITE_CLIPS array (after JC_EXCLUSIVE_CLIPS) ──
if "AJ_COMPOSITE_CLIPS" in content:
    print("AJ_COMPOSITE_CLIPS already present — replacing")
    pattern = re.compile(
        r"// ─+\n"
        r"//  AJ composite longform clips.*?\n"
        r"const AJ_COMPOSITE_CLIPS: LfEntry\[\] = \[.*?\n\];\n",
        re.DOTALL,
    )
    content = pattern.sub(comp_block, content)
else:
    # Insert right after the JC_EXCLUSIVE_CLIPS closing `];`
    # Marker: the closing of JC_EXCLUSIVE_CLIPS array
    # The last JC exclusive entry ends with `];` followed by a blank line
    jc_end_pattern = re.compile(r"(const JC_EXCLUSIVE_CLIPS: LfEntry\[\] = \[.*?\n\];\n)", re.DOTALL)
    m = jc_end_pattern.search(content)
    if not m:
        raise SystemExit("ERROR: could not find JC_EXCLUSIVE_CLIPS end")
    insertion = "\n" + comp_block + "\n"
    content = content[:m.end()] + insertion + content[m.end():]
    print("Inserted AJ_COMPOSITE_CLIPS block")

# ── 2. Add composite token cache + update findLongformMatch ──
HELPER_MARKER = "// AJ composite token cache"
if HELPER_MARKER not in content:
    helper_block = """// ────────────────────────────────────────────────────────────────────────────
//  AJ composite token cache
// ────────────────────────────────────────────────────────────────────────────

let ajCompositeTokenCache: Map<number, string[]> | null = null;

function getAjCompositeTokenCache(): Map<number, string[]> {
  if (ajCompositeTokenCache) return ajCompositeTokenCache;
  ajCompositeTokenCache = new Map();
  for (let i = 0; i < AJ_COMPOSITE_CLIPS.length; i++) {
    ajCompositeTokenCache.set(i, tokenize(AJ_COMPOSITE_CLIPS[i][1]));
  }
  return ajCompositeTokenCache;
}

"""
    # Insert right before the JC token cache helper (keeps helpers grouped)
    insert_before = "// ────────────────────────────────────────────────────────────────────────────\n//  JC exclusive token cache"
    if insert_before not in content:
        raise SystemExit("ERROR: could not find insertion point for composite helper")
    content = content.replace(insert_before, helper_block + insert_before)
    print("Inserted AJ composite token cache helper")

# ── 3. Modify findLongformMatch to also score composites for AJ ──
# Find the AJ-path at the end of findLongformMatch. Insert composite scoring
# just before the final AJ return.
OLD_AJ_TAIL = """  if (bestIdx < 0) return null;

  const [filename, text] = LONGFORM_CLIPS[bestIdx];
  return {
    src: `${LF_DIR}/${filename}.wav`,
    text,
    confidence: "likely",
  };
}"""

NEW_AJ_TAIL = """  // For AJ, also score against the 549 composite phrases (deduped from 1,525
  // two-period pair clips) and take the best match from either pool.
  const compCache = getAjCompositeTokenCache();
  let bestCompIdx = -1;
  let bestCompScore = MIN_MATCH_SCORE;
  for (let i = 0; i < AJ_COMPOSITE_CLIPS.length; i++) {
    const clipTokens = compCache.get(i)!;
    const score = scoreMatch(targetTokens, clipTokens);
    if (score > bestCompScore) {
      bestCompScore = score;
      bestCompIdx = i;
    }
  }

  if (bestCompIdx >= 0 && bestCompScore > bestScore) {
    const [compFilename, compText] = AJ_COMPOSITE_CLIPS[bestCompIdx];
    return {
      src: `${LF_DIR}/${compFilename}.wav`,
      text: compText,
      confidence: "likely",
    };
  }

  if (bestIdx < 0) return null;

  const [filename, text] = LONGFORM_CLIPS[bestIdx];
  return {
    src: `${LF_DIR}/${filename}.wav`,
    text,
    confidence: "likely",
  };
}"""

if OLD_AJ_TAIL in content:
    content = content.replace(OLD_AJ_TAIL, NEW_AJ_TAIL)
    print("Updated findLongformMatch to score AJ composites")
elif "score against the 549 composite" in content:
    print("findLongformMatch already updated — skipping")
else:
    raise SystemExit("ERROR: could not find AJ tail of findLongformMatch")

with open(SCHEMA, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\nUpdated: {SCHEMA}")
