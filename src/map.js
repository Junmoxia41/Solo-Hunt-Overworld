/* ============================================================
   map.js — Mapa procedural con tiles, colisiones, decoración,
   portales y ambiente. Seed fija por zona: siempre igual.
   ============================================================ */
import { TILE_SIZE, MAP_W, MAP_H } from './constants.js';
import { seededRng } from './utils.js';

const PORTALES = [
  { rango: 'E', tx: 68, ty: 12, color: 0x8bc34a, css: '#8bc34a' },
  { rango: 'D', tx: 70, ty: 66, color: 0x26c6da, css: '#26c6da' },
  { rango: 'C', tx: 10, ty: 68, color: 0x42a5f5, css: '#42a5f5' },
  { rango: 'S', tx: 8,  ty: 10, color: 0xff9800, css: '#ff9800' }
];

export class Mapa {
  constructor(game, seed = 1) {
    this.game = game;
    this.name = 'bosque_inicial';
    this.width = MAP_W;
    this.height = MAP_H;
    this.tileSize = TILE_SIZE;
    this.pixelW = MAP_W * TILE_SIZE;
    this.pixelH = MAP_H * TILE_SIZE;
    this.ambientColor = 'rgba(20, 8, 40, 0.10)';

    // Capas: [0] suelo (0 hierba, 1 hierba oscura, 2 tierra, 3 agua)
    //        solid: 1 pared/roca, 2 agua, 3 árbol
    this.suelo = new Uint8Array(MAP_W * MAP_H);
    this.solid = new Uint8Array(MAP_W * MAP_H);
    this.deco = new Array(MAP_W * MAP_H).fill(null); // 'arbol'|'flor'|'roca'

    this._generar(seed);
    this.portalesPos = PORTALES.map(p => ({ ...p, x: p.tx * TILE_SIZE + 16, y: p.ty * TILE_SIZE + 16 }));
    for (const p of this.portalesPos) this._limpiarArea(p.tx, p.ty, 2); // plaza despejada
    this._limpiarArea(40, 40, 3); // zona de spawn central despejada

    // Capa ALTA (árboles y rocas): se dibuja mezclada con las entidades
    // en orden de profundidad (y) para que el jugador pase POR DETRÁS.
    this.tall = [];
    for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
      const d = this.deco[ty * MAP_W + tx];
      if (d === 'arbol') this.tall.push({ tipo: 'arbol', x: tx * TILE_SIZE + 16, baseY: ty * TILE_SIZE + 30, ancho: 46, alto: 65 });
      else if (d === 'roca') this.tall.push({ tipo: 'roca', x: tx * TILE_SIZE + 16, baseY: ty * TILE_SIZE + 25, ancho: 28, alto: 24 });
    }
    this.tall.sort((a, b) => a.baseY - b.baseY);
  }

  _generar(seed) {
    const rnd = seededRng(seed * 977 + 13);
    const ruido = (x, y, s) => { // ruido simple determinista
      const n = Math.sin(x * 12.9898 + y * 78.233 + s) * 43758.5453;
      return n - Math.floor(n);
    };
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x;
      // borde del mundo: pared de roca
      if (x <= 1 || y <= 1 || x >= MAP_W - 2 || y >= MAP_H - 2) { this.solid[i] = 1; this.suelo[i] = 1; continue; }
      this.suelo[i] = ruido(x, y, 4) > 0.5 ? 0 : 1;
      // lago orgánico en el cuadrante suroeste
      const dx = (x - 20) / 9, dy = (y - 56) / 6;
      if (dx * dx + dy * dy < 1 + ruido(x, y, 8) * 0.25) { this.suelo[i] = 3; this.solid[i] = 2; continue; }
      // bosquecillos de pinos
      if (ruido(x, y, 1) > 0.93) { this.solid[i] = 3; this.deco[i] = 'arbol'; continue; }
      if (ruido(x, y, 2) > 0.965) this.deco[i] = 'flor';
      else if (ruido(x, y, 3) > 0.975) { this.deco[i] = 'roca'; this.solid[i] = 4; } // roca SÓLIDA
      // camino de tierra en cruz desde el spawn
      if (Math.abs(x - 40) <= 1 || Math.abs(y - 40) <= 1) { if (this.solid[i] !== 2) { this.suelo[i] = 2; } this.deco[i] = null; if (this.solid[i] >= 3) this.solid[i] = 0; }
      void rnd;
    }
  }

  /** ¿Tile de tierra firme en (tx, ty)? (para espumas del lago) */
  _esTierra(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
    return this.suelo[ty * MAP_W + tx] !== 3;
  }
  _siEmbTierra(tx, ty) {
    return this._esTierra(tx - 1, ty) || this._esTierra(tx + 1, ty) ||
           this._esTierra(tx, ty - 1) || this._esTierra(tx, ty + 1);
  }
  /** Ruido determinista por tile (grano de textura) */
  _ruidoTile(x, y, s) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + s) * 43758.5453;
    return n - Math.floor(n);
  }

  _limpiarArea(tx, ty, r) {
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
      if (x < 2 || y < 2 || x >= MAP_W - 2 || y >= MAP_H - 2) continue;
      const i = y * MAP_W + x;
      this.solid[i] = 0; this.deco[i] = null;
    }
  }

  isSolid(wx, wy) {
    const tx = Math.floor(wx / TILE_SIZE), ty = Math.floor(wy / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
    return this.solid[ty * MAP_W + tx] !== 0;
  }

  /** ¿Colisiona un rectángulo contra tiles sólidos? (recorre TODOS los
   *  tiles que toca el rectángulo: sin puntos ciegos entre esquinas) */
  rectSolido(x, y, w, h) {
    const tx0 = Math.floor(x / TILE_SIZE), tx1 = Math.floor((x + w) / TILE_SIZE);
    const ty0 = Math.floor(y / TILE_SIZE), ty1 = Math.floor((y + h) / TILE_SIZE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
      if (this.solid[ty * MAP_W + tx] !== 0) return true;
    }
    return false;
  }

  render(ctx, camera) {
    const T = TILE_SIZE;
    const x0 = Math.max(0, Math.floor(camera.x / T)), y0 = Math.max(0, Math.floor(camera.y / T));
    const x1 = Math.min(MAP_W, Math.ceil((camera.x + camera.width) / T));
    const y1 = Math.min(MAP_H, Math.ceil((camera.y + camera.height) / T));
    const t = this.game.lastTime / 1000;

    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * MAP_W + x;
      const px = x * T, py = y * T;
      const s = this.suelo[i];
      const nit = this._ruidoTile(x, y, 99); // grano determinista por tile
      // Suelo
      if (s === 3) { // — Agua: azul profundo, olas y cristalinas —
        ctx.fillStyle = '#16407c';
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = nit > 0.5 ? '#1b4a90' : '#123a74';
        ctx.fillRect(px, py, T, T);
        // orilla espumosa al tocar tierra
        if (this._siEmbTierra(x, y)) {
          ctx.fillStyle = 'rgba(190,230,255,0.35)';
          if (this._esTierra(x - 1, y)) ctx.fillRect(px, py, 3, T);
          if (this._esTierra(x + 1, y)) ctx.fillRect(px + T - 3, py, 3, T);
          if (this._esTierra(x, y - 1)) ctx.fillRect(px, py, T, 3);
          if (this._esTierra(x, y + 1)) ctx.fillRect(px, py + T - 3, T, 3);
        }
        ctx.fillStyle = 'rgba(140,190,255,0.30)';
        const ola = Math.sin(t * 2 + (x + y) * 0.8) * 6;
        ctx.fillRect(px + 4 + ola, py + 12, 14, 2);
        ctx.fillStyle = 'rgba(220,240,255,0.35)';
        ctx.fillRect(px + 12 - ola, py + 22, 12, 2);
      } else if (s === 2) { // — Tierra: pardo con guijarros y borde rugoso —
        ctx.fillStyle = '#6b4f2a'; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#755a31'; ctx.fillRect(px, py, T, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(px + ((x * 7) % 20), py + ((y * 13) % 20), 5, 3);
        ctx.fillStyle = 'rgba(255,220,150,0.16)';
        if (nit > 0.55) ctx.fillRect(px + 3 + ((x * 11) % 22), py + 3 + ((y * 5) % 22), 3, 2);
        if (nit < 0.35) ctx.fillRect(px + 14, py + 18, 4, 2);
      } else { // — Hierba: dos tonos + briznas y motas de luz —
        ctx.fillStyle = s === 0 ? '#2f7a3d' : '#2a6f38';
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        if ((x + y) % 4 === 0) ctx.fillRect(px, py, T, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        ctx.fillRect(px + ((x * 11) % 26), py + ((y * 17) % 26), 3, 3);
        ctx.fillRect(px + ((x * 5) % 26), py + ((y * 7) % 26), 2, 2);
        // briznas de hierba (puñado de líneas verticales alternas)
        if (nit > 0.6) {
          ctx.strokeStyle = 'rgba(20,70,35,0.55)'; ctx.lineWidth = 1;
          const bx = px + 4 + Math.floor(nit * 20);
          ctx.beginPath();
          ctx.moveTo(bx, py + 26); ctx.lineTo(bx + 1, py + 20);
          ctx.moveTo(bx + 5, py + 24); ctx.lineTo(bx + 6, py + 19);
          ctx.stroke();
        }
      }
      // Rejilla sutil
      ctx.strokeStyle = 'rgba(0,0,0,0.07)';
      ctx.strokeRect(px + .5, py + .5, T, T);

      // Decoración baja (flores) — árboles y rocas van en la capa alta
      const d = this.deco[i];
      const g = this.game;
      if (d === 'flor') {
        const img = g.assets['tile_flor'];
        if (img) {
          const wF = 22, hF = 26;
          ctx.drawImage(img, px + 16 - wF / 2, py + 28 - hF + ((x + y) % 2 ? -2 : 0), wF, hF);
        } else {
          ctx.font = '13px serif'; ctx.textAlign = 'center';
          ctx.fillText(((x + y) % 2) ? '🌸' : '🌼', px + 16, py + 21);
        }
      }
    }

    // Portales
    for (const p of this.portalesPos) {
      const pulso = 0.7 + Math.sin(t * 2.6 + p.tx) * 0.25;
      const grad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 26 * pulso + 8);
      grad.addColorStop(0, '#fff');
      grad.addColorStop(0.25, p.css);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(p.x, p.y, 26 * pulso + 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = p.css;
      ctx.lineWidth = 2;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(t * 0.9);
      ctx.strokeRect(-14, -14, 28, 28);
      ctx.restore();
      ctx.fillStyle = p.css;
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('RANGO ' + p.rango, p.x, p.y - 34);
      // partículas ambientales del portal
      if (Math.random() < 0.1) {
        this.game.particles.push({
          x: p.x + (Math.random() * 30 - 15), y: p.y + (Math.random() * 30 - 15),
          vx: 0, vy: -14, size: 2 + Math.random() * 2, color: p.css,
          maxLife: 1, life: 1, alpha: 1, gravity: 0, friction: 1, shrink: true, type: 'circle',
          update(dt) { this.y += this.vy * dt; this.life -= dt; this.alpha = this.life; },
          render(c) { c.save(); c.globalAlpha = this.alpha; c.fillStyle = this.color; c.beginPath(); c.arc(this.x, this.y, this.size, 0, 7); c.fill(); c.restore(); },
          isDead() { return this.life <= 0; }
        });
      }
    }
  }

  /** Dibuja un elemento ALTO (árbol/roca). El Game lo llama en orden de
   *  profundidad mezclado con jugador/enemigos: si el jugador está por
   *  detrás (pies más arriba), el árbol se pinta ENCIMA y lo tapa. */
  dibujarAlto(ctx, it) {
    const g = this.game;
    if (it.tipo === 'arbol') {
      const img = g.assets['tile_arbol'];
      if (img) {
        ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(it.x, it.baseY - 2, 10, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        const wA = 46, hA = 65; // sprite 181x256 remasterizado
        ctx.drawImage(img, it.x - wA / 2, it.baseY - hA, wA, hA);
      } else { // respaldo procedural
        const px = it.x - 16, py = it.baseY - 32;
        ctx.fillStyle = '#5d4037'; ctx.fillRect(px + 13, py + 18, 6, 12);
        ctx.fillStyle = '#14532d';
        ctx.beginPath(); ctx.moveTo(px + 16, py - 4); ctx.lineTo(px + 4, py + 14); ctx.lineTo(px + 28, py + 14); ctx.fill();
        ctx.fillStyle = '#166534';
        ctx.beginPath(); ctx.moveTo(px + 16, py - 10); ctx.lineTo(px + 2, py + 8); ctx.lineTo(px + 30, py + 8); ctx.fill();
      }
    } else if (it.tipo === 'roca') {
      const img = g.assets['tile_roca'];
      if (img) {
        ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(it.x, it.baseY - 2, 12, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        ctx.drawImage(img, it.x - 14, it.baseY - 24, 28, 24);
      } else { // respaldo procedural
        const px = it.x - 16, py = it.baseY - 32;
        ctx.fillStyle = '#7d8590';
        ctx.beginPath(); ctx.arc(px + 16, py + 20, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#565e68';
        ctx.beginPath(); ctx.arc(px + 13, py + 17, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  /** Ambiente nocturno por encima del mundo */
  renderOverlay(ctx, camera) {
    ctx.fillStyle = this.ambientColor;
    ctx.fillRect(camera.x, camera.y, camera.width, camera.height);
  }
}
