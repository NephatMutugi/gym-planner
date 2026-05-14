import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";


type EquipmentRow = {
  id: string;
  type: string;
  label: string | null;
  weightsKg: string | null;
  notes: string | null;
  scope?: string;
  userId: string | null;
  householdId: string | null;
  createdAt: Date;
};

const EQUIPMENT_TYPES = [
  "dumbbell",
  "kettlebell",
  "barbell",
  "plate",
  "bench",
  "pullup_bar",
  "band",
  "yoga_mat",
  "machine",
] as const;

const CreateSchema = z.object({
  type: z.enum(EQUIPMENT_TYPES),
  label: z.string().max(60).optional(),
  // Array of positive numbers in kg. Empty for non-weighted items.
  weightsKg: z.array(z.number().positive().max(500)).max(50).optional(),
  notes: z.string().max(200).optional(),
  scope: z.enum(["user", "household"]).optional(), // defaults to household if user is in one
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { householdId: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await prisma.equipment.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        user.householdId ? { householdId: user.householdId } : { id: "__never__" },
      ],
    },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    items: items.map((i: EquipmentRow) => ({
      id: i.id,
      type: i.type,
      label: i.label,
      weightsKg: i.weightsKg ? JSON.parse(i.weightsKg) : [],
      notes: i.notes,
      scope: i.householdId ? "household" : "user",
      createdAt: i.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { householdId: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Default scope: household if user has one, else user
  const scope = data.scope ?? (user.householdId ? "household" : "user");

  const item = await prisma.equipment.create({
    data: {
      type: data.type,
      label: data.label?.trim() || null,
      weightsKg:
        data.weightsKg && data.weightsKg.length > 0
          ? JSON.stringify([...data.weightsKg].sort((a, b) => a - b))
          : null,
      notes: data.notes?.trim() || null,
      userId: scope === "user" ? session.user.id : null,
      householdId: scope === "household" ? user.householdId : null,
    },
  });

  return NextResponse.json(
    {
      item: {
        id: item.id,
        type: item.type,
        label: item.label,
        weightsKg: item.weightsKg ? JSON.parse(item.weightsKg) : [],
        notes: item.notes,
        scope: item.householdId ? "household" : "user",
        createdAt: item.createdAt,
      },
    },
    { status: 201 }
  );
}
