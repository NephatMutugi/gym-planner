// Thin email layer. Uses Resend's HTTP API when RESEND_API_KEY is set; falls
// back to console logging so the password-reset flow works end-to-end before
// DNS / Resend is fully configured.
//
// We deliberately do NOT install the @resend/resend SDK — the HTTP surface is
// tiny and adding another dependency for one POST isn't worth it.

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface SendResult {
  ok: boolean;
  // When email isn't configured, we expose the raw content so the caller can
  // surface it via a server log line. We never expose this to the client.
  delivered: "resend" | "console" | "noop";
  error?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM_EMAIL;
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    // Console fallback. Useful during local dev and the window between feature
    // ship and Resend domain verification finishing.
    console.warn(
      `[email:DEV] to=${args.to} subject=${args.subject}\n--- BODY ---\n${args.text ?? stripHtml(args.html)}\n--- END ---`
    );
    return { ok: true, delivered: "console" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] Resend ${res.status}: ${body}`);
      return { ok: false, delivered: "noop", error: `Resend ${res.status}` };
    }
    return { ok: true, delivered: "resend" };
  } catch (err) {
    console.error("[email] Resend request failed", err);
    return { ok: false, delivered: "noop", error: "Network error" };
  }
}

// Tiny utility for the console fallback. Not safe for arbitrary HTML — only
// used on our own templates, which contain no scripts.
function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// --- Templates ---

export function passwordResetEmail(url: string, name: string | null) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const subject = "Reset your Gym Planner password";
  const text = [
    greeting,
    "",
    "We received a request to reset your Gym Planner password.",
    "Click the link below to set a new one. This link is valid for one hour and can only be used once.",
    "",
    url,
    "",
    "If you didn't request this, you can ignore this email — your password is unchanged.",
  ].join("\n");
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #0b1220;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">Reset your password</h1>
      <p style="margin: 0 0 12px;">${escapeHtml(greeting)}</p>
      <p style="margin: 0 0 16px;">We received a request to reset your Gym Planner password.</p>
      <p style="margin: 0 0 20px;">
        <a href="${url}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600;">Set a new password</a>
      </p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #475569;">Or copy and paste this URL into your browser:</p>
      <p style="margin: 0 0 20px; font-size: 13px; word-break: break-all;">${escapeHtml(url)}</p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #475569;">This link is valid for one hour and can only be used once.</p>
      <p style="margin: 0; font-size: 13px; color: #475569;">If you didn't request this, you can ignore this email — your password is unchanged.</p>
    </div>
  `;
  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
