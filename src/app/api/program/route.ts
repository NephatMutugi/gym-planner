import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateProgram,
  type Goal,
  type Experience,
  type TrainingContext,
} from "@/lib/program";
import { inventoryFromDb } from "@/lib/equipment";

type EquipmentRow = {
  type: string;
  weightsKg: string | null;
  label: string | null;
};


type ProgramDayRow = {
  id: string;
  order: number;
  label: string;
  isRestDay: boolean;
  items: ProgramItemRow[];
};
type ProgramItemRow = {
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
};

// GET /api/program → active program with days + items
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const program = await prisma.program.findFirst({
    where: { userId: session.user.id, isActive: true },
    orderBy: { generatedAt: "desc" },
    include: {
      days: {
        orderBy: { order: "asc" },
        include: { items: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!program) {
    return NextResponse.json({ program: null });
  }

  return NextResponse.json({
    program: {
      id: program.id,
      split: program.split,
      daysPerWeek: program.daysPerWeek,
      experience: program.experience,
      goals: JSON.parse(program.goalsSnapshot) as Goal[],
      generatedAt: program.generatedAt,
      days: program.days.map((d: ProgramDayRow) => ({
        id: d.id,
        order: d.order,
        label: d.label,
        isRestDay: d.isRestDay,
        items: d.items.map((it: ProgramItemRow) => ({
          id: it.id,
          order: it.order,
          exerciseId: it.exerciseId,
          sets: it.sets,
          repsMin: it.repsMin,
          repsMax: it.repsMax,
          targetLoadKg: it.targetLoadKg,
          holdSeconds: it.holdSeconds,
          restSeconds: it.restSeconds,
          notes: it.notes,
        })),
      })),
    },
  });
}

// POST /api/program → (re)generate the active program from current profile + inventory
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      onboarded: true,
      bodyweightKg: true,
      experience: true,
      goals: true,
      daysPerWeek: true,
      sessionMinutes: true,
      injuries: true,
      trainingContext: true,
      householdId: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!user.onboarded || !user.experience || !user.daysPerWeek || !user.sessionMinutes) {
    return NextResponse.json(
      { error: "Complete your profile first" },
      { status: 400 }
    );
  }

  const equipmentRows = await prisma.equipment.findMany({
    where: {
      OR: [
        { userId: user.id },
        user.householdId ? { householdId: user.householdId } : { id: "__never__" },
      ],
    },
    select: { type: true, weightsKg: true, label: true },
  });
  const inventory = inventoryFromDb(equipmentRows as EquipmentRow[]);

  const goals = (user.goals ? JSON.parse(user.goals) : []) as Goal[];
  const injuries = (user.injuries ? JSON.parse(user.injuries) : []) as string[];

  const generated = generateProgram(
    {
      bodyweightKg: user.bodyweightKg,
      experience: user.experience as Experience,
      goals,
      daysPerWeek: user.daysPerWeek,
      sessionMinutes: user.sessionMinutes,
      injuries,
      trainingContext: (user.trainingContext ?? "general") as TrainingContext,
    },
    inventory
  );

  // Deactivate previous programs, create new one
  await prisma.$transaction([
    prisma.program.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isActive: false },
    }),
    prisma.program.create({
      data: {
        userId: user.id,
        split: generated.splitId,
        daysPerWeek: generated.daysPerWeek,
        experience: generated.experience,
        goalsSnapshot: JSON.stringify(generated.goals),
        isActive: true,
        days: {
          create: generated.days.map((d, dIdx) => ({
            order: dIdx + 1,
            label: d.label,
            isRestDay: d.isRestDay,
            items: {
              create: d.items.map((it, iIdx) => ({
                order: iIdx + 1,
                exerciseId: it.exerciseId,
                sets: it.sets,
                repsMin: it.repsMin,
                repsMax: it.repsMax,
                targetLoadKg: it.targetLoadKg,
                holdSeconds: it.holdSeconds,
                restSeconds: it.restSeconds,
                notes: it.notes ?? null,
              })),
            },
          })),
        },
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
