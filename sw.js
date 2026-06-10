const CACHE = 'oola-spares-v3';

// Files to cache for offline use
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install — cache all app files immediately
self.addEventListener('install', e => {
  console.log('[SW] Installing...');
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(ASSETS);
      })
      .then(() => {
        console.log('[SW] Install complete');
        return self.skipWaiting(); // Activate immediately
      })
      .catch(err => console.log('[SW] Cache failed:', err))
  );
});

// Activate — take control immediately, clear old caches
self.addEventListener('activate', e => {
  console.log('[SW] Activating...');
  e.waitUntil(
    Promise.all([
      // Clear old caches
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        }))
      ),
      // Take control of all open tabs immediately
      self.clients.claim()
    ])
  );
});

// Fetch — smart caching strategy
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Skip non-GET requests
  if (e.request.method !== 'GET') return;

  // API calls to Google — network only, never cache
  if (url.includes('script.google.com') || url.includes('googleapis.com')) {
    e.respondWith(
      fetch(e.request)
        .catch(() => new Response(
          JSON.stringify({ success: false, error: 'offline' }),
          { headers: { 'Content-Type': 'application/json' } }
        ))
    );
    return;
  }

  // External resources (fonts, etc) — network first, cache fallback
  if (!url.includes('isaacoolaio-arch.github.io') && !url.startsWith(self.location.origin)) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // App files — cache first, network fallback, then index.html
  e.respondWith(
    caches.match(e.request)
      .then(cached => {
        if (cached) {
          // Return cached version immediately
          // Also fetch fresh version in background to update cache
          fetch(e.request)
            .then(res => {
              if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res));
            })
            .catch(() => {});
          return cached;
        }

        // Not in cache — try network
        return fetch(e.request)
          .then(res => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE).then(c => c.put(e.request, clone));
            }
            return res;
          })
          .catch(() => {
            // Network failed and not cached — return index.html as fallback
            return caches.match('./index.html');
          });
      })
  );
});
