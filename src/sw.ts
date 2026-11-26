/// <reference lib="webworker" />
export {};

declare global {
  interface Window {
    __WB_MANIFEST?: Array<{ url: string; revision?: string | null } | string>;
  }
}

const sw = globalThis as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = 'wally-pwa-shell-v2';
const PRECACHE_URLS = (self.__WB_MANIFEST || []).map(entry =>
  typeof entry === 'string' ? entry : entry.url
);

sw.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => sw.skipWaiting())
  );
});

sw.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => sw.clients.claim())
  );
});

sw.addEventListener('fetch', (event: FetchEvent) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never cache private API, auth, or cross-origin traffic.
  if (url.origin !== sw.location.origin || url.pathname.startsWith('/api') || url.pathname.startsWith('/auth')) {
    return;
  }
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});

sw.addEventListener('push', (event: PushEvent) => {
  let data: { title?: string; body?: string; url?: string; tag?: string } = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() || '' };
  }
  const title = data.title || 'Assist';
  const body = data.body || 'New update from Assist.';
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/';
  const tag = data.tag || 'assist';

  event.waitUntil(
    sw.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag,
      data: { url }
    })
  );
});

sw.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data && typeof event.notification.data.url === 'string')
    ? event.notification.data.url
    : '/';

  event.waitUntil(
    sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList: readonly WindowClient[]) => {
      for (const client of clientList) {
        if ('focus' in client && client.url.startsWith(sw.location.origin)) {
          return client.focus();
        }
      }
      return sw.clients.openWindow(targetUrl);
    })
  );
});
