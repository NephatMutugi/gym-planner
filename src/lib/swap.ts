// Local, no-AI swap suggester. Given an exercise, the user's profile, and
// their inventory, returns the best N alternatives ranked by similarity.
//
// Why local: 99% of swap requests ("my back is tight, give me a different
// row") can be served by a simple pattern + muscle + equipment match without
// calling Claude. We keep Claude as a fallback for the cases where the user
// has a specific contextual ask ("postpartum-safe variant" or "lower-impact
// alternative") that benefits from natural language reasoning.
//
// Scoring philosophy:
//   - Identical movement pattern is the biggest signal (+100).
//   - Adjacent patterns (h_push ↔ v_push, squat ↔ lunge, etc.) are
//     acceptable substitutes (+50).
//   - Shared primary muscles add weight (+20 each).
//   - Equipment / load type / difficulty alignment add small nudges.
//   - We never recommend the original exercise back to itself.
//   - Anything that fails the user's trainingContext filter is rejected
//     before scoring, because suggesting a filtered-out exercise breaks
//     the contract the user opted into.

import {
  EXERCISE_BY_ID,
  MUSCLE_LABELS,
  PATTERN_LABELS,
  type Exercise,
  type Pattern,
  type Muscle,
} from "@/data/exercises";
import { availableExercises, type Inventory } from "@/lib/equipment";
import type { ProfileInput } from "@/lib/program";

export interface SwapSuggestion {
  exerciseId: string;
  name: string;
  pattern: Pattern;
  primaryMuscles: Muscle[];
  difficulty: 1 | 2 | 3;
  equipment: Exercise["equipment"];
  cues: string[];
  // Short, human-readable explanation of why this is a good swap
  reason: string;
  // For debugging / future tuning. Not displayed.
  score: number;
}

// Two patterns are "adjacent" when they share enough biomechanical intent
// that one can reasonably replace the other for a typical training session.
function adjacentPattern(a: Pattern, b: Pattern): boolean {
  if (a === b) return true;
  if (a.includes("push") && b.includes("push")) return true;
  if (a.includes("pull") && b.includes("pull")) return true;
  // Lower body: squat ↔ lunge ↔ hinge form a triangle for the purposes of
  // "if you can't do X, try Y" swaps.
  const lower: Pattern[] = ["squat", "lunge", "hinge"];
  if (lower.includes(a) && lower.includes(b)) return true;
  if (a === "core" && b === "rotation") return true;
  if (a === "rotation" && b === "core") return true;
  return false;
}

function scoreSwap(original: Exercise, candidate: Exercise): number {
  let score = 0;

  // Pattern match. Same pattern is the strongest signal; adjacent is OK;
  // anything else returns -Infinity to exclude.
  if (candidate.pattern === original.pattern) {
    score += 100;
  } else if (adjacentPattern(original.pattern, candidate.pattern)) {
    score += 50;
  } else {
    return -Infinity;
  }

  // Shared primary muscles. +20 per shared muscle (cap implicit because
  // most exercises have ≤3 primary muscles).
  const shared = original.primaryMuscles.filter((m) =>
    candidate.primaryMuscles.includes(m)
  );
  score += shared.length * 20;

  // Same load type. Loaded ↔ loaded, bodyweight ↔ bodyweight, iso ↔ iso.
  if (candidate.loadType === original.loadType) score += 15;

  // Difficulty alignment. Prefer same or one easier (good for fatigue /
  // injury swaps); penalize a step harder; heavily penalize two+ harder.
  const diff = candidate.difficulty - original.difficulty;
  if (diff === 0) score += 10;
  else if (diff === -1) score += 5;
  else if (diff === 1) score -= 10;
  else score -= 30;

  // Equipment simplicity. Bodyweight is always available; fewer equipment
  // pieces means less setup friction.
  if (candidate.equipment.length === 0) score += 5;
  else if (candidate.equipment.length <= original.equipment.length) score += 3;

  // Same unilateral status. A small consistency bonus.
  if (candidate.unilateral === original.unilateral) score += 5;

  return score;
}

// Builds a one-line "why this swap" string for the UI. Tries to highlight
// the most relevant similarity first (same vs related pattern), then the
// shared muscle work, then any notable convenience win (bodyweight).
function buildReason(original: Exercise, candidate: Exercise): string {
  const parts: string[] = [];

  if (candidate.pattern === original.pattern) {
    parts.push("Same movement pattern");
  } else {
    parts.push(`Related to ${PATTERN_LABELS[original.pattern]}`);
  }

  const shared = original.primaryMuscles.filter((m) =>
    candidate.primaryMuscles.includes(m)
  );
  if (shared.length > 0) {
    parts.push(
      `hits ${shared.map((m) => MUSCLE_LABELS[m].toLowerCase()).join(" + ")}`
    );
  }

  if (candidate.equipment.length === 0 && original.equipment.length > 0) {
    parts.push("bodyweight — no equipment needed");
  } else if (candidate.difficulty < original.difficulty) {
    parts.push("a touch easier");
  }

  return parts.join(" · ");
}

// Filter helper that mirrors the program generator's training-context
// filtering. We deliberately re-implement it here (rather than import) to
// keep this file independent — the generator imports this is the natural
// direction of dependency, not the reverse.
function exclusionTagsForContext(
  ctx: ProfileInput["trainingContext"]
): Set<string> {
  if (!ctx || ctx === "general") return new Set();
  if (ctx === "returning_from_injury") {
    return new Set(["high_impact", "heavy_brace"]);
  }
  if (ctx === "prenatal" || ctx === "early_postpartum") {
    return new Set(["high_impact", "heavy_brace", "deep_core_flexion"]);
  }
  if (ctx === "late_postpartum") return new Set(["high_impact"]);
  return new Set();
}

export function suggestSwaps(
  originalId: string,
  profile: ProfileInput,
  inventory: Inventory,
  limit = 3
): SwapSuggestion[] {
  const original = EXERCISE_BY_ID[originalId];
  if (!original) return [];

  const excluded = exclusionTagsForContext(profile.trainingContext);

  const candidates = availableExercises(inventory)
    .filter((ex) => ex.id !== originalId)
    .filter((ex) => !ex.tags?.some((t) => excluded.has(t)));

  const scored = candidates
    .map((ex) => ({
      exercise: ex,
      score: scoreSwap(original, ex),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ exercise, score }) => ({
    exerciseId: exercise.id,
    name: exercise.name,
    pattern: exercise.pattern,
    primaryMuscles: exercise.primaryMuscles,
    difficulty: exercise.difficulty,
    equipment: exercise.equipment,
    cues: exercise.cues.slice(0, 2),
    reason: buildReason(original, exercise),
    score,
  }));
}
