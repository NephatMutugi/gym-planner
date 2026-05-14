import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CreateSchema = z.object({
  action: z.literal("create"),
  name: z.string().min(1).max(60),
});

const JoinSchema = z.object({
  action: z.literal("join"),
  inviteCode: z.string().min(4).max(12),
});

const BodySchema = z.union([CreateSchema, JoinSchema]);

function randomInviteCode(): string {
  // 6-char alphanumeric, omit ambiguous chars (0/O, 1/I/L)
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (parsed.data.action === "create") {
    // Generate a unique invite code (retry on collision)
    let inviteCode = randomInviteCode();
    for (let i = 0; i < 5; i++) {
      const existing = await prisma.household.findUnique({ where: { inviteCode } });
      if (!existing) break;
      inviteCode = randomInviteCode();
    }

    const household = await prisma.household.create({
      data: { name: parsed.data.name, inviteCode },
    });
    await prisma.user.update({
      where: { id: session.user.id },
      data: { householdId: household.id },
    });
    return NextResponse.json({ household });
  }

  // Join
  const code = parsed.data.inviteCode.toUpperCase();
  const household = await prisma.household.findUnique({ where: { inviteCode: code } });
  if (!household) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { householdId: household.id },
  });
  return NextResponse.json({ household });
}

// Leave / skip household
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { householdId: null },
  });
  return NextResponse.json({ ok: true });
}
