/* ============================================================
   camera.js — Cámara con seguimiento suave (lerp) y límites
   ============================================================ */
import { lerp, clamp } from './utils.js';
import { TILE_SIZE } from './constants.js';

export class Camera {
  constructor(x, y, width, height) {
    this.x = x; this.y = y;
    this.width = width; this.height = height;
    this.targetX = 0; this.targetY = 0;
    this.smoothing = 0.08; // factor lerp (más alto = más pegada al jugador)
  }

  update(dt, target, map) {
    this.targetX = target.x + target.width / 2 - this.width / 2;
    this.targetY = target.y + target.height / 2 - this.height / 2;
    this.x = lerp(this.x, this.targetX, this.smoothing);
    this.y = lerp(this.y, this.targetY, this.smoothing);
    // Nunca mostrar fuera del mapa
    if (map) {
      const w = map.width * TILE_SIZE, h = map.height * TILE_SIZE;
      this.x = clamp(this.x, 0, Math.max(0, w - this.width));
      this.y = clamp(this.y, 0, Math.max(0, h - this.height));
    }
  }

  isVisible(ent) {
    return ent.x + (ent.width || 32) > this.x &&
           ent.x < this.x + this.width &&
           ent.y + (ent.height || 32) > this.y &&
           ent.y < this.y + this.height;
  }
}
