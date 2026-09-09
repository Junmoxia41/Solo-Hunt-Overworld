/* ============================================================
   sw.js — Service Worker de Solo Hunt Overworld v2
   Estrategia: PRECACHE total al instalar + cache-first en fetch.
   El juego es 100% offline tras la primera visita.
   ============================================================ */
const CACHE = 'sh-v2-2.1.0';

// Todo lo necesario para jugar sin conexión
const PRECACHE = [
  './', './index.html', './style.css', './manifest.json',
  './src/main.js', './src/game.js', './src/constants.js', './src/utils.js',
  './src/camera.js', './src/input.js', './src/player.js', './src/enemy.js',
  './src/boss.js', './src/combat.js', './src/projectile.js', './src/particle.js',
  './src/item.js', './src/inventory.js', './src/quest.js', './src/npc.js',
  './src/dialogue.js', './src/shadow.js', './src/map.js', './src/dungeon.js',
  './src/ui.js', './src/audio.js', './src/save.js', './src/loader.js',
  './data/enemies.json', './data/items.json', './data/quests.json', './data/dialogues.json',
  './assets/fonts/pressstart2p.woff2',
  './assets/ui/icon-192.png', './assets/ui/icon-512.png',
  './assets/ui/icon-512-maskable.png', './assets/ui/apple-touch-icon.png',
  './assets/ui/loading_1.png', './assets/ui/loading_2.png',
  './assets/ui/loading_3.png', './assets/ui/loading_4.png',
  './assets/chars/kaito.png', './assets/chars/rin.png', './assets/chars/yuna.png',
  './assets/chars/grom.png', './assets/chars/sora.png', './assets/chars/dante.png',
  './assets/chars/mika.png', './assets/chars/roku.png', './assets/chars/elena.png',
  './assets/chars/atlas.png', './assets/chars/nix.png', './assets/chars/hana.png',
  './assets/chars/lado_kaito.png', './assets/chars/lado_rin.png',
  './assets/chars/lado_grom.png', './assets/chars/lado_sora.png',
  './assets/chars/lado_dante.png', './assets/chars/lado_mika.png',
  './assets/chars/lado_roku.png', './assets/chars/lado_atlas.png',
  './assets/chars/lado_nix.png', './assets/chars/lado_hana.png',
  './assets/sprites/lobo.png', './assets/sprites/murcielago.png',
  './assets/sprites/nomuerto.png', './assets/sprites/duende.png', './assets/sprites/mago.png',
  './assets/tiles/arbol.png', './assets/tiles/flor.png', './assets/tiles/roca.png'
];

self.addEventListener('install', e => {
  // Precaché: si algo falta, el juego nunca dice "offline" a medias
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(err => console.error('SW precache incompleto:', err))
  );
});

self.addEventListener('activate', e => {
  // Purgar cachés de versiones anteriores
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // cache-first; si no está, red y memorizar
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res && res.status === 200 && e.request.url.startsWith('http')) {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
      }
      return res;
    }).catch(() => caches.match('./index.html'))) // fallback: la app
  );
});
