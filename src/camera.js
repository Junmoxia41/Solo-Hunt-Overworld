/* ============================================================
   camera.js — Cámara con seguimiento suave (lerp), límites del
   mapa y ZOOM con rueda/pellizco/teclas. El zoom es suave: nunca
   da saltos, y la vista se recalcula (ancho/alto = pantalla/zoom)
   para que el seguimiento y los límites sigan siendo exactos.
   ============================================================ */
import { lerp, clamp } from './utils.js';
import { TILE_SIZE, ZOOM_MIN, ZOOM_MAX } from './constants.js';

export class Camera {
  constructor(screenW, screenH, zoomInicial = 1) {
    // Tamaño real de la pantalla (px del canvas)
    this.screenW = screenW;
    this.screenH = screenH;

    // Zoom suave: `zoom` es el valor actual, `zoomTarget` al que va
    this.zoom = zoomInicial;
    this.zoomTarget = zoomInicial;
    this.minZoom = ZOOM_MIN;
    this.maxZoom = ZOOM_MAX;

    // Tamaño de la VISTA en píxeles del mundo (depende del zoom)
    this.width = screenW / zoomInicial;
    this.height = screenH / zoomInicial;

    this.x = 0; this.y = 0;
    this.targetX = 0; this.targetY = 0;
    this.smoothing = 0.10; // factor de seguimiento (más alto = más pegada)
  }

  /** Cambiar tamaño del canvas (resize del navegador) */
  setScreen(w, h) {
    this.screenW = w; this.screenH = h;
    this._aplicarZoom();
  }

  _aplicarZoom() {
    this.width = this.screenW / this.zoom;
    this.height = this.screenH / this.zoom;
  }

  /** Fijar zoom objetivo con límites (opcionalmente al instante) */
  setZoom(z, instantaneo = false) {
    this.zoomTarget = clamp(z, this.minZoom, this.maxZoom);
    if (instantaneo) { this.zoom = this.zoomTarget; this._aplicarZoom(); }
  }

  /** Ajuste relativo (rueda / teclas +− / pellizco) */
  ajustarZoom(delta) { this.setZoom(this.zoomTarget + delta); }

  /** Colocar la cámara directamente sobre el objetivo (sin lerp) */
  snap(target, map) {
    this._aplicarZoom();
    this.targetX = target.x + target.width / 2 - this.width / 2;
    this.targetY = target.y + target.height / 2 - this.height / 2;
    this.x = this.targetX; this.y = this.targetY;
    this._limitar(map);
  }

  _limitar(map) {
    if (!map) return;
    const w = map.width * TILE_SIZE, h = map.height * TILE_SIZE;
    this.x = clamp(this.x, 0, Math.max(0, w - this.width));
    this.y = clamp(this.y, 0, Math.max(0, h - this.height));
  }

  update(dt, target, map) {
    // — Zoom suave hacia el objetivo (independiente del framerate) —
    if (this.zoom !== this.zoomTarget) {
      this.zoom = lerp(this.zoom, this.zoomTarget, 1 - Math.pow(0.001, dt));
      if (Math.abs(this.zoom - this.zoomTarget) < 0.004) this.zoom = this.zoomTarget;
      this._aplicarZoom();
    }

    // — Seguimiento del jugador (centrado en su cuerpo) —
    this.targetX = target.x + target.width / 2 - this.width / 2;
    this.targetY = target.y + target.height / 2 - this.height / 2;
    const k = 1 - Math.pow(1 - this.smoothing, dt * 60); // estabilizado a 60fps
    this.x = lerp(this.x, this.targetX, k);
    this.y = lerp(this.y, this.targetY, k);

    // Nunca mostrar fuera del mapa
    this._limitar(map);
  }

  isVisible(ent) {
    const margen = 80; // margen para sprites altos (árboles) que sobresalen
    return ent.x + (ent.width || 32) > this.x - margen &&
           ent.x < this.x + this.width + margen &&
           ent.y + (ent.height || 32) > this.y - margen &&
           ent.y < this.y + this.height + margen;
  }
}
