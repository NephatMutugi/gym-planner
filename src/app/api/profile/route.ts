import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const GENDER = ["male", "female", "other", "prefer_not_to_say"] as const;
const EXPERIENCE = ["beginner", "intermediate", "advanced"] as const;
const GOAL_OPTIONS = [
  "general_fitness",
  "strength",
  "muscle_gain",
  "fat_loss",
  "mobility",
  "endurance",
] as const;
const TRAINING_CONTEXTS = [
  "general",
  "returning_from_injury",
  "prenatal",
  "early_postpartum",
  "late_postpartum",
] as const;

const ProfileSchema = z.object({
  name: z.string().min(1).max(60),
  age: z.number().int().min(13).max(100),
  gender: z.enum(GENDER),
  heightCm: z.number().min(80).max(250),
  bodyweightKg: z.number().min(25).max(300),
  experience: z.enum(EXPERIENCE),
  goals: z.array(z.enum(GOAL_OPTIONS)).min(1).max(GOAL_OPTIONS.length),
  daysPerWeek: z.number().int().min(1).max(7),
  sessionMinutes: z.number().int().min(15).max(180),
  injuries: z.array(z.string().min(1).max(60)).max(20).default([]),
  trainingContext: z.enum(TRAINING_CONTEXTS).default("general"),
});

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: data.name,
      age: data.age,
      gender: data.gender,
      heightCm: data.heightCm,
      bodyweightKg: data.bodyweightKg,
      experience: data.experience,
      goals: JSON.stringify(data.goals),
      daysPerWeek: data.daysPerWeek,
      sessionMinutes: data.sessionMinutes,
      injuries: JSON.stringify(data.injuries),
      trainingContext: data.trainingContext,
      onboarded: true,
    },
    select: { id: true, onboarded: true },
  });

  return NextResponse.json({ user: updated });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      age: true,
      gender: true,
      heightCm: true,
      bodyweightKg: true,
      experience: true,
      goals: true,
      daysPerWeek: true,
      sessionMinutes: true,
      injuries: true,
      trainingContext: true,
      onboarded: true,
      householdId: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...user,
    goals: user.goals ? JSON.parse(user.goals) : [],
    injuries: user.injuries ? JSON.parse(user.injuries) : [],
  });
}
