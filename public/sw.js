const CACHE_NAME = 'obshiy-fond-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Push Notifications ─────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const fallback = { title: 'Общий фонд', body: 'Новое уведомление', type: 'general' };
  let data = fallback;
  try { data = event.data ? event.data.json() : fallback; } catch (e) { data = fallback; }

  const { title, body, type, url, icon } = data;

  const options = {
    body: body || '',
    icon: icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: type || 'general',
    renotify: true,
    data: { url: url || '/', type },
    vibrate: [100, 50, 100],
    actions: [],
  };

  event.waitUntil(self.registration.showNotification(title || 'Общий фонд', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin) && 'focus' in c);
      if (existing) {
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ── Fetch (Caching) ────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Network-first for API calls
  if (event.request.url.includes('/rest/v1/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
