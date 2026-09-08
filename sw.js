/* =========================================================
   Solo Hunt: Overworld — Service Worker
   Estrategia: Cache-First estricta (offline instantáneo).
   Las actualizaciones se despliegan subiendo CACHE_VERSION.
   ========================================================= */
const CACHE_VERSION = 'solo-hunt-0.2.1';

// Núcleo: imprescindible para arrancar (falla la instalación si falta alguno)
const NUCLEO = [
  './',
  './index.html',
  './css/style.css',
  './manifest.webmanifest',
  './vendor/phaser.min.js',
  './js/main.js',
  './js/core/rng.js',
  './js/core/save.js',
  './js/core/safearea.js',
  './js/core/worldgen.js',
  './js/core/textures.js',
  './js/core/widgets.js',
  './js/data/characters.js',
  './js/data/enemies.js',
  './js/data/portals.js',
  './js/data/premium.js',
  './js/data/arena.js',
  './js/scenes/BootScene.js',
  './js/scenes/PreloadScene.js',
  './js/scenes/WorldScene.js',
  './js/scenes/BattleTacticsScene.js',
  './js/scenes/UIScene.js'
];

// Assets gráficos (pueden faltar en desarrollo sin romper la instalación)
const EXTRA = [
  './assets/chars/kaito.png',
  './assets/chars/rin.png',
  './assets/chars/yuna.png',
  './assets/chars/grom.png',
  './assets/chars/sora.png',
  './assets/chars/dante.png',
  './assets/chars/mika.png',
  './assets/chars/roku.png',
  './assets/chars/elena.png',
  './assets/chars/atlas.png',
  './assets/chars/nix.png',
  './assets/chars/hana.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(async cache => {
        await cache.addAll(NUCLEO);
        await Promise.allSettled(EXTRA.map(u => cache.add(u)));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // sin peticiones externas: totalmente offline

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;                    // cache-first estricta
      return fetch(e.request).then(resp => {
        if (resp && resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, copia));
        }
        return resp;
      }).catch(() => {
        // Fallback de navegación offline: siempre arranca la app
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
