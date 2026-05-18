"use client";

/**
 * Wraps every page with the desktop app shell: a fixed left sidebar plus a
 * left-padded content column. On mobile this collapses to a no-op (the sidebar
 * is `hidden md:flex`) so the page lays out edge-to-edge as before and the
 * BottomNav handles navigation.
 *
 * On routes where we don't want any chrome (landing page, auth flows,
 * onboarding, the active workout session, offline fallback) the shell becomes
 * a transparent pass-through: no sidebar, no padding offset. This matches the
 * BottomNavGate hide list so the two stay in sync.
 */

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import SidebarNav from "./SidebarNav";

const HIDDEN_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/login(\/|$)/,
  /^\/signup(\/|$)/,
  /^\/onboarding(\/|$)/,
  /^\/offline(\/|$)/,
  /^\/workout\/session\//,
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const hidden = HIDDEN_PATTERNS.some((re) => re.test(pathname));

  if (hidden) {
    return <>{children}</>;
  }

  return (
    <>
      <SidebarNav />
      <div className="md:pl-60">{children}</div>
    </>
  );
}
