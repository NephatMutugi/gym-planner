import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EXERCISE_BY_ID } from "@/data/exercises";

type SetRow = {
  id: string;
  exerciseId: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  holdSeconds: number | null;
  rpe: number | null;
  skipped: boolean;
};

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const ws = await prisma.workoutSession.findUnique({
    where: { id },
    include: {
      programDay: { select: { label: true } },
      sets: { orderBy: [{ exerciseId: "asc" }, { setNumber: "asc" }] },
    },
  });
  if (!ws || ws.userId !== session.user.id) redirect("/history");

  // Group sets by exercise
  const byExercise = new Map<string, SetRow[]>();
  for (const s of ws.sets as SetRow[]) {
    const arr = byExercise.get(s.exerciseId) ?? [];
    arr.push(s);
    byExercise.set(s.exerciseId, arr);
  }

  return (
    <main className="mx-auto max-w-md min-h-[100dvh] flex flex-col p-6 gap-5">
      <header className="pt-2">
        <Link href="/history" className="text-sm text-[var(--fg-muted)]">
          ← History
        </Link>
        <h1 className="text-2xl font-bold mt-1">{ws.programDay?.label ?? "Workout"}</h1>
        <p className="text-sm text-[var(--fg-muted)] mt-1">
          {ws.completedAt
            ? `Completed ${formatDateTime(ws.completedAt)}`
            : `Started ${formatDateTime(ws.startedAt)}`}
        </p>
      </header>

      {byExercise.size === 0 ? (
        <div className="card">
          <p className="text-sm text-[var(--fg-muted)]">
            No sets were logged in this session.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {Array.from(byExercise.entries()).map(([exerciseId, sets]) => {
            const ex = EXERCISE_BY_ID[exerciseId];
            return (
              <li key={exerciseId} className="card">
                <p className="font-semibold">{ex?.name ?? exerciseId}</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {sets.map((s) => (
                    <li
                      key={s.id}
                      className={
                        "flex items-center justify-between text-sm py-1.5 px-2 rounded-lg " +
                        (s.skipped ? "opacity-50" : "")
                      }
                    >
                      <span className="font-mono text-[var(--fg-muted)] w-6">
                        {s.setNumber}
                      </span>
                      <span className="font-mono">
                        {s.skipped
                          ? "skipped"
                          : s.holdSeconds != null
                            ? `${s.holdSeconds}s`
                            : `${s.weightKg != null ? `${s.weightKg}kg × ` : ""}${
                                s.reps ?? 0
                              } reps`}
                      </span>
                      {s.rpe != null && (
                        <span className="text-xs text-[var(--fg-muted)]">
                          RPE {s.rpe}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}

      {ws.notes && (
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-2">
            Notes
          </p>
          <p className="text-sm">{ws.notes}</p>
        </div>
      )}
    </main>
  );
}

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
