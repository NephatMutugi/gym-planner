"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EXERCISE_BY_ID } from "@/data/exercises";
import { hasExerciseDemo } from "@/data/exercise-demos";
import CoachSheet from "@/components/CoachSheet";
import RestTimer from "@/components/RestTimer";
import ExerciseDemo from "@/components/ExerciseDemo";
import { drainQueue, enqueueSet, pendingCountFor } from "@/lib/offline-queue";
import AddExerciseSheet, {
  type LibraryGroup,
  type RecentExercise,
} from "./AddExerciseSheet";

type Prescription = {
  targetLoadKg: number | null;
  repsMin: number;
  repsMax: number;
  holdSeconds: number | null;
};

type ItemStatus = "PENDING" | "SKIPPED" | "REMOVED";

type Item = {
  programItemId: string;
  exerciseId: string;
  customName?: string | null;
  status: ItemStatus;
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

type RemovedItem = { id: string; name: string };

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
  removedItems,
  libraryGroups,
  recentExercises,
  exerciseNotes,
  loggedSets,
  claudeEnabled,
}: {
  sessionId: string;
  completed: boolean;
  initialNotes: string;
  items: Item[];
  removedItems: RemovedItem[];
  libraryGroups: LibraryGroup[];
  recentExercises: RecentExercise[];
  exerciseNotes: Record<string, string>;
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
  // Local algorithmic suggestions (fetched on swap-modal open). null = loading.
  const [localSuggestions, setLocalSuggestions] = useState<
    Array<{
      exerciseId: string;
      name: string;
      primaryMuscles: string[];
      reason: string;
      difficulty: number;
    }> | null
  >(null);
  const [localError, setLocalError] = useState<string | null>(null);
  // Claude (AI) suggestion path — collapsed by default, only opened when the
  // user explicitly asks for a custom suggestion.
  const [claudeExpanded, setClaudeExpanded] = useState(false);
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

  // --- Skip / Remove state ---
  // Optimistic status overrides keyed by SessionItem.id. We render based on
  // override if present, else the server-provided status.
  const [statusOverride, setStatusOverride] = useState<Record<string, ItemStatus>>({});
  // Names for items the user just removed this render (so the Undo strip can
  // still label them after the override hides the original card). Cleared on
  // router.refresh — but we keep our own copy so the strip survives the round-trip.
  const [removedNameCache, setRemovedNameCache] = useState<Record<string, string>>({});

  function effectiveStatus(item: Item): ItemStatus {
    return statusOverride[item.programItemId] ?? item.status;
  }

  async function setItemStatus(itemId: string, next: ItemStatus, prev: ItemStatus, nameForCache?: string) {
    setError(null);
    setStatusOverride((s) => ({ ...s, [itemId]: next }));
    if (next === "REMOVED" && nameForCache) {
      setRemovedNameCache((c) => ({ ...c, [itemId]: nameForCache }));
    }
    try {
      const res = await fetch(`/api/sessions/${sessionId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not update exercise");
        // revert
        setStatusOverride((s) => {
          const copy = { ...s };
          copy[itemId] = prev;
          return copy;
        });
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
      setStatusOverride((s) => {
        const copy = { ...s };
        copy[itemId] = prev;
        return copy;
      });
    }
  }

  function loggedSetsForExercise(exerciseId: string): number {
    return loggedSets.filter((s) => s.exerciseId === exerciseId && !s.skipped).length;
  }

  function handleSkip(item: Item) {
    const cur = effectiveStatus(item);
    const next: ItemStatus = cur === "SKIPPED" ? "PENDING" : "SKIPPED";
    setItemStatus(item.programItemId, next, cur);
  }

  function handleRemove(item: Item, displayName: string) {
    const logged = loggedSetsForExercise(item.exerciseId);
    if (logged > 0) {
      const msg =
        `Remove "${displayName}"? You've logged ${logged} set${logged === 1 ? "" : "s"} on it. ` +
        `The logged sets will be kept for history.`;
      if (!confirm(msg)) return;
    }
    setItemStatus(item.programItemId, "REMOVED", effectiveStatus(item), displayName);
  }

  function handleUndoRemove(itemId: string) {
    const cur = statusOverride[itemId] ?? "REMOVED";
    setItemStatus(itemId, "PENDING", cur);
    setRemovedNameCache((c) => {
      const copy = { ...c };
      delete copy[itemId];
      return copy;
    });
  }

  // --- Per-exercise persistent notes ---
  // Local overrides keyed by library exerciseId. Mirrors the swap/status
  // override pattern — render the override if present, fall back to the
  // server-provided dict.
  const [noteOverride, setNoteOverride] = useState<Record<string, string>>({});
  const [noteEditorFor, setNoteEditorFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);

  function getNote(exerciseId: string): string {
    if (Object.prototype.hasOwnProperty.call(noteOverride, exerciseId)) {
      return noteOverride[exerciseId];
    }
    return exerciseNotes[exerciseId] ?? "";
  }

  function openNoteEditor(exerciseId: string) {
    setNoteDraft(getNote(exerciseId));
    setNoteEditorFor(exerciseId);
  }

  function closeNoteEditor() {
    setNoteEditorFor(null);
    setNoteDraft("");
  }

  async function saveNote() {
    if (!noteEditorFor) return;
    const exerciseId = noteEditorFor;
    const next = noteDraft.trim();
    const prev = getNote(exerciseId);
    setNoteBusy(true);
    setNoteOverride((m) => ({ ...m, [exerciseId]: next }));
    try {
      const res = await fetch(`/api/exercises/${exerciseId}/note`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: next }),
      });
      if (!res.ok) {
        // revert
        setNoteOverride((m) => ({ ...m, [exerciseId]: prev }));
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save note");
        return;
      }
      closeNoteEditor();
    } catch {
      setNoteOverride((m) => ({ ...m, [exerciseId]: prev }));
      setError("Network error");
    } finally {
      setNoteBusy(false);
    }
  }

  // --- Exercise demo modal ---
  // Tracks { exerciseId, exerciseName } for the currently-open demo, or null.
  const [demoFor, setDemoFor] = useState<{
    exerciseId: string;
    exerciseName: string;
  } | null>(null);

  // --- Rest timer ---
  // restartKey is bumped each time the user logs a non-skipped set, which
  // triggers the timer to (re)start from the prescription's restSeconds.
  // Skipped sets do not start the timer (rest only matters between real sets).
  const [restTimer, setRestTimer] = useState<{
    duration: number;
    restartKey: string;
  } | null>(null);

  // --- Add exercise ---
  const [addOpen, setAddOpen] = useState(false);

  async function addExerciseCall(
    body:
      | { exerciseId: string }
      | {
          customName: string;
          sets: number;
          repsMin: number;
          repsMax: number;
          restSeconds: number;
        }
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.error ?? "Could not add exercise" };
      }
      router.refresh();
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error" };
    }
  }

  function openSwap(programItemId: string) {
    setSwapItemId(programItemId);
    setSwapReason("");
    setSwapSuggestion(null);
    setSwapError(null);
    setLocalSuggestions(null);
    setLocalError(null);
    setClaudeExpanded(false);
    setSwapOpen(true);
  }

  function closeSwap() {
    setSwapOpen(false);
    setSwapItemId(null);
    setSwapSuggestion(null);
    setSwapError(null);
    setLocalSuggestions(null);
    setLocalError(null);
    setClaudeExpanded(false);
  }

  // Fetch algorithmic suggestions whenever the swap modal opens for a new
  // item. This is the cheap, no-Claude path that handles 99% of cases.
  useEffect(() => {
    if (!swapOpen || !swapItemId) return;
    const item = items.find((i) => i.programItemId === swapItemId);
    if (!item) return;
    const exerciseIdToSwap =
      swappedExerciseIds[item.programItemId] ?? item.exerciseId;

    let cancelled = false;
    setLocalSuggestions(null);
    setLocalError(null);
    (async () => {
      try {
        const res = await fetch(`/api/swaps/${exerciseIdToSwap}`);
        if (cancelled) return;
        const data = await res.json();
        if (!res.ok) {
          setLocalError(data.error ?? "Could not load suggestions");
          return;
        }
        setLocalSuggestions(data.suggestions ?? []);
      } catch {
        if (cancelled) return;
        setLocalError("Network error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [swapOpen, swapItemId, items, swappedExerciseIds]);

  // Claude (AI) request — only fired when the user explicitly expands the
  // "Ask Claude" section and submits. The expensive path.
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

  // Accepts either a local algorithmic suggestion (just an exerciseId) or
  // Claude's suggestion (uses the stored swapSuggestion).
  function acceptSwap(exerciseId?: string) {
    if (!swapItemId) return;
    const targetId = exerciseId ?? swapSuggestion?.exerciseId;
    if (!targetId) return;
    setSwappedExerciseIds((prev) => ({
      ...prev,
      [swapItemId]: targetId,
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

    // Start (or restart) the rest timer on a real logged set. Skipped sets
    // don't trigger rest — there's nothing to recover from.
    if (!options.skipped && item.restSeconds > 0) {
      setRestTimer({
        duration: item.restSeconds,
        restartKey: `${effectiveExerciseId}-${setNumber}-${Date.now()}`,
      });
    }
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
        const status = effectiveStatus(it);
        // Hide REMOVED items from the main list — they live in the Undo strip below.
        if (status === "REMOVED") return null;

        const effectiveExerciseId = swappedExerciseIds[it.programItemId] ?? it.exerciseId;
        const ex = EXERCISE_BY_ID[effectiveExerciseId];
        // Custom items don't have a library Exercise. We still render them with
        // the customName but hide library-specific actions like ask/swap.
        const isCustom = !ex && !!it.customName;
        if (!ex && !isCustom) return null;
        const displayName = ex?.name ?? it.customName ?? "Exercise";
        const isIso = it.prescription.holdSeconds != null;
        const repsLabel =
          it.prescription.repsMin === it.prescription.repsMax
            ? `${it.prescription.repsMin}`
            : `${it.prescription.repsMin}–${it.prescription.repsMax}`;
        const isSkippedItem = status === "SKIPPED";

        return (
          <div
            key={it.programItemId}
            className="card"
            style={isSkippedItem ? { opacity: 0.55 } : undefined}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{displayName}</p>
                  {isCustom && (
                    <span className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)] border border-[var(--border)] rounded-full px-1.5 py-0.5">
                      custom
                    </span>
                  )}
                  {swappedExerciseIds[it.programItemId] && (
                    <span className="text-[10px] uppercase tracking-wide text-[var(--accent)] border border-[var(--accent)] rounded-full px-1.5 py-0.5">
                      swapped
                    </span>
                  )}
                  {isSkippedItem && (
                    <span className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)] border border-[var(--border)] rounded-full px-1.5 py-0.5">
                      skipped
                    </span>
                  )}
                  {!completed && !isSkippedItem && !isCustom && claudeEnabled && (
                    <>
                      <button
                        type="button"
                        onClick={() => explainExercise(effectiveExerciseId, displayName)}
                        className="text-xs text-[var(--accent)] underline"
                        aria-label={`Explain ${displayName}`}
                      >
                        ask
                      </button>
                      <button
                        type="button"
                        onClick={() => openSwap(it.programItemId)}
                        className="text-xs text-[var(--accent)] underline"
                        aria-label={`Swap ${displayName}`}
                      >
                        swap
                      </button>
                    </>
                  )}
                  {!isCustom && hasExerciseDemo(effectiveExerciseId) && (
                    <button
                      type="button"
                      onClick={() =>
                        setDemoFor({
                          exerciseId: effectiveExerciseId,
                          exerciseName: displayName,
                        })
                      }
                      className="text-xs text-[var(--accent)] underline"
                      aria-label={`Show form demo for ${displayName}`}
                    >
                      demo
                    </button>
                  )}
                  {!completed && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSkip(it)}
                        className="text-xs text-[var(--fg-muted)] underline"
                        aria-label={isSkippedItem ? `Unskip ${displayName}` : `Skip ${displayName}`}
                      >
                        {isSkippedItem ? "unskip" : "skip"}
                      </button>
                      {!isSkippedItem && (
                        <button
                          type="button"
                          onClick={() => handleRemove(it, displayName)}
                          className="text-xs text-[var(--fg-muted)] underline"
                          aria-label={`Remove ${displayName}`}
                        >
                          remove
                        </button>
                      )}
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
                {!isCustom && getNote(effectiveExerciseId) && (
                  <p className="text-xs text-[var(--fg-muted)] mt-1 italic">
                    📝 {getNote(effectiveExerciseId)}{" "}
                    {!completed && (
                      <button
                        type="button"
                        onClick={() => openNoteEditor(effectiveExerciseId)}
                        className="not-italic underline text-[var(--accent)] ml-1"
                        aria-label={`Edit note for ${displayName}`}
                      >
                        edit
                      </button>
                    )}
                  </p>
                )}
                {!isCustom && !getNote(effectiveExerciseId) && !completed && (
                  <button
                    type="button"
                    onClick={() => openNoteEditor(effectiveExerciseId)}
                    className="text-xs text-[var(--fg-muted)] underline mt-1"
                    aria-label={`Add note for ${displayName}`}
                  >
                    + note
                  </button>
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

            {isSkippedItem ? (
              <p className="mt-3 text-xs text-[var(--fg-muted)]">
                Skipped for today. Tap <span className="font-semibold">unskip</span> to bring it back.
              </p>
            ) : (
            <>
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
            </>
            )}
          </div>
        );
      })}

      {!completed && (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="card text-left text-sm text-[var(--accent)] font-semibold w-full hover:bg-[var(--accent-soft)]"
          aria-label="Add an exercise to this workout"
        >
          + Add exercise
        </button>
      )}

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
            {/* Local algorithmic suggestions — instant, no Claude call */}
            <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-2">
              Suggested alternatives
            </p>

            {localSuggestions === null && !localError && (
              <p className="text-sm text-[var(--fg-muted)]">Finding alternatives…</p>
            )}

            {localError && (
              <p className="text-sm" style={{ color: "var(--danger)" }}>
                {localError}
              </p>
            )}

            {localSuggestions !== null && localSuggestions.length === 0 && (
              <p className="text-sm text-[var(--fg-muted)]">
                No close alternatives found with your equipment. Try asking Claude for a custom suggestion below.
              </p>
            )}

            {localSuggestions !== null && localSuggestions.length > 0 && (
              <ul className="flex flex-col gap-2">
                {localSuggestions.map((s) => (
                  <li
                    key={s.exerciseId}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                        {s.reason}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => acceptSwap(s.exerciseId)}
                      className="shrink-0 text-xs font-semibold text-[var(--accent-fg)] bg-[var(--accent)] rounded-md px-3 py-1.5"
                    >
                      Use
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Claude fallback — collapsible, only fires the AI call when the
                user expands and explicitly submits */}
            <div className="mt-5 pt-4 border-t border-[var(--border)]">
              {!claudeExpanded && !swapSuggestion && (
                <button
                  type="button"
                  onClick={() => setClaudeExpanded(true)}
                  className="text-sm text-[var(--accent)] underline"
                >
                  Ask Claude for a custom suggestion
                </button>
              )}

              {claudeExpanded && !swapSuggestion && (
                <>
                  <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-2">
                    Custom (AI-powered)
                  </p>
                  <label className="block">
                    <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">
                      What&apos;s the constraint? <span className="opacity-60">(optional)</span>
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
                    className="btn btn-primary mt-3"
                    disabled={swapBusy}
                  >
                    {swapBusy ? "Asking Claude…" : "Ask Claude"}
                  </button>
                </>
              )}

              {swapSuggestion && (
                <>
                  <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                    Claude&apos;s suggestion
                  </p>
                  <p className="mt-1 text-lg font-bold">{swapSuggestion.name}</p>
                  <p className="mt-2 text-sm leading-relaxed">
                    {swapSuggestion.reasoning}
                  </p>
                  <div className="flex gap-3 mt-5">
                    <button
                      type="button"
                      onClick={() => setSwapSuggestion(null)}
                      className="btn btn-ghost"
                    >
                      Try another
                    </button>
                    <button
                      type="button"
                      onClick={() => acceptSwap()}
                      className="btn btn-primary"
                    >
                      Use this
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <CoachSheet
        open={coachOpen}
        title={coachTitle}
        onClose={() => setCoachOpen(false)}
        fetcher={coachFetcher ?? undefined}
      />

      <RestTimer
        duration={restTimer?.duration ?? null}
        restartKey={restTimer?.restartKey ?? null}
        enabled={!completed}
      />

      <ExerciseDemo
        open={!!demoFor}
        exerciseId={demoFor?.exerciseId ?? ""}
        exerciseName={demoFor?.exerciseName ?? ""}
        onClose={() => setDemoFor(null)}
      />

      <AddExerciseSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        libraryGroups={libraryGroups}
        recentExercises={recentExercises}
        onAdd={addExerciseCall}
      />

      {/* Per-exercise note editor */}
      {noteEditorFor && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          onClick={() => !noteBusy && closeNoteEditor()}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-[var(--border)] bg-[var(--bg-elev)] p-5 m-0 sm:m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-lg font-bold">
                Note: {EXERCISE_BY_ID[noteEditorFor]?.name ?? "Exercise"}
              </h2>
              <button
                type="button"
                onClick={closeNoteEditor}
                disabled={noteBusy}
                className="text-[var(--fg-muted)] text-xl leading-none px-2"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-[var(--fg-muted)] mb-2">
              Shown the next time this exercise appears in any workout. Leave empty to remove.
            </p>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="e.g. knee twinged on rep 8, try 12kg next time"
              autoFocus
              disabled={noteBusy}
            />
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={closeNoteEditor}
                className="btn btn-ghost"
                disabled={noteBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNote}
                className="btn btn-primary"
                disabled={noteBusy}
              >
                {noteBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {(() => {
        // Surface anything the user has removed (either from this render's
        // override map or from the server-provided removedItems list).
        const overrideRemovedIds = Object.entries(statusOverride)
          .filter(([, s]) => s === "REMOVED")
          .map(([id]) => id);
        const merged: RemovedItem[] = [];
        const seen = new Set<string>();
        for (const id of overrideRemovedIds) {
          // Prefer a fresh name from the cache (captured at remove-time), else
          // try to find the item in the live list, else fall back to the id.
          const liveName =
            items.find((it) => it.programItemId === id) &&
            EXERCISE_BY_ID[items.find((it) => it.programItemId === id)!.exerciseId]?.name;
          merged.push({ id, name: removedNameCache[id] ?? liveName ?? "Exercise" });
          seen.add(id);
        }
        for (const r of removedItems) {
          if (seen.has(r.id)) continue;
          // If the user has just un-removed it (override = PENDING/SKIPPED), skip.
          if (statusOverride[r.id] && statusOverride[r.id] !== "REMOVED") continue;
          merged.push(r);
        }
        if (merged.length === 0 || completed) return null;
        return (
          <div className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                  Removed today
                </p>
                <p className="text-sm mt-1">
                  {merged.map((r) => r.name).join(", ")}
                </p>
              </div>
              <div className="shrink-0 flex flex-col gap-1.5">
                {merged.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleUndoRemove(r.id)}
                    className="text-xs text-[var(--accent)] underline whitespace-nowrap"
                    aria-label={`Undo remove ${r.name}`}
                  >
                    undo {r.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

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
