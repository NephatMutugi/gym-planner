import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SessionRow = {
  id: string;
  startedAt: Date;
  completedAt: Date | null;
  notes: string | null;
  programDay: { label: string } | null;
  _count: { sets: number };
};

export default async function HistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const sessions = await prisma.workoutSession.findMany({
    where: { userId: session.user.id },
    orderBy: [{ startedAt: "desc" }],
    take: 100,
    include: {
      programDay: { select: { label: true } },
      _count: { select: { sets: true } },
    },
  });

  const completed = sessions.filter((s: SessionRow) => s.completedAt);
  const inProgress = sessions.filter((s: SessionRow) => !s.completedAt);

  return (
    <main className="mx-auto max-w-md min-h-[100dvh] flex flex-col p-6 gap-5">
      <header className="pt-2">
        <Link href="/dashboard" className="text-sm text-[var(--fg-muted)]">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold mt-1">History</h1>
        <p className="text-sm text-[var(--fg-muted)] mt-1">
          {completed.length} completed · {inProgress.length} in progress
        </p>
      </header>

      {sessions.length === 0 && (
        <div className="card">
          <p className="text-sm text-[var(--fg-muted)]">
            No workouts logged yet. Start a session from{" "}
            <Link href="/workout" className="underline">
              Workout
            </Link>{" "}
            to see your history here.
          </p>
        </div>
      )}

      {inProgress.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-2 px-1">
            In progress
          </h2>
          <ul className="flex flex-col gap-2">
            {inProgress.map((s: SessionRow) => (
              <li key={s.id}>
                <Link
                  href={`/workout/session/${s.id}`}
                  className="card flex items-center justify-between gap-3 cursor-pointer hover:border-[var(--accent)] transition-colors"
                >
                  <div>
                    <p className="font-semibold">{s.programDay?.label ?? "Workout"}</p>
                    <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                      Started {formatDate(s.startedAt)} · {s._count.sets} sets
                    </p>
                  </div>
                  <span className="text-[var(--accent)] text-xl leading-none">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-2 px-1">
            Completed
          </h2>
          <ul className="flex flex-col gap-2">
            {completed.map((s: SessionRow) => (
              <li key={s.id}>
                <Link
                  href={`/history/${s.id}`}
                  className="card flex items-center justify-between gap-3 cursor-pointer hover:border-[var(--accent)] transition-colors"
                >
                  <div>
                    <p className="font-semibold">{s.programDay?.label ?? "Workout"}</p>
                    <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                      {formatDate(s.completedAt!)} · {s._count.sets} sets
                    </p>
                  </div>
                  <span className="text-[var(--fg-muted)] text-xl leading-none">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function formatDate(d: Date): string {
  const date = new Date(d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
