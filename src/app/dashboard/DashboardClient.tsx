"use client";

import { signOut } from "next-auth/react";

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
}: {
  name: string;
  email: string;
  profile: Profile;
  householdName: string | null;
  householdInviteCode: string | null;
}) {
  return (
    <main className="mx-auto max-w-md min-h-[100dvh] flex flex-col p-6 gap-5">
      <header className="pt-4 flex items-start justify-between">
        <div>
          <p className="text-sm text-[var(--fg-muted)]">Welcome back,</p>
          <h1 className="text-2xl font-bold">{name}</h1>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-sm text-[var(--fg-muted)] underline"
        >
          Sign out
        </button>
      </header>

      <div className="card">
        <h2 className="text-base font-semibold">Phase 0 complete</h2>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Account, profile, and household setup are working. Equipment editor,
          exercise library, and program generation come next.
        </p>
      </div>

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
    </main>
  );
}
