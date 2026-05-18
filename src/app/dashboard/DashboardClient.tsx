"use client";

import { useState } from "react";

import Link from "next/link";
import { signOut } from "next-auth/react";
import CoachSheet from "@/components/CoachSheet";

type Profile = {
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  bodyweightKg: number | null;
  experience: string | null;
  goals: string[];
  daysPerWeek: number | null;
  sessionMinutes: number | null;
  injuries: string[];
};

export default function DashboardClient({
  name,
  email,
  profile,
  householdName,
  householdInviteCode,
  equipmentCount,
  exerciseCount,
  hasProgram,
  programSplit,
  programDayCount,
  claudeEnabled,
}: {
  name: string;
  email: string;
  profile: Profile;
  householdName: string | null;
  householdInviteCode: string | null;
  equipmentCount: number;
  exerciseCount: number;
  hasProgram: boolean;
  programSplit: string | null;
  programDayCount: number;
  claudeEnabled: boolean;
}) {

  const [checkinOpen, setCheckinOpen] = useState(false);

  async function fetchCheckin() {
    const res = await fetch("/api/coach/weekly-checkin", { method: "POST" });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "Could not load check-in" };
    return { text: data.text };
  }

  return (
    <main className="mx-auto w-full max-w-md md:max-w-5xl min-h-[100dvh] flex flex-col p-6 md:px-10 md:py-10 gap-5">
      <header className="pt-4 flex items-start justify-between">
        <div>
          <p className="text-sm text-[var(--fg-muted)]">Welcome back,</p>
          <h1 className="text-2xl md:text-3xl font-bold">{name}</h1>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-sm text-[var(--fg-muted)] underline md:hidden"
        >
          Sign out
        </button>
      </header>

      <nav className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link
          href="/workout"
          className="card flex items-center justify-between gap-3 cursor-pointer hover:border-[var(--accent)] active:opacity-80 transition-colors"
        >
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              Workout
            </p>
            <p className="mt-1 font-semibold">
              {hasProgram
                ? `${programSplit} · ${programDayCount} days`
                : "Generate your program"}
            </p>
          </div>
          <span aria-hidden className="text-[var(--accent)] text-xl leading-none">
            →
          </span>
        </Link>


        {claudeEnabled && (
          <button
            type="button"
            onClick={() => setCheckinOpen(true)}
            className="card flex items-center justify-between gap-3 cursor-pointer hover:border-[var(--accent)] active:opacity-80 transition-colors w-full text-left"
          >
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                Weekly check-in
              </p>
              <p className="mt-1 font-semibold">How am I doing?</p>
            </div>
            <span aria-hidden className="text-[var(--accent)] text-xl leading-none">
              →
            </span>
          </button>
        )}

        <Link
          href="/equipment"
          className="card flex items-center justify-between gap-3 cursor-pointer hover:border-[var(--accent)] active:opacity-80 transition-colors"
        >
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              Equipment
            </p>
            <p className="mt-1 font-semibold">
              {equipmentCount === 0
                ? "Add what you own"
                : `${equipmentCount} ${equipmentCount === 1 ? "item" : "items"}`}
            </p>
          </div>
          <span aria-hidden className="text-[var(--accent)] text-xl leading-none">
            →
          </span>
        </Link>



        <Link
          href="/insights"
          className="card flex items-center justify-between gap-3 cursor-pointer hover:border-[var(--accent)] active:opacity-80 transition-colors"
        >
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              Insights
            </p>
            <p className="mt-1 font-semibold">Sessions, volume, bests</p>
          </div>
          <span aria-hidden className="text-[var(--accent)] text-xl leading-none">
            →
          </span>
        </Link>

        <Link
          href="/history"
          className="card flex items-center justify-between gap-3 cursor-pointer hover:border-[var(--accent)] active:opacity-80 transition-colors"
        >
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              History
            </p>
            <p className="mt-1 font-semibold">View past workouts</p>
          </div>
          <span aria-hidden className="text-[var(--accent)] text-xl leading-none">
            →
          </span>
        </Link>

        <Link
          href="/exercises"
          className="card flex items-center justify-between gap-3 cursor-pointer hover:border-[var(--accent)] active:opacity-80 transition-colors"
        >
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              Exercises
            </p>
            <p className="mt-1 font-semibold">
              {exerciseCount} available to you
            </p>
          </div>
          <span aria-hidden className="text-[var(--accent)] text-xl leading-none">
            →
          </span>
        </Link>
      </nav>

      <div className="card">
        <h3 className="text-sm font-semibold text-[var(--fg-muted)] uppercase tracking-wide">
          Profile
        </h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-[var(--fg-muted)]">Email</dt>
          <dd className="truncate">{email}</dd>
          <dt className="text-[var(--fg-muted)]">Age</dt>
          <dd>{profile.age ?? "—"}</dd>
          <dt className="text-[var(--fg-muted)]">Gender</dt>
          <dd>{profile.gender ?? "—"}</dd>
          <dt className="text-[var(--fg-muted)]">Height</dt>
          <dd>{profile.heightCm ? `${profile.heightCm} cm` : "—"}</dd>
          <dt className="text-[var(--fg-muted)]">Bodyweight</dt>
          <dd>{profile.bodyweightKg ? `${profile.bodyweightKg} kg` : "—"}</dd>
          <dt className="text-[var(--fg-muted)]">Experience</dt>
          <dd>{profile.experience ?? "—"}</dd>
          <dt className="text-[var(--fg-muted)]">Schedule</dt>
          <dd>
            {profile.daysPerWeek && profile.sessionMinutes
              ? `${profile.daysPerWeek}×/wk · ${profile.sessionMinutes}m`
              : "—"}
          </dd>
        </dl>
        <div className="mt-4">
          <p className="text-xs text-[var(--fg-muted)] mb-1.5">Goals</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.goals.length === 0 && (
              <span className="text-sm text-[var(--fg-muted)]">—</span>
            )}
            {profile.goals.map((g) => (
              <span
                key={g}
                className="rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-2.5 py-0.5 text-xs"
              >
                {g.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
        {profile.injuries.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-[var(--fg-muted)] mb-1.5">Avoid</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.injuries.map((i) => (
                <span
                  key={i}
                  className="rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-2.5 py-0.5 text-xs"
                >
                  {i}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {householdName && (
        <div className="card">
          <h3 className="text-sm font-semibold text-[var(--fg-muted)] uppercase tracking-wide">
            Household
          </h3>
          <p className="mt-2 font-medium">{householdName}</p>
          {householdInviteCode && (
            <div className="mt-2">
              <p className="text-xs text-[var(--fg-muted)]">Invite code</p>
              <p className="font-mono text-lg tracking-widest mt-0.5">
                {householdInviteCode}
              </p>
            </div>
          )}
        </div>
      )}

      <CoachSheet
        open={checkinOpen}
        title="Weekly check-in"
        onClose={() => setCheckinOpen(false)}
        fetcher={fetchCheckin}
      />
    </main>
  );
}
