// Pure functions for matching the user's inventory against the exercise library
// and rounding prescribed loads to weights the user can actually load.

import {
  EXERCISES,
  type EquipmentType,
  type Exercise,
  type Pattern,
} from "@/data/exercises";

export interface InventoryItem {
  type: EquipmentType;
  weightsKg: number[]; // sorted ascending; empty for non-weighted items
  label?: string | null;
}

export type Inventory = InventoryItem[];

// Equipment types the user has, considering bodyweight is always implicit
function inventoryTypes(inv: Inventory): Set<EquipmentType> {
  return new Set(inv.map((i) => i.type));
}

export function canPerform(exercise: Exercise, inv: Inventory): boolean {
  if (exercise.equipment.length === 0) return true; // pure bodyweight
  const have = inventoryTypes(inv);
  return exercise.equipment.every((t) => have.has(t));
}

export function availableExercises(inv: Inventory): Exercise[] {
  return EXERCISES.filter((e) => canPerform(e, inv));
}

export function exercisesByPattern(inv: Inventory): Record<Pattern, Exercise[]> {
  const out: Partial<Record<Pattern, Exercise[]>> = {};
  for (const ex of availableExercises(inv)) {
    if (!out[ex.pattern]) out[ex.pattern] = [];
    out[ex.pattern]!.push(ex);
  }
  return out as Record<Pattern, Exercise[]>;
}

// --- Load prescription ---

// Round a target load (kg) to the nearest weight the user can actually load
// on the equipment type used by the exercise.
// Returns null if the user has no relevant loaded equipment for this exercise.
export function prescribeLoad(
  exercise: Exercise,
  inv: Inventory,
  targetKg: number
): number | null {
  if (exercise.loadType !== "loaded") return null;

  // Find the first loaded equipment item among the exercise's required list
  // that has weights. (Most loaded exercises use one weighted item: dumbbell,
  // kettlebell, or barbell.)
  const loadedTypes: EquipmentType[] = ["dumbbell", "kettlebell", "barbell"];
  const item =
    inv.find(
      (i) =>
        exercise.equipment.includes(i.type) &&
        loadedTypes.includes(i.type) &&
        i.weightsKg.length > 0
    ) ?? null;

  if (!item) return null;
  return nearestAvailable(targetKg, item.weightsKg);
}

// Pick the available weight closest to target. Ties round down (more conservative).
export function nearestAvailable(target: number, available: number[]): number {
  if (available.length === 0) return target;
  let best = available[0];
  let bestDelta = Math.abs(target - best);
  for (const w of available) {
    const delta = Math.abs(target - w);
    if (delta < bestDelta || (delta === bestDelta && w < best)) {
      best = w;
      bestDelta = delta;
    }
  }
  return best;
}

// --- Inventory parsing ---

// Convert a Prisma Equipment row (from the DB) to an InventoryItem.
// weightsKg in the DB is a JSON string; we parse here.
export function inventoryFromDb(
  rows: Array<{
    type: string;
    weightsKg: string | null;
    label: string | null;
  }>
): Inventory {
  return rows
    .filter((r) => isEquipmentType(r.type))
    .map((r) => ({
      type: r.type as EquipmentType,
      label: r.label,
      weightsKg: parseWeights(r.weightsKg),
    }));
}

export function isEquipmentType(s: string): s is EquipmentType {
  return [
    "dumbbell",
    "kettlebell",
    "barbell",
    "plate",
    "bench",
    "pullup_bar",
    "band",
    "yoga_mat",
    "machine",
  ].includes(s);
}

export function parseWeights(s: string | null): number[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((n): n is number => typeof n === "number" && isFinite(n) && n > 0)
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

// Parse a free-form weight string from the equipment editor.
// Accepts comma- or space-separated numbers. Strips kg suffix.
// e.g. "2, 5, 10" or "2kg 5kg 10kg" or "2.5, 5, 7.5"
export function parseWeightInput(input: string): number[] {
  const tokens = input
    .replace(/kg/gi, "")
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const nums: number[] = [];
  for (const t of tokens) {
    const n = Number(t);
    if (isFinite(n) && n > 0) nums.push(n);
  }
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}
