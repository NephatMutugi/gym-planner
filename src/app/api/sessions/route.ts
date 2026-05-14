import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ProgramItemRow = {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  targetLoadKg: number | null;
  holdSeconds: number | null;
  restSeconds: number;
};

type SessionRow = {
  id: string;
  startedAt: Date;
  completedAt: Date | null;
};

const StartSchema = z.object({
  programDayId: z.string(),
});

// POST /api/sessions — start (or resume) a session for a program day.
// If an active (incomplete) session already exists for this user + day, return it.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const parsed = StartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Verify the day belongs to a program owned by this user
  const day = await prisma.programDay.findUnique({
    where: { id: parsed.data.programDayId },
    include: { program: { select: { userId: true } } },
  });
  if (!day || day.program.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Existing active session for this exact day?
  const existing = await prisma.workoutSession.findFirst({
    where: {
      userId: session.user.id,
      programDayId: parsed.data.programDayId,
      completedAt: null,
    },
    orderBy: { startedAt: "desc" },
  });
  if (existing) {
    return NextResponse.json({ session: { id: existing.id } });
  }

  const created = await prisma.workoutSession.create({
    data: {
      userId: session.user.id,
      programDayId: parsed.data.programDayId,
    },
  });
  return NextResponse.json({ session: { id: created.id } }, { status: 201 });
}

// GET /api/sessions — list sessions for the current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.workoutSession.findMany({
    where: { userId: session.user.id },
    orderBy: { startedAt: "desc" },
    take: 100,
    include: {
      programDay: { select: { label: true } },
      _count: { select: { sets: true } },
    },
  });

  return NextResponse.json({
    sessions: items.map((s: { id: string; startedAt: Date; completedAt: Date | null; programDay: { label: string } | null; _count: { sets: number }; notes: string | null }) => ({
      id: s.id,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      label: s.programDay?.label ?? "Workout",
      setsLogged: s._count.sets,
      notes: s.notes,
    })),
  });
}

// Keep types referenced by import in other files happy
export type _Unused = ProgramItemRow | SessionRow;
