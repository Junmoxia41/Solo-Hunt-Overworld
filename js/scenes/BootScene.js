/* =========================================================
   BootScene — Arranque mínimo: inicializa registro global,
   safe area y estado de entrada, y pasa al preloader.
   ========================================================= */
import { leerSafeArea } from '../core/safearea.js';
import { Save } from '../core/save.js';
import { setWorldSeed, SEMILLA_OFFLINE } from '../core/worldgen.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  create() {
    // Zonas seguras de pantalla (notch iPhone, gestos Android…)
    this.registry.set('safe', leerSafeArea());
    // Vector del joystick virtual compartido WorldScene <-> UIScene
    this.registry.set('stick', { x: 0, y: 0 });

    // Carga de partida y semilla del mundo
    Save.load();
    setWorldSeed(Save.data.seed || SEMILLA_OFFLINE);

    this.scene.start('preload');
  }
}
