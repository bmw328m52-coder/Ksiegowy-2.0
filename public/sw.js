// Service worker dla LUVIANO app
// Cel: aplikacja odpala się offline (shell + ostatnio odwiedzone strony),
// zapisy (server actions) wymagają sieci.
// Utwardzenie: timeout na nawigacjach (nigdy nie wisi w nieskończoność),
// twarde czyszczenie starych cache po zmianie wersji, natychmiastowe przejęcie.

const SW_VERSION = "v8";
const PREFIX = "mf-";
const PRECACHE = `${PREFIX}precache-${SW_VERSION}`;
const RUNTIME_PAGES = `${PREFIX}pages-${SW_VERSION}`;
const RUNTIME_STATIC = `${PREFIX}static-${SW_VERSION}`;
const CURRENT_CACHES = [PRECACHE, RUNTIME_PAGES, RUNTIME_STATIC];

// Ile maksymalnie czekamy na sieć przy wejściu na stronę, gdy mamy już cache,
// zanim pokażemy zapisaną wersję. Chroni przed wiecznym „kręceniem się".
const NAV_TIMEOUT_MS = 6000;

const PRECACHE_URLS = [
  "/offline",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((c) => c.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Skasuj KAŻDY nasz cache spoza aktualnej wersji (twarde odświeżenie po deployu).
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith(PREFIX) && !CURRENT_CACHES.includes(k))
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

  // Nie cache'ujemy server actions / API / auth / danych RSC
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/") ||
    url.searchParams.has("_rsc")
  ) {
    return;
  }

  // HTML navigations: network-first z limitem czasu, fallback do cache, potem /offline
  if (isHTMLRequest(request)) {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // Statyki Next.js (pliki z hashem, niezmienne): cache-first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, RUNTIME_STATIC));
    return;
  }
});

function offlineResponse() {
  return new Response("Offline", { status: 503, statusText: "Offline" });
}

// Odpala `promise`, ale nie dłużej niż `ms` — inaczej rzuca „timeout".
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function networkFirstPage(request) {
  const cache = await caches.open(RUNTIME_PAGES);

  // Sieć leci zawsze; sukces aktualizuje cache (samonaprawa na kolejne wejście).
  const networkP = fetch(request).then((fresh) => {
    if (fresh && fresh.status === 200 && fresh.type === "basic") {
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  });

  const cached = await cache.match(request);

  if (cached) {
    // Mamy zapisany szkielet: czekamy na sieć najwyżej NAV_TIMEOUT_MS,
    // inaczej natychmiast pokazujemy cache — nigdy nie wisimy.
    try {
      const fresh = await withTimeout(networkP, NAV_TIMEOUT_MS);
      return fresh || cached;
    } catch {
      return cached;
    }
  }

  // Brak cache (np. pierwsze wejście): czekamy na sieć, fallback do /offline.
  try {
    const fresh = await networkP;
    return fresh;
  } catch {
    return (await caches.match("/offline")) || offlineResponse();
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
