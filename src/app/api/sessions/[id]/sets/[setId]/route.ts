import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/sessions/:id/sets/:setId — remove a set
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; setId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, setId } = await params;
  const ws = await prisma.workoutSession.findUnique({ where: { id } });
  if (!ws || ws.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const set = await prisma.setLog.findUnique({ where: { id: setId } });
  if (!set || set.sessionId !== ws.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.setLog.delete({ where: { id: setId } });
  return NextResponse.json({ ok: true });
}
