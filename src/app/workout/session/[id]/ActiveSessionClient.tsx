"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EXERCISE_BY_ID } from "@/data/exercises";
import CoachSheet from "@/components/CoachSheet";
import { drainQueue, enqueueSet, pendingCountFor } from "@/lib/offline-queue";

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
  claudeEnabled,
}: {
  sessionId: string;
  completed: boolean;
  initialNotes: string;
  items: Item[];
  loggedSets: LoggedSet[];
  claudeEnabled: boolean;
}) {
  const router = useRouter();

  // --- Online/offline awareness + drain queue on mount ---
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSets, setPendingSets] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => {
      setIsOnline(window.navigator.onLine);
      setPendingSets(pendingCountFor(sessionId));
    };
    refresh();
    const onOnline = async () => {
      setIsOnline(true);
      const result = await drainQueue();
      if (result.ok > 0) {
        // Refresh the page to show the latest state including drained sets
        setPendingSets(pendingCountFor(sessionId));
        router.refresh();
      }
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    // Drain immediately on mount in case we were just offline
    if (window.navigator.onLine) {
      drainQueue().then(() => setPendingSets(pendingCountFor(sessionId)));
    }
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [sessionId, router]);

  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachTitle, setCoachTitle] = useState("");
  const [coachFetcher, setCoachFetcher] = useState<(() => Promise<{ text?: string; error?: string }>) | null>(null);



  // --- Swap state ---
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapItemId, setSwapItemId] = useState<string | null>(null);
  const [swapReason, setSwapReason] = useState("");
  const [swapBusy, setSwapBusy] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapSuggestion, setSwapSuggestion] = useState<{
    exerciseId: string;
    name: string;
    reasoning: string;
  } | null>(null);
  // Map of programItemId -> new exerciseId (locally swapped, this session only)
  const [swappedExerciseIds, setSwappedExerciseIds] = useState<Record<string, string>>({});

  function openSwap(programItemId: string) {
    setSwapItemId(programItemId);
    setSwapReason("");
    setSwapSuggestion(null);
    setSwapError(null);
    setSwapOpen(true);
  }

  function closeSwap() {
    setSwapOpen(false);
    setSwapItemId(null);
    setSwapSuggestion(null);
    setSwapError(null);
  }

  async function requestSwap() {
    if (!swapItemId) return;
    const item = items.find((i) => i.programItemId === swapItemId);
    if (!item) return;
    const exerciseIdToSwap =
      swappedExerciseIds[item.programItemId] ?? item.exerciseId;
    setSwapBusy(true);
    setSwapError(null);
    const res = await fetch("/api/coach/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exerciseId: exerciseIdToSwap,
        reason: swapReason || "Looking for an alternative.",
      }),
    });
    setSwapBusy(false);
    const data = await res.json();
    if (!res.ok) {
      setSwapError(data.error ?? "Could not get a suggestion");
      return;
    }
    setSwapSuggestion(data.suggestion);
  }

  function acceptSwap() {
    if (!swapItemId || !swapSuggestion) return;
    setSwappedExerciseIds((prev) => ({
      ...prev,
      [swapItemId]: swapSuggestion.exerciseId,
    }));
    closeSwap();
  }

  function explainExercise(exerciseId: string, exerciseName: string) {
    setCoachTitle(`About: ${exerciseName}`);
    setCoachFetcher(() => async () => {
      const res = await fetch("/api/coach/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error ?? "Could not load explanation" };
      return { text: data.text };
    });
    setCoachOpen(true);
  }


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
    options: { skipped?: boolean; exerciseIdOverride?: string } = {}
  ) {
    setError(null);
    const effectiveExerciseId = options.exerciseIdOverride ?? item.exerciseId;
    const cur = getLocal(effectiveExerciseId, setNumber);
    const isIso = item.prescription.holdSeconds != null;
    const weight = cur.weight === "" ? null : Number(cur.weight);
    const reps = cur.reps === "" ? null : Number(cur.reps);
    const hold = cur.hold === "" ? null : Number(cur.hold);

    const payload = {
      exerciseId: effectiveExerciseId,
      setNumber,
      weightKg: options.skipped ? null : weight,
      reps: options.skipped ? null : isIso ? null : reps,
      holdSeconds: options.skipped ? null : isIso ? hold : null,
      skipped: options.skipped ?? false,
      programItemId: item.programItemId,
    };

    setLocalField(effectiveExerciseId, setNumber, "status", "saving");

    // If we know we're offline, queue immediately and show as logged optimistically.
    if (typeof window !== "undefined" && !window.navigator.onLine) {
      enqueueSet({ sessionId, payload, queuedAt: Date.now() });
      setPendingSets(pendingCountFor(sessionId));
      setLocalField(
        effectiveExerciseId,
        setNumber,
        "status",
        options.skipped ? "skipped" : "logged"
      );
      return;
    }

    try {
      const res = await fetch(`/api/sessions/${sessionId}/sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save set");
        setLocalField(effectiveExerciseId, setNumber, "status", "pending");
        return;
      }
    } catch {
      // Network error mid-request → queue and continue optimistically
      enqueueSet({ sessionId, payload, queuedAt: Date.now() });
      setPendingSets(pendingCountFor(sessionId));
    }

    setLocalField(
      effectiveExerciseId,
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
      {(!isOnline || pendingSets > 0) && (
        <div
          className="card text-xs"
          style={{ borderColor: !isOnline ? "var(--danger)" : "var(--accent)" }}
        >
          {!isOnline && (
            <p>
              <strong>Offline.</strong> Sets you log will sync automatically
              when you&apos;re back online.
            </p>
          )}
          {pendingSets > 0 && (
            <p className={!isOnline ? "mt-1" : ""}>
              {pendingSets} set{pendingSets === 1 ? "" : "s"} pending sync.
            </p>
          )}
        </div>
      )}

      {items.map((it) => {
        const effectiveExerciseId = swappedExerciseIds[it.programItemId] ?? it.exerciseId;
        const ex = EXERCISE_BY_ID[effectiveExerciseId];
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
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{ex.name}</p>
                  {swappedExerciseIds[it.programItemId] && (
                    <span className="text-[10px] uppercase tracking-wide text-[var(--accent)] border border-[var(--accent)] rounded-full px-1.5 py-0.5">
                      swapped
                    </span>
                  )}
                  {claudeEnabled && !completed && (
                    <>
                      <button
                        type="button"
                        onClick={() => explainExercise(effectiveExerciseId, ex.name)}
                        className="text-xs text-[var(--accent)] underline"
                        aria-label={`Explain ${ex.name}`}
                      >
                        ask
                      </button>
                      <button
                        type="button"
                        onClick={() => openSwap(it.programItemId)}
                        className="text-xs text-[var(--accent)] underline"
                        aria-label={`Swap ${ex.name}`}
                      >
                        swap
                      </button>
                    </>
                  )}
                </div>
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
                const cur = getLocal(effectiveExerciseId, setNumber);
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
                          setLocalField(effectiveExerciseId, setNumber, "weight", e.target.value)
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
                          setLocalField(effectiveExerciseId, setNumber, "hold", e.target.value)
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
                          setLocalField(effectiveExerciseId, setNumber, "reps", e.target.value)
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
                          onClick={() => logSet(it, setNumber, { exerciseIdOverride: effectiveExerciseId })}
                          className={
                            "px-3 py-1.5 rounded-lg text-sm font-semibold " +
                            (isLogged
                              ? "bg-[var(--accent)] text-white"
                              : "border border-[var(--border)] text-[var(--fg-muted)]")
                          }
                          disabled={cur.status === "saving"}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={() => logSet(it, setNumber, { skipped: true, exerciseIdOverride: effectiveExerciseId })}
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


      {/* Swap modal */}
      {swapOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          onClick={closeSwap}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full sm:max-w-md max-h-[85dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[var(--border)] bg-[var(--bg-elev)] p-5 m-0 sm:m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-lg font-bold">Swap exercise</h2>
              <button
                type="button"
                onClick={closeSwap}
                className="text-[var(--fg-muted)] text-xl leading-none px-2"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {!swapSuggestion && (
              <>
                <label className="block">
                  <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">
                    Why? <span className="opacity-60">(optional)</span>
                  </span>
                  <textarea
                    rows={3}
                    value={swapReason}
                    onChange={(e) => setSwapReason(e.target.value)}
                    placeholder="e.g. lower back is sore, no time for setup, want something easier"
                    maxLength={300}
                  />
                </label>
                {swapError && (
                  <p className="text-sm mt-2" style={{ color: "var(--danger)" }}>
                    {swapError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={requestSwap}
                  className="btn btn-primary mt-4"
                  disabled={swapBusy}
                >
                  {swapBusy ? "Asking Claude…" : "Suggest an alternative"}
                </button>
              </>
            )}
            {swapSuggestion && (
              <>
                <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                  Suggestion
                </p>
                <p className="mt-1 text-lg font-bold">{swapSuggestion.name}</p>
                <p className="mt-2 text-sm leading-relaxed">
                  {swapSuggestion.reasoning}
                </p>
                <div className="flex gap-3 mt-5">
                  <button
                    type="button"
                    onClick={() => {
                      setSwapSuggestion(null);
                    }}
                    className="btn btn-ghost"
                  >
                    Try another
                  </button>
                  <button
                    type="button"
                    onClick={acceptSwap}
                    className="btn btn-primary"
                  >
                    Use this
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <CoachSheet
        open={coachOpen}
        title={coachTitle}
        onClose={() => setCoachOpen(false)}
        fetcher={coachFetcher ?? undefined}
      />

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
