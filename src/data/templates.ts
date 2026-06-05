// Split templates: blueprints for weekly programs.
// Each template defines an ordered list of days, and each day defines
// ordered "slots" — movement patterns the generator must fill from the
// available exercise library.

import type { Pattern } from "@/data/exercises";

export type SlotIntensity = "main" | "accessory" | "finisher";

export interface Slot {
  // One slot can accept any of these patterns; first match wins.
  patterns: Pattern[];
  intensity: SlotIntensity;
  // Optional bias: prefer compound moves, isolation moves, etc.
  prefer?: "compound" | "isolation";
}

export interface TemplateDay {
  label: string;
  slots: Slot[];
}

export interface SplitTemplate {
  id: string;
  name: string;
  daysPerWeek: number;
  days: TemplateDay[];
}

// Slot builders for reuse

const SQUAT: Slot = { patterns: ["squat"], intensity: "main", prefer: "compound" };
const HINGE: Slot = { patterns: ["hinge"], intensity: "main", prefer: "compound" };
const H_PUSH: Slot = {
  patterns: ["horizontal_push"],
  intensity: "main",
  prefer: "compound",
};
const V_PUSH: Slot = {
  patterns: ["vertical_push"],
  intensity: "main",
  prefer: "compound",
};
const H_PULL: Slot = {
  patterns: ["horizontal_pull"],
  intensity: "main",
  prefer: "compound",
};
const V_PULL: Slot = {
  patterns: ["vertical_pull"],
  intensity: "main",
  prefer: "compound",
};
const LUNGE: Slot = { patterns: ["lunge"], intensity: "accessory" };
const CORE: Slot = { patterns: ["core"], intensity: "accessory" };
const ROTATION_CORE: Slot = {
  patterns: ["rotation", "core"],
  intensity: "accessory",
};
const CARRY: Slot = { patterns: ["carry"], intensity: "finisher" };
const CONDITIONING: Slot = {
  patterns: ["conditioning"],
  intensity: "finisher",
};
const ANY_PULL: Slot = {
  patterns: ["horizontal_pull", "vertical_pull"],
  intensity: "accessory",
};
const ANY_PUSH: Slot = {
  patterns: ["horizontal_push", "vertical_push"],
  intensity: "accessory",
};
const MOBILITY: Slot = {
  patterns: ["mobility"],
  intensity: "finisher",
};
// Direct calf work as a session finisher. Appended after compound slots so
// it only fills on longer sessions (the exercise budget trims late slots
// first when time is tight).
const CALF: Slot = {
  patterns: ["calf"],
  intensity: "finisher",
};
// Isolation-biased horizontal pull — picks shrugs / rear-delt raises /
// band pull-aparts over rows once the main row slot is already filled.
// The `used` set in the picker prevents re-selecting the row that won the
// main slot, and `prefer: "isolation"` further nudges the picker toward
// shrug + rear-delt-raise + band-pull-apart over any other compound row.
const ISO_PULL: Slot = {
  patterns: ["horizontal_pull"],
  intensity: "accessory",
  prefer: "isolation",
};

// --- Full body templates ---

const FULL_BODY_A: TemplateDay = {
  label: "Full body A",
  slots: [
    SQUAT,
    H_PUSH,
    H_PULL,
    HINGE,
    CORE,
    V_PUSH,
    CALF,
    CARRY,
    CONDITIONING,
  ],
};

const FULL_BODY_B: TemplateDay = {
  label: "Full body B",
  slots: [
    HINGE,
    V_PUSH,
    V_PULL,
    LUNGE,
    ROTATION_CORE,
    H_PUSH,
    CALF,
    CARRY,
    CONDITIONING,
  ],
};

const FULL_BODY_C: TemplateDay = {
  label: "Full body C",
  slots: [
    SQUAT,
    H_PULL,
    V_PUSH,
    HINGE,
    CORE,
    H_PUSH,
    ISO_PULL,
    CALF,
    CONDITIONING,
  ],
};

// --- Upper / Lower templates ---

const UPPER_A: TemplateDay = {
  label: "Upper A",
  slots: [
    H_PUSH,
    H_PULL,
    V_PUSH,
    V_PULL,
    ANY_PUSH,
    ANY_PULL,
    ISO_PULL,
    CORE,
  ],
};

const UPPER_B: TemplateDay = {
  label: "Upper B",
  slots: [
    V_PUSH,
    V_PULL,
    H_PUSH,
    H_PULL,
    ANY_PUSH,
    ISO_PULL,
    ROTATION_CORE,
  ],
};

const LOWER_A: TemplateDay = {
  label: "Lower A",
  slots: [
    SQUAT,
    HINGE,
    LUNGE,
    CORE,
    CALF,
    CARRY,
    CONDITIONING,
  ],
};

const LOWER_B: TemplateDay = {
  label: "Lower B",
  slots: [
    HINGE,
    SQUAT,
    LUNGE,
    ROTATION_CORE,
    CALF,
    CARRY,
  ],
};

// --- Push / Pull / Legs ---

const PUSH_DAY: TemplateDay = {
  label: "Push",
  slots: [
    H_PUSH,
    V_PUSH,
    H_PUSH,
    V_PUSH,
    CORE,
  ],
};

const PULL_DAY: TemplateDay = {
  label: "Pull",
  slots: [
    H_PULL,
    V_PULL,
    H_PULL,
    V_PULL,
    ISO_PULL,
    CORE,
  ],
};

const LEGS_DAY: TemplateDay = {
  label: "Legs",
  slots: [
    SQUAT,
    HINGE,
    LUNGE,
    CALF,
    CORE,
    CARRY,
  ],
};

// --- Mobility / recovery day ---

const MOBILITY_DAY: TemplateDay = {
  label: "Mobility / Recovery",
  slots: [MOBILITY, CORE, CARRY, MOBILITY],
};

// --- Templates by days/week ---

export const TEMPLATES: SplitTemplate[] = [
  {
    id: "full_body_1x",
    name: "Full body × 1",
    daysPerWeek: 1,
    days: [FULL_BODY_A],
  },
  {
    id: "full_body_2x",
    name: "Full body × 2",
    daysPerWeek: 2,
    days: [FULL_BODY_A, FULL_BODY_B],
  },
  {
    id: "full_body_3x",
    name: "Full body × 3",
    daysPerWeek: 3,
    days: [FULL_BODY_A, FULL_BODY_B, FULL_BODY_C],
  },
  {
    id: "upper_lower_4x",
    name: "Upper / Lower × 2",
    daysPerWeek: 4,
    days: [UPPER_A, LOWER_A, UPPER_B, LOWER_B],
  },
  {
    id: "upper_lower_5x",
    name: "Upper / Lower + Full body",
    daysPerWeek: 5,
    days: [UPPER_A, LOWER_A, UPPER_B, LOWER_B, FULL_BODY_A],
  },
  {
    id: "ppl_6x",
    name: "Push / Pull / Legs × 2",
    daysPerWeek: 6,
    days: [PUSH_DAY, PULL_DAY, LEGS_DAY, PUSH_DAY, PULL_DAY, LEGS_DAY],
  },
  {
    id: "ppl_7x",
    name: "Push / Pull / Legs + Mobility",
    daysPerWeek: 7,
    days: [
      PUSH_DAY,
      PULL_DAY,
      LEGS_DAY,
      PUSH_DAY,
      PULL_DAY,
      LEGS_DAY,
      MOBILITY_DAY,
    ],
  },
];

export function templateForDays(daysPerWeek: number): SplitTemplate {
  // Find exact match, otherwise nearest
  const exact = TEMPLATES.find((t) => t.daysPerWeek === daysPerWeek);
  if (exact) return exact;
  // Pick closest by days
  let best = TEMPLATES[0];
  let bestDelta = Math.abs(best.daysPerWeek - daysPerWeek);
  for (const t of TEMPLATES) {
    const d = Math.abs(t.daysPerWeek - daysPerWeek);
    if (d < bestDelta) {
      best = t;
      bestDelta = d;
    }
  }
  return best;
}
