"""
Integrate JC H08xxxx exclusive longform clips into longformSchema.ts.

This script:
1. Reads the generated TS entries from scripts/out/jc_exclusive_entries.ts
2. Inserts the JC_EXCLUSIVE_CLIPS array into longformSchema.ts
3. Modifies findLongformMatch() to also search JC exclusives when narrator is JC

Idempotent: if JC_EXCLUSIVE_CLIPS is already present, skips insertion.
"""
import os
import re

BASE = os.path.dirname(__file__)
SCHEMA = os.path.join(BASE, "..", "src", "audio", "manifests", "longformSchema.ts")
ENTRIES = os.path.join(BASE, "out", "jc_exclusive_entries.ts")

with open(SCHEMA, "r", encoding="utf-8") as f:
    content = f.read()

with open(ENTRIES, "r", encoding="utf-8") as f:
    jc_block = f.read()

# ── Check idempotency ──
if "JC_EXCLUSIVE_CLIPS" in content:
    print("JC_EXCLUSIVE_CLIPS already present — updating in place")
    # Replace the existing block (from marker comment to the closing `];`)
    pattern = re.compile(
        r"// ─+\n"
        r"//  JC-exclusive H08xxxx longform clips.*?\n"
        r"const JC_EXCLUSIVE_CLIPS: LfEntry\[\] = \[.*?\n\];\n",
        re.DOTALL,
    )
    content = pattern.sub(jc_block, content)
else:
    # Insert after the closing `];` of LONGFORM_CLIPS array
    # LONGFORM_CLIPS ends at "];" followed by a blank line then "// ──" separator
    marker = '  ["N076632", "Windy, periods of light rain this afternoon"],\n];\n'
    if marker not in content:
        print("ERROR: Could not find LONGFORM_CLIPS end marker")
        raise SystemExit(1)
    insertion = "\n" + jc_block + "\n"
    content = content.replace(marker, marker + insertion, 1)
    print("Inserted JC_EXCLUSIVE_CLIPS block")

# ── Add JC token cache + jcExclusiveScoreMatch helper before findLongformMatch ──
# We append to the file-level helpers section. Check if helper already added.
HELPER_MARKER = "// JC exclusive token cache"
if HELPER_MARKER not in content:
    # Find the export of findLongformMatch and insert helpers before it
    # Locate: "export function findLongformMatch("
    target = "export function findLongformMatch("
    idx = content.find(target)
    if idx < 0:
        print("ERROR: Could not find findLongformMatch definition")
        raise SystemExit(1)

    helper_block = """// ────────────────────────────────────────────────────────────────────────────
//  JC exclusive token cache
// ────────────────────────────────────────────────────────────────────────────

let jcExclusiveTokenCache: Map<number, string[]> | null = null;

function getJcExclusiveTokenCache(): Map<number, string[]> {
  if (jcExclusiveTokenCache) return jcExclusiveTokenCache;
  jcExclusiveTokenCache = new Map();
  for (let i = 0; i < JC_EXCLUSIVE_CLIPS.length; i++) {
    jcExclusiveTokenCache.set(i, tokenize(JC_EXCLUSIVE_CLIPS[i][1]));
  }
  return jcExclusiveTokenCache;
}

"""
    # Find the comment immediately before findLongformMatch export
    # Insert before the "/**" that starts the docblock for findLongformMatch
    # Easier: insert before the line containing "export function findLongformMatch"
    # Walk back to the start of its preceding docblock "/**"
    # Simpler approach: insert just before the target line
    line_start = content.rfind("/**", 0, idx)
    if line_start < 0:
        line_start = idx
    content = content[:line_start] + helper_block + content[line_start:]
    print("Inserted JC token cache helpers")

# ── Modify findLongformMatch to also search JC exclusives ──
# Replace the JC path inside findLongformMatch so it scores against both arrays
# and returns the best match from either.
OLD_JC_PATH = """  if (bestIdx < 0) return null;

  const [filename, text] = LONGFORM_CLIPS[bestIdx];

  // JC uses H-prefix in a different directory, same number codes.
  // Only N-series clips have JC equivalents (DUMMY clips are AJ-only).
  // JC has 418 of AJ's 554 N-series — if we match one JC doesn't have,
  // the audio system will gracefully fall back to TTS.
  if (narratorId === "jim-cantore") {
    if (!filename.startsWith("N")) return null; // DUMMY clips are AJ-only
    const jcFilename = filename.replace(/^N/, "H");
    return {
      src: `${JC_LF_DIR}/${jcFilename}.wav`,
      text,
      confidence: "likely",
    };
  }

  return {
    src: `${LF_DIR}/${filename}.wav`,
    text,
    confidence: "likely",
  };
}"""

NEW_JC_PATH = """  // For JC, also score against the 364 exclusive H08xxxx clips and take the
  // best match from either pool (shared N-series or JC-exclusive).
  if (narratorId === "jim-cantore") {
    const jcCache = getJcExclusiveTokenCache();
    let bestJcIdx = -1;
    let bestJcScore = MIN_MATCH_SCORE;
    for (let i = 0; i < JC_EXCLUSIVE_CLIPS.length; i++) {
      const clipTokens = jcCache.get(i)!;
      const score = scoreMatch(targetTokens, clipTokens);
      if (score > bestJcScore) {
        bestJcScore = score;
        bestJcIdx = i;
      }
    }

    // JC-exclusive beat the shared pool — use it
    if (bestJcIdx >= 0 && bestJcScore > bestScore) {
      const [jcFilename, jcText] = JC_EXCLUSIVE_CLIPS[bestJcIdx];
      return {
        src: `${JC_LF_DIR}/${jcFilename}.wav`,
        text: jcText,
        confidence: "likely",
      };
    }

    // Fall back to shared pool (N→H mapping). DUMMY clips are AJ-only.
    if (bestIdx < 0) return null;
    const [filename, text] = LONGFORM_CLIPS[bestIdx];
    if (!filename.startsWith("N")) return null;
    const jcFilename = filename.replace(/^N/, "H");
    return {
      src: `${JC_LF_DIR}/${jcFilename}.wav`,
      text,
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

if OLD_JC_PATH in content:
    content = content.replace(OLD_JC_PATH, NEW_JC_PATH)
    print("Updated findLongformMatch to search JC exclusives")
elif "JC-exclusive beat the shared pool" in content:
    print("findLongformMatch already updated — skipping")
else:
    print("ERROR: Could not find expected findLongformMatch body to update")
    raise SystemExit(1)

with open(SCHEMA, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\nUpdated: {SCHEMA}")
