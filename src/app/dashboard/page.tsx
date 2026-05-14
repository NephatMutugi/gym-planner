import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { availableExercises, inventoryFromDb } from "@/lib/equipment";
import DashboardClient from "./DashboardClient";

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
    select: { id: true, type: true, weightsKg: true, label: true },
  });
  const inv = inventoryFromDb(equipmentRows);
  const exerciseCount = availableExercises(inv).length;

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
    />
  );
}
