import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EXERCISE_BY_ID } from "@/data/exercises";

// POST /api/sessions/[id]/items
//
// Adds a new SessionItem to an in-progress workout. The body provides EITHER a
// library exercise id OR a free-form customName — never both.
//
// Defaults (when prescription fields are omitted):
//   sets: 3
//   reps: 8–12 (or holdSeconds: 30 for iso-load exercises)
//   restSeconds: 60
//   targetLoadKg: null  (user fills in per-set)
//
// The new item lands at the bottom of the session list (order = max+1) and is
// marked addedDuringSession=true so we can distinguish it from the original
// program prescription in history.

const PosInt = z.number().int().positive();

const BodySchema = z
  .object({
    exerciseId: z.string().min(1).optional(),
    customName: z.string().min(1).max(80).optional(),
    sets: PosInt.max(20).optional(),
    repsMin: PosInt.max(100).optional(),
    repsMax: PosInt.max(100).optional(),
    holdSeconds: PosInt.max(600).nullable().optional(),
    restSeconds: PosInt.max(900).optional(),
    targetLoadKg: z.number().positive().max(1000).nullable().optional(),
  })
  .refine(
    (b) => Boolean(b.exerciseId) !== Boolean(b.customName),
    { message: "Provide exactly one of exerciseId or customName" }
  )
  .refine(
    (b) =>
      b.repsMin == null || b.repsMax == null || b.repsMin <= b.repsMax,
    { message: "repsMin must be <= repsMax" }
  );

const DEFAULT_SETS = 3;
const DEFAULT_REPS_MIN = 8;
const DEFAULT_REPS_MAX = 12;
const DEFAULT_REST = 60;
const DEFAULT_HOLD_SECONDS = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const ws = await prisma.workoutSession.findUnique({
    where: { id },
    select: { id: true, userId: true, completedAt: true },
  });
  if (!ws || ws.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (ws.completedAt) {
    return NextResponse.json(
      { error: "Session is already completed" },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const data = parsed.data;

  const isLibrary = !!data.exerciseId;
  let exercise: ReturnType<typeof getEx> | null = null;
  if (isLibrary) {
    exercise = getEx(data.exerciseId!);
    if (!exercise) {
      return NextResponse.json({ error: "Unknown exercise" }, { status: 400 });
    }
  }

  // Decide between reps mode and hold mode. If body explicitly says hold, honor.
  // Otherwise, library exercises with loadType: "iso" default to hold mode.
  const isoByDefault = isLibrary && exercise?.loadType === "iso";
  const explicitHold = data.holdSeconds != null;
  const useHold = explicitHold || (isoByDefault && data.repsMin == null);

  const holdSeconds = useHold
    ? data.holdSeconds ?? DEFAULT_HOLD_SECONDS
    : null;
  const repsMin = useHold ? 0 : data.repsMin ?? DEFAULT_REPS_MIN;
  const repsMax = useHold ? 0 : data.repsMax ?? DEFAULT_REPS_MAX;

  // Next order: max + 1 within this session
  const max = await prisma.sessionItem.findFirst({
    where: { sessionId: id },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (max?.order ?? 0) + 1;

  const created = await prisma.sessionItem.create({
    data: {
      sessionId: id,
      sourceProgramItemId: null,
      exerciseId: isLibrary ? data.exerciseId! : null,
      customName: isLibrary ? null : data.customName!.trim(),
      order: nextOrder,
      sets: data.sets ?? DEFAULT_SETS,
      repsMin,
      repsMax,
      targetLoadKg: isLibrary ? data.targetLoadKg ?? null : null,
      holdSeconds,
      restSeconds: data.restSeconds ?? DEFAULT_REST,
      notes: null,
      status: "PENDING",
      addedDuringSession: true,
    },
  });

  return NextResponse.json({
    item: {
      id: created.id,
      exerciseId: created.exerciseId,
      customName: created.customName,
      order: created.order,
      sets: created.sets,
      repsMin: created.repsMin,
      repsMax: created.repsMax,
      holdSeconds: created.holdSeconds,
      restSeconds: created.restSeconds,
      targetLoadKg: created.targetLoadKg,
      status: created.status,
    },
  });
}

function getEx(id: string) {
  return EXERCISE_BY_ID[id] ?? null;
}
