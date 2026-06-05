"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

const REMEMBER_KEY = "gp.remember";
const EMAIL_KEY = "gp.lastEmail";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On mount, restore "remember me" state and pre-fill the email if it was
  // previously remembered. We only persist the email — never the password.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const wasRemembered = window.localStorage.getItem(REMEMBER_KEY) === "1";
      if (wasRemembered) {
        setRemember(true);
        const savedEmail = window.localStorage.getItem(EMAIL_KEY);
        if (savedEmail) setEmail(savedEmail);
      }
    } catch {
      // localStorage may be unavailable in private mode; ignore.
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (res?.error) {
      setError("Invalid email or password");
      setLoading(false);
      return;
    }
    // Persist (or clear) the "remember me" preference now that we know the
    // credentials worked.
    try {
      if (remember) {
        window.localStorage.setItem(REMEMBER_KEY, "1");
        window.localStorage.setItem(EMAIL_KEY, email);
      } else {
        window.localStorage.removeItem(REMEMBER_KEY);
        window.localStorage.removeItem(EMAIL_KEY);
      }
    } catch {
      // ignore localStorage failures
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md min-h-[100dvh] flex flex-col p-6">
      <div className="pt-10 pb-6">
        <h1 className="text-2xl font-bold">Welcome back</h1>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="block">
          <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="block">
          <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">Password</span>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{ paddingRight: "44px" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] hover:text-[var(--fg)] p-2 rounded-md inline-flex items-center justify-center"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                // Eye with slash — password is visible, click to hide
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              ) : (
                // Eye — password is hidden, click to reveal
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </label>

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--fg-muted)] select-none cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4"
              style={{ accentColor: "var(--accent)" }}
            />
            <span>Remember me</span>
          </label>
          <Link
            href="/forgot-password"
            className="text-sm text-[var(--accent)] underline"
          >
            Forgot password?
          </Link>
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary mt-2">
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-[var(--fg-muted)] text-center">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
