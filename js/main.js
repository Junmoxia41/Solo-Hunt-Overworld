/* =========================================================
   Solo Hunt: Overworld — Punto de entrada
   Configura Phaser 3, registra las escenas, el Service Worker
   y el evento de instalación PWA.
   ========================================================= */
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { BattleTacticsScene } from './scenes/BattleTacticsScene.js';
import { UIScene } from './scenes/UIScene.js';

/* ---------- Configuración del motor ---------- */
const config = {
  type: Phaser.AUTO,                 // WebGL con fallback a Canvas
  parent: 'game-root',
  backgroundColor: '#050816',
  pixelArt: false,
  roundPixels: true,                 // menos aliasing en movimiento de sprites
  input: { activePointers: 2 },      // joystick + botones simultáneos en móvil
  scale: {
    mode: Phaser.Scale.RESIZE,       // el canvas ocupa siempre toda la pantalla
    width: window.innerWidth,
    height: window.innerHeight,
    autoCenter: Phaser.Scale.NO_CENTER
  },
  scene: [BootScene, PreloadScene, WorldScene, BattleTacticsScene, UIScene]
};

const game = new Phaser.Game(config);
window.__game = game; // útil para depuración

// Redimensionado manual (rotación de pantalla, barra del navegador móvil, etc.)
let resizeT = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => game.scale.resize(window.innerWidth, window.innerHeight), 120);
});

/* ---------- Registro del Service Worker (PWA offline) ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {/* modo dev sin SW */});
  });
}

/* ---------- Captura del evento de instalación PWA ---------- */
window.__installEvt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  window.__installEvt = e;
  document.dispatchEvent(new CustomEvent('pwa:instalable'));
});
