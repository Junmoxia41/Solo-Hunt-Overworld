/* ============================================================
   main.js — Punto de entrada de Solo Hunt Overworld v2
   Inicia el juego y registra el Service Worker (PWA offline).
   ============================================================ */
import { Game } from './game.js';

window.addEventListener('DOMContentLoaded', async () => {
  const game = new Game();
  await game.init();
  game.start();
  window.__game = game; // depuración en consola

  // PWA: offline-first (solo bajo https o localhost)
  if ('serviceWorker' in navigator && ['https:', 'http:'].includes(location.protocol)) {
    try {
      await NavigatorSW();
    } catch (e) { /* la app sigue sin SW si el entorno lo bloquea */ }
  }
});

async function NavigatorSW() {
  await navigator.serviceWorker.register('./sw.js');
}
