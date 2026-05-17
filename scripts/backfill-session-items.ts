/**
 * One-shot backfill: snapshot ProgramItems into SessionItem rows for every
 * WorkoutSession that doesn't yet have any items, then link each existing
 * SetLog to the matching SessionItem by exerciseId.
 *
 * Idempotent: safe to re-run. Skips sessions that already have SessionItems,
 * and skips SetLogs that already have sessionItemId set.
 *
 * Run with:
 *   npx tsx scripts/backfill-session-items.ts
 * or:
 *   npx ts-node scripts/backfill-session-items.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Backfill: starting…");

  // 1) For each session without SessionItems, snapshot from its program day.
  const sessions = await prisma.workoutSession.findMany({
    where: { items: { none: {} } },
    select: { id: true, programDayId: true },
  });
  console.log(`Backfill: ${sessions.length} sessions need snapshotting.`);

  let snapped = 0;
  for (const s of sessions) {
    if (!s.programDayId) {
      console.log(`  skip session ${s.id} (no programDayId)`);
      continue;
    }
    const dayItems = await prisma.programItem.findMany({
      where: { dayId: s.programDayId },
      orderBy: { order: "asc" },
    });
    if (dayItems.length === 0) {
      console.log(`  skip session ${s.id} (program day has no items)`);
      continue;
    }
    await prisma.sessionItem.createMany({
      data: dayItems.map((it) => ({
        sessionId: s.id,
        sourceProgramItemId: it.id,
        exerciseId: it.exerciseId,
        order: it.order,
        sets: it.sets,
        repsMin: it.repsMin,
        repsMax: it.repsMax,
        targetLoadKg: it.targetLoadKg,
        holdSeconds: it.holdSeconds,
        restSeconds: it.restSeconds,
        notes: it.notes,
      })),
    });
    snapped++;
  }
  console.log(`Backfill: snapshotted ${snapped} sessions.`);

  // 2) Link existing SetLog rows to their SessionItem by (sessionId, exerciseId).
  // We pick the lowest-order SessionItem matching the exerciseId for that session.
  const unlinkedSets = await prisma.setLog.findMany({
    where: { sessionItemId: null },
    select: { id: true, sessionId: true, exerciseId: true },
  });
  console.log(`Backfill: ${unlinkedSets.length} SetLogs need linking.`);

  let linked = 0;
  for (const set of unlinkedSets) {
    const match = await prisma.sessionItem.findFirst({
      where: { sessionId: set.sessionId, exerciseId: set.exerciseId },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    if (!match) continue;
    await prisma.setLog.update({
      where: { id: set.id },
      data: { sessionItemId: match.id },
    });
    linked++;
  }
  console.log(`Backfill: linked ${linked} SetLogs.`);

  console.log("Backfill: done.");
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
