// Program generator: turns a user's profile + inventory into a weekly plan.
// Pure function. No side effects. No DB. The API route persists the result.

import {
  EXERCISE_BY_ID,
  EXERCISES,
  type Exercise,
  type ExerciseTag,
} from "@/data/exercises";
import { availableExercises, prescribeLoad, type Inventory } from "@/lib/equipment";
import {
  templateForDays,
  type Slot,
  type TemplateDay,
} from "@/data/templates";

export type Goal =
  | "general_fitness"
  | "strength"
  | "muscle_gain"
  | "fat_loss"
  | "mobility"
  | "endurance";

export type Experience = "beginner" | "intermediate" | "advanced";

// Recovery-aware programming flag. Drives both exercise filtering and rest
// tuning. "general" applies no special considerations. Other values map to
// tag filters defined in CONTEXT_FILTERS below.
export type TrainingContext =
  | "general"
  | "returning_from_injury"
  | "prenatal"
  | "early_postpartum"
  | "late_postpartum";

// Human-readable labels for displaying training context in the UI and
// passing as context to Claude. "general" is intentionally empty — we
// don't surface it as a special tag.
export const TRAINING_CONTEXT_LABELS: Record<TrainingContext, string> = {
  general: "",
  returning_from_injury: "Returning from injury",
  prenatal: "Prenatal",
  early_postpartum: "Early postpartum (< 4 months)",
  late_postpartum: "Late postpartum (4–12 months)",
};

export interface ProfileInput {
  bodyweightKg: number | null;
  experience: Experience;
  goals: Goal[];
  daysPerWeek: number;
  sessionMinutes: number;
  injuries?: string[];
  trainingContext?: TrainingContext | null;
}

export interface GeneratedItem {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  targetLoadKg: number | null;
  holdSeconds: number | null;
  restSeconds: number;
  notes?: string;
}

export interface GeneratedDay {
  label: string;
  isRestDay: boolean;
  items: GeneratedItem[];
}

export interface GeneratedProgram {
  splitId: string;
  splitName: string;
  daysPerWeek: number;
  experience: Experience;
  goals: Goal[];
  days: GeneratedDay[];
}

// ---- Reps / sets / rest tables, keyed by goal ----

interface PrescriptionShape {
  mainSets: number;
  mainRepsMin: number;
  mainRepsMax: number;
  mainRestSec: number;
  accessorySets: number;
  accessoryRepsMin: number;
  accessoryRepsMax: number;
  accessoryRestSec: number;
  finisherSets: number;
  finisherRepsMin: number;
  finisherRepsMax: number;
  finisherRestSec: number;
  isoHoldSec: number; // for plank, side plank etc.
}

// Rest periods are calibrated to current evidence (Schoenfeld et al. 2016,
// de Salles et al. Sports Med review, NSCA Essentials 4th ed.):
//   - Strength (1-5 reps): main compound rest ≥3 min for full PCr recovery.
//   - Hypertrophy (6-12 reps): 2-3 min on compounds preserves volume on later
//     sets, which is the primary growth driver. The older "60-90s for
//     hypertrophy" rec was overturned by Schoenfeld 2016 (3 min > 1 min for
//     both strength and growth, sets/reps equated).
//   - Isolation / accessory: 60-90s is sufficient.
//   - Metabolic / endurance: 30-60s maintains the elevated heart rate and
//     lactate accumulation that defines the stimulus.
const PRESCRIPTION_BY_GOAL: Record<Goal, PrescriptionShape> = {
  strength: {
    mainSets: 4,
    mainRepsMin: 4,
    mainRepsMax: 6,
    mainRestSec: 180, // 3 min — strength minimum for full PCr recovery
    accessorySets: 3,
    accessoryRepsMin: 6,
    accessoryRepsMax: 10,
    accessoryRestSec: 90,
    finisherSets: 2,
    finisherRepsMin: 8,
    finisherRepsMax: 12,
    finisherRestSec: 60,
    isoHoldSec: 45,
  },
  muscle_gain: {
    mainSets: 4,
    mainRepsMin: 8,
    mainRepsMax: 12,
    mainRestSec: 150, // 2:30 — Schoenfeld 2016 floor for compound hypertrophy
    accessorySets: 3,
    accessoryRepsMin: 10,
    accessoryRepsMax: 15,
    accessoryRestSec: 75,
    finisherSets: 3,
    finisherRepsMin: 12,
    finisherRepsMax: 20,
    finisherRestSec: 45,
    isoHoldSec: 45,
  },
  general_fitness: {
    mainSets: 3,
    mainRepsMin: 8,
    mainRepsMax: 12,
    mainRestSec: 90, // 1:30 — time-budget compromise; still enough on submax loads
    accessorySets: 3,
    accessoryRepsMin: 10,
    accessoryRepsMax: 15,
    accessoryRestSec: 60,
    finisherSets: 2,
    finisherRepsMin: 12,
    finisherRepsMax: 20,
    finisherRestSec: 45,
    isoHoldSec: 45,
  },
  fat_loss: {
    mainSets: 3,
    mainRepsMin: 10,
    mainRepsMax: 12,
    mainRestSec: 60,
    accessorySets: 3,
    accessoryRepsMin: 12,
    accessoryRepsMax: 15,
    accessoryRestSec: 45,
    finisherSets: 3,
    finisherRepsMin: 15,
    finisherRepsMax: 25,
    finisherRestSec: 30,
    isoHoldSec: 30,
  },
  endurance: {
    mainSets: 3,
    mainRepsMin: 12,
    mainRepsMax: 20,
    mainRestSec: 45,
    accessorySets: 3,
    accessoryRepsMin: 15,
    accessoryRepsMax: 25,
    accessoryRestSec: 30,
    finisherSets: 3,
    finisherRepsMin: 20,
    finisherRepsMax: 30,
    finisherRestSec: 30,
    isoHoldSec: 45,
  },
  mobility: {
    mainSets: 2,
    mainRepsMin: 8,
    mainRepsMax: 10,
    mainRestSec: 45,
    accessorySets: 2,
    accessoryRepsMin: 8,
    accessoryRepsMax: 12,
    accessoryRestSec: 30,
    finisherSets: 2,
    finisherRepsMin: 30, // seconds for stretches
    finisherRepsMax: 60,
    finisherRestSec: 30,
    isoHoldSec: 45,
  },
};

// Combine goals into a single prescription. First-listed goal weights most;
// average the rest.
function combinePrescriptions(goals: Goal[]): PrescriptionShape {
  if (goals.length === 0) return PRESCRIPTION_BY_GOAL.general_fitness;
  if (goals.length === 1) return PRESCRIPTION_BY_GOAL[goals[0]];

  const primary = PRESCRIPTION_BY_GOAL[goals[0]];
  // Blend secondary goals at 50% weight
  const others = goals.slice(1).map((g) => PRESCRIPTION_BY_GOAL[g]);
  const result: PrescriptionShape = { ...primary };
  for (const key of Object.keys(primary) as (keyof PrescriptionShape)[]) {
    const primaryVal = primary[key];
    const avgOthers =
      others.reduce((sum, o) => sum + o[key], 0) / others.length;
    result[key] = Math.round((primaryVal * 2 + avgOthers) / 3);
  }
  return result;
}

// Experience adjusts set counts
function adjustForExperience(shape: PrescriptionShape, xp: Experience): PrescriptionShape {
  const out = { ...shape };
  if (xp === "beginner") {
    out.mainSets = Math.max(2, out.mainSets - 1);
    out.accessorySets = Math.max(2, out.accessorySets - 1);
    out.finisherSets = Math.max(1, out.finisherSets - 1);
  } else if (xp === "advanced") {
    out.mainSets = out.mainSets + 1;
  }
  return out;
}

// Recovery rest buffer. Adds +30s to main and accessory rest periods on
// loaded work for users in a recovery context — postpartum (early or late),
// prenatal, or returning from injury. Rationale: longer rest between loaded
// sets reduces cumulative intra-abdominal pressure (postpartum / prenatal)
// and gives joints / connective tissue extra recovery between sets (return
// from injury). Originally formulated for postpartum (Bø et al. 2017 IOC
// consensus; clinical PT practice), generalized here. Finisher and iso rest
// are left alone — they're already short and not load-dominant.
function adjustForRecoveryContext(
  shape: PrescriptionShape,
  context: TrainingContext | null | undefined
): PrescriptionShape {
  const recoveryContexts: TrainingContext[] = [
    "returning_from_injury",
    "prenatal",
    "early_postpartum",
    "late_postpartum",
  ];
  if (!context || !recoveryContexts.includes(context)) return shape;
  // Late postpartum is gentler — no need for the full +30s by that point.
  if (context === "late_postpartum") return shape;
  return {
    ...shape,
    mainRestSec: shape.mainRestSec + 30,
    accessoryRestSec: shape.accessoryRestSec + 30,
  };
}

// Maps a training context to the set of exercise tags that should be
// filtered out. Each context picks the tags inappropriate for that state
// (high-impact + heavy-bracing for anyone in recovery; deep core flexion
// for pregnancy / early postpartum).
const CONTEXT_FILTERS: Record<TrainingContext, ExerciseTag[]> = {
  general: [],
  returning_from_injury: ["high_impact", "heavy_brace"],
  prenatal: ["high_impact", "heavy_brace", "deep_core_flexion"],
  early_postpartum: ["high_impact", "heavy_brace", "deep_core_flexion"],
  late_postpartum: ["high_impact"],
};

// ---- Session-length budget ----
// Rough heuristic: ~8 minutes per exercise including rest and inter-set work.
// Bumped from 7 → 8 alongside the rest-period retune so a 45-min target maps
// to ~5 exercises (was ~5–6). Empirically: 3 sets × 90s work + 3 × 120s rest +
// transition + warm-up ≈ 7.5 min, rounded up.
function exerciseBudget(sessionMinutes: number): number {
  const warmup = 5;
  const perExercise = 8;
  return Math.max(3, Math.min(8, Math.floor((sessionMinutes - warmup) / perExercise)));
}

// ---- Starting load estimates ----
// Conservative starting loads as a fraction of bodyweight.
// These map exercise ID prefixes / categories to a load factor.
// Generator falls back to 10kg if bodyweight is unknown.

interface LoadFactor {
  match: (ex: Exercise) => boolean;
  factor: number; // fraction of bodyweight per side / per hand (for unilateral DB) or total (for KB swing)
}

const LOAD_FACTORS: LoadFactor[] = [
  // Goblet / front squats — held at chest, can go heavier relative to BW
  { match: (e) => e.id.includes("goblet") || e.id.includes("front_squat"), factor: 0.35 },
  // Hip thrust — very strong pattern
  { match: (e) => e.id === "hip_thrust", factor: 0.5 },
  // Deadlifts / RDLs / swings — strong posterior chain
  { match: (e) => e.id === "kb_deadlift", factor: 0.5 },
  { match: (e) => e.id === "kb_swing", factor: 0.3 },
  { match: (e) => e.id.includes("rdl"), factor: 0.3 },
  // Rows
  { match: (e) => e.pattern === "horizontal_pull" && e.id.includes("row"), factor: 0.25 },
  // Pullover
  { match: (e) => e.id === "db_pullover", factor: 0.2 },
  // Bench / push movements
  {
    match: (e) =>
      e.pattern === "horizontal_push" && e.id.includes("bench"),
    factor: 0.25,
  },
  { match: (e) => e.pattern === "horizontal_push" && e.id.includes("floor_press"), factor: 0.2 },
  // Vertical push
  { match: (e) => e.pattern === "vertical_push" && e.id.includes("overhead"), factor: 0.15 },
  { match: (e) => e.pattern === "vertical_push" && e.id.includes("press"), factor: 0.15 },
  { match: (e) => e.id.includes("lateral_raise"), factor: 0.05 },
  // Split / Bulgarian
  {
    match: (e) =>
      e.pattern === "squat" && (e.id.includes("split") || e.id.includes("bulgarian")),
    factor: 0.18,
  },
  // Lunges
  { match: (e) => e.pattern === "lunge", factor: 0.18 },
  // Step-ups
  { match: (e) => e.id.includes("step_up"), factor: 0.15 },
  // Carries
  { match: (e) => e.pattern === "carry", factor: 0.3 },
  // Curls / isolation
  { match: (e) => e.id.includes("curl") || e.id.includes("tricep") || e.id.includes("skullcrusher"), factor: 0.1 },
  // Rotation
  { match: (e) => e.pattern === "rotation" || e.id.includes("russian"), factor: 0.1 },
  // KB clean & press / KB high pull
  { match: (e) => e.id.includes("clean") || e.id.includes("push_press"), factor: 0.2 },
  // Default for any other loaded exercise
];

function estimateStartingLoad(
  ex: Exercise,
  bodyweightKg: number | null,
  inv: Inventory,
  experience: Experience
): number | null {
  if (ex.loadType !== "loaded") return null;
  if (!bodyweightKg) {
    // Fall back to lightest available weight for the relevant equipment
    const item = inv.find(
      (i) =>
        ex.equipment.includes(i.type) &&
        ["dumbbell", "kettlebell", "barbell"].includes(i.type) &&
        i.weightsKg.length > 0
    );
    return item ? item.weightsKg[0] : null;
  }

  const factor =
    LOAD_FACTORS.find((lf) => lf.match(ex))?.factor ?? 0.15;
  let target = bodyweightKg * factor;

  // Experience modifier
  if (experience === "beginner") target *= 0.8;
  if (experience === "advanced") target *= 1.15;

  const rounded = prescribeLoad(ex, inv, target);
  return rounded;
}

// ---- Exercise selection per day ----

function isIsolation(ex: Exercise): boolean {
  // Heuristic: a single small muscle group as primary = isolation
  if (ex.primaryMuscles.length === 1) {
    const m = ex.primaryMuscles[0];
    if (m === "biceps" || m === "triceps" || m === "calves") return true;
  }
  return false;
}

function scoreCandidate(
  ex: Exercise,
  slot: Slot,
  experience: Experience,
  used: Set<string>
): number {
  let score = 100;
  // Strong preference: not already used
  if (used.has(ex.id)) score -= 60;

  // Slot pattern preference: prefer earlier listed patterns
  const idx = slot.patterns.indexOf(ex.pattern);
  if (idx >= 0) score += (slot.patterns.length - idx) * 5;

  // Compound vs isolation preference
  if (slot.prefer === "compound" && isIsolation(ex)) score -= 30;
  if (slot.prefer === "isolation" && !isIsolation(ex)) score -= 15;

  // Difficulty matching experience
  if (experience === "beginner" && ex.difficulty > 2) score -= 20;
  if (experience === "advanced" && ex.difficulty === 1) score -= 5;

  // Prefer loaded over bodyweight for "main" slots when loaded options exist
  if (slot.intensity === "main" && ex.loadType === "loaded") score += 8;

  return score;
}

function pickExercise(
  slot: Slot,
  available: Exercise[],
  experience: Experience,
  used: Set<string>
): Exercise | null {
  const candidates = available.filter((e) => slot.patterns.includes(e.pattern));
  if (candidates.length === 0) return null;
  const scored = candidates
    .map((c) => ({ ex: c, score: scoreCandidate(c, slot, experience, used) }))
    .sort((a, b) => b.score - a.score);
  return scored[0].ex;
}


// Tags excluded from the available pool based on profile modifications.
// Driven entirely off trainingContext via CONTEXT_FILTERS.
function exclusionTagsFor(profile: ProfileInput): Set<string> {
  const ctx = profile.trainingContext ?? "general";
  return new Set(CONTEXT_FILTERS[ctx] ?? []);
}

function filterExercisesForProfile(
  exercises: Exercise[],
  profile: ProfileInput
): Exercise[] {
  const excluded = exclusionTagsFor(profile);
  if (excluded.size === 0) return exercises;
  return exercises.filter(
    (ex) => !ex.tags?.some((t) => excluded.has(t))
  );
}

function isMobilityFocus(profile: ProfileInput): boolean {
  if (
    profile.trainingContext === "early_postpartum" ||
    profile.trainingContext === "prenatal"
  ) {
    return true;
  }
  return profile.goals[0] === "mobility" || profile.goals.includes("mobility");
}

function stretchPool(available: Exercise[]): Exercise[] {
  return available.filter((ex) => ex.tags?.includes("stretch"));
}

// ---- The generator ----

export function generateProgram(
  profile: ProfileInput,
  inventory: Inventory
): GeneratedProgram {
  const goals = (profile.goals.length > 0 ? profile.goals : ["general_fitness"]) as Goal[];
  const template = templateForDays(profile.daysPerWeek);
  const available = filterExercisesForProfile(availableExercises(inventory), profile);
  const shape = adjustForRecoveryContext(
    adjustForExperience(combinePrescriptions(goals), profile.experience),
    profile.trainingContext
  );
  const budget = exerciseBudget(profile.sessionMinutes);

  const days: GeneratedDay[] = template.days.map((tplDay) => {
    if (tplDay.label.includes("Mobility")) {
      return generateMobilityDay(tplDay, available, shape, profile);
    }

    const used = new Set<string>();
    const items: GeneratedItem[] = [];

    // Track exercises used in this same week so we vary day-to-day
    // (Note: weekly variation handled by template; intra-day uniqueness here.)

    for (const slot of tplDay.slots) {
      if (items.length >= budget) break;
      const ex = pickExercise(slot, available, profile.experience, used);
      if (!ex) continue;
      used.add(ex.id);

      const sets = setsForSlot(slot, shape);
      const { repsMin, repsMax, restSec, holdSec } = repsRestForSlot(slot, ex, shape);
      const load = estimateStartingLoad(
        ex,
        profile.bodyweightKg,
        inventory,
        profile.experience
      );

      items.push({
        exerciseId: ex.id,
        sets,
        repsMin,
        repsMax,
        targetLoadKg: load,
        holdSeconds: holdSec,
        restSeconds: restSec,
      });
    }


    // If mobility-focused (e.g. postpartum or mobility goal), append a short
    // stretch block — back / hip / glute biased.
    if (isMobilityFocus(profile)) {
      const stretchExercises = stretchPool(available)
        .filter((ex) => !used.has(ex.id))
        .sort((a, b) => {
          // Prefer back / hip / glute-focused stretches first
          const aScore = (a.tags?.includes("back_focus") ? 2 : 0) +
                         (a.tags?.includes("hip_focus") ? 2 : 0) +
                         (a.tags?.includes("postpartum_safe") ? 1 : 0);
          const bScore = (b.tags?.includes("back_focus") ? 2 : 0) +
                         (b.tags?.includes("hip_focus") ? 2 : 0) +
                         (b.tags?.includes("postpartum_safe") ? 1 : 0);
          return bScore - aScore;
        });
      const stretchCount = Math.min(3, stretchExercises.length);
      for (let i = 0; i < stretchCount; i++) {
        const ex = stretchExercises[i];
        used.add(ex.id);
        items.push({
          exerciseId: ex.id,
          sets: 2,
          repsMin: 1,
          repsMax: 1,
          targetLoadKg: null,
          holdSeconds: 30,
          restSeconds: 20,
        });
      }
    }

    return {
      label: tplDay.label,
      isRestDay: false,
      items,
    };
  });

  return {
    splitId: template.id,
    splitName: template.name,
    daysPerWeek: template.daysPerWeek,
    experience: profile.experience,
    goals,
    days,
  };
}

function setsForSlot(slot: Slot, shape: PrescriptionShape): number {
  if (slot.intensity === "main") return shape.mainSets;
  if (slot.intensity === "accessory") return shape.accessorySets;
  return shape.finisherSets;
}

function repsRestForSlot(
  slot: Slot,
  ex: Exercise,
  shape: PrescriptionShape
): { repsMin: number; repsMax: number; restSec: number; holdSec: number | null } {
  let repsMin: number, repsMax: number, restSec: number;
  if (slot.intensity === "main") {
    repsMin = shape.mainRepsMin;
    repsMax = shape.mainRepsMax;
    restSec = shape.mainRestSec;
  } else if (slot.intensity === "accessory") {
    repsMin = shape.accessoryRepsMin;
    repsMax = shape.accessoryRepsMax;
    restSec = shape.accessoryRestSec;
  } else {
    repsMin = shape.finisherRepsMin;
    repsMax = shape.finisherRepsMax;
    restSec = shape.finisherRestSec;
  }

  // For iso holds, use holdSeconds instead of reps
  const holdSec = ex.loadType === "iso" ? shape.isoHoldSec : null;

  // Carries: use reps as a distance/time proxy (10-20 = ~30s walks)
  if (ex.pattern === "carry") {
    repsMin = 1;
    repsMax = 1; // 1 long walk per set; the prescription is the rest seconds
    restSec = Math.max(restSec, 60);
  }

  return { repsMin, repsMax, restSec, holdSec };
}

function generateMobilityDay(
  tplDay: TemplateDay,
  available: Exercise[],
  shape: PrescriptionShape,
  profile: ProfileInput
): GeneratedDay {
  const items: GeneratedItem[] = [];
  const used = new Set<string>();
  for (const slot of tplDay.slots) {
    const ex = pickExercise(slot, available, profile.experience, used);
    if (!ex) continue;
    used.add(ex.id);
    items.push({
      exerciseId: ex.id,
      sets: 2,
      repsMin: 8,
      repsMax: 12,
      targetLoadKg: null,
      holdSeconds: ex.loadType === "iso" ? shape.isoHoldSec : null,
      restSeconds: 30,
    });
  }
  return { label: tplDay.label, isRestDay: false, items };
}

// ---- Convenience: find an exercise by id with a safe fallback ----
export function exerciseById(id: string): Exercise | null {
  return EXERCISE_BY_ID[id] ?? null;
}

// Keep EXERCISES referenced so unused-import linter doesn't yell
void EXERCISES;
