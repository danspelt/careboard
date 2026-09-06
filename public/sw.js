const SHELL_CACHE = 'careboard-shell-v1';
const STATIC_CACHE = 'careboard-static-v1';
const SHELL = ['/', '/sign-in', '/offline.html', '/favicon.svg', '/manifest.webmanifest'];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE && key !== STATIC_CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET' || !isSameOrigin(url)) {
    return;
  }

  // Never cache API responses or authenticated HTML pages in a shared cache.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  const isStatic = url.pathname.startsWith('/_next/') || url.pathname.match(/\.(js|css|svg|png|jpg|webp|ico|woff2?)$/);

  if (isStatic) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        fetch(event.request)
          .then((response) => {
            if (response.ok && response.type === 'basic') {
              void cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => cache.match(event.request).then((response) => response || Response.error())),
      ),
    );
    return;
  }

  // Navigation requests fall back to the offline page when the network is unavailable.
  // Only public shell pages are served from cache; authenticated pages are never cached.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && response.type === 'basic' && SHELL.includes(url.pathname)) {
            const clone = response.clone();
            void caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(
          () =>
            caches
              .match(event.request)
              .then((cached) => cached || caches.match('/offline.html'))
              .then((cached) => cached || Response.error()),
        ),
    );
    return;
  }

  // Other same-origin requests (e.g., favicon/manifest) use the shell cache if available.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === 'basic' && SHELL.includes(url.pathname)) {
          const clone = response.clone();
          void caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((response) => response || Response.error())),
  );
});
