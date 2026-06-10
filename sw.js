const CACHE = 'oola-spares-v5';

const ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install — cache only static assets, NOT index.html
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.log('[SW] Cache failed:', err))
  );
});

// Activate — clear old caches, take control immediately
self.addEventListener('activate', e => {
  e.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Skip non-GET
  if (e.request.method !== 'GET') return;

  // Google API calls — network only, never cache
  if (url.includes('script.google.com') || url.includes('googleusercontent.com')) {
    e.respondWith(
      fetch(e.request, { mode: 'cors', credentials: 'omit', redirect: 'follow' })
        .catch(() => new Response(
          JSON.stringify({ success: false, error: 'offline' }),
          { headers: { 'Content-Type': 'application/json' } }
        ))
    );
    return;
  }

  // Google Fonts — cache first, network fallback
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // index.html — NETWORK FIRST so updates always load immediately
  if (url.includes('index.html') || url.endsWith('/Spares/') || url.endsWith('/Spares')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request) || caches.match('./index.html'))
    );
    return;
  }

  // All other app files — cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
