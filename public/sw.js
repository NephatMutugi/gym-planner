// Gym Planner service worker — minimal, dependency-free.
// Strategy:
//   - Precache the app shell + manifest + icon on install
//   - Network-first for HTML navigations, falling back to cache then offline page
//   - Stale-while-revalidate for static assets (/_next/static/*, icons)
//   - Never cache API responses (always fresh, fall through to network errors)

const VERSION = "v1";
const SHELL = `gp-shell-${VERSION}`;
const ASSETS = `gp-assets-${VERSION}`;

const APP_SHELL = ["/", "/manifest.json", "/icon.svg", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL && k !== ASSETS)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API requests — they should always go to the network
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests: network-first, cache fallback, then offline page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(SHELL).then((c) => c.put(request, copy)).catch(() => {});
          return resp;
        })
        .catch(() =>
          caches.match(request).then((cached) =>
            cached || caches.match("/offline").then((o) => o || new Response("Offline", { status: 503 }))
          )
        )
    );
    return;
  }

  // Static assets: stale-while-revalidate
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((resp) => {
            if (resp.ok) cache.put(request, resp.clone()).catch(() => {});
            return resp;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
