"use client";

/**
 * Primary mobile bottom navigation.
 *
 * Four top-level destinations, thumb-zone aligned, with paired outline/filled
 * icons for active state, label + icon together (icon-only fails for anyone
 * who isn't a power user — see Nielsen Norman on tab bar UX).
 *
 * iOS PWA notes:
 *   - viewportFit="cover" is set in app/layout.tsx so env(safe-area-inset-*)
 *     resolves to real pixels.
 *   - paddingBottom: env(safe-area-inset-bottom) keeps the tap targets above
 *     the home-indicator gesture region.
 *
 * Desktop: hidden via Tailwind `md:hidden`. On md+ the SidebarNav takes over
 * (see src/components/SidebarNav.tsx).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type NavTab = {
  href: string;
  label: string;
  matches: (path: string) => boolean;
  outline: ReactNode;
  filled: ReactNode;
};

const STROKE = "currentColor";

function HomeOutline() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 10.5 12 4l8.5 6.5V19a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1v-8.5Z"
        stroke={STROKE}
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomeFilled() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3.5 10.5 12 4l8.5 6.5V19a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1v-8.5Z" />
    </svg>
  );
}

function CalendarOutline() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="15"
        rx="2.25"
        stroke={STROKE}
        strokeWidth="1.75"
      />
      <path d="M3.5 10h17" stroke={STROKE} strokeWidth="1.75" />
      <path d="M8 3.5v3M16 3.5v3" stroke={STROKE} strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function CalendarFilled() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.25" />
      <path
        d="M8 3.5v3M16 3.5v3"
        stroke="var(--bg)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="8" cy="14" r="1.25" fill="var(--bg)" />
      <circle cx="12" cy="14" r="1.25" fill="var(--bg)" />
      <circle cx="16" cy="14" r="1.25" fill="var(--bg)" />
    </svg>
  );
}

function HistoryOutline() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4a8 8 0 1 1-7.5 5.25"
        stroke={STROKE}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M4.5 4.5v4.75H9.25"
        stroke={STROKE}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 8.5v4l2.75 2.75"
        stroke={STROKE}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HistoryFilled() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="currentColor" />
      <path
        d="M4.5 4.5v4.75H9.25"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 8.5v4l2.75 2.75"
        stroke="var(--bg)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserOutline() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.75" stroke={STROKE} strokeWidth="1.75" />
      <path
        d="M4.75 20c.75-3.75 3.75-5.75 7.25-5.75s6.5 2 7.25 5.75"
        stroke={STROKE}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UserFilled() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.75" />
      <path d="M4.75 20c.75-3.75 3.75-5.75 7.25-5.75s6.5 2 7.25 5.75H4.75Z" />
    </svg>
  );
}

export const NAV_TABS: NavTab[] = [
  {
    href: "/dashboard",
    label: "Home",
    matches: (p) => p === "/dashboard" || p.startsWith("/dashboard/"),
    outline: <HomeOutline />,
    filled: <HomeFilled />,
  },
  {
    href: "/workout",
    label: "Plan",
    // Active session (/workout/session/[id]) hides the nav via the gate, but
    // if a user navigates there and back, Plan is still the conceptual parent.
    matches: (p) => p === "/workout" || p.startsWith("/workout/"),
    outline: <CalendarOutline />,
    filled: <CalendarFilled />,
  },
  {
    href: "/history",
    label: "History",
    matches: (p) =>
      p === "/history" || p.startsWith("/history/") || p.startsWith("/insights"),
    outline: <HistoryOutline />,
    filled: <HistoryFilled />,
  },
  {
    href: "/account",
    label: "Profile",
    matches: (p) =>
      p.startsWith("/account") ||
      p.startsWith("/equipment") ||
      p.startsWith("/exercises"),
    outline: <UserOutline />,
    filled: <UserFilled />,
  },
];

export default function BottomNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--bg-elev)] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {NAV_TABS.map((tab) => {
          const active = tab.matches(pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                aria-label={tab.label}
                className={
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 transition-colors " +
                  "focus:outline-none focus-visible:bg-[var(--bg)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset " +
                  (active
                    ? "text-[var(--accent)] font-semibold"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)]")
                }
              >
                <span aria-hidden="true" className="leading-none">
                  {active ? tab.filled : tab.outline}
                </span>
                <span className="text-[11px] leading-none">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
