const CACHE_VERSION = 'mandiplus-v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/offline',
  '/manifest.json',
  '/images/logo.jpeg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== API_CACHE && key !== IMAGE_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.origin !== location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/offline').then((r) => r || caches.match('/')))
    );
    return;
  }

  if (url.pathname.startsWith('/api/') || url.hostname.includes('api.mandiplus.com')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (
    request.destination === 'image' ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(IMAGE_CACHE).then((cache) => cache.put(request, clone));
            return response;
          })
      )
    );
    return;
  }

  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    url.pathname.match(/\.(css|js|woff2?|ttf|eot)$/)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
            return response;
          })
      )
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};

  if (data.type === 'incoming_call') {
    const callerLabel = data.caller_name || data.from || 'Unknown';
    const options = {
      body: data.body || `${callerLabel} is calling...`,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: 'wa-incoming-call',
      requireInteraction: true,
      vibrate: [500, 200, 500, 200, 500],
      silent: false,
      actions: [
        { action: 'decline', title: 'Decline' },
        { action: 'answer', title: 'Answer' },
      ],
      data: {
        type: 'incoming_call',
        callId: data.call_id,
        from: data.from,
        url: data.url || '/whatsapp-chats',
      },
    };
    event.waitUntil(
      self.registration.showNotification(data.title || `Incoming call · ${callerLabel}`, options)
    );
    return;
  }

  if (data.type === 'new_message') {
    const options = {
      body: data.body || 'You have a new WhatsApp message',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: data.tag || `wa-message-${data.phone || 'unknown'}`,
      renotify: true,
      data: {
        type: 'new_message',
        phone: data.phone,
        url: data.url || '/whatsapp-chats',
      },
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'New WhatsApp message', options)
    );
    return;
  }

  const title = data.title || 'MandiPlus';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: data.tag || 'mandiplus-notification',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const action = event.action;

  if (notifData.type === 'incoming_call') {
    const targetUrl = notifData.url || '/admin/chat-logs';
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        const existing = clients.find((c) => c.url.includes('/admin'));
        if (existing) {
          existing.focus();
          existing.postMessage({
            type: 'wa-push-call-action',
            action: action || 'answer',
            callId: notifData.callId,
          });
          return;
        }
        return self.clients.openWindow(targetUrl);
      })
    );
    return;
  }

  const targetUrl = notifData.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const targetPath = new URL(targetUrl, self.location.origin).pathname;
      const existing = clients.find((c) => {
        try {
          return new URL(c.url).pathname === targetPath;
        } catch {
          return c.url.includes(targetUrl);
        }
      });
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});
