import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AccountClient from "./AccountClient";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { household: true },
  });
  if (!user) redirect("/login");
  if (!user.onboarded) redirect("/onboarding");

  const equipmentCount = await prisma.equipment.count({
    where: {
      OR: [
        { userId: session.user.id },
        user.householdId ? { householdId: user.householdId } : { id: "__never__" },
      ],
    },
  });

  return (
    <AccountClient
      name={user.name ?? "there"}
      email={user.email}
      experience={user.experience ?? null}
      daysPerWeek={user.daysPerWeek ?? null}
      sessionMinutes={user.sessionMinutes ?? null}
      trainingContext={user.trainingContext ?? null}
      householdName={user.household?.name ?? null}
      householdInviteCode={user.household?.inviteCode ?? null}
      equipmentCount={equipmentCount}
    />
  );
}
