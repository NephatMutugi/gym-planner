// Downloads start/end images for every exercise mapped in
// src/data/exercise-demos.ts SOURCES, saving them into
// public/exercise-demos/<our_id>/{start,end}.jpg.
//
// Smart-validation flow:
//   1. Fetch the upstream's combined catalog (dist/exercises.json) once.
//   2. Build an index of every valid upstream exercise id.
//   3. For each SOURCES entry, check the index before fetching images.
//        - if valid → download (idempotent — skips files already present)
//        - if not   → fuzzy-match against the index and print the top 3
//                     suggestions, so you know what to put in SOURCES
//
// Run with:
//   npx tsx scripts/download-demos.ts
//
// The script exits 1 on any miss so you can wire it into CI later.

import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  EXERCISE_DEMO_SOURCES,
  upstreamImageUrls,
  UPSTREAM_IMAGE_BASE,
} from "../src/data/exercise-demos";

const PUBLIC_DIR = join(process.cwd(), "public", "exercise-demos");
const CATALOG_URL =
  UPSTREAM_IMAGE_BASE.replace(/\/exercises$/, "") + "/dist/exercises.json";

interface UpstreamEntry {
  id: string;
  name: string;
}

interface Failure {
  exerciseId: string;
  upstreamName: string;
  reason: string;
  suggestions?: string[];
}

async function fetchCatalog(): Promise<UpstreamEntry[]> {
  process.stdout.write(`Fetching upstream catalog from ${CATALOG_URL}\n`);
  const res = await fetch(CATALOG_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch catalog: HTTP ${res.status}`);
  }
  const data = (await res.json()) as UpstreamEntry[];
  process.stdout.write(`Indexed ${data.length} upstream exercises.\n\n`);
  return data;
}

// Tokenize an upstream id into lowercase word parts.
// "Alternating_Renegade_Row" → ["alternating", "renegade", "row"]
function tokenize(id: string): string[] {
  return id
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Jaccard similarity over token sets. 1.0 = identical, 0 = nothing in common.
function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection += 1;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

function fuzzyMatch(query: string, catalog: UpstreamEntry[], topN = 3): string[] {
  const queryTokens = tokenize(query);
  const scored = catalog
    .map((entry) => ({
      id: entry.id,
      score: jaccard(queryTokens, tokenize(entry.id)),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
  return scored.map((s) => s.id);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile() && s.size > 0;
  } catch {
    return false;
  }
}

async function fetchToFile(
  url: string,
  destPath: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const res = await fetch(url);
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) return { ok: false, reason: "empty body" };
  await mkdir(dirname(destPath), { recursive: true });
  await writeFile(destPath, buf);
  return { ok: true };
}

async function downloadOne(
  exerciseId: string,
  upstreamName: string
): Promise<Failure | null> {
  const urls = upstreamImageUrls(upstreamName);
  const tasks: Array<["start" | "end", string]> = [
    ["start", urls.start],
    ["end", urls.end],
  ];

  for (const [position, url] of tasks) {
    const dest = join(PUBLIC_DIR, exerciseId, `${position}.jpg`);
    if (await fileExists(dest)) continue;

    process.stdout.write(`  ${exerciseId}/${position}.jpg ... `);
    try {
      const result = await fetchToFile(url, dest);
      if (!result.ok) {
        process.stdout.write(`FAIL (${result.reason})\n`);
        return { exerciseId, upstreamName, reason: result.reason };
      }
      process.stdout.write("ok\n");
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      process.stdout.write(`FAIL (${reason})\n`);
      return { exerciseId, upstreamName, reason };
    }
  }

  return null;
}

async function main() {
  const catalog = await fetchCatalog();
  const validIds = new Set(catalog.map((e) => e.id));

  const entries = Object.entries(EXERCISE_DEMO_SOURCES);
  process.stdout.write(`Validating + downloading ${entries.length} mapped exercises...\n`);
  process.stdout.write(`Target: ${PUBLIC_DIR}\n\n`);

  const validationFailures: Failure[] = [];
  const downloadFailures: Failure[] = [];

  for (const [exerciseId, upstreamName] of entries) {
    if (!validIds.has(upstreamName)) {
      // Not in catalog at all → don't even attempt downloads. Just suggest.
      const suggestions = fuzzyMatch(upstreamName, catalog);
      validationFailures.push({
        exerciseId,
        upstreamName,
        reason: "not in upstream catalog",
        suggestions,
      });
      process.stdout.write(
        `  ${exerciseId} → "${upstreamName}" NOT IN CATALOG\n`
      );
      continue;
    }
    const failure = await downloadOne(exerciseId, upstreamName);
    if (failure) downloadFailures.push(failure);
  }

  process.stdout.write("\n--- Summary ---\n");
  process.stdout.write(`Mapped exercises: ${entries.length}\n`);
  process.stdout.write(`Catalog validation failures: ${validationFailures.length}\n`);
  process.stdout.write(`Download failures (post-validation): ${downloadFailures.length}\n`);

  if (validationFailures.length > 0) {
    process.stdout.write("\n--- Catalog misses + suggestions ---\n");
    for (const f of validationFailures) {
      process.stdout.write(`\n  ${f.exerciseId} → "${f.upstreamName}"\n`);
      if (f.suggestions && f.suggestions.length > 0) {
        process.stdout.write(`    Closest upstream matches:\n`);
        for (const s of f.suggestions) {
          process.stdout.write(`      • ${s}\n`);
        }
      } else {
        process.stdout.write(
          `    No fuzzy matches in upstream — likely a genuine gap.\n`
        );
      }
    }
    process.stdout.write(
      "\nFix: open src/data/exercise-demos.ts. For each miss above,\n" +
      "either replace the SOURCES value with one of the suggestions,\n" +
      "or remove the SOURCES entry (the UI hides the demo button when\n" +
      "no mapping exists). Then re-run this script.\n"
    );
  }

  if (downloadFailures.length > 0) {
    process.stdout.write("\n--- Download failures ---\n");
    for (const f of downloadFailures) {
      process.stdout.write(
        `  • ${f.exerciseId} → "${f.upstreamName}"  (${f.reason})\n`
      );
    }
  }

  const total = validationFailures.length + downloadFailures.length;
  if (total === 0) {
    process.stdout.write(
      "\nAll mapped images present. Commit public/exercise-demos/ and push.\n"
    );
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
