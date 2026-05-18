"use client";

/**
 * Theme management — small, framework-free hook backed by localStorage.
 *
 * Three user-visible options:
 *   - "auto"  → follow the OS via prefers-color-scheme (default for first-time visitors)
 *   - "light" → force light regardless of OS
 *   - "dark"  → force dark regardless of OS
 *
 * "resolved" is the actually applied theme (always "light" | "dark") — useful
 * for components that need to swap an image, an SVG fill, or a meta tag.
 *
 * The initial DOM state is set by the inline FOUC script in app/layout.tsx so
 * the first paint already matches the user's choice. This hook then takes
 * over for live changes and live OS preference updates while the page is open.
 */

import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "auto" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme";

function readStored(): ThemePreference {
  if (typeof window === "undefined") return "auto";
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "auto") return v;
  return "auto";
}

function resolveOSPreference(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref === "light" || pref === "dark") return pref;
  return resolveOSPreference();
}

function applyToDocument(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
  // Keep the address-bar / status-bar color in sync (the meta tag is created
  // by the inline FOUC script; this just updates it).
  const color = resolved === "dark" ? "#0b1220" : "#ffffff";
  const meta = document.querySelector(
    'meta[name="theme-color"][data-resolved]'
  ) as HTMLMetaElement | null;
  if (meta) meta.content = color;
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>("auto");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  // Initialise from localStorage on mount (intentionally lazy — SSR can't
  // read it). The FOUC script already painted the correct theme; this just
  // syncs the React state so components reflect it.
  useEffect(() => {
    const stored = readStored();
    setPreferenceState(stored);
    setResolved(resolve(stored));
  }, []);

  // Listen for OS preference changes — only meaningful when pref === "auto".
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (readStored() === "auto") {
        const next = resolveOSPreference();
        setResolved(next);
        applyToDocument(next);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    const r = resolve(next);
    setResolved(r);
    applyToDocument(r);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore quota / privacy mode */
    }
  }, []);

  return { preference, resolved, setPreference };
}
