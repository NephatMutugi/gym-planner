import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const UpdateSchema = z.object({
  label: z.string().max(60).nullable().optional(),
  weightsKg: z.array(z.number().positive().max(500)).max(50).optional(),
  notes: z.string().max(200).nullable().optional(),
});

async function findOwned(itemId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { householdId: true },
  });
  const item = await prisma.equipment.findUnique({ where: { id: itemId } });
  if (!item) return null;
  const owned =
    item.userId === userId ||
    (user?.householdId && item.householdId === user.householdId);
  return owned ? item : null;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const existing = await findOwned(params.id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const data = parsed.data;

  const updated = await prisma.equipment.update({
    where: { id: params.id },
    data: {
      label: data.label !== undefined ? data.label?.trim() || null : undefined,
      weightsKg:
        data.weightsKg !== undefined
          ? data.weightsKg.length > 0
            ? JSON.stringify([...data.weightsKg].sort((a, b) => a - b))
            : null
          : undefined,
      notes: data.notes !== undefined ? data.notes?.trim() || null : undefined,
    },
  });

  return NextResponse.json({
    item: {
      id: updated.id,
      type: updated.type,
      label: updated.label,
      weightsKg: updated.weightsKg ? JSON.parse(updated.weightsKg) : [],
      notes: updated.notes,
      scope: updated.householdId ? "household" : "user",
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const existing = await findOwned(params.id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.equipment.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
