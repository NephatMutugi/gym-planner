import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { consume, PASSWORD_RESET_COMPLETE_LIMIT } from "@/lib/rate-limit";

// POST /api/auth/password-reset/complete   body: { token, password }
//
// Validates the token, updates the user's password, marks token used, and
// stamps passwordChangedAt so existing sessions on other devices are
// invalidated by the JWT callback.
//
// Unlike the request endpoint, we DO return real error states here — the
// caller already has the token, so we're not exposing additional info by
// telling them "expired" vs "already used".

const Schema = z.object({
  token: z.string().min(20).max(200),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const bucket = consume(`pwreset:complete:ip:${ip}`, PASSWORD_RESET_COMPLETE_LIMIT);
  if (!bucket.ok) {
    return NextResponse.json(
      { error: `Slow down — try again in ${bucket.retryAfterSec}s` },
      { status: 429, headers: { "Retry-After": String(bucket.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { token, password } = parsed.data;

  // Hash the supplied token and look up by hash. Constant-time-ish via index.
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!row) {
    return NextResponse.json(
      { error: "This reset link is invalid. Request a new one." },
      { status: 400 }
    );
  }
  if (row.usedAt) {
    return NextResponse.json(
      { error: "This reset link has already been used. Request a new one." },
      { status: 400 }
    );
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "This reset link has expired. Request a new one." },
      { status: 400 }
    );
  }

  const newHash = await bcrypt.hash(password, 12);
  const now = new Date();

  // Wrap in a transaction so a partial failure can't leave the token marked
  // used but the password unchanged (or vice versa).
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash: newHash, passwordChangedAt: now },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: now },
    }),
    // Best effort: mark any other outstanding tokens used so a stolen-but-
    // unused link can't be redeemed after the legitimate reset.
    prisma.passwordResetToken.updateMany({
      where: { userId: row.userId, usedAt: null, NOT: { id: row.id } },
      data: { usedAt: now },
    }),
  ]);

  console.log(`[pwreset] password reset completed for user ${row.userId}`);

  return NextResponse.json({ ok: true });
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
