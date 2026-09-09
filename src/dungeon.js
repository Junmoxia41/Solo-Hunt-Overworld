/* ============================================================
   dungeon.js — Mazmorras procedurales por rango (E → S)
   Por cada piso: mapa de piedra generado con semilla, salas
   conectadas por pasillos, enemigos por rango y, en el último
   piso, un jefe con 3 fases. Con temporizador y resultados.
   Ver GDD v2.0 §FASE 7 y §FASE 13.
   ============================================================ */
import { TILE_SIZE, MAP_W, MAP_H, CARGA_MS } from './constants.js';
import { seededRng, randomInt, randomFloat, distance } from './utils.js';
import { Boss } from './boss.js';
import { crearItem, GroundItem } from './item.js';
import { pantallaCarga } from './loader.js';

/* ---------- Configuración por rango ---------- */
export const RANGOS = {
  E: { zona: 2,  pisos: 3, segPiso: 100, segExtra: 60, nivelMin: 1,  jefe: { nombre: 'LOBO ALFA CAÍDO',            tipo: 'lobo',      hpMult: 8,  atkMult: 1.6, css: '#8bc34a', recompensaExp: 260,  recompensaOro: 120 },  premioOroBase: 200,  pool: ['iron_sword', 'leather_armor', 'elixir'] },
  D: { zona: 4,  pisos: 4, segPiso: 95,  segExtra: 60, nivelMin: 5,  jefe: { nombre: 'REY DE LOS DUENDES',           tipo: 'duende',    hpMult: 9,  atkMult: 1.7, css: '#26c6da', recompensaExp: 520,  recompensaOro: 260 },  premioOroBase: 420,  pool: ['iron_sword', 'leather_armor', 'elixir'] },
  C: { zona: 7,  pisos: 5, segPiso: 90,  segExtra: 90, nivelMin: 10, jefe: { nombre: 'MAGO ANTIGUO PROFANADO',       tipo: 'mago',      hpMult: 10, atkMult: 1.8, css: '#42a5f5', recompensaExp: 1100, recompensaOro: 550 },  premioOroBase: 800,  pool: ['shadow_blade', 'elixir', 'iron_sword'] },
  B: { zona: 10, pisos: 6, segPiso: 85,  segExtra: 90, nivelMin: 15, jefe: { nombre: 'SEÑOR DE LOS NO-MUERTOS',      tipo: 'nomuerto',  hpMult: 11, atkMult: 1.9, css: '#e67e22', recompensaExp: 2200, recompensaOro: 1200 }, premioOroBase: 1500, pool: ['shadow_blade', 'elixir'] },
  S: { zona: 14, pisos: 7, segPiso: 80,  segExtra: 120, nivelMin: 20, jefe: { nombre: 'MONARCA DE LAS SOMBRAS',      tipo: 'mago',     hpMult: 13, atkMult: 2.1, css: '#ffd700', recompensaExp: 5000, recompensaOro: 3000 }, premioOroBase: 3000, pool: ['monarch_dagger', 'shadow_blade', 'elixir'] }
};

/* ---------- Mapa de mazmorra (interfaz compatible con Mapa) ---------- */
export class DungeonMap {
  constructor(game, seed, enBoss = false) {
    this.game = game;
    this.name = 'mazmorra';
    this.width = MAP_W; this.height = MAP_H;
    this.tileSize = TILE_SIZE;
    this.pixelW = MAP_W * TILE_SIZE; this.pixelH = MAP_H * TILE_SIZE;
    this.ambientColor = 'rgba(15, 5, 30, 0.28)';
    this.esBoss = [enBoss][0];

    this.suelo = new Uint8Array(MAP_W * MAP_H);      // 0 piedra, 1 piedra clara
    this.solid = new Uint8Array(MAP_W * MAP_H);      // 1 muro, 3 pilar
    this.deco = new Array(MAP_W * MAP_H).fill(null); // 'antorcha' | 'losa'
    this.portalesPos = [];                            // SALIDA (se activa al limpiar)

    this._generar(seed);

    // Pilares a la capa ALTA (se dibujan con profundidad: el jugador
    // puede pasar por detrás y el pilar lo tapa)
    this.tall = [];
    for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
      if (this.solid[ty * MAP_W + tx] === 3) {
        this.tall.push({ tipo: 'pilar', x: tx * TILE_SIZE + 16, baseY: ty * TILE_SIZE + TILE_SIZE, ancho: 32, alto: 40 });
      }
    }
    this.tall.sort((a, b) => a.baseY - b.baseY);
  }

  _pon(tx, ty, suelo, solid, deco = null) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return;
    const i = ty * MAP_W + tx;
    this.suelo[i] = suelo; this.solid[i] = solid; this.deco[i] = deco;
  }

  _hab(tx, ty, w, h, rnd) {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++)
      this._pon(x, y, rnd() < 0.12 ? 1 : 0, 0);
    // pilares de esquinas interiores
    if (w > 8 && rnd() < 0.5) { this._pon(tx + 2, ty + 2, 0, 3); this._pon(tx + w - 3, ty + h - 3, 0, 3); }
    // antorcha en alguna pared
    this._pon(tx + randomInt(0, w - 1), ty - 1, 0, 1, 'antorcha');
    return { cx: tx + Math.floor(w / 2), cy: ty + Math.floor(h / 2), tx, ty, w, h };
  }

  _pasilloH(x0, y, x1) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) { this._pon(x, y, 0, 0); this._pon(x, y + 1, 0, 0); } }
  _pasilloV(x, y0, y1) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) { this._pon(x, y, 0, 0); this._pon(x + 1, y, 0, 0); } }

  _generar(seed) {
    const rnd = seededRng(seed);
    // todo muro
    this.solid.fill(1);
    // salas repartidas por cuadrantes
    this.salas = [];
    const N = 10;
    const cols = 4, rows = 3;
    const cw = (MAP_W - 8) / cols, rh = (MAP_H - 8) / rows;
    const celdas = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) celdas.push([c, r]);
    // barajar celdas y tomar N
    for (let i = celdas.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [celdas[i], celdas[j]] = [celdas[j], celdas[i]]; }
    for (let i = 0; i < Math.min(N, celdas.length); i++) {
      const [c, r] = celdas[i];
      const sw = 9 + Math.floor(rnd() * 8), sh = 7 + Math.floor(rnd() * 7);
      const tx = 4 + Math.floor(c * cw + rnd() * (cw - sw - 2));
      const ty = 4 + Math.floor(r * rh + rnd() * (rh - sh - 2));
      this.salas.push(this._hab(tx, ty, sw, sh, rnd));
    }
    // conectar salas en cadena por orden (random walk determina conectividad)
    for (let i = 0; i < this.salas.length - 1; i++) {
      const a = this.salas[i], b = this.salas[i + 1];
      if (rnd() < 0.5) { this._pasilloH(a.cx, a.cy, b.cx); this._pasilloV(b.cx, a.cy, b.cy); }
      else { this._pasilloV(a.cx, a.cy, b.cy); this._pasilloH(a.cx, b.cy, b.cx); }
    }
    // entrada = sala más cercana al borde oeste; salida = más lejana de ella
    this.salas.sort((a, b) => a.cx - b.cx || a.cy - b.cy);
    this.entrada = this.salas[0];
    let far = 0, idx = 1;
    this.salas.forEach((s, i) => {
      const d = distance(s.cx, s.cy, this.entrada.cx, this.entrada.cy);
      if (d > far) { far = d; idx = i; }
    });
    this.salida = this.salas[idx];
    // losas decorativas sueltas
    for (let k = 0; k < 40; k++) {
      const x = Math.floor(rnd() * MAP_W), y = Math.floor(rnd() * MAP_H);
      const i = y * MAP_W + x;
      if (!this.solid[i] && !this.deco[i] && rnd() < 0.6) this.deco[i] = 'losa';
    }
  }

  isSolid(wx, wy) {
    const tx = Math.floor(wx / TILE_SIZE), ty = Math.floor(wy / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
    return this.solid[ty * MAP_W + tx] !== 0;
  }
  /** Recorre TODOS los tiles que toca el rectángulo (sin puntos ciegos) */
  rectSolido(x, y, w, h) {
    const tx0 = Math.floor(x / TILE_SIZE), tx1 = Math.floor((x + w) / TILE_SIZE);
    const ty0 = Math.floor(y / TILE_SIZE), ty1 = Math.floor((y + h) / TILE_SIZE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
      if (this.solid[ty * MAP_W + tx] !== 0) return true;
    }
    return false;
  }

  /** Dibuja un pilar (capa alta, orden de profundidad con el jugador) */
  dibujarAlto(ctx, it) {
    if (it.tipo !== 'pilar') return;
    ctx.fillStyle = '#262b3d'; ctx.fillRect(it.x - 16, it.baseY - 32, 32, 32);
    ctx.fillStyle = '#1a1e2e'; ctx.fillRect(it.x - 11, it.baseY - 34, 22, 38);
    ctx.fillStyle = '#333a52'; ctx.fillRect(it.x - 11, it.baseY - 34, 22, 5);
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
      if (this.solid[i] === 1) { // muro de piedra oscura con arista
        ctx.fillStyle = '#151223'; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#221c38'; ctx.fillRect(px, py, T, 4);
        ctx.fillStyle = (x + y) % 2 ? '#191530' : '#171328'; ctx.fillRect(px, py + 4, T, T - 4);
        if (!this.solid[i + MAP_W]) { ctx.fillStyle = '#2d2547'; ctx.fillRect(px, py + T - 6, T, 6); } // borde inferior
        if (this.deco[i] === 'antorcha') {
          const f = 0.85 + Math.sin(t * 9 + x) * 0.15;
          ctx.globalAlpha = f;
          ctx.font = '16px serif'; ctx.textAlign = 'center';
          ctx.fillText('🔥', px + 16, py + 18);
          ctx.globalAlpha = 1;
          const brillo = ctx.createRadialGradient(px + 16, py + 16, 2, px + 16, py + 16, 60);
          brillo.addColorStop(0, 'rgba(255,150,50,0.28)'); brillo.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = brillo; ctx.beginPath(); ctx.arc(px + 16, py + 16, 60, 0, Math.PI * 2); ctx.fill();
        }
      } else if (this.solid[i] === 3) { // pilar: suelo debajo; la columna va en la capa alta
        ctx.fillStyle = this.suelo[i] === 1 ? '#2b3044' : '#232739';
        ctx.fillRect(px, py, T, T);
      } else { // suelo
        ctx.fillStyle = this.suelo[i] === 1 ? '#2b3044' : '#232739';
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(px + ((x * 13) % 24), py + ((y * 7) % 24), 4, 3);
        if (this.deco[i] === 'losa') {
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
          ctx.strokeRect(px + 4.5, py + 4.5, T - 9, T - 9);
        }
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.10)';
      ctx.strokeRect(px + .5, py + .5, T, T);
    }

    // Portal de salida (solo visible cuando está activo)
    for (const p of this.portalesPos) {
      const pulso = 0.7 + Math.sin(t * 3 + p.x * 0.01) * 0.3;
      const grad = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 34 * pulso);
      grad.addColorStop(0, '#fff'); grad.addColorStop(0.3, p.css); grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(p.x, p.y, 34 * pulso, 0, Math.PI * 2); ctx.fill();
      ctx.font = '9px "Press Start 2P", monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = p.css;
      ctx.fillText(p.texto, p.x, p.y - 42);
    }
  }

  renderOverlay(ctx, camera) {
    ctx.fillStyle = this.ambientColor;
    ctx.fillRect(camera.x, camera.y, camera.width, camera.height);
  }
}

/* ---------- Controlador de mazmorra ---------- */
export class Dungeon {
  constructor(game, rango) {
    this.game = game;
    this.rango = rango;
    this.cfg = RANGOS[rango];
    this.piso = 1;
    this.tiempoRestante = this.cfg.pisos * this.cfg.segPiso + this.cfg.segExtra;
    this.stats = { kills: 0, exp: 0, oro: 0, bosses: 0 };
    this.startAgo = performance.now();
    this._pisoSemilla = Math.floor(Math.random() * 1e9);
  }

  /* ===== Entrar (con pantalla de carga de escena) ===== */
  async entrar() {
    const g = this.game;
    g.audio.playSFX('portal');
    await pantallaCarga(g, {
      titulo: 'MAZMORRA',
      sub: `RANGO ${this.rango} · PISO 1/${this.cfg.pisos}`,
      minMs: CARGA_MS.mazmorra,
      pasos: [
        'Sellando la entrada a tu espalda…',
        'Despertando a las bestias…',
        'Encendiendo las antorchas…',
        'Colocando losas y trampas…',
        'El tiempo ya corre…'
      ],
      alMedias: () => {
        // Foto del overworld para restaurar al salir
        this._ow = { mapa: g.currentMap, enemigos: g.enemies, npcs: g.npcs, pos: { x: g.player.x, y: g.player.y } };
        g.enemies = []; g.npcs = []; g.projectiles = []; g.groundItems = [];
        this._cargarPiso();
        g.dungeon = this;
        g.audio.playBGM('combat');
      }
    });
    g.changeState('PLAYING');
    g.ui.toast(`🌀 Mazmorra Rango ${this.rango} — Piso 1/${this.cfg.pisos} · Límite ${this._tmm()}`, '#42a5f5', 4200);
  }

  _tmm() { // mm:ss del tiempo restante
    const s = Math.max(0, Math.ceil(this.tiempoRestante));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  /* ===== Cargar piso ===== */
  _cargarPiso() {
    const g = this.game;
    const esUltimo = this.piso === this.cfg.pisos;
    g.currentMap = new DungeonMap(g, this._pisoSemilla + this.piso * 77, esUltimo);
    g.enemies = []; g.projectiles = []; g.groundItems = [];

    // posicionar al jugador en la entrada
    g.player.x = g.currentMap.entrada.cx * TILE_SIZE;
    g.player.y = g.currentMap.entrada.cy * TILE_SIZE;

    // poblar enemigos en salas (todas menos entrada)
    const enemigosPorPiso = esUltimo ? 0 : 6 + this.piso * 2;
    const tipos = ['lobo', 'murcielago', 'nomuerto', 'duende', 'mago'].slice(0, this.cfg.zona >= 7 ? 5 : this.cfg.zona >= 4 ? 4 : 3);
    if (!esUltimo) {
      const salasUso = g.currentMap.salas.filter(s => s !== g.currentMap.entrada);
      for (let i = 0; i < enemigosPorPiso; i++) {
        const sala = salasUso[i % salasUso.length];
        const tipo = tipos[randomInt(0, tipos.length - 1)];
        for (let t = 0; t < 24; t++) {
          const x = (sala.tx + randomInt(1, sala.w - 2)) * TILE_SIZE;
          const y = (sala.ty + randomInt(1, sala.h - 2)) * TILE_SIZE;
          if (!g.currentMap.isSolid(x + 16, y + 16)) {
            g.spawnEnemy(tipo, x, y, this.cfg.zona + (this.piso - 1));
            break;
          }
        }
      }
      g.ui.toast(`⚔️ Piso ${this.piso}/${this.cfg.pisos} — ${enemigosPorPiso} bestias aguardando`, '#e67e22', 3000);
    } else {
      // sala del jefe: sala de salida se convierte en su trono
      const b = g.currentMap.salida;
      const boss = new Boss(g, b.cx * TILE_SIZE, b.cy * TILE_SIZE, this.cfg.jefe);
      g.enemies.push(boss);
      g.ui.toast(`🚪 Piso final — la sala del trono te espera`, this.cfg.jefe.css, 4000);
    }

    // La cámara salta directamente al jugador (sin lerp desde el mapa anterior)
    if (g.camera) g.camera.snap(g.player, g.currentMap);
  }

  /** El boss invoca esbirros desde aquí (control de escala de zona) */
  spawnEsbirros(x, y) {
    const tipos = ['lobo', 'murcielago'];
    this.game.spawnEnemy(tipos[randomInt(0, 1)], x, y, this.cfg.zona);
  }

  /* ===== Enganches de combate ===== */
  registrarMuerte(exp, oro) {
    this.stats.kills++;
    this.stats.exp += exp;
    this.stats.oro += oro;
  }

  /** Botín extra al caer enemigos en mazmorra */
  lootExtra(enemy) {
    // materiales/curas con algo más de suerte que en el exterior
    if (Math.random() < 0.12) {
      const it = crearItem(this.game, Math.random() < 0.55 ? 'hp_potion' : 'mp_potion');
      if (it) this.game.groundItems.push(new GroundItem(this.game, it, enemy.x + randomFloat(-12, 12), enemy.y + randomFloat(-12, 12)));
    }
  }

  /** Botín del jefe: objeto del pool del rango + cascada de oro */
  lootBoss(boss) {
    const g = this.game;
    this.stats.bosses++;
    let intentos = 0;
    while (intentos++ < 3) {
      const id = this.cfg.pool[randomInt(0, this.cfg.pool.length - 1)];
      const it = crearItem(g, id);
      if (it) {
        const gi = new GroundItem(g, it, boss.x + randomFloat(-30, 30), boss.y + randomFloat(-18, 18));
        g.groundItems.push(gi);
      }
    }
  }

  /* ===== Bucle (llamado desde Game.update) ===== */
  update(dt) {
    const g = this.game;
    // cuenta atrás
    this.tiempoRestante -= dt;
    if (this.tiempoRestante <= 0) { this.fail('⏳ El tiempo se agotó… la puerta colapsa'); return; }

    const vivos = g.enemies.filter(e => !e.isDead).length;
    const esUltimo = this.piso === this.cfg.pisos;
    const bossVivo = g.enemies.some(e => e.esBoss && !e.isDead);

    // activación del portal de salida
    const portal = g.currentMap.portalesPos[0];
    if (!portal) {
      const limpio = esUltimo ? !bossVivo : vivos === 0;
      if (limpio) {
        const s = g.currentMap.salida;
        g.currentMap.portalesPos.push({
          x: s.cx * TILE_SIZE + 16, y: s.cy * TILE_SIZE + 16,
          css: esUltimo ? '#ffd700' : '#2ecc71',
          texto: esUltimo ? '◤ MAZMORRA SUPERADA ◢' : `Piso ${this.piso + 1}`,
          salida: true, final: esUltimo, rango: this.rango,
          particleT: 0
        });
        g.audio.playSFX('chest');
        g.ui.toast(esUltimo ? '👑 Jefe eliminado — cruza el portal dorado para tu recompensa' : `✅ Piso limpio — el portal al piso ${this.piso + 1} se activa`, '#2ecc71', 3200);
      }
    } else {
      // brillo animado del portal
      portal.particleT = (portal.particleT || 0) - dt;
      if (portal.particleT <= 0) { portal.particleT = 0.1; g.addParticles(portal.x, portal.y, 'portal', 1); }
    }
  }

  /* ===== Avanzar por el portal (con pantalla de carga de piso) ===== */
  async avanzar() {
    const g = this.game;
    const portal = g.currentMap.portalesPos[0];
    if (!portal) return;
    if (!portal.final) {
      this.piso++;
      const esJefe = this.piso === this.cfg.pisos;
      g.audio.playSFX('portal');
      g.addParticles(g.player.x + 16, g.player.y + 16, 'portal', 30);
      await pantallaCarga(g, {
        titulo: esJefe ? 'PISO FINAL' : 'MAZMORRA',
        sub: esJefe ? `RANGO ${this.rango} · ${this.cfg.jefe.nombre}` : `RANGO ${this.rango} · PISO ${this.piso}/${this.cfg.pisos}`,
        minMs: esJefe ? CARGA_MS.jefe : CARGA_MS.piso,
        pasos: esJefe ? [
          'El aire se vuelve pesado…',
          'Algo enorme respira en la oscuridad…',
          'El trono aparece al fondo…',
          'Que empiece la caza…'
        ] : [
          'Tallando el siguiente piso…',
          'Invocando más bestias…',
          'Repintando las runas…',
          'Casi listo…'
        ],
        alMedias: () => this._cargarPiso()
      });
      g.changeState('PLAYING');
    } else {
      this.complete();
    }
  }

  /* ===== Finalización ===== */
  _salir() {
    const g = this.game;
    g.currentMap = this._ow.mapa;
    g.enemies = this._ow.enemigos;
    g.npcs = this._ow.npcs;
    g.projectiles = []; g.groundItems = [];
    g.player.x = this._ow.pos.x; g.player.y = this._ow.pos.y + 40;
    // despertar enemigos dormidos de la foto (timers sanos)
    for (const e of g.enemies) { e.knockbackVx = 0; e.knockbackVy = 0; }
    g.dungeon = null;
    g.audio.playBGM('overworld');
    if (g.camera) g.camera.snap(g.player, g.currentMap); // sin lerp de vuelta
    // OJO: no cambiamos estado aquí — lo pone quien llama al terminar su carga
  }

  async complete() {
    const g = this.game;
    const bonusExp = this.stats.exp; // EXP x2: doblamos lo ganado dentro
    const bonusOro = this.cfg.premioOroBase;              // recompensa fija del rango
    const bonusTiempo = Math.round(this.tiempoRestante * 2); // +2 de oro por segundo sobrante
    const oroTotal = bonusOro + bonusTiempo;
    const datos = {
      rango: this.rango, pisos: this.cfg.pisos, kills: this.stats.kills,
      exp: this.stats.exp, bonusExp, oro: this.stats.oro, oroTotal,
      tiempoSobra: this._tmm(),
      sombras: g.shadows.length
    };
    g.player.gold += oroTotal;
    if (bonusExp > 0) g.player.gainExp(bonusExp); // los puntos de stat pendientes se muestran tras el panel
    g.audio.playSFX('levelUp');
    await pantallaCarga(g, {
      titulo: 'BOSQUE',
      sub: 'REGRESO AL EXTERIOR',
      minMs: CARGA_MS.salida,
      pasos: ['Cruzando el portal dorado…', 'El bosque te reconoce…', 'Aullidos a lo lejos…'],
      alMedias: () => this._salir()
    });
    g.ui.mostrarResultadosDungeon(datos);
  }

  async fail(motivo) {
    const g = this.game;
    const datos = { motivo, rango: this.rango, pisos: this.piso, kills: this.stats.kills, oro: this.stats.oro };
    await pantallaCarga(g, {
      titulo: 'BOSQUE',
      sub: 'REAGRUPÁNDOSE…',
      minMs: CARGA_MS.salida,
      pasos: ['La mazmorra escupe tu cuerpo…', 'El bosque te reconoce…', 'A lamerse las heridas…'],
      alMedias: () => this._salir()
    });
    g.ui.mostrarFalloDungeon(datos);
  }
}
