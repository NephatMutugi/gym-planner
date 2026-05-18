import type { Metadata, Viewport } from "next";
import "./globals.css";
import Script from "next/script";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import BottomNavGate from "@/components/BottomNavGate";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Gym Planner",
  description: "A pocket-sized strength coach for your home gym",
  manifest: "/manifest.json",
  applicationName: "Gym Planner",
  appleWebApp: {
    capable: true,
    title: "Gym Planner",
    // The status bar adapts to the theme via the inline FOUC script below.
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
};

// Two-color viewport — the browser picks the right one per OS color scheme.
// On top of that, the inline script in <head> sets a single, explicit meta
// `theme-color` based on the user's stored preference so an active Light/Dark
// override (rather than Auto) wins over the OS.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
  viewportFit: "cover",
};

// Runs synchronously in <head>, before the body paints. Reads the stored
// theme preference, resolves "auto" against the OS, applies data-theme to
// <html>, and writes a matching theme-color meta tag. This avoids the
// "flash of wrong theme" that happens when React applies the theme after
// hydration. Kept terse on purpose — every byte runs before first paint.
const FOUC_SCRIPT = `
(function () {
  try {
    var pref = localStorage.getItem('theme'); // 'light' | 'dark' | 'auto' | null
    var mode = pref;
    if (mode !== 'light' && mode !== 'dark') {
      mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', mode);
    var color = mode === 'dark' ? '#0b1220' : '#ffffff';
    var meta = document.querySelector('meta[name="theme-color"][data-resolved]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      meta.setAttribute('data-resolved', '');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', color);
  } catch (e) { /* noop */ }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the inline FOUC script in <head> below sets
    // data-theme on <html> before React hydrates. Without this attribute,
    // React would flag the resulting server/client mismatch. This is the
    // same pattern next-themes and every other theme-switcher library uses.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Pre-paint theme resolution — see FOUC_SCRIPT comment above. */}
        <script dangerouslySetInnerHTML={{ __html: FOUC_SCRIPT }} />
      </head>
      <body className="antialiased">
        <SessionProviderWrapper>
          <AppShell>{children}</AppShell>
        </SessionProviderWrapper>
        <BottomNavGate />
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ("serviceWorker" in navigator) {
              window.addEventListener("load", () => {
                navigator.serviceWorker
                  .register("/sw.js")
                  .catch((e) => console.error("SW register failed", e));
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
