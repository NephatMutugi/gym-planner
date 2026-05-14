import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { consume, COACH_LIMIT } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { complete, isClaudeConfigured } from "@/lib/claude";
import { EXERCISE_BY_ID, MUSCLE_LABELS } from "@/data/exercises";

const Schema = z.object({
  exerciseId: z.string(),
  question: z.string().max(200).optional(),
});

const SYSTEM = `You are a thoughtful, evidence-informed strength coach.
You answer brief, practical questions about specific exercises for a user training at home.
You match advice to the user's profile (goals, experience, postpartum status, injuries).
Be concrete: name muscles, give cues, and call out the two most common form mistakes.
Keep responses under 180 words. No emojis. No medical advice — when injuries or postpartum status come up, suggest consulting a healthcare provider but don't lecture.`;

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

  const exercise = EXERCISE_BY_ID[parsed.data.exerciseId];
  if (!exercise) {
    return NextResponse.json({ error: "Unknown exercise" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      experience: true,
      goals: true,
      postpartumWeeks: true,
      injuries: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const goals: string[] = user.goals ? JSON.parse(user.goals) : [];
  const injuries: string[] = user.injuries ? JSON.parse(user.injuries) : [];

  const userPrompt = [
    `Exercise: ${exercise.name}`,
    `Movement pattern: ${exercise.pattern}`,
    `Primary muscles: ${exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(", ")}`,
    `Equipment required: ${exercise.equipment.length === 0 ? "Bodyweight" : exercise.equipment.join(", ")}`,
    `Existing form cues: ${exercise.cues.join(" | ")}`,
    "",
    "User profile:",
    `- Experience: ${user.experience ?? "unknown"}`,
    `- Goals: ${goals.join(", ") || "general fitness"}`,
    user.postpartumWeeks != null
      ? `- Postpartum: ${user.postpartumWeeks} weeks since giving birth`
      : "- Postpartum: N/A",
    `- Injuries / things to avoid: ${injuries.join(", ") || "none reported"}`,
    "",
    parsed.data.question
      ? `Specific question: ${parsed.data.question}`
      : "Explain why this exercise fits their plan, and the 2–3 most important form points for *this user* specifically.",
  ].join("\n");

  try {
    const text = await complete({
      system: SYSTEM,
      user: userPrompt,
      model: "haiku",
      maxTokens: 500,
    });
    return NextResponse.json({ text });
  } catch (err) {
    console.error("explain error", err);
    return NextResponse.json({ error: "Claude request failed" }, { status: 500 });
  }
}
