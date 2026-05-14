// Progression engine — pure functions.
// Given a user's history for an exercise and the current prescription,
// compute the next session's target.
//
// Conventions:
// - Loaded exercises use "double progression":
//     * Start at the bottom of the rep range
//     * Push reps each session until you hit the top of the range on every set
//     * Then jump load up to the next loadable weight, reset reps to bottom
// - Bodyweight exercises progress by reps only (top of range bumps the range)
// - Iso holds (planks etc.) progress by seconds
// - Missed reps on most sets => deload one increment

import type { Exercise } from "@/data/exercises";
import { type Inventory, prescribeLoad } from "@/lib/equipment";

export interface SetLogInput {
  weightKg: number | null;
  reps: number | null;
  holdSeconds: number | null;
  skipped: boolean;
}

export interface Prescription {
  targetLoadKg: number | null;
  repsMin: number;
  repsMax: number;
  holdSeconds: number | null;
}

// Was the last session a "good" session for this exercise?
// Returns a categorical assessment used by the progression rules.
function assessLastSession(
  lastSets: SetLogInput[],
  current: Prescription
): "all_maxed" | "all_hit" | "some_missed" | "many_missed" | "no_data" {
  const real = lastSets.filter((s) => !s.skipped);
  if (real.length === 0) return "no_data";

  // For iso holds, use holdSeconds as the metric
  if (current.holdSeconds != null) {
    const maxed = real.every(
      (s) => (s.holdSeconds ?? 0) >= current.holdSeconds!
    );
    return maxed ? "all_maxed" : "all_hit";
  }

  const hitTop = real.filter((s) => (s.reps ?? 0) >= current.repsMax).length;
  const hitMin = real.filter((s) => (s.reps ?? 0) >= current.repsMin).length;
  const missed = real.length - hitMin;

  if (hitTop === real.length) return "all_maxed";
  if (hitMin === real.length) return "all_hit";
  if (missed >= Math.ceil(real.length / 2)) return "many_missed";
  return "some_missed";
}

// Find the next weight up from `current` in the available list.
function stepUp(current: number, available: number[]): number {
  const sorted = [...available].sort((a, b) => a - b);
  for (const w of sorted) {
    if (w > current) return w;
  }
  return current; // already at max
}

function stepDown(current: number, available: number[]): number {
  const sorted = [...available].sort((a, b) => b - a);
  for (const w of sorted) {
    if (w < current) return w;
  }
  return current; // already at min
}

// Pick the available weights for the loaded equipment used by this exercise.
function loadableWeights(ex: Exercise, inv: Inventory): number[] {
  const item = inv.find(
    (i) =>
      ex.equipment.includes(i.type) &&
      ["dumbbell", "kettlebell", "barbell"].includes(i.type) &&
      i.weightsKg.length > 0
  );
  return item ? item.weightsKg : [];
}

export function nextPrescription(
  ex: Exercise,
  current: Prescription,
  lastSession: SetLogInput[],
  inventory: Inventory
): Prescription {
  const assessment = assessLastSession(lastSession, current);

  // Iso holds: progress by seconds
  if (current.holdSeconds != null) {
    if (assessment === "all_maxed") {
      return { ...current, holdSeconds: current.holdSeconds + 5 };
    }
    if (assessment === "many_missed") {
      return {
        ...current,
        holdSeconds: Math.max(15, current.holdSeconds - 5),
      };
    }
    return current;
  }

  // Loaded exercises: double progression
  if (current.targetLoadKg != null) {
    const available = loadableWeights(ex, inventory);
    if (available.length === 0) return current;

    if (assessment === "all_maxed") {
      // Jump load, reset to bottom of rep range
      const next = stepUp(current.targetLoadKg, available);
      // Snap to nearest loadable in case of float drift
      const snapped = prescribeLoad(ex, inventory, next) ?? next;
      return { ...current, targetLoadKg: snapped };
    }
    if (assessment === "many_missed") {
      const next = stepDown(current.targetLoadKg, available);
      return { ...current, targetLoadKg: next };
    }
    // all_hit or some_missed: stay at same load (push reps within range)
    return current;
  }

  // Bodyweight: progress reps
  if (assessment === "all_maxed") {
    return {
      ...current,
      repsMin: current.repsMin + 1,
      repsMax: current.repsMax + 1,
    };
  }
  if (assessment === "many_missed") {
    return {
      ...current,
      repsMin: Math.max(1, current.repsMin - 1),
      repsMax: Math.max(current.repsMin, current.repsMax - 1),
    };
  }
  return current;
}

// Compute starting prescriptions for an active session from program items
// plus the user's recent history. Returns one prescription per program item.
export interface ProgressInput {
  exercise: Exercise;
  current: Prescription;
  lastSessionSets: SetLogInput[];
}

export function nextPrescriptionForMany(
  inputs: ProgressInput[],
  inventory: Inventory
): Prescription[] {
  return inputs.map((i) =>
    nextPrescription(i.exercise, i.current, i.lastSessionSets, inventory)
  );
}
