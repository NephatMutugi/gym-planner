import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { complete, isClaudeConfigured } from "@/lib/claude";
import { EXERCISE_BY_ID } from "@/data/exercises";

const SYSTEM = `You are a supportive, candid strength coach checking in with someone training at home.
Read the stats from their last two weeks of workouts and respond with:
- A one-sentence overall: what's going well or not
- 2-3 specific observations grounded in the data (name exercises, weights, rep ranges, completion rate)
- 1-2 concrete, kind suggestions for next week

Tone: warm, direct, no fluff. No emojis. Under 200 words. Address them by name.`;

type SetRow = {
  exerciseId: string;
  weightKg: number | null;
  reps: number | null;
  holdSeconds: number | null;
  skipped: boolean;
};

type SessionRow = {
  id: string;
  startedAt: Date;
  completedAt: Date | null;
  notes: string | null;
  programDay: { label: string } | null;
  sets: SetRow[];
};

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isClaudeConfigured()) {
    return NextResponse.json(
      { error: "Claude is not configured. Add ANTHROPIC_API_KEY to .env." },
      { status: 503 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      experience: true,
      goals: true,
      postpartumWeeks: true,
      injuries: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const since = new Date();
  since.setDate(since.getDate() - 14);

  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId: session.user.id,
      completedAt: { not: null, gte: since },
    },
    orderBy: { completedAt: "desc" },
    include: { sets: true, programDay: { select: { label: true } } },
  });

  if (sessions.length === 0) {
    return NextResponse.json({
      text: "You haven't completed any workouts in the last two weeks yet. Start a session from the Workout tab and we'll have something to talk about next week.",
    });
  }

  // Stats per exercise
  type Stat = {
    name: string;
    sessions: number;
    totalSets: number;
    skipped: number;
    bestWeight: number | null;
    bestReps: number | null;
    bestHold: number | null;
  };
  const statsById = new Map<string, Stat>();
  for (const s of sessions as SessionRow[]) {
    const exercisesThisSession = new Set<string>();
    for (const set of s.sets) {
      exercisesThisSession.add(set.exerciseId);
      const ex = EXERCISE_BY_ID[set.exerciseId];
      const name = ex?.name ?? set.exerciseId;
      const stat: Stat =
        statsById.get(set.exerciseId) ?? {
          name,
          sessions: 0,
          totalSets: 0,
          skipped: 0,
          bestWeight: null,
          bestReps: null,
          bestHold: null,
        };
      stat.totalSets += 1;
      if (set.skipped) stat.skipped += 1;
      if (set.weightKg != null && (stat.bestWeight == null || set.weightKg > stat.bestWeight)) {
        stat.bestWeight = set.weightKg;
      }
      if (set.reps != null && (stat.bestReps == null || set.reps > stat.bestReps)) {
        stat.bestReps = set.reps;
      }
      if (set.holdSeconds != null && (stat.bestHold == null || set.holdSeconds > stat.bestHold)) {
        stat.bestHold = set.holdSeconds;
      }
      statsById.set(set.exerciseId, stat);
    }
    for (const id of Array.from(exercisesThisSession)) {
      const stat = statsById.get(id)!;
      stat.sessions += 1;
    }
  }

  const completedDays = sessions.length;
  const allNotes = (sessions as SessionRow[])
    .map((s) => s.notes)
    .filter((n): n is string => !!n);

  const goals: string[] = user.goals ? JSON.parse(user.goals) : [];
  const injuries: string[] = user.injuries ? JSON.parse(user.injuries) : [];

  const statLines = Array.from(statsById.values())
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 12)
    .map((st) => {
      const bits: string[] = [];
      if (st.bestWeight != null) bits.push(`top weight ${st.bestWeight}kg`);
      if (st.bestReps != null) bits.push(`top reps ${st.bestReps}`);
      if (st.bestHold != null) bits.push(`top hold ${st.bestHold}s`);
      if (st.skipped > 0) bits.push(`${st.skipped} skipped sets`);
      return `- ${st.name}: ${st.sessions} session(s), ${st.totalSets} sets — ${bits.join(", ") || "logged"}`;
    });

  const userPrompt = [
    `Name: ${user.name ?? "there"}`,
    `Experience: ${user.experience ?? "unknown"}`,
    `Goals: ${goals.join(", ") || "general fitness"}`,
    user.postpartumWeeks != null
      ? `Postpartum: ${user.postpartumWeeks} weeks since giving birth`
      : "",
    injuries.length > 0 ? `Things to avoid: ${injuries.join(", ")}` : "",
    "",
    `Last 14 days: ${completedDays} completed workout(s).`,
    "Per-exercise summary:",
    ...statLines,
    "",
    allNotes.length > 0 ? "Recent session notes:" : "",
    ...allNotes.slice(0, 5).map((n) => `- ${n}`),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const text = await complete({
      system: SYSTEM,
      user: userPrompt,
      model: "sonnet",
      maxTokens: 500,
    });
    return NextResponse.json({ text });
  } catch (err) {
    console.error("weekly checkin error", err);
    return NextResponse.json({ error: "Claude request failed" }, { status: 500 });
  }
}
