"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
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

// snake_case stored values rendered as sentence-case for the UI. Source of truth
// for label text lives in onboarding/page.tsx; this is the inverse mapping for
// display. Falls back to a Title-cased version of the value for unknown keys.
const GOAL_LABELS: Record<string, string> = {
  general_fitness: "General fitness",
  strength: "Strength",
  muscle_gain: "Muscle gain",
  fat_loss: "Fat loss",
  mobility: "Mobility",
  endurance: "Endurance",
};

function goalLabel(value: string): string {
  if (GOAL_LABELS[value]) return GOAL_LABELS[value];
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Time-of-day greeting. Resolved client-side so it reflects the user's local
// clock rather than the server's. 5 am – 11:59 am is morning, noon – 4:59 pm
// is afternoon, the rest is evening.
function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Welcome back,";
  if (hour < 12) return "Good morning,";
  if (hour < 17) return "Good afternoon,";
  return "Good evening,";
}

export default function DashboardClient({
  name,
  email,
  profile,
  householdName,
  householdInviteCode,
  equipmentCount,
  exerciseCount,
  hasProgram,
  hasActiveSession,
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
  hasActiveSession: boolean;
  programSplit: string | null;
  programDayCount: number;
  claudeEnabled: boolean;
}) {

  const [checkinOpen, setCheckinOpen] = useState(false);

  // Greeting is resolved on the client to avoid SSR/CSR hydration mismatches
  // when the server clock and the user's local clock fall in different time-
  // of-day buckets. Initial render is the neutral "Welcome back," so SSR and
  // hydration produce identical markup; the useEffect then upgrades it.
  const [greeting, setGreeting] = useState("Welcome back,");
  useEffect(() => {
    setGreeting(timeGreeting());
  }, []);

  async function fetchCheckin() {
    const res = await fetch("/api/coach/weekly-checkin", { method: "POST" });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "Could not load check-in" };
    return { text: data.text };
  }

  return (
    <main className="mx-auto w-full max-w-md md:max-w-5xl min-h-[100dvh] flex flex-col p-6 md:px-10 md:py-10 gap-5">
      <header className="pt-4">
        <p className="text-sm text-[var(--fg-muted)]">{greeting}</p>
        <h1 className="text-2xl md:text-3xl font-bold">{name}</h1>
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
            <p className="mt-1 font-semibold flex items-center gap-2 flex-wrap">
              {hasActiveSession ? (
                <>
                  <span
                    aria-hidden="true"
                    className="inline-block w-2 h-2 rounded-full bg-[var(--accent)]"
                  />
                  Resume workout
                </>
              ) : hasProgram ? (
                `${programSplit} · ${programDayCount} days`
              ) : (
                "Generate your program"
              )}
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
                {goalLabel(g)}
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
