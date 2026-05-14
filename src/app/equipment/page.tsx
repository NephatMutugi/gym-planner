import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EquipmentClient from "./EquipmentClient";


type EquipmentRow = {
  id: string;
  type: string;
  label: string | null;
  weightsKg: string | null;
  notes: string | null;
  userId: string | null;
  householdId: string | null;
};

export default async function EquipmentPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { householdId: true, household: { select: { name: true } } },
  });
  if (!user) redirect("/login");

  const items = await prisma.equipment.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        user.householdId ? { householdId: user.householdId } : { id: "__never__" },
      ],
    },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });

  return (
    <EquipmentClient
      initialItems={items.map((i: EquipmentRow) => ({
        id: i.id,
        type: i.type,
        label: i.label,
        weightsKg: i.weightsKg ? JSON.parse(i.weightsKg) : [],
        notes: i.notes,
        scope: i.householdId ? "household" : "user",
      }))}
      inHousehold={!!user.householdId}
      householdName={user.household?.name ?? null}
    />
  );
}
