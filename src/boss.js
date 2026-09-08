/* ============================================================
   boss.js — Jefes de mazmorra (MILESTONE 2)
   Incluye la estructura de fases ya esbozada para que la
   implementación encaje sin romper la arquitectura.
   ============================================================ */
import { Enemy } from './enemy.js';

/**
 * TODO(M2): Jefes con 3 fases (umbrales 100/60/30%), patrones
 * por fase, barra de vida grande y drops legendarios de ARISE
 * garantizado. Ver GDD v2.0 §FASE 13.
 */
export class Boss extends Enemy {
  constructor(game, x, y, tipoBoss, nivel) {
    super(game, x, y, tipoBoss, nivel);
    this.phase = 1;
    this.phaseThresholds = [1.0, 0.6, 0.3];
    this.esBoss = true;
    // TODO(M2): patrones, enrage, barra grande, animación de muerte épica
  }
}
