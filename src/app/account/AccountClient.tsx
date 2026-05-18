"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import ThemeToggle from "@/components/ThemeToggle";

type Props = {
  name: string;
  email: string;
  experience: string | null;
  daysPerWeek: number | null;
  sessionMinutes: number | null;
  postpartumWeeks: number | null;
  householdName: string | null;
  householdInviteCode: string | null;
  equipmentCount: number;
};

export default function AccountClient(props: Props) {
  return (
    <main className="mx-auto w-full max-w-md md:max-w-4xl min-h-[100dvh] flex flex-col p-6 md:px-10 md:py-10 pt-12 gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-[var(--fg-muted)] mt-1">{props.email}</p>
      </header>

      {/* Profile summary card */}
      <section className="card">
        <p className="font-semibold">{props.name}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-[var(--fg-muted)]">Experience</dt>
          <dd className="text-right capitalize">{props.experience ?? "—"}</dd>

          <dt className="text-[var(--fg-muted)]">Schedule</dt>
          <dd className="text-right">
            {props.daysPerWeek != null
              ? `${props.daysPerWeek}× / week`
              : "—"}
            {props.sessionMinutes != null && (
              <span className="text-[var(--fg-muted)]"> · {props.sessionMinutes}m</span>
            )}
          </dd>

          {props.postpartumWeeks != null && (
            <>
              <dt className="text-[var(--fg-muted)]">Postpartum</dt>
              <dd className="text-right">{props.postpartumWeeks} weeks</dd>
            </>
          )}

          {props.householdName && (
            <>
              <dt className="text-[var(--fg-muted)]">Household</dt>
              <dd className="text-right">{props.householdName}</dd>
            </>
          )}
        </dl>
        <Link
          href="/onboarding"
          className="mt-4 inline-block text-sm text-[var(--accent)] underline"
        >
          Edit profile
        </Link>
      </section>

      {/* Nav rows */}
      <section className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)] px-1">
          Setup
        </p>
        <NavRow
          href="/equipment"
          title="Equipment"
          subtitle={`${props.equipmentCount} items`}
        />
        <NavRow
          href="/exercises"
          title="Exercise library"
          subtitle="Browse what you can do with your gear"
        />
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)] px-1">
          Progress
        </p>
        <NavRow
          href="/insights"
          title="Insights"
          subtitle="Volume, streaks, and trends"
        />
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)] px-1">
          Appearance
        </p>
        <div className="card flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold">Theme</p>
            <p className="text-xs text-[var(--fg-muted)] mt-0.5">
              Auto follows your device&apos;s setting.
            </p>
          </div>
          <ThemeToggle />
        </div>
      </section>

      {props.householdInviteCode && (
        <section className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)] px-1">
            Household
          </p>
          <div className="card">
            <p className="text-sm text-[var(--fg-muted)]">Invite code</p>
            <p className="font-mono text-lg mt-0.5">
              {props.householdInviteCode}
            </p>
            <p className="text-xs text-[var(--fg-muted)] mt-2">
              Share this code with your partner so they can join the household.
            </p>
          </div>
        </section>
      )}

      <section className="mt-2">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          Sign out
        </button>
      </section>
    </main>
  );
}

function NavRow({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="card flex items-center justify-between gap-3 hover:bg-[var(--bg)] transition-colors"
    >
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-[var(--fg-muted)] mt-0.5">{subtitle}</p>
      </div>
      <span
        aria-hidden="true"
        className="text-[var(--fg-muted)] text-xl leading-none"
      >
        ›
      </span>
    </Link>
  );
}
