"use client";

/**
 * Three-segment Auto / Light / Dark control. Renders as a single rounded
 * pill with the active segment filled. Used inside the Account page's
 * "Appearance" section.
 *
 * A11y: implemented as a `<div role="radiogroup">` with each segment a
 * `<button role="radio" aria-checked>`. Keyboard arrows could be added later
 * but Tab/Enter is sufficient for v1.
 */

import { useTheme, type ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme preference"
      className="inline-flex rounded-full border border-[var(--border)] bg-[var(--bg)] p-1"
    >
      {OPTIONS.map((opt) => {
        const active = preference === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(opt.value)}
            className={
              "px-4 py-1.5 text-sm rounded-full transition-colors " +
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] " +
              (active
                ? "bg-[var(--accent)] text-[var(--accent-fg)] font-semibold"
                : "text-[var(--fg-muted)] hover:text-[var(--fg)]")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
