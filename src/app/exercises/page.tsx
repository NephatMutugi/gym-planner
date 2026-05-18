import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { availableExercises, inventoryFromDb } from "@/lib/equipment";
import {
  EQUIPMENT_LABELS,
  MUSCLE_LABELS,
  PATTERN_LABELS,
  type EquipmentType,
  type Muscle,
  type Pattern,
} from "@/data/exercises";


type EquipmentRow = {
  type: string;
  weightsKg: string | null;
  label: string | null;
};

export default async function ExercisesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { householdId: true },
  });
  if (!user) redirect("/login");

  const equipmentRows = await prisma.equipment.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        user.householdId ? { householdId: user.householdId } : { id: "__never__" },
      ],
    },
  });

  const inv = inventoryFromDb(
    equipmentRows.map((e: EquipmentRow) => ({
      type: e.type,
      weightsKg: e.weightsKg,
      label: e.label,
    }))
  );

  const exercises = availableExercises(inv);

  // Group by pattern, preserving the order from PATTERN_LABELS
  const patterns = Object.keys(PATTERN_LABELS) as Pattern[];
  const grouped: { pattern: Pattern; items: typeof exercises }[] = [];
  for (const p of patterns) {
    const items = exercises.filter((e) => e.pattern === p);
    if (items.length > 0) grouped.push({ pattern: p, items });
  }

  return (
    <main className="mx-auto w-full max-w-md md:max-w-5xl min-h-[100dvh] flex flex-col p-6 md:px-10 md:py-10 gap-5">
      <header className="pt-2">
        <Link href="/dashboard" className="text-sm text-[var(--fg-muted)]">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold mt-1">Exercises</h1>
        <p className="text-sm text-[var(--fg-muted)] mt-1">
          {exercises.length} exercises you can do with what you own
        </p>
      </header>

      {inv.length === 0 && (
        <div className="card">
          <p className="text-sm">
            You haven&apos;t added any equipment yet. Until you do, only
            bodyweight movements are shown.
          </p>
          <Link href="/equipment" className="btn btn-primary mt-3">
            Add equipment
          </Link>
        </div>
      )}

      {grouped.map(({ pattern, items }) => (
        <section key={pattern}>
          <h2 className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-2 px-1">
            {PATTERN_LABELS[pattern]} · {items.length}
          </h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {items.map((ex) => (
              <li key={ex.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{ex.name}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {ex.primaryMuscles.map((m) => (
                        <span
                          key={m}
                          className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--fg-muted)]"
                        >
                          {MUSCLE_LABELS[m as Muscle]}
                        </span>
                      ))}
                    </div>
                    {ex.equipment.length > 0 && (
                      <p className="text-xs text-[var(--fg-muted)] mt-2">
                        {ex.equipment
                          .map((t) => EQUIPMENT_LABELS[t as EquipmentType])
                          .join(" · ")}
                      </p>
                    )}
                    {ex.equipment.length === 0 && (
                      <p className="text-xs text-[var(--fg-muted)] mt-2">
                        Bodyweight
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">
                      Level
                    </span>
                    <span className="font-mono text-sm">
                      {"●".repeat(ex.difficulty)}
                      <span className="opacity-30">
                        {"●".repeat(3 - ex.difficulty)}
                      </span>
                    </span>
                  </div>
                </div>
                {ex.cues.length > 0 && (
                  <ul className="mt-3 pl-4 text-xs text-[var(--fg-muted)] list-disc space-y-1">
                    {ex.cues.slice(0, 3).map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
