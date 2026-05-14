import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { consume, COACH_LIMIT } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { complete, isClaudeConfigured, extractJson } from "@/lib/claude";
import { inventoryFromDb, availableExercises } from "@/lib/equipment";
import { EXERCISE_BY_ID, MUSCLE_LABELS, PATTERN_LABELS } from "@/data/exercises";

const Schema = z.object({
  exerciseId: z.string(),
  reason: z.string().max(300),
});

type EquipmentRow = {
  type: string;
  weightsKg: string | null;
  label: string | null;
};

const SYSTEM = `You are a thoughtful, evidence-informed strength coach.
A user wants to swap an exercise mid-workout. They will tell you why.
Pick exactly one alternative from the candidate list. Match the movement pattern as closely as possible and respect any injury/postpartum context.
Respond as JSON only, with this shape:
{
  "exerciseId": "candidate_id_from_the_list",
  "reasoning": "one or two sentences explaining the choice and any cues to consider"
}
Do not include any other text.`;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = consume(`coach:${session.user.id}`, COACH_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: `Slow down — try again in ${rl.retryAfterSec}s`,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  if (!isClaudeConfigured()) {
    return NextResponse.json(
      { error: "Claude is not configured. Add ANTHROPIC_API_KEY to .env." },
      { status: 503 }
    );
  }

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const original = EXERCISE_BY_ID[parsed.data.exerciseId];
  if (!original) {
    return NextResponse.json({ error: "Unknown exercise" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      experience: true,
      goals: true,
      postpartumWeeks: true,
      injuries: true,
      householdId: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const equipmentRows = await prisma.equipment.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        user.householdId ? { householdId: user.householdId } : { id: "__never__" },
      ],
    },
    select: { type: true, weightsKg: true, label: true },
  });
  const inventory = inventoryFromDb(equipmentRows as EquipmentRow[]);

  const goals: string[] = user.goals ? JSON.parse(user.goals) : [];
  const injuries: string[] = user.injuries ? JSON.parse(user.injuries) : [];

  // Candidates: same pattern OR closely-related patterns; not the original
  const sameOrClosePattern = (p: string): boolean => {
    if (p === original.pattern) return true;
    // Allow horizontal_push <-> vertical_push, etc., as fallbacks
    if (original.pattern.includes("push") && p.includes("push")) return true;
    if (original.pattern.includes("pull") && p.includes("pull")) return true;
    if (original.pattern === "core" && p === "rotation") return true;
    if (original.pattern === "rotation" && p === "core") return true;
    return false;
  };

  const candidates = availableExercises(inventory).filter(
    (ex) => ex.id !== original.id && sameOrClosePattern(ex.pattern)
  );

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "No swap options available with your current equipment" },
      { status: 422 }
    );
  }

  const userPrompt = [
    `Original exercise being swapped: ${original.name} (${original.id})`,
    `Pattern: ${PATTERN_LABELS[original.pattern]}`,
    `Primary muscles: ${original.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(", ")}`,
    "",
    `Reason for swap: ${parsed.data.reason}`,
    "",
    "User profile:",
    `- Experience: ${user.experience ?? "unknown"}`,
    `- Goals: ${goals.join(", ") || "general fitness"}`,
    user.postpartumWeeks != null
      ? `- Postpartum: ${user.postpartumWeeks} weeks since giving birth`
      : "- Postpartum: N/A",
    `- Injuries / things to avoid: ${injuries.join(", ") || "none reported"}`,
    "",
    "Candidate exercises (pick one):",
    ...candidates.map((c) => {
      const tags = c.tags ? ` [${c.tags.join(", ")}]` : "";
      const muscles = c.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(", ");
      return `- ${c.id}: ${c.name} — ${PATTERN_LABELS[c.pattern]}; muscles: ${muscles}; difficulty ${c.difficulty}${tags}`;
    }),
  ].join("\n");

  try {
    const text = await complete({
      system: SYSTEM,
      user: userPrompt,
      model: "sonnet",
      maxTokens: 400,
    });
    const json = extractJson<{ exerciseId: string; reasoning: string }>(text);
    if (!json || !json.exerciseId) {
      return NextResponse.json(
        { error: "Claude response could not be parsed", raw: text },
        { status: 500 }
      );
    }
    // Validate it picked a real candidate
    const picked = candidates.find((c) => c.id === json.exerciseId);
    if (!picked) {
      return NextResponse.json(
        { error: "Claude suggested an invalid exercise", raw: text },
        { status: 500 }
      );
    }
    return NextResponse.json({
      suggestion: {
        exerciseId: picked.id,
        name: picked.name,
        pattern: picked.pattern,
        primaryMuscles: picked.primaryMuscles,
        equipment: picked.equipment,
        cues: picked.cues,
        difficulty: picked.difficulty,
        reasoning: json.reasoning,
      },
    });
  } catch (err) {
    console.error("swap error", err);
    return NextResponse.json({ error: "Claude request failed" }, { status: 500 });
  }
}
