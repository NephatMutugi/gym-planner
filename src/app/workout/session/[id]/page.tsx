import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ActiveSessionClient from "./ActiveSessionClient";
import { inventoryFromDb } from "@/lib/equipment";
import { nextPrescription, type SetLogInput, type Prescription } from "@/lib/progression";
import { EXERCISE_BY_ID } from "@/data/exercises";
import { isClaudeConfigured } from "@/lib/claude";

type EquipmentRow = {
  type: string;
  weightsKg: string | null;
  label: string | null;
};

type SessionItemRow = {
  id: string;
  sourceProgramItemId: string | null;
  exerciseId: string | null;
  customName: string | null;
  order: number;
  sets: number;
  repsMin: number;
  repsMax: number;
  targetLoadKg: number | null;
  holdSeconds: number | null;
  restSeconds: number;
  status: "PENDING" | "SKIPPED" | "REMOVED";
};

type SetRow = {
  id: string;
  exerciseId: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  holdSeconds: number | null;
  rpe: number | null;
  skipped: boolean;
  notes: string | null;
};

export default async function ActiveSessionPage({
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
      sets: { orderBy: [{ exerciseId: "asc" }, { setNumber: "asc" }] },
      items: { orderBy: { order: "asc" } },
      programDay: { select: { label: true } },
    },
  });
  if (!ws || ws.userId !== session.user.id) redirect("/workout");

  // Legacy sessions (created before the snapshot pattern) may not have
  // SessionItem rows yet. Snapshot lazily on read so the user can keep working
  // while the backfill catches up. Skips silently if items already exist.
  if ((ws.items?.length ?? 0) === 0 && ws.programDayId) {
    const dayItems = await prisma.programItem.findMany({
      where: { dayId: ws.programDayId },
      orderBy: { order: "asc" },
    });
    if (dayItems.length > 0) {
      await prisma.sessionItem.createMany({
        data: dayItems.map((it: {
          id: string;
          order: number;
          exerciseId: string;
          sets: number;
          repsMin: number;
          repsMax: number;
          targetLoadKg: number | null;
          holdSeconds: number | null;
          restSeconds: number;
          notes: string | null;
        }) => ({
          sessionId: ws.id,
          sourceProgramItemId: it.id,
          exerciseId: it.exerciseId,
          order: it.order,
          sets: it.sets,
          repsMin: it.repsMin,
          repsMax: it.repsMax,
          targetLoadKg: it.targetLoadKg,
          holdSeconds: it.holdSeconds,
          restSeconds: it.restSeconds,
          notes: it.notes,
        })),
      });
      // Refresh items into the local ws object
      ws.items = await prisma.sessionItem.findMany({
        where: { sessionId: ws.id },
        orderBy: { order: "asc" },
      });
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { householdId: true },
  });
  const equipmentRows = await prisma.equipment.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        user?.householdId ? { householdId: user.householdId } : { id: "__never__" },
      ],
    },
    select: { type: true, weightsKg: true, label: true },
  });
  const inventory = inventoryFromDb(equipmentRows as EquipmentRow[]);
  // Hide REMOVED items from the active session view. SKIPPED items stay visible
  // so the user can undo them.
  const items: SessionItemRow[] = (ws.items ?? []).filter(
    (it: SessionItemRow) => it.status !== "REMOVED"
  );

  // Compute prescriptions w/ progression and find previous best
  const itemsWithPx = await Promise.all(
    items.map(async (it: SessionItemRow) => {
      // Custom (free-form) items have no library exercise and don't progress.
      if (!it.exerciseId) {
        return {
          programItemId: it.id,
          exerciseId: it.exerciseId ?? `custom:${it.id}`,
          sets: it.sets,
          prescription: {
            targetLoadKg: it.targetLoadKg,
            repsMin: it.repsMin,
            repsMax: it.repsMax,
            holdSeconds: it.holdSeconds,
          },
          previous: null,
          restSeconds: it.restSeconds,
        };
      }
      const previous = await prisma.workoutSession.findFirst({
        where: {
          userId: session.user.id,
          completedAt: { not: null },
          id: { not: ws.id },
          sets: { some: { exerciseId: it.exerciseId, skipped: false } },
        },
        orderBy: { completedAt: "desc" },
        include: {
          sets: {
            where: { exerciseId: it.exerciseId, skipped: false },
            orderBy: { setNumber: "asc" },
          },
        },
      });
      const lastSets: SetLogInput[] = (previous?.sets ?? []).map((s: SetRow) => ({
        weightKg: s.weightKg,
        reps: s.reps,
        holdSeconds: s.holdSeconds,
        skipped: s.skipped,
      }));
      const exercise = EXERCISE_BY_ID[it.exerciseId];
      const current: Prescription = {
        targetLoadKg: it.targetLoadKg,
        repsMin: it.repsMin,
        repsMax: it.repsMax,
        holdSeconds: it.holdSeconds,
      };
      const px = exercise
        ? nextPrescription(exercise, current, lastSets, inventory)
        : current;
      return {
        // Keep the prop name "programItemId" for backward compat with
        // ActiveSessionClient. The id we send is the SessionItem.id, which is
        // the stable per-session identifier going forward.
        programItemId: it.id,
        exerciseId: it.exerciseId,
        sets: it.sets,
        prescription: px,
        previous:
          previous && lastSets.length > 0
            ? {
                weightKg: lastSets[0].weightKg,
                reps: lastSets[0].reps,
                holdSeconds: lastSets[0].holdSeconds,
                date: previous.completedAt,
              }
            : null,
        restSeconds: it.restSeconds,
      };
    })
  );

  return (
    <main className="mx-auto max-w-md min-h-[100dvh] flex flex-col p-6 gap-4">
      <header className="pt-2">
        <Link href="/workout" className="text-sm text-[var(--fg-muted)]">
          ← Workout
        </Link>
        <h1 className="text-2xl font-bold mt-1">
          {ws.programDay?.label ?? "Workout"}
        </h1>
        <p className="text-xs text-[var(--fg-muted)] mt-1">
          {ws.completedAt ? "Completed" : "In progress"}
        </p>
      </header>

      <ActiveSessionClient
        sessionId={ws.id}
        claudeEnabled={isClaudeConfigured()}
        completed={!!ws.completedAt}
        initialNotes={ws.notes ?? ""}
        items={itemsWithPx}
        loggedSets={ws.sets.map((s: SetRow) => ({
          id: s.id,
          exerciseId: s.exerciseId,
          setNumber: s.setNumber,
          weightKg: s.weightKg,
          reps: s.reps,
          holdSeconds: s.holdSeconds,
          rpe: s.rpe,
          skipped: s.skipped,
        }))}
      />
    </main>
  );
}
