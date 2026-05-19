import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH  /api/sessions/[id]/items/[itemId]    body: { status }
// DELETE /api/sessions/[id]/items/[itemId]    convenience alias for status=REMOVED
//
// Status transitions: any → any (so Undo from REMOVED or SKIPPED works).
// We don't allow mutations on a completed session — once finished, the snapshot
// is read-only for the history view.

const PatchSchema = z.object({
  status: z.enum(["PENDING", "SKIPPED", "REMOVED"]),
});

type Loaded =
  | { error: string; status: 401 | 404 | 409 }
  | { item: { id: string; sessionId: string; status: "PENDING" | "SKIPPED" | "REMOVED" } };

async function loadOwnedItem(
  sessionId: string,
  itemId: string,
  userId: string
): Promise<Loaded> {
  const ws = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, completedAt: true },
  });
  if (!ws || ws.userId !== userId) {
    return { error: "Not found", status: 404 };
  }
  if (ws.completedAt) {
    return { error: "Session is already completed", status: 409 };
  }
  const item = await prisma.sessionItem.findUnique({
    where: { id: itemId },
    select: { id: true, sessionId: true, status: true },
  });
  if (!item || item.sessionId !== sessionId) {
    return { error: "Item not found", status: 404 };
  }
  return { item };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, itemId } = await params;

  const loaded = await loadOwnedItem(id, itemId, session.user.id);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const updated = await prisma.sessionItem.update({
    where: { id: itemId },
    data: { status: parsed.data.status },
    select: { id: true, status: true },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, itemId } = await params;

  const loaded = await loadOwnedItem(id, itemId, session.user.id);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const updated = await prisma.sessionItem.update({
    where: { id: itemId },
    data: { status: "REMOVED" },
    select: { id: true, status: true },
  });

  return NextResponse.json({ item: updated });
}
