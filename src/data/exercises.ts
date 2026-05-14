// Exercise library — Phase 1 seed data.
// Source of truth: the equipment fields on each exercise determine
// whether the user can perform it given their inventory.

export type EquipmentType =
  | "dumbbell"
  | "kettlebell"
  | "barbell"
  | "plate"
  | "bench"
  | "pullup_bar"
  | "band"
  | "yoga_mat"
  | "machine";

export type Pattern =
  | "horizontal_push"
  | "vertical_push"
  | "horizontal_pull"
  | "vertical_pull"
  | "squat"
  | "hinge"
  | "lunge"
  | "carry"
  | "core"
  | "rotation"
  | "mobility"
  | "conditioning";

export type Muscle =
  | "chest"
  | "shoulders"
  | "triceps"
  | "biceps"
  | "back"
  | "lats"
  | "traps"
  | "forearms"
  | "abs"
  | "obliques"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "hip_flexors"
  | "full_body";

export type LoadType = "loaded" | "bodyweight" | "iso";

export type ExerciseTag =
  | "high_impact"        // burpees, jumping — avoid early postpartum
  | "heavy_brace"        // KB swings, push press — heavy intra-abdominal pressure
  | "deep_core_flexion"  // sit-ups, full crunches — avoid early postpartum / diastasis
  | "overhead_load"      // overhead presses with heavy weight
  | "wrist_loaded"       // push-ups, planks — wrist sensitive
  | "stretch"            // static or dynamic stretch
  | "glute_activation"   // hip thrusts, bird dog
  | "back_focus"         // back-specific mobility
  | "hip_focus"          // hip-specific mobility
  | "postpartum_safe"    // pelvic-floor + diastasis friendly
  | "pregnancy_safe";    // safe during pregnancy

export interface Exercise {
  id: string;
  name: string;
  equipment: EquipmentType[]; // empty array = bodyweight, always available
  pattern: Pattern;
  primaryMuscles: Muscle[];
  difficulty: 1 | 2 | 3; // 1 beginner, 3 advanced
  unilateral: boolean;
  loadType: LoadType;
  cues: string[];
  tags?: ExerciseTag[];
}

export const PATTERN_LABELS: Record<Pattern, string> = {
  horizontal_push: "Horizontal push",
  vertical_push: "Vertical push",
  horizontal_pull: "Horizontal pull",
  vertical_pull: "Vertical pull",
  squat: "Squat",
  hinge: "Hinge",
  lunge: "Lunge / Single leg",
  carry: "Carry",
  core: "Core",
  rotation: "Rotation",
  mobility: "Mobility",
  conditioning: "Conditioning",
};

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  dumbbell: "Dumbbells",
  kettlebell: "Kettlebells",
  barbell: "Barbell",
  plate: "Weight plates",
  bench: "Bench",
  pullup_bar: "Pull-up bar",
  band: "Resistance bands",
  yoga_mat: "Yoga mat",
  machine: "Machine",
};

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: "Chest",
  shoulders: "Shoulders",
  triceps: "Triceps",
  biceps: "Biceps",
  back: "Back",
  lats: "Lats",
  traps: "Traps",
  forearms: "Forearms",
  abs: "Abs",
  obliques: "Obliques",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  hip_flexors: "Hip flexors",
  full_body: "Full body",
};

export const EXERCISES: Exercise[] = [
  // ---------- Horizontal push ----------
  {
    id: "pushup",
    name: "Push-up",
    equipment: [],
    pattern: "horizontal_push",
    primaryMuscles: ["chest", "triceps", "shoulders"],
    difficulty: 1,
    unilateral: false,
    loadType: "bodyweight",
    tags: ["wrist_loaded"],
    cues: [
      "Hands under shoulders, body in one straight line",
      "Brace abs and glutes, don't let hips sag",
      "Elbows tracking back at ~45°",
    ],
  },
  {
    id: "incline_pushup",
    name: "Incline push-up",
    equipment: ["bench"],
    pattern: "horizontal_push",
    primaryMuscles: ["chest", "triceps"],
    difficulty: 1,
    unilateral: false,
    loadType: "bodyweight",
    tags: ["wrist_loaded", "postpartum_safe"],
    cues: [
      "Hands on the bench, body in a straight line",
      "Easier than floor push-ups — good regression",
    ],
  },
  {
    id: "decline_pushup",
    name: "Decline push-up",
    equipment: ["bench"],
    pattern: "horizontal_push",
    primaryMuscles: ["chest", "shoulders", "triceps"],
    difficulty: 2,
    unilateral: false,
    loadType: "bodyweight",
    tags: ["wrist_loaded"],
    cues: [
      "Feet elevated on bench, hands on floor",
      "Hits upper chest harder than flat push-ups",
    ],
  },
  {
    id: "db_bench_press",
    name: "Dumbbell bench press",
    equipment: ["dumbbell", "bench"],
    pattern: "horizontal_push",
    primaryMuscles: ["chest", "triceps", "shoulders"],
    difficulty: 2,
    unilateral: false,
    loadType: "loaded",
    cues: [
      "Lie flat, dumbbells at shoulder line",
      "Press up and slightly in, controlled descent",
      "Don't flare elbows past 75°",
    ],
  },
  {
    id: "db_floor_press",
    name: "Dumbbell floor press",
    equipment: ["dumbbell"],
    pattern: "horizontal_push",
    primaryMuscles: ["chest", "triceps"],
    difficulty: 2,
    unilateral: false,
    loadType: "loaded",
    cues: [
      "Lie on the floor, knees bent",
      "Lower until upper arms touch floor, pause, press up",
      "Great bench substitute",
    ],
  },
  {
    id: "db_incline_bench_press",
    name: "Dumbbell incline bench press",
    equipment: ["dumbbell", "bench"],
    pattern: "horizontal_push",
    primaryMuscles: ["chest", "shoulders", "triceps"],
    difficulty: 2,
    unilateral: false,
    loadType: "loaded",
    cues: [
      "Bench set to 30–45° incline",
      "Hits upper chest",
      "Drive dumbbells up and slightly together",
    ],
  },
  {
    id: "kb_floor_press",
    name: "Kettlebell floor press",
    equipment: ["kettlebell"],
    pattern: "horizontal_push",
    primaryMuscles: ["chest", "triceps"],
    difficulty: 2,
    unilateral: true,
    loadType: "loaded",
    cues: [
      "One arm at a time — wrist neutral, knuckles to ceiling",
      "Off-arm braced or holding a counterweight",
    ],
  },

  // ---------- Vertical push ----------
  {
    id: "pike_pushup",
    name: "Pike push-up",
    equipment: [],
    pattern: "vertical_push",
    primaryMuscles: ["shoulders", "triceps"],
    difficulty: 2,
    unilateral: false,
    loadType: "bodyweight",
    tags: ["wrist_loaded", "overhead_load"],
    cues: [
      "Inverted-V position, hips high",
      "Lower the top of your head toward the floor",
      "Great shoulder progression toward handstand push-ups",
    ],
  },
  {
    id: "db_overhead_press",
    name: "Dumbbell overhead press",
    equipment: ["dumbbell"],
    pattern: "vertical_push",
    primaryMuscles: ["shoulders", "triceps"],
    difficulty: 2,
    unilateral: false,
    loadType: "loaded",
    tags: ["overhead_load"],
    cues: [
      "Standing or seated, dumbbells at shoulder height",
      "Brace core, press straight up",
      "Don't lean back — keep ribs down",
    ],
  },
  {
    id: "db_seated_press",
    name: "Dumbbell seated press",
    equipment: ["dumbbell", "bench"],
    pattern: "vertical_push",
    primaryMuscles: ["shoulders", "triceps"],
    difficulty: 2,
    unilateral: false,
    loadType: "loaded",
    tags: ["overhead_load"],
    cues: [
      "Bench upright, back supported",
      "Removes lower-body cheat — pure shoulder work",
    ],
  },
  {
    id: "kb_strict_press",
    name: "Kettlebell strict press",
    equipment: ["kettlebell"],
    pattern: "vertical_push",
    primaryMuscles: ["shoulders", "triceps"],
    difficulty: 2,
    unilateral: true,
    loadType: "loaded",
    tags: ["overhead_load"],
    cues: [
      "KB in front rack, elbow tucked",
      "Press while keeping torso vertical and glutes squeezed",
      "Pull the bell down on the way back, don't drop",
    ],
  },
  {
    id: "kb_push_press",
    name: "Kettlebell push press",
    equipment: ["kettlebell"],
    pattern: "vertical_push",
    primaryMuscles: ["shoulders", "triceps", "quads"],
    difficulty: 2,
    unilateral: true,
    loadType: "loaded",
    tags: ["heavy_brace", "overhead_load"],
    cues: [
      "Slight dip with the legs, then drive overhead",
      "Use this when strict press load is too heavy",
    ],
  },
  {
    id: "db_lateral_raise",
    name: "Dumbbell lateral raise",
    equipment: ["dumbbell"],
    pattern: "vertical_push",
    primaryMuscles: ["shoulders"],
    difficulty: 1,
    unilateral: false,
    loadType: "loaded",
    cues: [
      "Slight bend at the elbow, lift to shoulder height",
      "Lead with the elbows, not the hands",
      "Don't shrug",
    ],
  },

  // ---------- Horizontal pull ----------
  {
    id: "db_row",
    name: "Dumbbell row",
    equipment: ["dumbbell"],
    pattern: "horizontal_pull",
    primaryMuscles: ["back", "lats", "biceps"],
    difficulty: 1,
    unilateral: true,
    loadType: "loaded",
    cues: [
      "Hinge at the hips, flat back",
      "Pull elbow toward your hip, not your shoulder",
      "Squeeze shoulder blade at the top",
    ],
  },
  {
    id: "db_bench_supported_row",
    name: "Dumbbell bench-supported row",
    equipment: ["dumbbell", "bench"],
    pattern: "horizontal_pull",
    primaryMuscles: ["back", "lats", "biceps"],
    difficulty: 1,
    unilateral: true,
    loadType: "loaded",
    cues: [
      "One knee and hand on bench, opposite foot on floor",
      "Lets you isolate the back without lower-back fatigue",
    ],
  },
  {
    id: "kb_row",
    name: "Kettlebell row",
    equipment: ["kettlebell"],
    pattern: "horizontal_pull",
    primaryMuscles: ["back", "lats", "biceps"],
    difficulty: 1,
    unilateral: true,
    loadType: "loaded",
    cues: [
      "Hinge over, free hand on knee or bench",
      "Drive elbow back, squeeze the lat",
    ],
  },
  {
    id: "renegade_row",
    name: "Renegade row",
    equipment: ["dumbbell"],
    pattern: "horizontal_pull",
    primaryMuscles: ["back", "lats", "abs"],
    difficulty: 3,
    unilateral: true,
    loadType: "loaded",
    tags: ["wrist_loaded", "heavy_brace"],
    cues: [
      "Plank on the dumbbells, wide feet for stability",
      "Row one DB while not letting the hips rotate",
      "Brace the core hard",
    ],
  },
  {
    id: "inverted_row",
    name: "Inverted row",
    equipment: ["pullup_bar"],
    pattern: "horizontal_pull",
    primaryMuscles: ["back", "lats", "biceps"],
    difficulty: 2,
    unilateral: false,
    loadType: "bodyweight",
    cues: [
      "Bar set at hip height, hang underneath",
      "Pull chest to bar, body in a straight line",
      "Adjust foot position for difficulty",
    ],
  },
  {
    id: "band_row",
    name: "Band row",
    equipment: ["band"],
    pattern: "horizontal_pull",
    primaryMuscles: ["back", "lats", "biceps"],
    difficulty: 1,
    unilateral: false,
    loadType: "loaded",
    cues: [
      "Anchor band at chest height",
      "Pull handles toward ribs, squeeze shoulder blades",
    ],
  },

  // ---------- Vertical pull ----------
  {
    id: "pullup",
    name: "Pull-up",
    equipment: ["pullup_bar"],
    pattern: "vertical_pull",
    primaryMuscles: ["lats", "back", "biceps"],
    difficulty: 3,
    unilateral: false,
    loadType: "bodyweight",
    cues: [
      "Full hang at the bottom",
      "Pull chest toward the bar, elbows down and back",
      "Avoid kipping — control the descent",
    ],
  },
  {
    id: "chinup",
    name: "Chin-up",
    equipment: ["pullup_bar"],
    pattern: "vertical_pull",
    primaryMuscles: ["lats", "biceps"],
    difficulty: 2,
    unilateral: false,
    loadType: "bodyweight",
    cues: [
      "Underhand grip, shoulder-width",
      "Easier than pull-up, more biceps involvement",
    ],
  },
  {
    id: "band_pulldown",
    name: "Band pulldown",
    equipment: ["band"],
    pattern: "vertical_pull",
    primaryMuscles: ["lats", "back"],
    difficulty: 1,
    unilateral: false,
    loadType: "loaded",
    cues: [
      "Anchor band overhead",
      "Pull elbows down and back, squeeze lats",
    ],
  },
  {
    id: "db_pullover",
    name: "Dumbbell pullover",
    equipment: ["dumbbell", "bench"],
    pattern: "vertical_pull",
    primaryMuscles: ["lats", "chest"],
    difficulty: 2,
    unilateral: false,
    loadType: "loaded",
    cues: [
      "Lie on bench, hold one DB with both hands above chest",
      "Lower behind your head with a slight elbow bend",
      "Feel the stretch in the lats",
    ],
  },

  // ---------- Squat ----------
  {
    id: "bodyweight_squat",
    name: "Bodyweight squat",
    equipment: [],
    pattern: "squat",
    primaryMuscles: ["quads", "glutes"],
    difficulty: 1,
    unilateral: false,
    loadType: "bodyweight",
    cues: [
      "Feet shoulder-width, toes slightly out",
      "Hips back and down, knees track over toes",
      "Chest up, weight on midfoot",
    ],
  },
  {
    id: "goblet_squat",
    name: "Goblet squat",
    equipment: ["dumbbell"],
    pattern: "squat",
    primaryMuscles: ["quads", "glutes", "abs"],
    difficulty: 1,
    unilateral: false,
    loadType: "loaded",
    cues: [
      "Hold DB at chest with both hands",
      "Elbows brush the inside of your knees at the bottom",
      "Keep torso tall, drive through the heels",
    ],
  },
  {
    id: "kb_goblet_squat",
    name: "Kettlebell goblet squat",
    equipment: ["kettlebell"],
    pattern: "squat",
    primaryMuscles: ["quads", "glutes", "abs"],
    difficulty: 1,
    unilateral: false,
    loadType: "loaded",
    cues: [
      "Hold KB by the horns at chest height",
      "Same form as DB goblet",
    ],
  },
  {
    id: "db_front_squat",
    name: "Dumbbell front squat",
    equipment: ["dumbbell"],
    pattern: "squat",
    primaryMuscles: ["quads", "glutes"],
    difficulty: 2,
    unilateral: false,
    loadType: "loaded",
    cues: [
      "DBs on shoulders, elbows high",
      "Stay upright — front-loaded squat punishes a forward lean",
    ],
  },
  {
    id: "kb_double_front_squat",
    name: "Double kettlebell front squat",
    equipment: ["kettlebell"],
    pattern: "squat",
    primaryMuscles: ["quads", "glutes", "abs"],
    difficulty: 2,
    unilateral: false,
    loadType: "loaded",
    cues: [
      "Both KBs in front rack",
      "Elbows pointed down, chest tall",
    ],
  },
  {
    id: "split_squat",
    name: "Split squat",
    equipment: [],
    pattern: "squat",
    primaryMuscles: ["quads", "glutes"],
    difficulty: 1,
    unilateral: true,
    loadType: "bodyweight",
    cues: [
      "Staggered stance, both feet flat",
      "Drop straight down, front knee tracks over foot",
    ],
  },
  {
    id: "db_split_squat",
    name: "Dumbbell split squat",
    equipment: ["dumbbell"],
    pattern: "squat",
    primaryMuscles: ["quads", "glutes"],
    difficulty: 2,
    unilateral: true,
    loadType: "loaded",
    cues: [
      "DBs at sides, staggered stance",
      "Up to 80% of the work on the front leg",
    ],
  },
  {
    id: "bulgarian_split_squat",
    name: "Bulgarian split squat",
    equipment: ["dumbbell", "bench"],
    pattern: "squat",
    primaryMuscles: ["quads", "glutes"],
    difficulty: 3,
    unilateral: true,
    loadType: "loaded",
    cues: [
      "Rear foot on bench, far enough forward that knee tracks over foot",
      "Brutal but very effective single-leg builder",
    ],
  },

  // ---------- Hinge ----------
  {
    id: "db_rdl",
    name: "Dumbbell Romanian deadlift",
    equipment: ["dumbbell"],
    pattern: "hinge",
    primaryMuscles: ["hamstrings", "glutes", "back"],
    difficulty: 1,
    unilateral: false,
    loadType: "loaded",
    cues: [
      "Soft knees, push hips back",
      "DBs slide down the thighs, neutral spine",
      "Stop where you feel a stretch — don't round",
    ],
  },
  {
    id: "single_leg_db_rdl",
    name: "Single-leg dumbbell RDL",
    equipment: ["dumbbell"],
    pattern: "hinge",
    primaryMuscles: ["hamstrings", "glutes"],
    difficulty: 2,
    unilateral: true,
    loadType: "loaded",
    cues: [
      "Hinge over one leg, back leg extends behind",
      "Hips square — don't open up",
      "Great for balance and hamstring strength",
    ],
  },
  {
    id: "kb_deadlift",
    name: "Kettlebell deadlift",
    equipment: ["kettlebell"],
    pattern: "hinge",
    primaryMuscles: ["hamstrings", "glutes", "back"],
    difficulty: 1,
    unilateral: false,
    loadType: "loaded",
    cues: [
      "KB between your feet",
      "Hinge, grip handle with neutral spine",
      "Drive floor away, stand tall",
    ],
  },
  {
    id: "kb_swing",
    name: "Kettlebell swing",
    equipment: ["kettlebell"],
    pattern: "hinge",
    primaryMuscles: ["glutes", "hamstrings", "back"],
    difficulty: 2,
    unilateral: false,
    loadType: "loaded",
    tags: ["heavy_brace"],
    cues: [
      "Hike the bell back, then snap hips forward",
      "Arms are ropes — the bell floats to chest height",
      "Glutes finish the lift, not the shoulders",
    ],
  },
  {
    id: "good_morning",
    name: "Good morning",
    equipment: ["dumbbell"],
    pattern: "hinge",
    primaryMuscles: ["hamstrings", "glutes", "back"],
    difficulty: 2,
    unilateral: false,
    loadType: "loaded",
    cues: [
      "DBs at shoulders or held at chest",
      "Hinge as far as flexibility allows, neutral spine",
    ],
  },
  {
    id: "hip_thrust",
    name: "Hip thrust",
    equipment: ["dumbbell", "bench"],
    pattern: "hinge",
    primaryMuscles: ["glutes", "hamstrings"],
    difficulty: 1,
    unilateral: false,
    loadType: "loaded",
    tags: ["glute_activation"],
    cues: [
      "Upper back on bench, DB over hips",
      "Drive hips up, squeeze glutes at top",
      "Ribs down — don't hyperextend",
    ],
  },
  {
    id: "glute_bridge",
    name: "Glute bridge",
    equipment: [],
    pattern: "hinge",
    primaryMuscles: ["glutes", "hamstrings"],
    difficulty: 1,
    unilateral: false,
    loadType: "bodyweight",
    tags: ["glute_activation", "postpartum_safe"],
    cues: [
      "Feet flat, heels close to glutes",
      "Drive heels into floor, lift hips",
      "Pause and squeeze at the top",
    ],
  },

  // ---------- Lunge ----------
  {
    id: "reverse_lunge",
    name: "Reverse lunge",
    equipment: [],
    pattern: "lunge",
    primaryMuscles: ["quads", "glutes"],
    difficulty: 1,
    unilateral: true,
    loadType: "bodyweight",
    cues: [
      "Step back, drop the back knee toward the floor",
      "Front shin stays vertical-ish",
      "Push through the front heel to stand",
    ],
  },
  {
    id: "db_reverse_lunge",
    name: "Dumbbell reverse lunge",
    equipment: ["dumbbell"],
    pattern: "lunge",
    primaryMuscles: ["quads", "glutes"],
    difficulty: 2,
    unilateral: true,
    loadType: "loaded",
    cues: [
      "DBs at sides, same form as bodyweight",
    ],
  },
  {
    id: "db_walking_lunge",
    name: "Dumbbell walking lunge",
    equipment: ["dumbbell"],
    pattern: "lunge",
    primaryMuscles: ["quads", "glutes"],
    difficulty: 2,
    unilateral: true,
    loadType: "loaded",
    cues: [
      "Step forward, drop into a deep lunge, drive through and step forward again",
      "Brutal conditioning",
    ],
  },
  {
    id: "step_up",
    name: "Step-up",
    equipment: ["bench"],
    pattern: "lunge",
    primaryMuscles: ["quads", "glutes"],
    difficulty: 1,
    unilateral: true,
    loadType: "bodyweight",
    cues: [
      "Bench at mid-shin to knee height",
      "All the work on the top leg — don't bounce off the bottom",
    ],
  },
  {
    id: "db_step_up",
    name: "Dumbbell step-up",
    equipment: ["dumbbell", "bench"],
    pattern: "lunge",
    primaryMuscles: ["quads", "glutes"],
    difficulty: 2,
    unilateral: true,
    loadType: "loaded",
    cues: [
      "DBs at sides",
      "Drive through the heel on the top leg",
    ],
  },

  // ---------- Carry ----------
  {
    id: "farmer_carry_db",
    name: "Farmer carry (dumbbells)",
    equipment: ["dumbbell"],
    pattern: "carry",
    primaryMuscles: ["forearms", "traps", "abs", "full_body"],
    difficulty: 1,
    unilateral: false,
    loadType: "loaded",
    cues: [
      "Pick up the DBs with good form",
      "Walk tall, shoulders pulled back, abs braced",
      "Grip kills your forearms — that's the point",
    ],
  },
  {
    id: "farmer_carry_kb",
    name: "Farmer carry (kettlebells)",
    equipment: ["kettlebell"],
    pattern: "carry",
    primaryMuscles: ["forearms", "traps", "abs", "full_body"],
    difficulty: 1,
    unilateral: false,
    loadType: "loaded",
    cues: ["Same form as DB version"],
  },
  {
    id: "suitcase_carry",
    name: "Suitcase carry",
    equipment: ["dumbbell"],
    pattern: "carry",
    primaryMuscles: ["obliques", "abs", "forearms"],
    difficulty: 2,
    unilateral: true,
    loadType: "loaded",
    cues: [
      "One DB on one side only",
      "Resist leaning — keep torso vertical",
      "Anti-lateral-flexion ab work",
    ],
  },
  {
    id: "kb_overhead_carry",
    name: "Kettlebell overhead carry",
    equipment: ["kettlebell"],
    pattern: "carry",
    primaryMuscles: ["shoulders", "abs"],
    difficulty: 2,
    unilateral: true,
    loadType: "loaded",
    tags: ["overhead_load"],
    cues: [
      "Press the KB overhead, lock the arm",
      "Walk slowly — shoulder stability test",
    ],
  },

  // ---------- Core ----------
  {
    id: "plank",
    name: "Plank",
    equipment: [],
    pattern: "core",
    primaryMuscles: ["abs"],
    difficulty: 1,
    unilateral: false,
    loadType: "iso",
    tags: ["wrist_loaded"],
    cues: [
      "Forearms on the floor, body in one line",
      "Squeeze glutes, tuck pelvis, brace abs",
      "Quality over duration",
    ],
  },
  {
    id: "side_plank",
    name: "Side plank",
    equipment: [],
    pattern: "core",
    primaryMuscles: ["obliques", "abs"],
    difficulty: 1,
    unilateral: true,
    loadType: "iso",
    tags: ["wrist_loaded"],
    cues: [
      "Stack the feet, hips off the floor",
      "Body in a straight line from head to heel",
    ],
  },
  {
    id: "dead_bug",
    name: "Dead bug",
    equipment: ["yoga_mat"],
    pattern: "core",
    primaryMuscles: ["abs"],
    difficulty: 1,
    unilateral: false,
    loadType: "bodyweight",
    tags: ["postpartum_safe"],
    cues: [
      "Lower back glued to the floor",
      "Slow, controlled — opposite arm and leg",
      "Exhale on the extension",
    ],
  },
  {
    id: "hollow_hold",
    name: "Hollow body hold",
    equipment: ["yoga_mat"],
    pattern: "core",
    primaryMuscles: ["abs"],
    difficulty: 2,
    unilateral: false,
    loadType: "iso",
    cues: [
      "Press lower back into the floor",
      "Arms overhead, legs straight, slight curl",
    ],
  },
  {
    id: "kb_russian_twist",
    name: "Kettlebell Russian twist",
    equipment: ["kettlebell"],
    pattern: "rotation",
    primaryMuscles: ["obliques", "abs"],
    difficulty: 2,
    unilateral: false,
    loadType: "loaded",
    cues: [
      "Lean back ~45°, feet hovering for harder version",
      "Rotate from the ribs, not just the arms",
    ],
  },
  {
    id: "pallof_press",
    name: "Pallof press",
    equipment: ["band"],
    pattern: "rotation",
    primaryMuscles: ["abs", "obliques"],
    difficulty: 2,
    unilateral: false,
    loadType: "iso",
    cues: [
      "Band anchored at chest height to the side",
      "Press the handle straight out and resist the rotation",
    ],
  },

  // ---------- Biceps / Triceps (small isolation set) ----------
  {
    id: "db_curl",
    name: "Dumbbell curl",
    equipment: ["dumbbell"],
    pattern: "horizontal_pull",
    primaryMuscles: ["biceps"],
    difficulty: 1,
    unilateral: false,
    loadType: "loaded",
    cues: [
      "Elbows pinned at the sides",
      "Slow eccentric — that's where the growth is",
    ],
  },
  {
    id: "db_hammer_curl",
    name: "Dumbbell hammer curl",
    equipment: ["dumbbell"],
    pattern: "horizontal_pull",
    primaryMuscles: ["biceps", "forearms"],
    difficulty: 1,
    unilateral: false,
    loadType: "loaded",
    cues: [
      "Neutral grip (thumbs up)",
      "Hits brachialis and forearms",
    ],
  },
  {
    id: "db_skullcrusher",
    name: "Dumbbell skullcrusher",
    equipment: ["dumbbell", "bench"],
    pattern: "horizontal_push",
    primaryMuscles: ["triceps"],
    difficulty: 2,
    unilateral: false,
    loadType: "loaded",
    cues: [
      "Lie on bench, DBs above shoulders",
      "Lower toward forehead, only the elbows move",
    ],
  },
  {
    id: "db_overhead_tricep_extension",
    name: "Dumbbell overhead tricep extension",
    equipment: ["dumbbell"],
    pattern: "vertical_push",
    primaryMuscles: ["triceps"],
    difficulty: 1,
    unilateral: false,
    loadType: "loaded",
    tags: ["overhead_load"],
    cues: [
      "One DB held overhead with both hands",
      "Elbows in, lower behind the head with control",
    ],
  },

  // ---------- Mobility / Conditioning ----------
  {
    id: "world_greatest_stretch",
    name: "World's greatest stretch",
    equipment: ["yoga_mat"],
    pattern: "mobility",
    primaryMuscles: ["hip_flexors", "full_body"],
    difficulty: 1,
    unilateral: true,
    loadType: "bodyweight",
    tags: ["stretch", "hip_focus"],
    cues: [
      "Lunge, hand to floor, rotate and reach to ceiling",
      "Full-body warm-up movement",
    ],
  },
  {
    id: "cat_cow",
    name: "Cat-cow",
    equipment: ["yoga_mat"],
    pattern: "mobility",
    primaryMuscles: ["back"],
    difficulty: 1,
    unilateral: false,
    loadType: "bodyweight",
    tags: ["stretch", "back_focus", "postpartum_safe"],
    cues: [
      "On all fours, alternate spinal flexion and extension",
      "Good warm-up for the spine",
    ],
  },
  {
    id: "kb_clean_and_press",
    name: "Kettlebell clean & press",
    equipment: ["kettlebell"],
    pattern: "conditioning",
    primaryMuscles: ["full_body"],
    difficulty: 3,
    unilateral: true,
    loadType: "loaded",
    tags: ["heavy_brace", "overhead_load"],
    cues: [
      "Clean to rack, press to lockout, return",
      "Brutal full-body conditioning",
    ],
  },
  {
    id: "burpee",
    name: "Burpee",
    equipment: [],
    pattern: "conditioning",
    primaryMuscles: ["full_body"],
    difficulty: 2,
    unilateral: false,
    loadType: "bodyweight",
    tags: ["high_impact", "wrist_loaded"],
    cues: [
      "Squat, kick back to plank, push-up, jump up",
      "Universally hated, universally effective",
    ],
  },
  {
    id: "mountain_climber",
    name: "Mountain climber",
    equipment: [],
    pattern: "conditioning",
    primaryMuscles: ["abs", "full_body"],
    difficulty: 1,
    unilateral: false,
    loadType: "bodyweight",
    tags: ["high_impact", "wrist_loaded"],
    cues: [
      "Plank position, drive knees toward chest alternately",
      "Maintain a flat back — don't pop hips up",
    ],
  },
  {
    id: "jumping_jacks",
    name: "Jumping jacks",
    equipment: [],
    pattern: "conditioning",
    primaryMuscles: ["full_body"],
    difficulty: 1,
    unilateral: false,
    loadType: "bodyweight",
    tags: ["high_impact"],
    cues: ["Classic warm-up — keep the rhythm steady"],
  },

  // ---------- More stretches & postpartum-friendly mobility ----------
  {
    id: "childs_pose",
    name: "Child's pose",
    equipment: ["yoga_mat"],
    pattern: "mobility",
    primaryMuscles: ["back", "lats", "hip_flexors"],
    difficulty: 1,
    unilateral: false,
    loadType: "iso",
    tags: ["stretch", "back_focus", "postpartum_safe"],
    cues: [
      "Knees wide, big toes touching, sit hips back to heels",
      "Reach arms forward, forehead toward mat",
      "Breathe into the lower back for 5–10 slow breaths",
    ],
  },
  {
    id: "thread_the_needle",
    name: "Thread the needle",
    equipment: ["yoga_mat"],
    pattern: "mobility",
    primaryMuscles: ["back", "shoulders"],
    difficulty: 1,
    unilateral: true,
    loadType: "iso",
    tags: ["stretch", "back_focus", "postpartum_safe"],
    cues: [
      "From all fours, thread one arm under the other",
      "Rest shoulder and ear on the mat; opposite arm reaches forward",
      "Great for upper back and shoulder mobility",
    ],
  },
  {
    id: "seated_spinal_twist",
    name: "Seated spinal twist",
    equipment: ["yoga_mat"],
    pattern: "mobility",
    primaryMuscles: ["back", "obliques"],
    difficulty: 1,
    unilateral: true,
    loadType: "iso",
    tags: ["stretch", "back_focus", "postpartum_safe"],
    cues: [
      "Sit tall, cross one knee over the other",
      "Twist toward the bent leg, lengthen the spine on the inhale",
      "Don't force — twist comes from the mid-back",
    ],
  },
  {
    id: "supine_figure_four",
    name: "Lying figure-4 stretch",
    equipment: ["yoga_mat"],
    pattern: "mobility",
    primaryMuscles: ["glutes", "hip_flexors"],
    difficulty: 1,
    unilateral: true,
    loadType: "iso",
    tags: ["stretch", "hip_focus", "postpartum_safe"],
    cues: [
      "Lie on back, cross one ankle over the opposite knee",
      "Pull the bottom thigh toward your chest",
      "Hold 30–60s each side — releases deep glute tension",
    ],
  },
  {
    id: "pigeon_pose",
    name: "Pigeon pose",
    equipment: ["yoga_mat"],
    pattern: "mobility",
    primaryMuscles: ["glutes", "hip_flexors"],
    difficulty: 2,
    unilateral: true,
    loadType: "iso",
    tags: ["stretch", "hip_focus"],
    cues: [
      "Front shin angled across the mat, back leg straight behind",
      "Stack hips, fold forward over the front shin",
      "Skip if it pinches the front knee — sub the figure-4 stretch",
    ],
  },
  {
    id: "kneeling_hip_flexor_stretch",
    name: "Kneeling hip flexor stretch",
    equipment: ["yoga_mat"],
    pattern: "mobility",
    primaryMuscles: ["hip_flexors", "glutes"],
    difficulty: 1,
    unilateral: true,
    loadType: "iso",
    tags: ["stretch", "hip_focus", "postpartum_safe"],
    cues: [
      "Half-kneeling stance, back knee on the mat",
      "Tuck pelvis, squeeze the rear glute",
      "Don't arch the back — the stretch is in the front of the hip",
    ],
  },
  {
    id: "ninety_ninety_hip",
    name: "90/90 hip switch",
    equipment: ["yoga_mat"],
    pattern: "mobility",
    primaryMuscles: ["hip_flexors", "glutes"],
    difficulty: 2,
    unilateral: false,
    loadType: "bodyweight",
    tags: ["stretch", "hip_focus", "postpartum_safe"],
    cues: [
      "Sit with front leg at 90°, back leg at 90°",
      "Lean over the front knee for an external rotation stretch",
      "Sweep the legs to switch sides slowly",
    ],
  },
  {
    id: "standing_forward_fold",
    name: "Standing forward fold",
    equipment: [],
    pattern: "mobility",
    primaryMuscles: ["hamstrings", "back"],
    difficulty: 1,
    unilateral: false,
    loadType: "iso",
    tags: ["stretch", "back_focus", "postpartum_safe"],
    cues: [
      "Soft knees, hinge from the hips",
      "Let the head and arms hang — release the spine",
      "Don't bounce; breathe into the hamstrings",
    ],
  },
  {
    id: "knees_to_chest",
    name: "Knees-to-chest",
    equipment: ["yoga_mat"],
    pattern: "mobility",
    primaryMuscles: ["back", "glutes"],
    difficulty: 1,
    unilateral: false,
    loadType: "iso",
    tags: ["stretch", "back_focus", "postpartum_safe"],
    cues: [
      "Lie on back, hug both knees to chest",
      "Rock gently side-to-side to massage the lower back",
    ],
  },
  {
    id: "bird_dog",
    name: "Bird dog",
    equipment: ["yoga_mat"],
    pattern: "core",
    primaryMuscles: ["abs", "back", "glutes"],
    difficulty: 1,
    unilateral: true,
    loadType: "bodyweight",
    tags: ["postpartum_safe", "glute_activation", "back_focus"],
    cues: [
      "All fours, neutral spine — don't sag or hike the hips",
      "Extend opposite arm + leg, pause, return with control",
      "Pelvic-floor-friendly core work",
    ],
  },
  {
    id: "pelvic_tilt",
    name: "Pelvic tilt",
    equipment: ["yoga_mat"],
    pattern: "core",
    primaryMuscles: ["abs", "glutes"],
    difficulty: 1,
    unilateral: false,
    loadType: "bodyweight",
    tags: ["postpartum_safe"],
    cues: [
      "Lie on back, knees bent, feet flat",
      "Exhale and gently flatten lower back into the mat",
      "Subtle movement — connect breath with pelvic floor",
    ],
  },
  {
    id: "diaphragmatic_breathing",
    name: "Diaphragmatic breathing",
    equipment: ["yoga_mat"],
    pattern: "core",
    primaryMuscles: ["abs"],
    difficulty: 1,
    unilateral: false,
    loadType: "iso",
    tags: ["postpartum_safe"],
    cues: [
      "Lie on back, one hand on chest, one on belly",
      "Inhale into the belly, exhale fully",
      "Foundational for rebuilding deep core after pregnancy",
    ],
  },
  {
    id: "glute_bridge_march",
    name: "Glute bridge march",
    equipment: ["yoga_mat"],
    pattern: "hinge",
    primaryMuscles: ["glutes", "abs"],
    difficulty: 2,
    unilateral: true,
    loadType: "bodyweight",
    tags: ["glute_activation", "postpartum_safe"],
    cues: [
      "From a glute bridge, lift one knee toward chest without dropping the hips",
      "Alternate slowly — challenges single-leg stability",
    ],
  },
  {
    id: "clamshell",
    name: "Clamshell",
    equipment: ["yoga_mat"],
    pattern: "hinge",
    primaryMuscles: ["glutes"],
    difficulty: 1,
    unilateral: true,
    loadType: "bodyweight",
    tags: ["glute_activation", "postpartum_safe", "hip_focus"],
    cues: [
      "Side-lying, knees bent and stacked",
      "Lift top knee while keeping feet together — don't roll the hip back",
      "Targets the lateral glutes",
    ],
  },
  {
    id: "couch_stretch",
    name: "Couch stretch",
    equipment: ["yoga_mat"],
    pattern: "mobility",
    primaryMuscles: ["hip_flexors", "quads"],
    difficulty: 2,
    unilateral: true,
    loadType: "iso",
    tags: ["stretch", "hip_focus"],
    cues: [
      "Back foot up on a couch or bench, front foot flat",
      "Tuck the pelvis and squeeze the rear glute",
      "Hits the hip flexors and quads aggressively",
    ],
  },
];

// Quick lookup
export const EXERCISE_BY_ID = Object.fromEntries(
  EXERCISES.map((e) => [e.id, e])
) as Record<string, Exercise>;
