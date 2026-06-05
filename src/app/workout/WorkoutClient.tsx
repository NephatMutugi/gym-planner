"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EXERCISE_BY_ID, MUSCLE_LABELS, type Muscle } from "@/data/exercises";
import ExerciseDemoButton from "@/components/ExerciseDemoButton";

// Context-specific banner copy. The keys mirror the TrainingContext enum
// values from src/lib/program.ts. "general" is intentionally absent — we
// don't show a banner for that case.
const CONTEXT_BANNER: Record<string, { title: string; body: string }> = {
  returning_from_injury: {
    title: "Recovery-aware programming",
    body: "High-impact moves and heavy bracing are filtered out. Rest periods on loaded sets are extended to give joints and connective tissue more time to recover. Listen to your body and clear return-to-exercise with your healthcare provider.",
  },
  prenatal: {
    title: "Prenatal-aware programming",
    body: "High-impact, heavy-bracing, and deep core flexion exercises are filtered out. Your program includes extra mobility. Always clear return-to-exercise with your healthcare provider, especially in the second and third trimesters.",
  },
  early_postpartum: {
    title: "Early postpartum-aware programming",
    body: "High-impact moves, heavy bracing, and deep core flexion are filtered out. Your program includes extra mobility and glute activation. Listen to your body and check with your healthcare provider before pushing intensity — especially if you have diastasis or pelvic-floor concerns.",
  },
  late_postpartum: {
    title: "Postpartum-aware programming",
    body: "High-impact moves are filtered out as you continue rebuilding capacity. Other movement patterns are unrestricted, but stay attentive to pelvic-floor symptoms and clear return-to-impact with your healthcare provider.",
  },
};

type Item = {
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

type Day = {
  id: string;
  order: number;
  label: string;
  isRestDay: boolean;
  items: Item[];
};

type Program = {
  id: string;
  split: string;
  daysPerWeek: number;
  experience: string;
  goals: string[];
  days: Day[];
};

export default function WorkoutClient({
  program,
  initialDayIndex,
  trainingContext,
  activeSessionByDayId,
}: {
  program: Program | null;
  initialDayIndex: number;
  trainingContext: string | null;
  activeSessionByDayId?: Record<string, string>;
}) {
  const router = useRouter();
  const [dayIndex, setDayIndex] = useState(initialDayIndex);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);


  async function startOrResume(dayId: string) {
    setError(null);
    const existing = activeSessionByDayId?.[dayId];
    if (existing) {
      router.push(`/workout/session/${existing}`);
      return;
    }
    setBusy(true);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ programDayId: dayId }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not start session");
      return;
    }
    const data = await res.json();
    router.push(`/workout/session/${data.session.id}`);
  }

  async function generate() {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/program", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not generate program");
      return;
    }
    router.refresh();
  }

  if (!program) {
    return (
      <div className="flex flex-col gap-3 mt-4">
        {error && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={generate}
          disabled={busy}
        >
          {busy ? "Generating…" : "Generate program"}
        </button>
      </div>
    );
  }

  const day = program.days[dayIndex];

  return (
    <div className="flex flex-col gap-5">
      {/* Day tabs */}
      <div
        className="flex gap-2 overflow-x-auto -mx-2 px-2 pb-1"
        style={{ scrollbarWidth: "thin" }}
      >
        {program.days.map((d, i) => (
          <button
            key={d.order}
            type="button"
            onClick={() => setDayIndex(i)}
            className={
              "shrink-0 rounded-full border px-3 py-1.5 text-sm " +
              (i === dayIndex
                ? "border-[var(--accent)] bg-[var(--accent)] text-white font-semibold"
                : "border-[var(--border)] bg-[var(--bg-elev)] text-[var(--fg-muted)]")
            }
          >
            Day {d.order}
            {i === initialDayIndex && (
              <span className={i === dayIndex ? "opacity-70" : "text-[var(--accent)]"}> · today</span>
            )}
          </button>
        ))}
      </div>


      {trainingContext && trainingContext !== "general" && (
        <div
          className="card text-sm"
          style={{ borderColor: "var(--accent)" }}
        >
          <p className="font-semibold">{CONTEXT_BANNER[trainingContext]?.title ?? "Recovery-aware programming"}</p>
          <p className="text-[var(--fg-muted)] mt-1.5">
            {CONTEXT_BANNER[trainingContext]?.body ??
              "Your program is tuned for recovery — certain movement patterns are filtered out and rest is extended on loaded sets. Listen to your body and check with your healthcare provider before pushing intensity."}
          </p>
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold">{day.label}</h2>
        <p className="text-xs text-[var(--fg-muted)] mt-1">
          {day.items.length} exercises
        </p>
      </section>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => startOrResume(day.id)}
        disabled={busy || day.items.length === 0}
      >
        {activeSessionByDayId?.[day.id]
          ? "Resume workout"
          : busy
            ? "Starting…"
            : "Start workout"}
      </button>


      {day.items.length === 0 ? (
        <div className="card">
          <p className="text-sm text-[var(--fg-muted)]">
            No exercises for this day. Add more equipment or expand your
            session length and regenerate.
          </p>
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {day.items.map((it) => {
            const ex = EXERCISE_BY_ID[it.exerciseId];
            if (!ex) return null;
            const repsLabel =
              it.holdSeconds != null
                ? `${it.holdSeconds}s hold`
                : it.repsMin === it.repsMax
                  ? `${it.repsMin} reps`
                  : `${it.repsMin}–${it.repsMax} reps`;

            return (
              <li key={it.order} className="card">
                <div className="flex items-start justify-between gap-3">
                  <ExerciseDemoButton
                    exerciseId={ex.id}
                    exerciseName={ex.name}
                    variant="thumbnail"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{ex.name}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {ex.primaryMuscles.slice(0, 3).map((m) => (
                        <span
                          key={m}
                          className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--fg-muted)]"
                        >
                          {MUSCLE_LABELS[m as Muscle]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                      Sets × Reps
                    </p>
                    <p className="font-mono text-lg leading-tight">
                      {it.sets} × {repsLabel.replace(" reps", "")}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-[var(--border)] py-2">
                    <p className="text-[10px] uppercase text-[var(--fg-muted)]">
                      Load
                    </p>
                    <p className="font-mono text-sm mt-0.5">
                      {it.targetLoadKg != null
                        ? `${it.targetLoadKg}kg`
                        : ex.loadType === "iso"
                          ? "—"
                          : "BW"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] py-2">
                    <p className="text-[10px] uppercase text-[var(--fg-muted)]">
                      Reps
                    </p>
                    <p className="font-mono text-sm mt-0.5">
                      {it.holdSeconds != null
                        ? `${it.holdSeconds}s`
                        : it.repsMin === it.repsMax
                          ? `${it.repsMin}`
                          : `${it.repsMin}–${it.repsMax}`}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] py-2">
                    <p className="text-[10px] uppercase text-[var(--fg-muted)]">
                      Rest
                    </p>
                    <p className="font-mono text-sm mt-0.5">{it.restSeconds}s</p>
                  </div>
                </div>

                {ex.cues.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-xs text-[var(--fg-muted)] cursor-pointer select-none">
                      Form cues
                    </summary>
                    <ul className="mt-2 pl-4 text-xs text-[var(--fg-muted)] list-disc space-y-1">
                      {ex.cues.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <div className="pt-2 flex flex-col gap-3">
        {error && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={generate}
          disabled={busy}
        >
          {busy ? "Regenerating…" : "Regenerate program"}
        </button>
        <p className="text-xs text-[var(--fg-muted)] text-center">
          Uses your current profile and equipment.
        </p>
      </div>
    </div>
  );
}
