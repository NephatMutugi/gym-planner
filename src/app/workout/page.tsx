import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import WorkoutClient from "./WorkoutClient";


type ProgramDayRow = {
  id: string;
  order: number;
  label: string;
  isRestDay: boolean;
  items: ProgramItemRow[];
};
type ProgramItemRow = {
  id: string;
  order: number;
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  targetLoadKg: number | null;
  holdSeconds: number | null;
  restSeconds: number;
  notes: string | null;
};

export default async function WorkoutPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboarded: true, trainingContext: true },
  });
  if (!user) redirect("/login");
  if (!user.onboarded) redirect("/onboarding");

  const program = await prisma.program.findFirst({
    where: { userId: session.user.id, isActive: true },
    orderBy: { generatedAt: "desc" },
    include: {
      days: {
        orderBy: { order: "asc" },
        include: { items: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!program) {
    return (
      <main className="mx-auto w-full max-w-md md:max-w-4xl min-h-[100dvh] flex flex-col p-6 md:px-10 md:py-10 gap-5">
        <header className="pt-2">
          <Link href="/dashboard" className="text-sm text-[var(--fg-muted)]">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold mt-1">Workout</h1>
        </header>
        <div className="card">
          <h2 className="font-semibold">No program yet</h2>
          <p className="text-sm text-[var(--fg-muted)] mt-2">
            We&apos;ll generate a weekly plan based on your goals, schedule,
            and the equipment you own.
          </p>
          <WorkoutClient trainingContext={user.trainingContext ?? null} program={null} initialDayIndex={0} />
        </div>
      </main>
    );
  }

  // Find any active (incomplete) sessions for the current program's days
  const activeSessions = await prisma.workoutSession.findMany({
    where: {
      userId: session.user.id,
      completedAt: null,
      programDayId: { in: program.days.map((d: ProgramDayRow) => d.id) },
    },
    select: { id: true, programDayId: true },
  });
  const activeByDayId = new Map<string, string>();
  for (const s of activeSessions) {
    if (s.programDayId) activeByDayId.set(s.programDayId, s.id);
  }
  const activeMap = Object.fromEntries(activeByDayId);

  // Compute "today" — simple weekday rotation
  const todayIndex = todayDayIndex(program.daysPerWeek, program.days.length);

  return (
    <main className="mx-auto w-full max-w-md md:max-w-4xl min-h-[100dvh] flex flex-col p-6 md:px-10 md:py-10 gap-5">
      <header className="pt-2">
        <Link href="/dashboard" className="text-sm text-[var(--fg-muted)] md:hidden">
          ← Dashboard
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold mt-1">Workout</h1>
        <p className="text-sm text-[var(--fg-muted)] mt-1">
          {formatSplit(program.split)} · {program.daysPerWeek}×/week
        </p>
      </header>

      <WorkoutClient
        trainingContext={user.trainingContext ?? null}
        activeSessionByDayId={activeMap}
        program={{
          id: program.id,
          split: program.split,
          daysPerWeek: program.daysPerWeek,
          experience: program.experience,
          goals: JSON.parse(program.goalsSnapshot) as string[],
          days: program.days.map((d: ProgramDayRow) => ({
            id: d.id,
            order: d.order,
            label: d.label,
            isRestDay: d.isRestDay,
            items: d.items.map((it: ProgramItemRow) => ({
              order: it.order,
              exerciseId: it.exerciseId,
              sets: it.sets,
              repsMin: it.repsMin,
              repsMax: it.repsMax,
              targetLoadKg: it.targetLoadKg,
              holdSeconds: it.holdSeconds,
              restSeconds: it.restSeconds,
              notes: it.notes,
            })),
          })),
        }}
        initialDayIndex={todayIndex}
      />
    </main>
  );
}

// "full_body_3x" → "Full body 3x"
function formatSplit(raw: string): string {
  const spaced = raw.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Map current weekday to a 0-based day index within the program's rotation.
// Mon-first weekday rotation; if days < 7, evenly distribute training days.
function todayDayIndex(daysPerWeek: number, totalDays: number): number {
  const jsDay = new Date().getDay(); // 0 = Sun, 1 = Mon, ...
  const mondayFirst = (jsDay + 6) % 7; // 0 = Mon, 6 = Sun

  // Even distribution: which training day "slot" is today's weekday?
  // For 3 days: Mon=0, Wed=1, Fri=2, others map to nearest upcoming.
  if (daysPerWeek >= 7) return mondayFirst % totalDays;
  const trainingDays: number[] = [];
  // Distribute training days across 7 weekday slots
  for (let i = 0; i < daysPerWeek; i++) {
    trainingDays.push(Math.round((i * 7) / daysPerWeek));
  }
  // Find the closest upcoming training day index
  let idx = 0;
  for (let i = 0; i < trainingDays.length; i++) {
    if (trainingDays[i] <= mondayFirst) idx = i;
  }
  return Math.min(idx, totalDays - 1);
}
