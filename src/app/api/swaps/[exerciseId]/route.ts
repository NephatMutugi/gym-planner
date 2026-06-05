import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inventoryFromDb } from "@/lib/equipment";
import { suggestSwaps } from "@/lib/swap";
import { EXERCISE_BY_ID } from "@/data/exercises";
import type { TrainingContext, Experience, Goal } from "@/lib/program";

// GET /api/swaps/[exerciseId]
// Returns top 3 algorithmic swap suggestions for the given exercise,
// scoped to the user's profile + equipment. Does NOT call Claude — this is
// the fast/free path. The /api/coach/swap route remains for cases where
// the user wants AI-driven reasoning.

interface EquipmentRow {
  type: string;
  weightsKg: string | null;
  label: string | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ exerciseId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { exerciseId } = await params;
  if (!EXERCISE_BY_ID[exerciseId]) {
    return NextResponse.json({ error: "Unknown exercise" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
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
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const equipmentRows = await prisma.equipment.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        user.householdId ? { householdId: user.householdId } : { id: "__never__" },
      ],
    },
    select: { type: true, weightsKg: true, label: true },
  });
  const inventory = inventoryFromDb(equipmentRows as EquipmentRow[]);

  const goals = (user.goals ? JSON.parse(user.goals) : []) as Goal[];
  const injuries = (user.injuries ? JSON.parse(user.injuries) : []) as string[];

  const suggestions = suggestSwaps(
    exerciseId,
    {
      bodyweightKg: user.bodyweightKg,
      experience: (user.experience ?? "beginner") as Experience,
      goals,
      daysPerWeek: user.daysPerWeek ?? 3,
      sessionMinutes: user.sessionMinutes ?? 45,
      injuries,
      trainingContext: (user.trainingContext ?? "general") as TrainingContext,
    },
    inventory,
    3
  );

  return NextResponse.json({ suggestions });
}
