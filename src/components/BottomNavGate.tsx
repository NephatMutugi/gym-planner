"use client";

/**
 * Conditionally renders the BottomNav.
 *
 * Hidden on:
 *   - Landing page                 (/)
 *   - Auth flows                   (/login, /signup, /onboarding)
 *   - Active workout session       (/workout/session/[id])  — full focus mode
 *   - Offline fallback             (/offline)
 *
 * This pattern is common in fitness apps (Hevy, Strong) where the active
 * workout screen suppresses navigation to keep the user heads-down on logging
 * sets without accidental tab taps.
 */

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

const HIDDEN_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/login(\/|$)/,
  /^\/signup(\/|$)/,
  /^\/onboarding(\/|$)/,
  /^\/offline(\/|$)/,
  /^\/workout\/session\//,
];

export default function BottomNavGate() {
  const pathname = usePathname() ?? "/";
  const hidden = HIDDEN_PATTERNS.some((re) => re.test(pathname));
  if (hidden) return null;
  return <BottomNav />;
}
