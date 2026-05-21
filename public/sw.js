// Service worker dla Manager Firmy (LUVIANO)
// Cel: aplikacja odpala się offline (shell + ostatnio odwiedzone strony),
// zapisy (server actions) wymagają sieci.

const SW_VERSION = "v1";
const PRECACHE = `mf-precache-${SW_VERSION}`;
const RUNTIME_PAGES = `mf-pages-${SW_VERSION}`;
const RUNTIME_STATIC = `mf-static-${SW_VERSION}`;

const PRECACHE_URLS = [
  "/offline",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((c) => c.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![PRECACHE, RUNTIME_PAGES, RUNTIME_STATIC].includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isHTMLRequest(request) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.startsWith("/icon-") ||
    /\.(png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf|css|js)$/i.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nie cache'ujemy server actions / API / auth
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/") ||
    url.searchParams.has("_rsc")
  ) {
    return;
  }

  // HTML navigations: network-first, fallback do cache, ostatecznie /offline
  if (isHTMLRequest(request)) {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // Statyki Next.js: cache-first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, RUNTIME_STATIC));
    return;
  }
});

async function networkFirstPage(request) {
  const cache = await caches.open(RUNTIME_PAGES);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.status === 200 && fresh.type === "basic") {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await caches.match("/offline");
    if (offline) return offline;
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.status === 200) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return cached || new Response("", { status: 504 });
  }
}
