import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EXERCISE_BY_ID } from "@/data/exercises";

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
  sets: SetRow[];
};

const WEEKS = 8;

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun, 1 Mon, ...
  const diff = (day + 6) % 7; // Monday-anchored
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - diff);
  return x;
}

function fmtWeekLabel(weekStart: Date): string {
  return weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function InsightsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const since = new Date();
  since.setDate(since.getDate() - 7 * WEEKS);

  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId: session.user.id,
      completedAt: { not: null, gte: since },
    },
    orderBy: { completedAt: "asc" },
    include: { sets: true },
  });

  // ---- Per-week stats ----
  const now = new Date();
  const weeks: { start: Date; sessions: number; volume: number }[] = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weeks.push({ start: startOfWeek(d), sessions: 0, volume: 0 });
  }

  for (const s of sessions as SessionRow[]) {
    if (!s.completedAt) continue;
    const wkStart = startOfWeek(s.completedAt).getTime();
    const wk = weeks.find((w) => w.start.getTime() === wkStart);
    if (!wk) continue;
    wk.sessions += 1;
    for (const set of s.sets) {
      if (set.skipped) continue;
      if (set.weightKg != null && set.reps != null) {
        wk.volume += set.weightKg * set.reps;
      }
    }
  }

  const maxSessions = Math.max(1, ...weeks.map((w) => w.sessions));
  const maxVolume = Math.max(1, ...weeks.map((w) => w.volume));

  // ---- Per-exercise progress: top weight × reps over time, last 12 weeks ----
  type ExStat = {
    name: string;
    sessions: number;
    bestWeight: number | null;
    bestReps: number | null;
    bestHold: number | null;
    series: { date: Date; weight: number | null; reps: number | null }[];
  };
  const byExercise = new Map<string, ExStat>();
  for (const s of sessions as SessionRow[]) {
    if (!s.completedAt) continue;
    const dateKey = s.completedAt;
    const seen = new Set<string>();
    for (const set of s.sets) {
      if (set.skipped) continue;
      const ex = EXERCISE_BY_ID[set.exerciseId];
      const name = ex?.name ?? set.exerciseId;
      const stat: ExStat =
        byExercise.get(set.exerciseId) ?? {
          name,
          sessions: 0,
          bestWeight: null,
          bestReps: null,
          bestHold: null,
          series: [],
        };
      if (!seen.has(set.exerciseId)) {
        stat.sessions += 1;
        seen.add(set.exerciseId);
        stat.series.push({
          date: dateKey,
          weight: set.weightKg,
          reps: set.reps,
        });
      }
      if (set.weightKg != null && (stat.bestWeight == null || set.weightKg > stat.bestWeight)) {
        stat.bestWeight = set.weightKg;
      }
      if (set.reps != null && (stat.bestReps == null || set.reps > stat.bestReps)) {
        stat.bestReps = set.reps;
      }
      if (set.holdSeconds != null && (stat.bestHold == null || set.holdSeconds > stat.bestHold)) {
        stat.bestHold = set.holdSeconds;
      }
      byExercise.set(set.exerciseId, stat);
    }
  }

  const exerciseList = Array.from(byExercise.entries())
    .map(([id, st]) => ({ id, ...st }))
    .sort((a, b) => b.sessions - a.sessions);

  const totalSessions = sessions.length;
  const totalVolume = weeks.reduce((sum, w) => sum + w.volume, 0);

  return (
    <main className="mx-auto w-full max-w-md md:max-w-4xl min-h-[100dvh] flex flex-col p-6 md:px-10 md:py-10 gap-5">
      <header className="pt-2">
        <Link href="/dashboard" className="text-sm text-[var(--fg-muted)]">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold mt-1">Insights</h1>
        <p className="text-sm text-[var(--fg-muted)] mt-1">
          Last {WEEKS} weeks
        </p>
      </header>

      {totalSessions === 0 ? (
        <div className="card">
          <p className="text-sm text-[var(--fg-muted)]">
            No completed sessions in the last {WEEKS} weeks. Log a few
            workouts and your progress charts will show up here.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                Sessions
              </p>
              <p className="mt-2 text-2xl font-bold">{totalSessions}</p>
              <p className="text-xs text-[var(--fg-muted)] mt-1">completed</p>
            </div>
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                Volume
              </p>
              <p className="mt-2 text-2xl font-bold">
                {Math.round(totalVolume).toLocaleString()}
              </p>
              <p className="text-xs text-[var(--fg-muted)] mt-1">kg × reps</p>
            </div>
          </div>

          <section className="card">
            <h2 className="text-sm font-semibold text-[var(--fg-muted)] uppercase tracking-wide">
              Sessions per week
            </h2>
            <div className="mt-3 flex items-end gap-1.5 h-28">
              {weeks.map((w) => {
                const h = (w.sessions / maxSessions) * 100;
                return (
                  <div
                    key={w.start.toISOString()}
                    className="flex-1 flex flex-col items-center gap-1"
                    title={`${fmtWeekLabel(w.start)}: ${w.sessions} session(s)`}
                  >
                    <div className="w-full flex flex-col-reverse items-center" style={{ height: "100%" }}>
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${Math.max(2, h)}%`,
                          background:
                            w.sessions === 0 ? "var(--border)" : "var(--accent)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex gap-1.5 text-[10px] text-[var(--fg-muted)]">
              {weeks.map((w) => (
                <div key={w.start.toISOString()} className="flex-1 text-center">
                  {fmtWeekLabel(w.start)}
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2 className="text-sm font-semibold text-[var(--fg-muted)] uppercase tracking-wide">
              Volume per week
            </h2>
            <div className="mt-3 flex items-end gap-1.5 h-28">
              {weeks.map((w) => {
                const h = (w.volume / maxVolume) * 100;
                return (
                  <div
                    key={w.start.toISOString()}
                    className="flex-1 flex flex-col items-center gap-1"
                    title={`${fmtWeekLabel(w.start)}: ${Math.round(w.volume).toLocaleString()} kg×reps`}
                  >
                    <div className="w-full flex flex-col-reverse items-center" style={{ height: "100%" }}>
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${Math.max(2, h)}%`,
                          background:
                            w.volume === 0 ? "var(--border)" : "var(--accent)",
                          opacity: 0.85,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-2 px-1">
              Per-exercise bests
            </h2>
            <ul className="flex flex-col gap-2">
              {exerciseList.map((ex) => (
                <li key={ex.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{ex.name}</p>
                      <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                        {ex.sessions} session{ex.sessions === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">
                        Best
                      </p>
                      <p className="font-mono text-sm">
                        {ex.bestWeight != null
                          ? `${ex.bestWeight}kg × ${ex.bestReps ?? "—"}`
                          : ex.bestHold != null
                            ? `${ex.bestHold}s`
                            : `${ex.bestReps ?? "—"} reps`}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
