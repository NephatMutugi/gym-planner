import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { consume, PASSWORD_RESET_REQUEST_LIMIT } from "@/lib/rate-limit";
import { sendEmail, passwordResetEmail } from "@/lib/email";

// POST /api/auth/password-reset/request   body: { email }
//
// Always returns 200 with the same shape regardless of whether the email
// matches an account, to prevent account enumeration.
//
// Side effects when a matching user exists:
//   - Invalidate (mark used) any prior unused tokens for that user.
//   - Generate a 32-byte token, store its SHA-256, expire in 1h.
//   - Send the user an email with a single-use link.

const Schema = z.object({
  email: z.string().email().max(200),
});

const GENERIC_RESPONSE = {
  ok: true,
  message:
    "If an account exists with that email, we've sent a link to reset your password.",
};

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest) {
  // Rate limit by IP — guards against an attacker enumerating addresses from
  // a single source. The token-bucket limiter is per-process so it's a soft
  // guard on serverless; better than nothing for a personal app.
  const ip = clientIp(req);
  const ipBucket = consume(`pwreset:req:ip:${ip}`, PASSWORD_RESET_REQUEST_LIMIT);
  if (!ipBucket.ok) {
    return NextResponse.json(GENERIC_RESPONSE, {
      status: 200,
      headers: { "Retry-After": String(ipBucket.retryAfterSec) },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    // Treat malformed JSON as generic success — never leak the reason.
    return NextResponse.json(GENERIC_RESPONSE);
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(GENERIC_RESPONSE);
  }
  const email = parsed.data.email.toLowerCase().trim();

  // Second bucket by email so a single attacker can't repeatedly probe the
  // same address from rotated IPs.
  const emailBucket = consume(
    `pwreset:req:email:${email}`,
    PASSWORD_RESET_REQUEST_LIMIT
  );
  if (!emailBucket.ok) {
    return NextResponse.json(GENERIC_RESPONSE);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    // Don't leak existence. Return the same payload as success.
    console.warn(`[pwreset] request for unknown email ${email}`);
    return NextResponse.json(GENERIC_RESPONSE);
  }

  // Build the token. Plaintext token only ever leaves the server in the email.
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  // Invalidate prior outstanding tokens for this user. This is "mark used"
  // rather than delete so audit trails are preserved.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const appUrl =
    process.env.APP_URL?.replace(/\/+$/, "") || originFromRequest(req);
  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

  const { subject, html, text } = passwordResetEmail(resetUrl, user.name);
  const sent = await sendEmail({ to: user.email, subject, html, text });
  if (!sent.ok) {
    // We've already created the token; log loudly so we can intervene
    // manually. Still return generic success.
    console.error(
      `[pwreset] email send failed for ${user.email}: ${sent.error ?? "unknown"}`
    );
  } else {
    console.log(
      `[pwreset] sent via ${sent.delivered} to ${user.email} (expires ${expiresAt.toISOString()})`
    );
  }

  return NextResponse.json(GENERIC_RESPONSE);
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function originFromRequest(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
