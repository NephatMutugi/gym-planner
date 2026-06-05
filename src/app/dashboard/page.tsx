import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { availableExercises, inventoryFromDb } from "@/lib/equipment";
import { isClaudeConfigured } from "@/lib/claude";
import DashboardClient from "./DashboardClient";

type EquipmentRow = {
  type: string;
  weightsKg: string | null;
  label: string | null;
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { household: true },
  });
  if (!user) redirect("/login");
  if (!user.onboarded) redirect("/onboarding");

  const goals: string[] = user.goals ? JSON.parse(user.goals) : [];
  const injuries: string[] = user.injuries ? JSON.parse(user.injuries) : [];

  // Counts for nav cards
  const equipmentRows = await prisma.equipment.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        user.householdId ? { householdId: user.householdId } : { id: "__never__" },
      ],
    },
    select: { type: true, weightsKg: true, label: true },
  });
  const inv = inventoryFromDb(equipmentRows as EquipmentRow[]);
  const exerciseCount = availableExercises(inv).length;

  // Active program (for the Workout nav row)
  const program = await prisma.program.findFirst({
    where: { userId: session.user.id, isActive: true },
    select: {
      split: true,
      daysPerWeek: true,
      days: { select: { id: true }, orderBy: { order: "asc" } },
    },
  });

  // Has an in-progress workout session? Drives the "Resume workout" cue on the
  // dashboard's Workout card.
  const activeSessionCount = await prisma.workoutSession.count({
    where: {
      userId: session.user.id,
      completedAt: null,
    },
  });

  return (
    <DashboardClient
      name={user.name ?? "there"}
      email={user.email}
      profile={{
        age: user.age ?? null,
        gender: user.gender ?? null,
        heightCm: user.heightCm ?? null,
        bodyweightKg: user.bodyweightKg ?? null,
        experience: user.experience ?? null,
        goals,
        daysPerWeek: user.daysPerWeek ?? null,
        sessionMinutes: user.sessionMinutes ?? null,
        injuries,
      }}
      householdName={user.household?.name ?? null}
      householdInviteCode={user.household?.inviteCode ?? null}
      equipmentCount={equipmentRows.length}
      exerciseCount={exerciseCount}
      hasProgram={!!program}
      hasActiveSession={activeSessionCount > 0}
      programSplit={program ? formatSplit(program.split) : null}
      programDayCount={program?.days.length ?? 0}
      claudeEnabled={isClaudeConfigured()}
    />
  );
}

// "full_body_3x" → "Full body 3x". Keeps shorthand like "3x" lowercase
// because uppercasing every word would yield "Full Body 3X" — yuck.
function formatSplit(raw: string): string {
  const spaced = raw.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
