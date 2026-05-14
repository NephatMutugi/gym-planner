import type { Metadata, Viewport } from "next";
import "./globals.css";
import Script from "next/script";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";

export const metadata: Metadata = {
  title: "Gym Planner",
  description: "A pocket-sized strength coach for your home gym",
  manifest: "/manifest.json",
  applicationName: "Gym Planner",
  appleWebApp: {
    capable: true,
    title: "Gym Planner",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b0d10",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
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
