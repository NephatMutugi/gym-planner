import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SetSchema = z.object({
  exerciseId: z.string(),
  setNumber: z.number().int().min(1).max(20),
  weightKg: z.number().min(0).max(500).nullable().optional(),
  reps: z.number().int().min(0).max(200).nullable().optional(),
  holdSeconds: z.number().int().min(0).max(600).nullable().optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  skipped: z.boolean().optional(),
  notes: z.string().max(200).nullable().optional(),
  programItemId: z.string().nullable().optional(),
});

// POST /api/sessions/:id/sets — upsert a set by (sessionId, exerciseId, setNumber)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const parsed = SetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Upsert by (session, exercise, setNumber)
  const existing = await prisma.setLog.findFirst({
    where: {
      sessionId: ws.id,
      exerciseId: data.exerciseId,
      setNumber: data.setNumber,
    },
  });

  const payload = {
    sessionId: ws.id,
    exerciseId: data.exerciseId,
    setNumber: data.setNumber,
    weightKg: data.weightKg ?? null,
    reps: data.reps ?? null,
    holdSeconds: data.holdSeconds ?? null,
    rpe: data.rpe ?? null,
    skipped: data.skipped ?? false,
    notes: data.notes ?? null,
    programItemId: data.programItemId ?? null,
  };

  const saved = existing
    ? await prisma.setLog.update({ where: { id: existing.id }, data: payload })
    : await prisma.setLog.create({ data: payload });

  return NextResponse.json({
    set: {
      id: saved.id,
      exerciseId: saved.exerciseId,
      setNumber: saved.setNumber,
      weightKg: saved.weightKg,
      reps: saved.reps,
      holdSeconds: saved.holdSeconds,
      rpe: saved.rpe,
      skipped: saved.skipped,
      notes: saved.notes,
    },
  });
}
