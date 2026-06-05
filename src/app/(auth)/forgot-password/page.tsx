"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // The endpoint always returns 200 with the same generic message — we
      // surface that message regardless. The only way to fail here is a
      // network error.
      if (!res.ok) {
        setError("Network error. Please try again.");
        setLoading(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md min-h-[100dvh] flex flex-col p-6">
      <div className="pt-10 pb-6">
        <h1 className="text-2xl font-bold">Forgot password</h1>
        <p className="mt-2 text-[var(--fg-muted)] text-sm">
          Enter the email you signed up with and we&apos;ll send you a link to
          set a new password.
        </p>
      </div>

      {submitted ? (
        <div className="card">
          <p className="text-sm">
            If an account exists with that email, we&apos;ve sent a link to
            reset your password. The link is valid for one hour.
          </p>
          <p className="text-sm mt-3 text-[var(--fg-muted)]">
            Didn&apos;t get it? Check spam, or{" "}
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="underline text-[var(--accent)]"
            >
              try again
            </button>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="block">
            <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>

          {error && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary mt-2"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <p className="mt-6 text-sm text-[var(--fg-muted)] text-center">
        Remembered it?{" "}
        <Link href="/login" className="underline">
          Back to log in
        </Link>
      </p>
    </main>
  );
}
