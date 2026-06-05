import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EXERCISE_BY_ID } from "@/data/exercises";

// PUT    /api/exercises/[id]/note   body: { body }     Upsert the current user's note
// DELETE /api/exercises/[id]/note                      Clear the current user's note
//
// Notes are per-user, per-library-exercise — they persist across sessions and
// surface on every workout that includes that exercise. Empty/whitespace
// bodies are treated as a delete (so the UI doesn't have to differentiate).

const BodySchema = z.object({
  body: z.string().max(500),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: exerciseId } = await params;
  if (!EXERCISE_BY_ID[exerciseId]) {
    return NextResponse.json({ error: "Unknown exercise" }, { status: 404 });
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const body = parsed.data.body.trim();

  // Empty after trim → treat as delete so the UI has one save path.
  if (!body) {
    await prisma.exerciseNote.deleteMany({
      where: { userId: session.user.id, exerciseId },
    });
    return NextResponse.json({ note: null });
  }

  const note = await prisma.exerciseNote.upsert({
    where: {
      userId_exerciseId: { userId: session.user.id, exerciseId },
    },
    create: {
      userId: session.user.id,
      exerciseId,
      body,
    },
    update: { body },
    select: { exerciseId: true, body: true, updatedAt: true },
  });

  return NextResponse.json({ note });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: exerciseId } = await params;
  await prisma.exerciseNote.deleteMany({
    where: { userId: session.user.id, exerciseId },
  });
  return NextResponse.json({ ok: true });
}
