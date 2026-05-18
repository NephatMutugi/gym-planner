"use client";

import { useState } from "react";
import Link from "next/link";
import {
  EQUIPMENT_LABELS,
  type EquipmentType,
} from "@/data/exercises";
import { parseWeightInput } from "@/lib/equipment";

type Item = {
  id: string;
  type: string;
  label: string | null;
  weightsKg: number[];
  notes: string | null;
  scope: "user" | "household";
};

const WEIGHTED: EquipmentType[] = ["dumbbell", "kettlebell", "barbell", "plate"];

const TYPE_HINTS: Partial<Record<EquipmentType, string>> = {
  dumbbell: "Enter the weight of each pair you own (e.g. 2, 5, 10).",
  kettlebell: "Enter each kettlebell weight you own (e.g. 12, 16, 24).",
  barbell: "Enter the bar weight only (plates are a separate item).",
  plate: "Enter each plate weight (one entry per pair).",
  bench: "Adjustable, flat, or otherwise — just check the box.",
  pullup_bar: "Doorway, wall-mounted, etc.",
  band: "Optional — note resistance level if known.",
  yoga_mat: "Optional.",
  machine: "Describe the machine in the label.",
};

export default function EquipmentClient({
  initialItems,
  inHousehold,
  householdName,
}: {
  initialItems: Item[];
  inHousehold: boolean;
  householdName: string | null;
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [showAdd, setShowAdd] = useState(initialItems.length === 0);
  const [type, setType] = useState<EquipmentType>("dumbbell");
  const [label, setLabel] = useState("");
  const [weightsInput, setWeightsInput] = useState("");
  const [notes, setNotes] = useState("");
  const [scope, setScope] = useState<"user" | "household">(
    inHousehold ? "household" : "user"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isWeighted = WEIGHTED.includes(type);

  function resetForm() {
    setType("dumbbell");
    setLabel("");
    setWeightsInput("");
    setNotes("");
    setError(null);
  }

  async function addItem() {
    setError(null);
    const weights = isWeighted ? parseWeightInput(weightsInput) : [];
    if (isWeighted && weights.length === 0) {
      setError("Enter at least one weight (e.g. 5, 10, 15)");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/equipment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        label: label.trim() || undefined,
        weightsKg: weights,
        notes: notes.trim() || undefined,
        scope,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not add item");
      return;
    }
    const data = await res.json();
    setItems((prev) => [...prev, data.item]);
    resetForm();
    setShowAdd(false);
  }

  async function removeItem(id: string) {
    if (!confirm("Remove this item?")) return;
    const res = await fetch(`/api/equipment/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <main className="mx-auto w-full max-w-md md:max-w-4xl min-h-[100dvh] flex flex-col p-6 md:px-10 md:py-10 gap-5">
      <header className="pt-2 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-[var(--fg-muted)]">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold mt-1">Equipment</h1>
          <p className="text-sm text-[var(--fg-muted)] mt-1">
            {inHousehold
              ? `Shared with ${householdName ?? "your household"}`
              : "Personal inventory"}
          </p>
        </div>
      </header>

      {items.length === 0 && !showAdd && (
        <div className="card text-center">
          <p className="text-sm text-[var(--fg-muted)]">
            No equipment yet. Add what you own — dumbbells, kettlebells, a bench,
            anything. You can come back to edit any time.
          </p>
        </div>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((it) => (
            <li key={it.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {EQUIPMENT_LABELS[it.type as EquipmentType] ?? it.type}
                    {it.label && (
                      <span className="text-[var(--fg-muted)] font-normal">
                        {" "}
                        — {it.label}
                      </span>
                    )}
                  </p>
                  {it.weightsKg.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {it.weightsKg.map((w) => (
                        <span
                          key={w}
                          className="rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-2.5 py-0.5 text-xs font-mono"
                        >
                          {w}kg
                        </span>
                      ))}
                    </div>
                  )}
                  {it.notes && (
                    <p className="text-xs text-[var(--fg-muted)] mt-2">{it.notes}</p>
                  )}
                  <p className="text-xs text-[var(--fg-muted)] mt-2">
                    {it.scope === "household" ? "Shared" : "Personal"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(it.id)}
                  aria-label="Remove"
                  className="text-[var(--fg-muted)] text-lg leading-none px-2 py-1"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showAdd ? (
        <div className="card flex flex-col gap-4">
          <h2 className="font-semibold">Add equipment</h2>
          <label className="block">
            <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EquipmentType)}
            >
              {(Object.entries(EQUIPMENT_LABELS) as [EquipmentType, string][]).map(
                ([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                )
              )}
            </select>
            {TYPE_HINTS[type] && (
              <span className="block text-xs text-[var(--fg-muted)] mt-1.5">
                {TYPE_HINTS[type]}
              </span>
            )}
          </label>

          {isWeighted && (
            <label className="block">
              <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">
                Weights (kg)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={weightsInput}
                onChange={(e) => setWeightsInput(e.target.value)}
                placeholder="e.g. 2, 5, 10"
              />
              <span className="block text-xs text-[var(--fg-muted)] mt-1.5">
                Comma- or space-separated. Each number is one available weight.
              </span>
            </label>
          )}

          <label className="block">
            <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">
              Label <span className="opacity-60">(optional)</span>
            </span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. PowerBlocks, Adjustable bench"
              maxLength={60}
            />
          </label>

          <label className="block">
            <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">
              Notes <span className="opacity-60">(optional)</span>
            </span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
            />
          </label>

          {inHousehold && (
            <fieldset>
              <legend className="block text-sm mb-1.5 text-[var(--fg-muted)]">
                Visibility
              </legend>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope("household")}
                  className={
                    "rounded-xl border px-3 py-3 text-sm " +
                    (scope === "household"
                      ? "border-[var(--accent)] bg-[var(--bg-elev)] text-white"
                      : "border-[var(--border)] bg-[var(--bg-elev)] text-[var(--fg-muted)]")
                  }
                >
                  Shared
                </button>
                <button
                  type="button"
                  onClick={() => setScope("user")}
                  className={
                    "rounded-xl border px-3 py-3 text-sm " +
                    (scope === "user"
                      ? "border-[var(--accent)] bg-[var(--bg-elev)] text-white"
                      : "border-[var(--border)] bg-[var(--bg-elev)] text-[var(--fg-muted)]")
                  }
                >
                  Personal
                </button>
              </div>
            </fieldset>
          )}

          {error && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setShowAdd(false);
                resetForm();
              }}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={addItem}
              disabled={busy}
            >
              {busy ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowAdd(true)}
        >
          + Add equipment
        </button>
      )}
    </main>
  );
}
