/* ============================================================
   map.js — EL VOLUMEN: mapa del mundo por biomas (Folios).
   Mundo 160×160 tiles con 4 biomas: bosque, pradera, cementerio
   y ciénaga. Bordes orgánicos entre Folios, caminos cruzados,
   colisión de tronco en árboles, tumbas/rocas sólidas, y render
   con paleta + detalles por bioma. Seed fija: siempre igual.
   ============================================================ */
import { TILE_SIZE, WORLD_SIZE } from './constants.js';
import { BIOMAS, ORDEN_BIOMAS, biomaIdx } from './world.js';

// Portales repartidos por Folios: E bosque · D pradera · C cementerio · S ciénaga
const PORTALES = [
  { rango: 'E', tx: 68,  ty: 12,  color: 0x8bc34a, css: '#8bc34a' },
  { rango: 'D', tx: 120, ty: 30,  color: 0x26c6da, css: '#26c6da' },
  { rango: 'C', tx: 30,  ty: 130, color: 0x42a5f5, css: '#42a5f5' },
  { rango: 'S', tx: 120, ty: 130, color: 0xff9800, css: '#ff9800' }
];

const W = WORLD_SIZE, H = WORLD_SIZE;

export class Mapa {
  constructor(game, seed = 1) {
    this.game = game;
    this.name = 'el_volumen'; // el mundo entero (las mazmorras se llaman 'mazmorra')
    this.width = W; this.height = H;
    this.tileSize = TILE_SIZE;
    this.pixelW = W * TILE_SIZE;
    this.pixelH = H * TILE_SIZE;
    this.ambientColor = BIOMAS.bosque.ambiente; // se actualiza según la cámara

    // Capas: suelo (0 hierba A, 1 hierba B, 2 tierra/camino, 3 agua)
    //        solid: 1 pared, 2 agua, 3 árbol (tronco), 4 sólido bajo (roca/tumba)
    this.suelo = new Uint8Array(W * H);
    this.solid = new Uint8Array(W * H);
    this.deco = new Array(W * H).fill(null);  // 'arbol' | 'flor' | 'solido'
    this.bioma = new Uint8Array(W * H);       // índice de Folio por tile

    this._generar(seed);
    this.portalesPos = PORTALES.map(p => ({ ...p, x: p.tx * TILE_SIZE + 16, y: p.ty * TILE_SIZE + 16 }));
    for (const p of this.portalesPos) this._limpiarArea(p.tx, p.ty, 2); // plaza despejada
    this._limpiarArea(40, 40, 3); // campamento central (spawn + NPCs)

    // Colisiones de TRONCO + capa ALTA de árboles (profundidad con entidades)
    this.tronco = {};
    this.tall = [];
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const i = ty * W + tx;
      if (this.deco[i] === 'arbol') {
        const bid = ORDEN_BIOMAS[this.bioma[i]];
        this.tall.push({ tipo: 'arbol', x: tx * TILE_SIZE + 16, baseY: ty * TILE_SIZE + 30, ancho: 46, alto: 65, sprite: BIOMAS[bid].deco.arbol });
        this.tronco[i] = { x: tx * TILE_SIZE + 10, y: ty * TILE_SIZE + 8, w: 12, h: 22 };
      }
    }
    this.tall.sort((a, b) => a.baseY - b.baseY);
    this._tallWrap = this.tall.map(it => ({
      y: it.baseY,
      o: { x: it.x - 32, y: it.baseY - 96, width: 64, height: 120, render: c => this.dibujarAlto(c, it) }
    }));
  }

  /* ---------- Utilidades de ruido/terreno ---------- */
  _ruido(x, y, s) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + s) * 43758.5453;
    return n - Math.floor(n);
  }
  _esTierra(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return false;
    return this.suelo[ty * W + tx] !== 3;
  }
  _siEmbTierra(tx, ty) {
    return this._esTierra(tx - 1, ty) || this._esTierra(tx + 1, ty) ||
           this._esTierra(tx, ty - 1) || this._esTierra(tx, ty + 1);
  }

  /** Bioma (id string) en coordenadas de TILE */
  biomaEn(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return 'bosque';
    return ORDEN_BIOMAS[this.bioma[ty * W + tx]];
  }
  /** Bioma (id string) en coordenadas de MUNDO (píxeles) */
  biomaEnPixel(wx, wy) { return this.biomaEn(Math.floor(wx / TILE_SIZE), Math.floor(wy / TILE_SIZE)); }

  _limpiarArea(tx, ty, r) {
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue;
      const i = y * W + x;
      this.solid[i] = 0;
      this.deco[i] = null;
      if (this.suelo[i] === 3) this.suelo[i] = this._ruido(x, y, 4) > 0.5 ? 0 : 1;
    }
  }

  /* ---------- Generación ---------- */
  _generar(seed) {
    const ruido = (x, y, s) => this._ruido(x, y, s);
    const aguaDe = {};

    // 1) Agua especial por bioma (lagos/estanques/pantano) antes del resto
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const bIdx = biomaIdx(x, y, ruido);
      this.bioma[i] = bIdx;
      const bid = ORDEN_BIOMAS[bIdx];
      const B = BIOMAS[bid];
      let agua = false;

      // borde del mundo: pared de roca
      if (x <= 1 || y <= 1 || x >= W - 2 || y >= H - 2) { this.solid[i] = 1; this.suelo[i] = 1; aguaDe[i] = bid; continue; }

      const extra = B.aguaExtra;
      if (extra?.tipo === 'lago') {
        const dx = (x - extra.cx) / extra.rx, dy = (y - extra.cy) / extra.ry;
        agua = dx * dx + dy * dy < 1 + ruido(x, y, 8) * 0.25;
      } else if (extra?.tipo === 'estanques') {
        for (const [cx, cy, rx, ry] of extra.lista) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          if (dx * dx + dy * dy < 1 + ruido(x, y, 8) * 0.2) { agua = true; break; }
        }
      } else if (extra?.tipo === 'pantano') {
        agua = ruido(Math.floor(x / 2), Math.floor(y / 2), extra.ruido) > extra.umbral;
      }
      if (agua) { this.suelo[i] = 3; this.solid[i] = 2; aguaDe[i] = bid; continue; }

      // suelo base: dos tonos de hierba del bioma
      this.suelo[i] = ruido(x, y, 4) > 0.5 ? 0 : 1;

      // decoración según umbrales del bioma
      const u = B.umbrales;
      if (ruido(x, y, 1) > u.arbol) { this.solid[i] = 3; this.deco[i] = 'arbol'; continue; }
      if (ruido(x, y, 2) > u.flor) this.deco[i] = 'flor';
      else if (ruido(x, y, 3) > u.solido) { this.deco[i] = 'solido'; this.solid[i] = 4; }
    }

    // 2) Caminos cruzados: conectan los 4 Folios (secables sobre agua)
    for (let x = 4; x < W - 4; x++) { this._camino(x, 40); this._camino(x, 120); }
    for (let y = 4; y < H - 4; y++) { this._camino(40, y); this._camino(120, y); }
  }

  /** Convierte un tile en camino de tierra transitable (seca el agua) */
  _camino(x, y) {
    const i = y * W + x;
    if (x <= 1 || y <= 1 || x >= W - 2 || y >= H - 2) return;
    if (this.solid[i] === 1) return; // no taladrar la muralla
    this.suelo[i] = 2;
    this.solid[i] = 0;
    this.deco[i] = null;
  }

  /* ---------- Colisiones ---------- */
  isSolid(wx, wy) {
    const tx = Math.floor(wx / TILE_SIZE), ty = Math.floor(wy / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
    return this.solid[ty * W + tx] !== 0;
  }

  /** ¿Colisiona un rectángulo? Recorre TODOS los tiles que toca.
   *  Árboles: solo el TRONCO bloquea; rocas y tumbas: el tile entero. */
  rectSolido(x, y, w, h) {
    const tx0 = Math.floor(x / TILE_SIZE), tx1 = Math.floor((x + w) / TILE_SIZE);
    const ty0 = Math.floor(y / TILE_SIZE), ty1 = Math.floor((y + h) / TILE_SIZE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
      const i = ty * W + tx;
      const s = this.solid[i];
      if (s === 0) continue;
      if (s === 3) { // árbol: solo el tronco
        const t = this.tronco[i];
        if (t && x < t.x + t.w && x + w > t.x && y < t.y + t.h && y + h > t.y) return true;
        continue;
      }
      return true; // pared, agua, roca o tumba
    }
    return false;
  }

  /* ---------- Capa alta (árboles: profundidad con el jugador) ---------- */
  dibujarAlto(ctx, it) {
    const img = this.game.assets[it.sprite];
    if (img) {
      ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(it.x, it.baseY - 2, 10, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      const wA = 46, hA = 65;
      ctx.drawImage(img, it.x - wA / 2, it.baseY - hA, wA, hA);
    } else { // respaldo procedural (pinos)
      const px = it.x - 16, py = it.baseY - 32;
      ctx.fillStyle = '#5d4037'; ctx.fillRect(px + 13, py + 18, 6, 12);
      ctx.fillStyle = '#14532d';
      ctx.beginPath(); ctx.moveTo(px + 16, py - 4); ctx.lineTo(px + 4, py + 14); ctx.lineTo(px + 28, py + 14); ctx.fill();
      ctx.fillStyle = '#166534';
      ctx.beginPath(); ctx.moveTo(px + 16, py - 10); ctx.lineTo(px + 2, py + 8); ctx.lineTo(px + 30, py + 8); ctx.fill();
    }
  }

  /* ---------- Render del terreno ---------- */
  render(ctx, camera) {
    const T = TILE_SIZE;
    const x0 = Math.max(0, Math.floor(camera.x / T)), y0 = Math.max(0, Math.floor(camera.y / T));
    const x1 = Math.min(W, Math.ceil((camera.x + camera.width) / T));
    const y1 = Math.min(H, Math.ceil((camera.y + camera.height) / T));
    const t = this.game.lastTime / 1000;

    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * W + x;
      const px = x * T, py = y * T;
      const s = this.suelo[i];
      const bid = ORDEN_BIOMAS[this.bioma[i]];
      const B = BIOMAS[bid];
      const nit = this._ruido(x, y, 99);

      /* — Suelo — */
      if (s === 3) { // Agua con la paleta del bioma
        ctx.fillStyle = B.aguaA; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = nit > 0.5 ? B.aguaB : B.aguaC;
        ctx.fillRect(px, py, T, T);
        if (this._siEmbTierra(x, y)) {
          ctx.fillStyle = 'rgba(200,225,255,0.30)';
          if (this._esTierra(x - 1, y)) ctx.fillRect(px, py, 3, T);
          if (this._esTierra(x + 1, y)) ctx.fillRect(px + T - 3, py, 3, T);
          if (this._esTierra(x, y - 1)) ctx.fillRect(px, py, T, 3);
          if (this._esTierra(x, y + 1)) ctx.fillRect(px, py + T - 3, T, 3);
        }
        ctx.fillStyle = bid === 'cenaga' ? 'rgba(90,200,160,0.18)' : 'rgba(140,190,255,0.30)';
        const ola = Math.sin(t * 2 + (x + y) * 0.8) * 6;
        ctx.fillRect(px + 4 + ola, py + 12, 14, 2);
        ctx.fillStyle = bid === 'cenaga' ? 'rgba(140,255,220,0.22)' : 'rgba(220,240,255,0.35)';
        ctx.fillRect(px + 12 - ola, py + 22, 12, 2);
      } else if (s === 2) { // Tierra/camino
        ctx.fillStyle = B.tierra; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = B.tierraClara; ctx.fillRect(px, py, T, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(px + ((x * 7) % 20), py + ((y * 13) % 20), 5, 3);
        ctx.fillStyle = 'rgba(255,235,170,0.14)';
        if (nit > 0.55) ctx.fillRect(px + 3 + ((x * 11) % 22), py + 3 + ((y * 5) % 22), 3, 2);
      } else { // Hierba (dos tonos del bioma)
        ctx.fillStyle = s === 0 ? B.sueloA : B.sueloB;
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        if ((x + y) % 4 === 0) ctx.fillRect(px, py, T, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        ctx.fillRect(px + ((x * 11) % 26), py + ((y * 17) % 26), 3, 3);
        ctx.fillRect(px + ((x * 5) % 26), py + ((y * 7) % 26), 2, 2);
        // detalle propio del bioma
        if (B.detalle === 'briznas' && nit > 0.6) {
          ctx.strokeStyle = B.brizna; ctx.lineWidth = 1;
          const bx = px + 4 + Math.floor(nit * 20);
          ctx.beginPath();
          ctx.moveTo(bx, py + 26); ctx.lineTo(bx + 1, py + 20);
          ctx.moveTo(bx + 5, py + 24); ctx.lineTo(bx + 6, py + 19);
          ctx.stroke();
        } else if (B.detalle === 'briznas_altas' && nit > 0.45) {
          ctx.strokeStyle = B.brizna; ctx.lineWidth = 1.5;
          const bx = px + 3 + Math.floor(nit * 22);
          ctx.beginPath();
          ctx.moveTo(bx, py + 28); ctx.lineTo(bx + 2, py + 18);
          ctx.moveTo(bx + 6, py + 27); ctx.lineTo(bx + 8, py + 15);
          ctx.stroke();
          if (nit > 0.85) { // mota de sol
            ctx.fillStyle = 'rgba(255,240,160,0.5)';
            ctx.fillRect(px + 14, py + 10, 3, 3);
          }
        } else if (B.detalle === 'niebla') {
          if (nit > 0.55) {
            const deriva = Math.sin(t * 0.7 + x * 0.6) * 5;
            ctx.fillStyle = 'rgba(220,220,235,0.10)';
            ctx.fillRect(px + deriva, py + 10 + (nit * 12), 26, 5);
          }
        } else if (B.detalle === 'lodo' && nit > 0.72) {
          ctx.fillStyle = 'rgba(30,25,15,0.30)';
          ctx.beginPath(); ctx.ellipse(px + 16, py + 18, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Rejilla sutil
      ctx.strokeStyle = 'rgba(0,0,0,0.07)';
      ctx.strokeRect(px + .5, py + .5, T, T);

      /* — Decoración baja: flores y sólidos (rocas/tumbas) del bioma — */
      const d = this.deco[i];
      if (d === 'flor' && B.deco.flor) {
        const img = this.game.assets[B.deco.flor];
        if (img) {
          const wF = 22, hF = 26;
          ctx.drawImage(img, px + 16 - wF / 2, py + 28 - hF + ((x + y) % 2 ? -2 : 0), wF, hF);
          if (bid === 'cenaga') { // halo de la flor bioluminiscente
            ctx.save(); ctx.globalAlpha = 0.16 + Math.sin(t * 3 + x) * 0.08;
            ctx.fillStyle = '#00e5ff';
            ctx.beginPath(); ctx.arc(px + 16, py + 16, 15, 0, Math.PI * 2); ctx.fill(); ctx.restore();
          }
        }
      } else if (d === 'solido') {
        const img = this.game.assets[B.deco.solido];
        if (B.deco.solidoTipo === 'tumba' && img) {
          ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.ellipse(px + 16, py + 26, 11, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
          ctx.drawImage(img, px + 16 - 13, py + 28 - 26, 26, 26);
        } else if (img) { // roca
          ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.ellipse(px + 16, py + 23, 12, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
          ctx.drawImage(img, px + 16 - 14, py + 25 - 24, 28, 24);
        } else { // respaldo
          ctx.fillStyle = '#7d8590';
          ctx.beginPath(); ctx.arc(px + 16, py + 20, 9, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    /* — Portales — */
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

  /** Ambiente (tinte) según el bioma del centro de la cámara */
  renderOverlay(ctx, camera) {
    const bid = this.biomaEnPixel(camera.x + camera.width / 2, camera.y + camera.height / 2);
    this.ambientColor = BIOMAS[bid]?.ambiente || 'rgba(20,8,40,0.10)';
    ctx.fillStyle = this.ambientColor;
    ctx.fillRect(camera.x, camera.y, camera.width, camera.height);
  }
}
