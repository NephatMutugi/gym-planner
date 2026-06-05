import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ActiveSessionClient from "./ActiveSessionClient";
import { inventoryFromDb, exercisesByPattern } from "@/lib/equipment";
import { nextPrescription, type SetLogInput, type Prescription } from "@/lib/progression";
import { EXERCISE_BY_ID, PATTERN_LABELS, type Pattern } from "@/data/exercises";
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
  // The active session view splits items by status:
  //   - PENDING / SKIPPED → render as cards (SKIPPED greyed out with undo)
  //   - REMOVED → not rendered in the main list, surfaced via the bottom undo strip
  const allItems: SessionItemRow[] = ws.items ?? [];
  const items: SessionItemRow[] = allItems.filter(
    (it: SessionItemRow) => it.status !== "REMOVED"
  );
  const removedItems = allItems
    .filter((it: SessionItemRow) => it.status === "REMOVED")
    .map((it: SessionItemRow) => ({
      id: it.id,
      name: it.exerciseId
        ? (EXERCISE_BY_ID[it.exerciseId]?.name ?? it.exerciseId)
        : (it.customName ?? "Custom exercise"),
    }));

  // Compute prescriptions w/ progression and find previous best
  const itemsWithPx = await Promise.all(
    items.map(async (it: SessionItemRow) => {
      // Custom (free-form) items have no library exercise and don't progress.
      if (!it.exerciseId) {
        return {
          programItemId: it.id,
          exerciseId: it.exerciseId ?? `custom:${it.id}`,
          customName: it.customName,
          status: it.status,
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
        customName: it.customName,
        status: it.status,
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

  // Persistent per-exercise notes. We pre-fetch all notes touching the
  // exercises in this session so the client can render them inline without
  // a roundtrip per card.
  const sessionExerciseIds = Array.from(
    new Set(
      allItems
        .map((it: SessionItemRow) => it.exerciseId)
        .filter((id: string | null): id is string => !!id)
    )
  );
  const noteRows =
    sessionExerciseIds.length > 0
      ? await prisma.exerciseNote.findMany({
          where: {
            userId: session.user.id,
            exerciseId: { in: sessionExerciseIds },
          },
          select: { exerciseId: true, body: true },
        })
      : [];
  const exerciseNotes: Record<string, string> = {};
  for (const n of noteRows as Array<{ exerciseId: string; body: string }>) {
    exerciseNotes[n.exerciseId] = n.body;
  }

  // Build library data for the Add-exercise sheet (server-side so the client
  // doesn't ship the whole exercise table).
  const grouped = exercisesByPattern(inventory);
  const libraryGroups: Array<{
    pattern: Pattern;
    label: string;
    exercises: Array<{ id: string; name: string; loadType: "loaded" | "bodyweight" | "iso" }>;
  }> = (Object.keys(grouped) as Pattern[]).map((p) => ({
    pattern: p,
    label: PATTERN_LABELS[p],
    exercises: grouped[p].map((e) => ({
      id: e.id,
      name: e.name,
      loadType: e.loadType,
    })),
  }));

  // Recent exercises: distinct, most-recently-logged library exercises for this
  // user. We pull the 60 most recent SetLog rows and dedupe — much cheaper than
  // a DISTINCT ON / window query for the small numbers in play.
  const recentLogs = await prisma.setLog.findMany({
    where: { session: { userId: session.user.id }, skipped: false },
    orderBy: { loggedAt: "desc" },
    select: { exerciseId: true },
    take: 60,
  });
  const seenRecent = new Set<string>();
  const recentExercises: Array<{ id: string; name: string }> = [];
  for (const log of recentLogs as Array<{ exerciseId: string }>) {
    if (seenRecent.has(log.exerciseId)) continue;
    const ex = EXERCISE_BY_ID[log.exerciseId];
    if (!ex) continue;
    seenRecent.add(log.exerciseId);
    recentExercises.push({ id: ex.id, name: ex.name });
    if (recentExercises.length >= 10) break;
  }

  return (
    <main className="mx-auto w-full max-w-md md:max-w-2xl min-h-[100dvh] flex flex-col p-6 md:px-10 md:py-10 gap-4">
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
        removedItems={removedItems}
        libraryGroups={libraryGroups}
        recentExercises={recentExercises}
        exerciseNotes={exerciseNotes}
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
