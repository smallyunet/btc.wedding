const CACHE_NAME = "btc-wedding-v10";
const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./favicon-32.png",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener("fetch", event => {
  const requestUrl = new URL(event.request.url);
  const isLocalAsset = requestUrl.origin === self.location.origin;
  const shouldRefreshFirst = isLocalAsset && (
    requestUrl.pathname === "/" ||
    requestUrl.pathname.endsWith(".html") ||
    requestUrl.pathname.endsWith(".css") ||
    requestUrl.pathname.endsWith(".js")
  );

  if (shouldRefreshFirst) {
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request).catch(() => {
        // Fallback for API calls or non-cached items if offline
        return new Response("Offline (Network request blocked or unavailable)", {
          status: 503,
          statusText: "Service Unavailable"
        });
      });
    })
  );
});
