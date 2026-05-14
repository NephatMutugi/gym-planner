"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EXERCISE_BY_ID } from "@/data/exercises";

type Prescription = {
  targetLoadKg: number | null;
  repsMin: number;
  repsMax: number;
  holdSeconds: number | null;
};

type Item = {
  programItemId: string;
  exerciseId: string;
  sets: number;
  prescription: Prescription;
  previous: {
    weightKg: number | null;
    reps: number | null;
    holdSeconds: number | null;
    date: Date | null;
  } | null;
  restSeconds: number;
};

type LoggedSet = {
  id: string;
  exerciseId: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  holdSeconds: number | null;
  rpe: number | null;
  skipped: boolean;
};

// Local in-memory state for set rows keyed by `${exerciseId}-${setNumber}`
type Local = {
  weight: string;
  reps: string;
  hold: string;
  status: "pending" | "saving" | "logged" | "skipped";
};

function key(exerciseId: string, setNumber: number): string {
  return `${exerciseId}-${setNumber}`;
}

export default function ActiveSessionClient({
  sessionId,
  completed,
  initialNotes,
  items,
  loggedSets,
}: {
  sessionId: string;
  completed: boolean;
  initialNotes: string;
  items: Item[];
  loggedSets: LoggedSet[];
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed state from logged sets
  const seed: Record<string, Local> = {};
  for (const s of loggedSets) {
    seed[key(s.exerciseId, s.setNumber)] = {
      weight: s.weightKg != null ? String(s.weightKg) : "",
      reps: s.reps != null ? String(s.reps) : "",
      hold: s.holdSeconds != null ? String(s.holdSeconds) : "",
      status: s.skipped ? "skipped" : "logged",
    };
  }
  const [local, setLocal] = useState<Record<string, Local>>(seed);

  function getLocal(exerciseId: string, setNumber: number): Local {
    return (
      local[key(exerciseId, setNumber)] ?? {
        weight: "",
        reps: "",
        hold: "",
        status: "pending",
      }
    );
  }

  function setLocalField(
    exerciseId: string,
    setNumber: number,
    field: keyof Local,
    value: string | Local["status"]
  ) {
    setLocal((prev) => {
      const k = key(exerciseId, setNumber);
      const existing = prev[k] ?? { weight: "", reps: "", hold: "", status: "pending" as Local["status"] };
      return { ...prev, [k]: { ...existing, [field]: value } };
    });
  }

  async function logSet(
    item: Item,
    setNumber: number,
    options: { skipped?: boolean } = {}
  ) {
    setError(null);
    const cur = getLocal(item.exerciseId, setNumber);
    const isIso = item.prescription.holdSeconds != null;
    const weight = cur.weight === "" ? null : Number(cur.weight);
    const reps = cur.reps === "" ? null : Number(cur.reps);
    const hold = cur.hold === "" ? null : Number(cur.hold);

    const payload = {
      exerciseId: item.exerciseId,
      setNumber,
      weightKg: options.skipped ? null : weight,
      reps: options.skipped ? null : isIso ? null : reps,
      holdSeconds: options.skipped ? null : isIso ? hold : null,
      skipped: options.skipped ?? false,
      programItemId: item.programItemId,
    };

    setLocalField(item.exerciseId, setNumber, "status", "saving");
    const res = await fetch(`/api/sessions/${sessionId}/sets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save set");
      setLocalField(item.exerciseId, setNumber, "status", "pending");
      return;
    }
    setLocalField(
      item.exerciseId,
      setNumber,
      "status",
      options.skipped ? "skipped" : "logged"
    );
  }

  async function completeSession() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true, notes: notes || null }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not complete session");
      return;
    }
    router.push("/history");
    router.refresh();
  }

  async function discard() {
    if (!confirm("Discard this session? All logged sets will be lost.")) return;
    setBusy(true);
    const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      router.push("/workout");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((it) => {
        const ex = EXERCISE_BY_ID[it.exerciseId];
        if (!ex) return null;
        const isIso = it.prescription.holdSeconds != null;
        const repsLabel =
          it.prescription.repsMin === it.prescription.repsMax
            ? `${it.prescription.repsMin}`
            : `${it.prescription.repsMin}–${it.prescription.repsMax}`;

        return (
          <div key={it.programItemId} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{ex.name}</p>
                {it.previous && (
                  <p className="text-xs text-[var(--fg-muted)] mt-1">
                    Last:{" "}
                    {it.previous.weightKg != null
                      ? `${it.previous.weightKg}kg × `
                      : ""}
                    {it.previous.holdSeconds != null
                      ? `${it.previous.holdSeconds}s`
                      : it.previous.reps ?? ""}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] uppercase text-[var(--fg-muted)]">
                  Target
                </p>
                <p className="font-mono text-sm">
                  {it.prescription.targetLoadKg != null
                    ? `${it.prescription.targetLoadKg}kg × `
                    : ""}
                  {isIso ? `${it.prescription.holdSeconds}s` : repsLabel}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {Array.from({ length: it.sets }).map((_, i) => {
                const setNumber = i + 1;
                const cur = getLocal(it.exerciseId, setNumber);
                const isLogged = cur.status === "logged";
                const isSkipped = cur.status === "skipped";
                return (
                  <div
                    key={setNumber}
                    className={
                      "flex items-center gap-2 rounded-xl border px-2 py-2 " +
                      (isLogged
                        ? "border-[var(--accent)] bg-[var(--bg-elev)]"
                        : isSkipped
                          ? "border-[var(--border)] bg-[var(--bg-elev)] opacity-50"
                          : "border-[var(--border)] bg-[var(--bg-elev)]")
                    }
                  >
                    <span className="text-xs font-mono w-5 text-[var(--fg-muted)] text-center">
                      {setNumber}
                    </span>
                    {!isIso && it.prescription.targetLoadKg != null && (
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        value={cur.weight}
                        onChange={(e) =>
                          setLocalField(it.exerciseId, setNumber, "weight", e.target.value)
                        }
                        placeholder={String(it.prescription.targetLoadKg)}
                        className="text-center"
                        style={{ padding: "8px 6px", width: "70px" }}
                        disabled={completed}
                      />
                    )}
                    {isIso ? (
                      <input
                        type="number"
                        inputMode="numeric"
                        value={cur.hold}
                        onChange={(e) =>
                          setLocalField(it.exerciseId, setNumber, "hold", e.target.value)
                        }
                        placeholder={String(it.prescription.holdSeconds ?? "")}
                        className="text-center flex-1"
                        style={{ padding: "8px 6px" }}
                        disabled={completed}
                      />
                    ) : (
                      <input
                        type="number"
                        inputMode="numeric"
                        value={cur.reps}
                        onChange={(e) =>
                          setLocalField(it.exerciseId, setNumber, "reps", e.target.value)
                        }
                        placeholder={repsLabel}
                        className="text-center flex-1"
                        style={{ padding: "8px 6px" }}
                        disabled={completed}
                      />
                    )}
                    <span className="text-[10px] text-[var(--fg-muted)] w-8 text-center">
                      {isIso ? "sec" : "reps"}
                    </span>
                    {!completed && (
                      <>
                        <button
                          type="button"
                          onClick={() => logSet(it, setNumber)}
                          className={
                            "px-3 py-1.5 rounded-lg text-sm font-semibold " +
                            (isLogged
                              ? "bg-[var(--accent)] text-[#082420]"
                              : "border border-[var(--border)] text-[var(--fg-muted)]")
                          }
                          disabled={cur.status === "saving"}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={() => logSet(it, setNumber, { skipped: true })}
                          className="px-3 py-1.5 rounded-lg text-sm text-[var(--fg-muted)] border border-[var(--border)]"
                          disabled={cur.status === "saving"}
                          aria-label="Skip set"
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-[var(--fg-muted)] mt-3">
              Rest: {it.restSeconds}s
            </p>
          </div>
        );
      })}

      <div className="card">
        <label className="block">
          <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">
            Notes <span className="opacity-60">(optional)</span>
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="How did it feel? Anything to remember next time?"
            disabled={completed}
          />
        </label>
      </div>

      {error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {!completed && (
        <div className="flex flex-col gap-3 pb-4">
          <button
            type="button"
            className="btn btn-primary"
            onClick={completeSession}
            disabled={busy}
          >
            {busy ? "Saving…" : "Complete workout"}
          </button>
          <button
            type="button"
            className="text-sm text-[var(--fg-muted)] underline self-center"
            onClick={discard}
            disabled={busy}
          >
            Discard session
          </button>
        </div>
      )}
    </div>
  );
}
