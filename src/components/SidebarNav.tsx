"use client";

/**
 * Desktop sidebar navigation. Mirrors the mobile BottomNav tabs but laid out
 * vertically along the left edge — the canonical "app shell" pattern used by
 * Twitter, Spotify, Linear, and most fitness web apps once the viewport
 * passes ~768px.
 *
 * Hidden on mobile (`md:flex` only); BottomNav handles small screens.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS } from "./BottomNav";

export default function SidebarNav() {
  const pathname = usePathname() ?? "";
  return (
    <aside
      aria-label="Primary"
      className="hidden md:flex md:flex-col md:gap-1 md:fixed md:left-0 md:top-0 md:bottom-0 md:w-60 md:border-r md:border-[var(--border)] md:bg-[var(--bg-elev)] md:px-3 md:py-6 md:z-30"
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-2 px-3 pb-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:rounded-md"
      >
        <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="8" fill="var(--accent)" />
          <rect x="9" y="15" width="14" height="2" rx="1" fill="white" />
          <rect x="6" y="12.5" width="3" height="7" rx="1" fill="white" />
          <rect x="23" y="12.5" width="3" height="7" rx="1" fill="white" />
        </svg>
        <span className="font-semibold tracking-tight">Gym Planner</span>
      </Link>

      <nav className="flex flex-col gap-0.5">
        {NAV_TABS.map((tab) => {
          const active = tab.matches(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={
                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors " +
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] " +
                (active
                  ? "bg-[var(--bg)] text-[var(--accent)] font-semibold"
                  : "text-[var(--fg-muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]")
              }
            >
              <span aria-hidden="true" className="leading-none">
                {active ? tab.filled : tab.outline}
              </span>
              <span className="text-sm">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
