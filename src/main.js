/* ============================================================
   main.js — Punto de entrada de Solo Hunt Overworld v2
   ============================================================ */
import { Game } from './game.js';

window.addEventListener('DOMContentLoaded', async () => {
  const game = new Game();
  await game.init();
  game.start();
  window.__game = game; // depuración en consola
});
