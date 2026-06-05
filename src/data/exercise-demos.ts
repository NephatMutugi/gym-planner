// Form-demo metadata for each library exercise.
//
// Two-image static demos (start position + end position) come from the
// yuhonas/free-exercise-db public-domain dataset:
//   https://github.com/yuhonas/free-exercise-db
// License: Unlicense (public domain). No attribution required.
//
// The actual JPEGs are committed to /public/exercise-demos/<our_id>/
// (start.jpg + end.jpg). To re-fetch them after adding new entries to
// SOURCES below, run:
//
//   npx tsx scripts/download-demos.ts
//
// Optional curated YouTube videos supplement the headline lifts where the
// transition between start and end matters more than two photos can convey
// (hinges, swings, jumps, presses). These are user-curated TODOs — drop in
// whichever coach's video you trust.
//
// Exercises without an upstream match (mostly mobility/stretch moves and a
// few postpartum-specific ones the upstream doesn't cover) are omitted; the
// UI gracefully hides the demo affordance when no entry exists.

// Self-hosted base. /public/exercise-demos/* is served by Vercel's Edge as
// static files, cached aggressively, and works offline once the service
// worker has seen them. To revert to GitHub raw URLs, change this to:
//   "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises"
// and update the path scheme in the helper below.
const DEMO_IMAGE_BASE = "/exercise-demos";

// Our exercise.id → the matching exercise name in yuhonas/free-exercise-db.
// Names are verified against the upstream by the download script — if a name
// is wrong, the script logs the 404 so you know which entry to fix here.
// Entries with comments are "closest pattern" matches (different equipment
// or slight variant) rather than exact matches.
const SOURCES: Record<string, string> = {
  // --- Horizontal push ---
  pushup: "Pushups",
  incline_pushup: "Incline_Push-Up",
  decline_pushup: "Decline_Push-Up",
  db_bench_press: "Dumbbell_Bench_Press",
  db_floor_press: "Dumbbell_Floor_Press",
  db_incline_bench_press: "Incline_Dumbbell_Press",
  kb_floor_press: "Dumbbell_Floor_Press", // upstream has no KB variant
  // --- Vertical push ---
  // (pike_pushup omitted — upstream has no pike variant; closest matches were
  // unrelated pushup angles)
  db_overhead_press: "Standing_Dumbbell_Press",
  db_seated_press: "Seated_Dumbbell_Press",
  kb_strict_press: "Standing_Dumbbell_Press", // closest analog
  kb_push_press: "Push_Press",
  db_lateral_raise: "Side_Lateral_Raise",
  // --- Horizontal pull ---
  db_row: "Bent_Over_Two-Dumbbell_Row",
  db_bench_supported_row: "One-Arm_Dumbbell_Row",
  kb_row: "Bent_Over_Two-Dumbbell_Row", // closest analog
  renegade_row: "Alternating_Renegade_Row", // upstream uses "Alternating" prefix
  inverted_row: "Inverted_Row",
  // --- Vertical pull ---
  pullup: "Pullups",
  chinup: "Chin-Up",
  // (band_pulldown, band_row, db_pullover removed — upstream has no clean match)
  // --- Squat ---
  bodyweight_squat: "Bodyweight_Squat",
  goblet_squat: "Goblet_Squat",
  kb_goblet_squat: "Goblet_Squat",
  db_front_squat: "Dumbbell_Squat",
  kb_double_front_squat: "Goblet_Squat", // closest analog
  // (bulgarian_split_squat omitted — upstream has no Bulgarian variant;
  // suggested matches were unrelated split squats)
  // --- Hinge ---
  // Upstream doesn't distinguish RDL from stiff-leg DL; same hinge pattern.
  db_rdl: "Stiff-Legged_Dumbbell_Deadlift",
  single_leg_db_rdl: "Stiff-Legged_Dumbbell_Deadlift",
  kb_deadlift: "Stiff-Legged_Dumbbell_Deadlift",
  good_morning: "Good_Morning",
  hip_thrust: "Barbell_Hip_Thrust",
  // (kb_swing, glute_bridge removed — no clean upstream match)
  // --- Lunge ---
  db_reverse_lunge: "Dumbbell_Rear_Lunge", // upstream uses "Rear" not "Reverse"
  db_walking_lunge: "Dumbbell_Lunges",
  step_up: "Dumbbell_Step_Ups",
  db_step_up: "Dumbbell_Step_Ups",
  // (reverse_lunge bodyweight, split_squat, db_split_squat — no clean upstream
  // bodyweight match; lunge demo on hand is dumbbell-based which doesn't fit
  // a bodyweight lunge well. Leaving unmapped to avoid misleading visuals.)
  // --- Carry ---
  farmer_carry_db: "Farmers_Walk",
  farmer_carry_kb: "Farmers_Walk",
  suitcase_carry: "Farmers_Walk", // unilateral variant; same pattern
  // (kb_overhead_carry — no clean match)
  // --- Core ---
  plank: "Plank",
  side_plank: "Side_Bridge",
  kb_russian_twist: "Russian_Twist",
  pallof_press: "Pallof_Press",
  // (dead_bug, hollow_hold — no clean upstream match)
  // --- Isolation (arms) ---
  db_curl: "Dumbbell_Bicep_Curl",
  db_hammer_curl: "Hammer_Curls",
  db_skullcrusher: "Lying_Dumbbell_Tricep_Extension", // singular "Tricep" + reversed word order
  db_overhead_tricep_extension: "Seated_Triceps_Press",
  db_tricep_kickback: "Tricep_Dumbbell_Kickback",
  // --- Calves ---
  db_calf_raise: "Standing_Dumbbell_Calf_Raise",
  // --- Traps / rear delts ---
  db_shrug: "Dumbbell_Shrug",
  band_pull_apart: "Band_Pull_Apart",
  db_rear_delt_raise: "Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench",
  // --- Core (advanced) ---
  hanging_leg_raise: "Hanging_Leg_Raise",
  // --- Conditioning / full-body ---
  kb_clean_and_press: "Two-Arm_Kettlebell_Clean", // press portion is similar
  mountain_climber: "Mountain_Climbers",
  // (burpee and jumping_jacks omitted — genuine catalog gaps. The cardio
  // section of the upstream dataset is thin. These exercises have video
  // TODOs in VIDEOS below instead, which suit cardio movement anyway.)
  // --- Stretches / mobility / postpartum-specific ---
  // The upstream dataset is heavily strength-focused and lacks reliable
  // demos for most yoga / mobility / postpartum moves (cat_cow,
  // childs_pose, pigeon_pose, pelvic_tilt, diaphragmatic_breathing,
  // glute_bridge_march, clamshell, couch_stretch, bird_dog,
  // thread_the_needle, world_greatest_stretch, etc.). These intentionally
  // have no mapping — the UI hides the demo button rather than showing
  // a misleading photo.
};

// Curated YouTube videos for headline lifts. Replace the TODO strings with
// the URL of a coach you trust. The UI hides the video section when the
// value is still a TODO_ placeholder.
const VIDEOS: Record<string, string> = {
  goblet_squat: "TODO_VIDEO_URL",
  db_rdl: "TODO_VIDEO_URL",
  kb_swing: "TODO_VIDEO_URL",
  pullup: "TODO_VIDEO_URL",
  pushup: "TODO_VIDEO_URL",
  db_bench_press: "TODO_VIDEO_URL",
  db_overhead_press: "TODO_VIDEO_URL",
  kb_clean_and_press: "TODO_VIDEO_URL",
  hip_thrust: "TODO_VIDEO_URL",
  plank: "TODO_VIDEO_URL",
  // Cardio / calisthenics moves not in the upstream image catalog. Video
  // demos are actually a better fit for these than two photos anyway —
  // drop in a coach's YouTube URL when you find one you like.
  burpee: "TODO_VIDEO_URL",
  jumping_jacks: "TODO_VIDEO_URL",
  pike_pushup: "TODO_VIDEO_URL",
  bulgarian_split_squat: "TODO_VIDEO_URL",
};

export interface ExerciseDemo {
  images?: { start: string; end: string };
  videoUrl?: string;
}

// Returns demo media for an exercise, or null if no demo exists. Both fields
// in the returned object are individually optional — an exercise may have
// only images, only a video, or both.
export function getExerciseDemo(exerciseId: string): ExerciseDemo | null {
  const source = SOURCES[exerciseId];
  const videoRaw = VIDEOS[exerciseId];
  const hasVideo = videoRaw && videoRaw !== "TODO_VIDEO_URL";
  if (!source && !hasVideo) return null;

  const demo: ExerciseDemo = {};
  if (source) {
    // Self-hosted path scheme: /exercise-demos/<our_id>/{start,end}.jpg
    // Files are produced by scripts/download-demos.ts.
    const base = `${DEMO_IMAGE_BASE}/${exerciseId}`;
    demo.images = { start: `${base}/start.jpg`, end: `${base}/end.jpg` };
  }
  if (hasVideo) {
    demo.videoUrl = videoRaw;
  }
  return demo;
}

export function hasExerciseDemo(exerciseId: string): boolean {
  return getExerciseDemo(exerciseId) !== null;
}

// Exported so the download script can iterate every mapped exercise and fetch
// its upstream images without having to re-derive the dictionary.
export const EXERCISE_DEMO_SOURCES: Readonly<Record<string, string>> = SOURCES;

// Upstream URL builder for the download script. Kept here so source-of-truth
// for the upstream URL pattern lives in exactly one file.
export const UPSTREAM_IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

export function upstreamImageUrls(
  upstreamName: string
): { start: string; end: string } {
  const base = `${UPSTREAM_IMAGE_BASE}/${upstreamName}`;
  return { start: `${base}/0.jpg`, end: `${base}/1.jpg` };
}
