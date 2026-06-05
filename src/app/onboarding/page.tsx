"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const GOAL_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "general_fitness", label: "General fitness", hint: "Stay active, balanced conditioning" },
  { value: "strength", label: "Strength", hint: "Get stronger, progressive overload" },
  { value: "muscle_gain", label: "Muscle gain", hint: "Hypertrophy-focused programming" },
  { value: "fat_loss", label: "Fat loss", hint: "Higher volume, conditioning circuits" },
  { value: "mobility", label: "Mobility", hint: "Joint health, flexibility, posture" },
  { value: "endurance", label: "Endurance", hint: "Stamina, work capacity" },
];

const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "Beginner", hint: "Less than 6 months consistent training" },
  { value: "intermediate", label: "Intermediate", hint: "6 months to 3 years" },
  { value: "advanced", label: "Advanced", hint: "3+ years, know your numbers" },
];

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

type Form = {
  name: string;
  age: string;
  gender: string;
  heightCm: string;
  bodyweightKg: string;
  experience: string;
  goals: string[];
  daysPerWeek: string;
  sessionMinutes: string;
  injuries: string[];
  trainingContext: string; // "general" by default; see options below
};

const TRAINING_CONTEXT_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "general", label: "General training", hint: "No special considerations" },
  {
    value: "returning_from_injury",
    label: "Returning from injury",
    hint: "Lighter loads, longer rest, no high-impact",
  },
  {
    value: "prenatal",
    label: "Prenatal",
    hint: "Pregnancy-aware: no heavy bracing or deep core flexion",
  },
  {
    value: "early_postpartum",
    label: "Early postpartum (< 4 months)",
    hint: "No high-impact, heavy bracing, or deep core flexion. Extra rest + mobility",
  },
  {
    value: "late_postpartum",
    label: "Late postpartum (4 months – 1 year)",
    hint: "No high-impact moves",
  },
];

const STEP_COUNT = 6;

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [injuryDraft, setInjuryDraft] = useState("");

  // Household step (optional, after profile saved)
  const [hhMode, setHhMode] = useState<"choose" | "create" | "join" | "done">("choose");
  // Which path completed — "created" shows the invite code to share, "joined"
  // shows a simple confirmation. Defaults to null until done.
  const [hhDoneVia, setHhDoneVia] = useState<"created" | "joined" | null>(null);
  const [hhName, setHhName] = useState("");
  const [hhCode, setHhCode] = useState("");

  const [form, setForm] = useState<Form>({
    name: session?.user?.name ?? "",
    age: "",
    gender: "",
    heightCm: "",
    bodyweightKg: "",
    experience: "",
    goals: [],
    daysPerWeek: "3",
    sessionMinutes: "45",
    injuries: [],
    trainingContext: "general",
  });

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-md min-h-[100dvh] flex items-center justify-center p-6">
        <p className="text-[var(--fg-muted)]">Loading…</p>
      </main>
    );
  }

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!form.name.trim()) return "Please tell us your name";
      const age = Number(form.age);
      if (!age || age < 13 || age > 100) return "Enter a valid age (13–100)";
      if (!form.gender) return "Pick an option";
    }
    if (s === 1) {
      const h = Number(form.heightCm);
      const w = Number(form.bodyweightKg);
      if (!h || h < 80 || h > 250) return "Enter a valid height in cm";
      if (!w || w < 25 || w > 300) return "Enter a valid bodyweight in kg";
      if (!form.experience) return "Pick your experience level";
    }
    if (s === 2) {
      if (form.goals.length === 0) return "Pick at least one goal";
    }
    if (s === 3) {
      const d = Number(form.daysPerWeek);
      const m = Number(form.sessionMinutes);
      if (!d || d < 1 || d > 7) return "Days per week must be 1–7";
      if (!m || m < 15 || m > 180) return "Session length must be 15–180 minutes";
    }
    return null;
  }

  async function next() {
    const v = validateStep(step);
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    if (step < 4) {
      setStep(step + 1);
      return;
    }
    if (step === 4) {
      // Save profile, then move to household step
      setSubmitting(true);
      const payload = {
        name: form.name.trim(),
        age: Number(form.age),
        gender: form.gender,
        heightCm: Number(form.heightCm),
        bodyweightKg: Number(form.bodyweightKg),
        experience: form.experience,
        goals: form.goals,
        daysPerWeek: Number(form.daysPerWeek),
        sessionMinutes: Number(form.sessionMinutes),
        injuries: form.injuries,
        trainingContext: form.trainingContext || "general",
      };
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSubmitting(false);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save profile");
        return;
      }
      setStep(5);
    }
  }

  function back() {
    setError(null);
    if (step === 0) return;
    setStep(step - 1);
  }

  function toggleGoal(g: string) {
    setForm((f) => ({
      ...f,
      goals: f.goals.includes(g) ? f.goals.filter((x) => x !== g) : [...f.goals, g],
    }));
  }

  function addInjury() {
    const v = injuryDraft.trim();
    if (!v) return;
    if (form.injuries.includes(v)) return;
    setForm((f) => ({ ...f, injuries: [...f.injuries, v] }));
    setInjuryDraft("");
  }

  function removeInjury(i: number) {
    setForm((f) => ({ ...f, injuries: f.injuries.filter((_, idx) => idx !== i) }));
  }

  async function createHousehold() {
    if (!hhName.trim()) {
      setError("Give your household a name");
      return;
    }
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/household", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", name: hhName.trim() }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create household");
      return;
    }
    const data = await res.json();
    setHhCode(data.household.inviteCode);
    setHhDoneVia("created");
    setHhMode("done");
  }

  async function joinHousehold() {
    const code = hhCode.trim().toUpperCase();
    if (!code) {
      setError("Enter an invite code");
      return;
    }
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/household", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", inviteCode: code }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not join household");
      return;
    }
    setHhDoneVia("joined");
    setHhMode("done");
  }

  function finish() {
    router.push("/dashboard");
    router.refresh();
  }

  const progress = ((step + 1) / STEP_COUNT) * 100;

  return (
    <main className="mx-auto max-w-md min-h-[100dvh] flex flex-col p-6">
      <header className="pt-4 pb-6">
        <div className="h-1.5 rounded-full bg-[var(--bg-elev)] overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[var(--fg-muted)]">
          Step {step + 1} of {STEP_COUNT}
        </p>
      </header>

      <section className="flex-1">
        {step === 0 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-bold">Tell us about you</h2>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">
                The basics. Used to tailor your program.
              </p>
            </div>
            <label className="block">
              <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                maxLength={60}
                autoFocus
              />
            </label>
            <label className="block">
              <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">Age</span>
              <input
                type="number"
                inputMode="numeric"
                value={form.age}
                onChange={(e) => update("age", e.target.value)}
                min={13}
                max={100}
              />
            </label>
            <fieldset>
              <legend className="block text-sm mb-1.5 text-[var(--fg-muted)]">Gender</legend>
              <div className="grid grid-cols-2 gap-2">
                {GENDER_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => update("gender", opt.value)}
                    className={
                      "rounded-xl border px-3 py-3 text-sm " +
                      (form.gender === opt.value
                        ? "border-[var(--accent)] bg-[var(--bg-elev)] text-[var(--accent)] font-semibold"
                        : "border-[var(--border)] bg-[var(--bg-elev)] text-[var(--fg-muted)]")
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-bold">Your body</h2>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">
                Used to scale starting loads and rep ranges.
              </p>
            </div>
            <label className="block">
              <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">Height (cm)</span>
              <input
                type="number"
                inputMode="decimal"
                value={form.heightCm}
                onChange={(e) => update("heightCm", e.target.value)}
                min={80}
                max={250}
                step="0.1"
              />
            </label>
            <label className="block">
              <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">Bodyweight (kg)</span>
              <input
                type="number"
                inputMode="decimal"
                value={form.bodyweightKg}
                onChange={(e) => update("bodyweightKg", e.target.value)}
                min={25}
                max={300}
                step="0.1"
              />
            </label>
            <fieldset>
              <legend className="block text-sm mb-1.5 text-[var(--fg-muted)]">Experience</legend>
              <div className="flex flex-col gap-2">
                {EXPERIENCE_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => update("experience", opt.value)}
                    className={
                      "rounded-xl border px-4 py-3 text-left " +
                      (form.experience === opt.value
                        ? "border-[var(--accent)] bg-[var(--bg-elev)]"
                        : "border-[var(--border)] bg-[var(--bg-elev)]")
                    }
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs text-[var(--fg-muted)] mt-0.5">{opt.hint}</div>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-bold">Your goals</h2>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">
                Pick one or more. We&apos;ll mix them into a single program.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {GOAL_OPTIONS.map((g) => {
                const active = form.goals.includes(g.value);
                return (
                  <button
                    type="button"
                    key={g.value}
                    onClick={() => toggleGoal(g.value)}
                    className={
                      "rounded-xl border px-4 py-3 text-left " +
                      (active
                        ? "border-[var(--accent)] bg-[var(--bg-elev)]"
                        : "border-[var(--border)] bg-[var(--bg-elev)]")
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{g.label}</span>
                      {active && <span className="text-[var(--accent)] text-sm">Selected</span>}
                    </div>
                    <div className="text-xs text-[var(--fg-muted)] mt-0.5">{g.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-bold">Your schedule</h2>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">
                How much time can you realistically commit?
              </p>
            </div>
            <label className="block">
              <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">Days per week</span>
              <input
                type="number"
                inputMode="numeric"
                value={form.daysPerWeek}
                onChange={(e) => update("daysPerWeek", e.target.value)}
                min={1}
                max={7}
              />
            </label>
            <label className="block">
              <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">
                Session length (minutes)
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={form.sessionMinutes}
                onChange={(e) => update("sessionMinutes", e.target.value)}
                min={15}
                max={180}
                step={5}
              />
            </label>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-bold">Anything to avoid?</h2>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">
                Injuries, sore joints, movements you can&apos;t do. Optional.
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={injuryDraft}
                onChange={(e) => setInjuryDraft(e.target.value)}
                placeholder="e.g. lower back, left knee"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addInjury();
                  }
                }}
              />
              <button
                type="button"
                onClick={addInjury}
                className="btn btn-ghost"
                style={{ width: "auto", padding: "12px 16px" }}
              >
                Add
              </button>
            </div>
            {form.injuries.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.injuries.map((tag, i) => (
                  <span
                    key={tag + i}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-1 text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeInjury(i)}
                      className="text-[var(--fg-muted)]"
                      aria-label={`Remove ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-[var(--fg-muted)]">
              Leave empty if nothing applies. You can edit these later.
            </p>
            <hr className="border-[var(--border)] my-1" />
            <fieldset>
              <legend className="block text-sm mb-1.5 text-[var(--fg-muted)]">
                Training context <span className="opacity-60">(optional)</span>
              </legend>
              <div className="flex flex-col gap-2">
                {TRAINING_CONTEXT_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => update("trainingContext", opt.value)}
                    className={
                      "rounded-xl border px-4 py-3 text-left " +
                      (form.trainingContext === opt.value
                        ? "border-[var(--accent)] bg-[var(--bg-elev)]"
                        : "border-[var(--border)] bg-[var(--bg-elev)]")
                    }
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs text-[var(--fg-muted)] mt-0.5">{opt.hint}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-[var(--fg-muted)] mt-1.5">
                Tunes exercise selection and rest periods. Always clear return-to-exercise with your healthcare provider if any of these apply.
              </p>
            </fieldset>

          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-bold">Training with someone?</h2>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">
                Optionally share equipment with a partner. You can skip this.
              </p>
            </div>

            {hhMode === "choose" && (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setHhMode("create")}
                >
                  Create a household
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setHhMode("join")}
                >
                  Join with invite code
                </button>
                <button type="button" className="btn btn-primary" onClick={finish}>
                  Skip for now
                </button>
              </div>
            )}

            {hhMode === "create" && (
              <div className="flex flex-col gap-4">
                <label className="block">
                  <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">
                    Household name
                  </span>
                  <input
                    type="text"
                    value={hhName}
                    onChange={(e) => setHhName(e.target.value)}
                    placeholder="e.g. Our home gym"
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={createHousehold}
                  disabled={submitting}
                >
                  {submitting ? "Creating…" : "Create household"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setHhMode("choose")}
                >
                  Back
                </button>
              </div>
            )}

            {hhMode === "join" && (
              <div className="flex flex-col gap-4">
                <label className="block">
                  <span className="block text-sm mb-1.5 text-[var(--fg-muted)]">
                    Invite code
                  </span>
                  <input
                    type="text"
                    value={hhCode}
                    onChange={(e) => setHhCode(e.target.value.toUpperCase())}
                    placeholder="6-character code"
                    maxLength={12}
                    autoCapitalize="characters"
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={joinHousehold}
                  disabled={submitting}
                >
                  {submitting ? "Joining…" : "Join household"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setHhMode("choose")}
                >
                  Back
                </button>
              </div>
            )}

            {hhMode === "done" && (
              <div className="card">
                <p className="text-sm text-[var(--fg-muted)]">
                  {hhDoneVia === "created"
                    ? "Household created. Share this invite code with your partner so they can join."
                    : "You’re in. You’ll share equipment with your household."}
                </p>
                {hhDoneVia === "created" && (
                  <div className="mt-3 text-2xl font-mono tracking-widest text-center py-3 border border-[var(--border)] rounded-xl">
                    {hhCode}
                  </div>
                )}
                <button type="button" className="btn btn-primary mt-4" onClick={finish}>
                  Continue
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {error && (
        <p className="text-sm py-2" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {step <= 4 && (
        <footer className="pt-4 pb-2 flex gap-3">
          {step > 0 && (
            <button type="button" onClick={back} className="btn btn-ghost">
              Back
            </button>
          )}
          <button
            type="button"
            onClick={next}
            disabled={submitting}
            className="btn btn-primary"
          >
            {step === 4 ? (submitting ? "Saving…" : "Save profile") : "Continue"}
          </button>
        </footer>
      )}
    </main>
  );
}
