import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextPrescription, type SetLogInput, type Prescription } from "@/lib/progression";
import { inventoryFromDb } from "@/lib/equipment";
import { EXERCISE_BY_ID } from "@/data/exercises";

const PatchSchema = z.object({
  completed: z.boolean().optional(),
  notes: z.string().max(500).nullable().optional(),
});

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
  notes: string | null;
  status: "PENDING" | "SKIPPED" | "REMOVED";
  addedDuringSession: boolean;
};

type EquipmentRow = {
  type: string;
  weightsKg: string | null;
  label: string | null;
};

// GET /api/sessions/:id — full session detail with prescriptions + already-logged sets
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ws = await prisma.workoutSession.findUnique({
    where: { id },
    include: {
      sets: { orderBy: [{ exerciseId: "asc" }, { setNumber: "asc" }] },
      items: { orderBy: { order: "asc" } },
      programDay: {
        select: {
          label: true,
          program: { select: { id: true } },
        },
      },
    },
  });
  if (!ws || ws.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Build prescriptions for each session item using progression logic
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

  // Hide REMOVED items from the session view. SKIPPED items stay visible so
  // the user can undo them.
  const items: SessionItemRow[] = (ws.items ?? []).filter(
    (it: SessionItemRow) => it.status !== "REMOVED"
  );

  // For each item, look up the most recent completed session that logged this exercise
  // (excluding this session itself) and apply progression.
  const prescriptions = await Promise.all(
    items.map(async (it: SessionItemRow) => {
      // Custom (free-form) items don't progress and have no library exercise.
      if (!it.exerciseId) {
        return {
          sessionItemId: it.id,
          programItemId: it.sourceProgramItemId,
          order: it.order,
          exerciseId: null,
          customName: it.customName,
          sets: it.sets,
          status: it.status,
          addedDuringSession: it.addedDuringSession,
          prescription: {
            targetLoadKg: it.targetLoadKg,
            repsMin: it.repsMin,
            repsMax: it.repsMax,
            holdSeconds: it.holdSeconds,
          },
          previousBest: null,
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
      const next = exercise
        ? nextPrescription(exercise, current, lastSets, inventory)
        : current;
      return {
        sessionItemId: it.id,
        programItemId: it.sourceProgramItemId,
        order: it.order,
        exerciseId: it.exerciseId,
        customName: null,
        sets: it.sets,
        status: it.status,
        addedDuringSession: it.addedDuringSession,
        prescription: next,
        previousBest:
          previous && lastSets.length > 0
            ? {
                weightKg: lastSets[0].weightKg,
                reps: lastSets[0].reps,
                holdSeconds: lastSets[0].holdSeconds,
                loggedAt: previous.completedAt,
              }
            : null,
        restSeconds: it.restSeconds,
      };
    })
  );

  return NextResponse.json({
    session: {
      id: ws.id,
      startedAt: ws.startedAt,
      completedAt: ws.completedAt,
      notes: ws.notes,
      dayLabel: ws.programDay?.label ?? "Workout",
      programId: ws.programDay?.program?.id ?? null,
      hasRemovedItems: (ws.items ?? []).some(
        (it: SessionItemRow) => it.status === "REMOVED"
      ),
    },
    items: prescriptions,
    sets: ws.sets.map((s: SetRow) => ({
      id: s.id,
      exerciseId: s.exerciseId,
      setNumber: s.setNumber,
      weightKg: s.weightKg,
      reps: s.reps,
      holdSeconds: s.holdSeconds,
      rpe: s.rpe,
      skipped: s.skipped,
      notes: s.notes,
    })),
  });
}

// PATCH /api/sessions/:id — complete the session, add notes
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ws = await prisma.workoutSession.findUnique({ where: { id } });
  if (!ws || ws.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const updated = await prisma.workoutSession.update({
    where: { id },
    data: {
      completedAt:
        parsed.data.completed === true
          ? new Date()
          : parsed.data.completed === false
            ? null
            : undefined,
      notes:
        parsed.data.notes !== undefined ? parsed.data.notes : undefined,
    },
  });

  return NextResponse.json({
    session: {
      id: updated.id,
      startedAt: updated.startedAt,
      completedAt: updated.completedAt,
      notes: updated.notes,
    },
  });
}

// DELETE /api/sessions/:id — discard a session
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const ws = await prisma.workoutSession.findUnique({ where: { id } });
  if (!ws || ws.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.workoutSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
