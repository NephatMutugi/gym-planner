"use client";

import { useMemo, useState } from "react";

export type LibraryGroup = {
  pattern: string;
  label: string;
  exercises: Array<{ id: string; name: string; loadType: "loaded" | "bodyweight" | "iso" }>;
};

export type RecentExercise = { id: string; name: string };

type Tab = "library" | "recent" | "custom";

type AddBody =
  | { exerciseId: string }
  | {
      customName: string;
      sets: number;
      repsMin: number;
      repsMax: number;
      restSeconds: number;
    };

export default function AddExerciseSheet({
  open,
  onClose,
  libraryGroups,
  recentExercises,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  libraryGroups: LibraryGroup[];
  recentExercises: RecentExercise[];
  onAdd: (body: AddBody) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [tab, setTab] = useState<Tab>("library");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom form
  const [customName, setCustomName] = useState("");
  const [customSets, setCustomSets] = useState("3");
  const [customRepsMin, setCustomRepsMin] = useState("8");
  const [customRepsMax, setCustomRepsMax] = useState("12");
  const [customRest, setCustomRest] = useState("60");

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return libraryGroups;
    return libraryGroups
      .map((g) => ({
        ...g,
        exercises: g.exercises.filter((e) => e.name.toLowerCase().includes(q)),
      }))
      .filter((g) => g.exercises.length > 0);
  }, [libraryGroups, search]);

  function reset() {
    setError(null);
    setSearch("");
    setCustomName("");
    setCustomSets("3");
    setCustomRepsMin("8");
    setCustomRepsMax("12");
    setCustomRest("60");
  }

  function handleClose() {
    if (busy) return;
    reset();
    onClose();
  }

  async function submit(body: AddBody) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await onAdd(body);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not add exercise");
      return;
    }
    reset();
    onClose();
  }

  function submitLibrary(exerciseId: string) {
    void submit({ exerciseId });
  }

  function submitCustom() {
    const name = customName.trim();
    if (!name) {
      setError("Name is required");
      return;
    }
    const sets = Math.max(1, Math.min(20, Number(customSets) || 3));
    const repsMin = Math.max(1, Math.min(100, Number(customRepsMin) || 8));
    const repsMaxRaw = Math.max(1, Math.min(100, Number(customRepsMax) || 12));
    const repsMax = Math.max(repsMin, repsMaxRaw);
    const restSeconds = Math.max(0, Math.min(900, Number(customRest) || 60));
    void submit({ customName: name, sets, repsMin, repsMax, restSeconds });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Add exercise"
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full sm:max-w-md max-h-[85dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[var(--border)] bg-[var(--bg-elev)] p-5 m-0 sm:m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-bold">Add exercise</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-[var(--fg-muted)] text-xl leading-none px-2"
            aria-label="Close"
            disabled={busy}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Add exercise source"
          className="flex gap-1 bg-[var(--bg)] rounded-xl p-1 mb-3 border border-[var(--border)]"
        >
          {(["library", "recent", "custom"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setError(null);
              }}
              className={
                "flex-1 text-sm py-1.5 rounded-lg capitalize " +
                (tab === t
                  ? "bg-[var(--accent)] text-[var(--accent-fg)] font-semibold"
                  : "text-[var(--fg-muted)]")
              }
            >
              {t}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm mb-2" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}

        {/* Library */}
        {tab === "library" && (
          <div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises"
              className="w-full mb-3"
              style={{ padding: "8px 10px" }}
              disabled={busy}
              aria-label="Search exercises"
            />
            {filteredGroups.length === 0 ? (
              <p className="text-sm text-[var(--fg-muted)]">
                No matches. Try a different word, or use the Custom tab.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {filteredGroups.map((g) => (
                  <section key={g.pattern}>
                    <h3 className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-1.5">
                      {g.label}
                    </h3>
                    <ul className="flex flex-col">
                      {g.exercises.map((ex) => (
                        <li key={ex.id}>
                          <button
                            type="button"
                            onClick={() => submitLibrary(ex.id)}
                            disabled={busy}
                            className="w-full text-left py-2 px-2 rounded-lg text-sm hover:bg-[var(--bg)] flex items-center justify-between gap-2"
                          >
                            <span>{ex.name}</span>
                            <span className="text-[10px] uppercase text-[var(--fg-muted)]">
                              {ex.loadType === "loaded"
                                ? "weighted"
                                : ex.loadType === "iso"
                                  ? "hold"
                                  : "bodyweight"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent */}
        {tab === "recent" && (
          <div>
            {recentExercises.length === 0 ? (
              <p className="text-sm text-[var(--fg-muted)]">
                Nothing here yet — once you log a few workouts, exercises you&apos;ve
                done recently will show up here for quick re-adding.
              </p>
            ) : (
              <ul className="flex flex-col">
                {recentExercises.map((ex) => (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() => submitLibrary(ex.id)}
                      disabled={busy}
                      className="w-full text-left py-2 px-2 rounded-lg text-sm hover:bg-[var(--bg)]"
                    >
                      {ex.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Custom */}
        {tab === "custom" && (
          <div className="flex flex-col gap-3">
            <label className="block">
              <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">
                Name
              </span>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Foam rolling, Cat-cow"
                maxLength={80}
                disabled={busy}
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">
                  Sets
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={customSets}
                  onChange={(e) => setCustomSets(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="block">
                <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">
                  Reps min
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={customRepsMin}
                  onChange={(e) => setCustomRepsMin(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="block">
                <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">
                  Reps max
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={customRepsMax}
                  onChange={(e) => setCustomRepsMax(e.target.value)}
                  disabled={busy}
                />
              </label>
            </div>
            <label className="block">
              <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">
                Rest (seconds)
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={customRest}
                onChange={(e) => setCustomRest(e.target.value)}
                disabled={busy}
              />
            </label>
            <button
              type="button"
              onClick={submitCustom}
              disabled={busy}
              className="btn btn-primary mt-1"
            >
              {busy ? "Adding…" : "Add to workout"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
