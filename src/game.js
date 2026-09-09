/* ============================================================
   game.js — Clase Game: loop principal, estados y escena
   ============================================================ */
import { CANVAS_WIDTH, CANVAS_HEIGHT, AUTOSAVE_INTERVAL, ZOOM_DEFAULT_PC, ZOOM_DEFAULT_MOVIL, CARGA_MS } from './constants.js';
import { Camera } from './camera.js';
import { Player } from './player.js';
import { Combat } from './combat.js';
import { Mapa } from './map.js';
import { UI } from './ui.js';
import { InputManager } from './input.js';
import { AudioManager } from './audio.js';
import { Particle, spawnParticles } from './particle.js';
import { SaveManager } from './save.js';
import { Projectile } from './projectile.js';
import { NPC } from './npc.js';
import { Shadow } from './shadow.js';
import { Inventory } from './inventory.js';
import { DialogueManager } from './dialogue.js';
import { QuestGuia } from './quest.js';
import { distEnt, angleVec, randomInt } from './utils.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.state = 'MENU'; // MENU | PLAYING | PAUSED | INVENTORY | LEVEL_UP | GAME_OVER | DIALOGUE | EXTRACT | PORTAL | DUNGEON_END
    this.lastTime = 0;
    this.deltaTime = 0;
    this.playTime = 0;
    this.totalDeaths = 0;
    this.dungeon = null; // controlador de mazmorra activa (o null en overworld)

    // Entidades vivas del mundo
    this.enemies = [];
    this.shadows = [];
    this.npcs = [];
    this.projectiles = [];
    this.particles = [];
    this.groundItems = [];

    // Sprites precargados {clave: Image}
    this.assets = {};

    this._resize = this.resize.bind(this);
    window.addEventListener('resize', () => { clearTimeout(this._rt); this._rt = setTimeout(this._resize, 120); });
  }

  resize() {
    this.canvas.width = CANVAS_WIDTH();
    this.canvas.height = CANVAS_HEIGHT();
    if (this.camera) this.camera.setScreen(this.canvas.width, this.canvas.height);
  }

  /* ---------- Carga de recursos ---------- */
  async loadImage(src) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => { this._tickCarga?.(); res(img); };
      img.onerror = () => { this._tickCarga?.(); res(null); }; // nunca bloquear por un sprite
      img.src = src;
    });
  }

  /** Progreso visual de la pantalla de carga de arranque.
   *  La barra NUNCA llega al 100% antes de `minMs` (mínimo por escena),
   *  pero si la red va lenta sigue a los assets de verdad. */
  _configurarCarga(total, minMs = 0) {
    this._carga = { total, hechos: 0, t0: performance.now(), minMs };
    this._cargaPromesa = new Promise(res => { this._cargaResolve = res; });
    this._tickCarga = () => { this._carga.hechos++; };

    if (minMs > 0) {
      const tick = () => {
        const c = this._carga;
        const fracAssets = c.hechos / c.total;
        const fracTiempo = Math.min(1, (performance.now() - c.t0) / c.minMs);
        const terminado = fracAssets >= 1 && fracTiempo >= 1;
        const pct = terminado ? 100 : Math.floor(Math.min(fracAssets, 0.25 + 0.75 * fracTiempo) * 100);
        const barra = document.getElementById('load-fill');
        const num = document.getElementById('load-num');
        const runner = document.getElementById('load-runner');
        if (barra) barra.style.width = pct + '%';
        if (num) num.textContent = pct + '%';
        if (runner) runner.style.left = `calc(${pct}% - 12px)`;
        if (terminado) {
          window.__cargaBootMs = Math.round(performance.now() - c.t0); // depuración/tests
          const loader = document.getElementById('loading');
          if (loader) { loader.classList.add('done'); setTimeout(() => loader.remove(), 800); }
          this._cargaResolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  async init() {
    this.resize();

    // Progreso: 4 JSON + 12 frontales + 12 perfiles + 5 enemigos + 3 tiles + 4 key-arts
    this._configurarCarga(40, CARGA_MS.boot);

    // Datos JSON (enemigos, items, misiones, diálogos)
    const [enemiesData, itemsData, questsData, dialoguesData] = await Promise.all([
      fetch('data/enemies.json').then(r => { this._tickCarga(); return r.json(); }),
      fetch('data/items.json').then(r => { this._tickCarga(); return r.json(); }),
      fetch('data/quests.json').then(r => { this._tickCarga(); return r.json(); }),
      fetch('data/dialogues.json').then(r => { this._tickCarga(); return r.json(); })
    ]);
    this.data = { enemies: enemiesData, items: itemsData, quests: questsData, dialogues: dialoguesData };

    // Sprites de los 12 cazadores: frontal + PERFIL (para caminar mirando a los lados)
    const CHARS = ['kaito','rin','yuna','grom','sora','dante','mika','roku','elena','atlas','nix','hana'];
    await Promise.all(CHARS.map(async c => { this.assets['char_' + c] = await this.loadImage(`assets/chars/${c}.png`); }));
    await Promise.all(CHARS.map(async c => { this.assets['lado_' + c] = await this.loadImage(`assets/chars/lado_${c}.png`); }));
    // Sprites de enemigos (si existen; si no, se dibujan por código)
    for (const t of ['lobo','murcielago','nomuerto','duende','mago']) {
      this.assets['mob_' + t] = await this.loadImage(`assets/sprites/${t}.png`);
    }
    // Tiles decorativos (árbol/flor/roca remasterizados)
    for (const d of ['arbol','flor','roca']) {
      this.assets['tile_' + d] = await this.loadImage(`assets/tiles/${d}.png`);
    }
    // Los 4 key-arts de carga (el menú elige uno al azar; los loaders también)
    await Promise.all([1, 2, 3, 4].map(async i => {
      this.assets['loading_' + i] = await this.loadImage(`assets/ui/loading_${i}.png`);
    }));
    this.assets['menu_bg'] = this.assets['loading_' + randomInt(1, 4)];

    // Sistemas
    this.input = new InputManager(this);
    this.input.init();
    this.audio = new AudioManager();
    this.ui = new UI(this);
    this.combat = new Combat(this);
    // Cámara con ZOOM: el personaje se ve más de cerca (más aún en móvil)
    this.camera = new Camera(
      this.canvas.width, this.canvas.height,
      this.input.isMobile ? ZOOM_DEFAULT_MOVIL : ZOOM_DEFAULT_PC
    );
    this.currentMap = new Mapa(this, 1); // zona semilla del bosque
    this.inventory = new Inventory(this);
    this.dialogue = new DialogueManager(this);
    this.player = new Player(this, 40 * 32, 40 * 32);
    this.player.recalculateStats(); // aplica bonos de equipo si los hubiera
    this.npcs = [
      new NPC(this, 38 * 32, 37 * 32, 'guia_gremio'),
      new NPC(this, 42 * 32, 38 * 32, 'mercader')
    ];

    // Partida guardada (restaura jugador, sombras y misión)
    this.saveInfo = SaveManager.load(this);
    if (this.saveInfo && this.saveInfo.player) SaveManager.applyToGame(this, this.saveInfo);
    this.quests = new QuestGuia(this);

    this.spawnOleadaInicial();
    this.camera.snap(this.player, this.currentMap); // cámara centrada desde el frame 1

    // Respetar la duración mínima de la pantalla de carga de arranque
    await this._cargaPromesa;

    // Autoguardado (nunca dentro de una mazmorra: el mapa sería temporal)
    this._autosave = setInterval(() => {
      if (this.state === 'PLAYING' && !this.dungeon) { SaveManager.save(this); this.ui.toast('💾 Guardado automático', '#888'); }
    }, AUTOSAVE_INTERVAL);

    // Pausa automática al perder el foco (alt-tab / cambiar de pestaña / minimizar)
    window.addEventListener('blur', () => { if (this.state === 'PLAYING') this.changeState('PAUSED'); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'PLAYING') this.changeState('PAUSED');
    });

    this.changeState('MENU');
  }

  /* ---------- Loop principal ---------- */
  start() {
    requestAnimationFrame(this.loop.bind(this));
  }

  loop(timestamp) {
    this.deltaTime = Math.min(0.05, (timestamp - this.lastTime) / 1000); // cap anti-saltos
    this.lastTime = timestamp;
    this.update(this.deltaTime);
    this.render();
    this.input.clearFrame();
    requestAnimationFrame(this.loop.bind(this));
  }

  update(dt) {
    // Hitlag: congela el mundo unos frames al impactar
    this.combat.updateTimers(dt);
    const hitlag = this.combat.hitlagTimer > 0;

    // Zoom de cámara con teclas +/− (la rueda y el pellizco van por InputManager)
    if (this.state === 'PLAYING') {
      if (this.input.isZoomIn()) this.camera.ajustarZoom(0.2);
      if (this.input.isZoomOut()) this.camera.ajustarZoom(-0.2);
    }

    if (this.state === 'PLAYING' && !hitlag) {
      this.playTime += dt;
      this.player.update(dt);
      for (const e of this.enemies) e.update(dt, this.player);
      for (const s of this.shadows) s.update(dt, this.player, this.enemies);
      for (const n of this.npcs) n.update(dt);
      for (const p of this.projectiles) p.update(dt);
      for (const g of this.groundItems) g.update(dt);
      this.combat.checkCollisions();
      this.camera.update(dt, this.player, this.currentMap);
      this.dungeon?.update(dt); // cuenta atrás, portal de salida, jefe
      if (!this.dungeon) this._poblacionEnemigos(dt);
      this._limpiar();
    }
    // Las partículas y números de daño SIEMPRE avanzan (también en pausa quedan preciosas)
    if (!hitlag) for (const pt of this.particles) pt.update(dt);
    this.combat.updateNumeros(dt);
    this.particles = this.particles.filter(p => !p.isDead());
    this.projectiles = this.projectiles.filter(p => !p.dead);

    // Mini-rastro de dash
    if (this.state === 'PLAYING' && this.player.isDashing) {
      for (let i = 0; i < 3; i++) {
        this.particles.push(Particle.preset('dash_trail', this.player.x + 16, this.player.y + 24));
      }
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.state === 'MENU') { this.ui.renderMenuCanvas(ctx); return; }

    ctx.save();
    // ZOOM: el mundo se dibuja escalado; la cámara ya tiene la vista
    // reducida (ancho/alto = pantalla/zoom) para seguir y recortar bien.
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(
      -Math.round(this.camera.x + this.combat.shake.x),
      -Math.round(this.camera.y + this.combat.shake.y)
    );

    this.currentMap.render(ctx, this.camera);

    // Orden de render por profundidad: se compara la SUELA (pies) de cada
    // entidad contra la base del tronco de los árboles/pilares. Así, si
    // caminas por DEBAJO (delante) del árbol te ves ENCIMA; si pasas por
    // detrás (arriba), la copa te tapa. Los envoltorios de la capa alta
    // ya vienen precomputados del mapa (cero basura por frame).
    const dibujables = [
      ...(this.currentMap._tallWrap || []),
      ...this.groundItems.map(g => ({ y: g.y + (g._pie || 0), o: g })),
      ...this.npcs.map(n => ({ y: n.y + (n._pie || 0), o: n })),
      ...this.shadows.map(s => ({ y: s.y + (s._pie || 0), o: s })),
      ...this.enemies.map(e => ({ y: e.y + (e._pie || 0), o: e })),
      { y: this.player.y + this.player._pie, o: this.player }
    ].sort((a, b) => a.y - b.y);
    for (const d of dibujables) if (this.camera.isVisible(d.o)) d.o.render(ctx);

    for (const p of this.projectiles) p.render(ctx);
    for (const pt of this.particles) pt.render(ctx);
    this.combat.renderNumeros(ctx);
    this.currentMap.renderOverlay(ctx, this.camera);

    ctx.restore();

    // HUD por encima del mundo (también durante diálogos y paneles congelados)
    if (['PLAYING', 'PAUSED', 'DIALOGUE', 'PORTAL', 'DUNGEON_END', 'EXTRACT', 'SHOP', 'MAPVIEW'].includes(this.state)) {
      this.ui.renderHUD(ctx);
    }
  }

  /* ---------- Estados ---------- */
  changeState(newState) {
    this.state = newState;
    this.ui.onStateChange(newState);
    if (['PAUSED', 'PORTAL', 'DUNGEON_END', 'LEVEL_UP', 'GAME_OVER', 'SHOP'].includes(newState)) this.audio.duck(true);
    else this.audio.duck(false);
  }

  /* ---------- Spawns ---------- */
  spawnEnemy(type, x, y, nivelZona = 1) {
    const Clase = {
      lobo: 'WolfEnemy', murcielago: 'BatEnemy', nomuerto: 'UndeadEnemy',
      duende: 'GoblinArcherEnemy', mago: 'DarkMageEnemy'
    }[type];
    return Clase && import('./enemy.js').then(m => {
      const e = new m[Clase](this, x, y, nivelZona);
      this.enemies.push(e);
      return e;
    });
  }

  /** Repoblación suave del bosque (mantiene el mundo vivo) */
  _poblacionEnemigos(dt) {
    this._spawnT = (this._spawnT || 0) + dt;
    if (this._spawnT < 3) return;
    this._spawnT = 0;
    const vivos = this.enemies.filter(e => !e.isDead).length;
    if (vivos >= 14) return;
    const tipo = ['lobo','lobo','murcielago','nomuerto','duende','mago'][randomInt(0, 5)];
    // aparecer fuera de la vista del jugador
    for (let i = 0; i < 20; i++) {
      const x = this.player.x + randomInt(-1, 1) * randomInt(380, 700);
      const y = this.player.y + randomInt(-1, 1) * randomInt(380, 700);
      if (x > 32 && y > 32 && x < this.currentMap.pixelW - 32 && y < this.currentMap.pixelH - 32 && !this.currentMap.isSolid(x + 16, y + 16)) {
        this.spawnEnemy(tipo, x, y, 1);
        break;
      }
    }
  }

  _limpiar() {
    // Enemigos cuyo cadáver ya no es extraíble y se desvaneció
    this.enemies = this.enemies.filter(e => !(e.isDead && e.deathTimer > 12 || e.removed));
    this.shadows = this.shadows.filter(s => !s.removed);
    this.groundItems = this.groundItems.filter(g => !g.recogido);
    // Misión: rastrear muertes
    if (this._killsMarcados !== this.player.totalKills) {
      this._killsMarcados = this.player.totalKills;
      this.questTrack?.();
    }
  }

  spawnOleadaInicial() {
    const defs = [
      ['lobo', 8], ['murcielago', 4], ['nomuerto', 2], ['duende', 2], ['mago', 1]
    ];
    for (const [tipo, n] of defs) {
      for (let i = 0; i < n; i++) {
        for (let t = 0; t < 25; t++) {
          const x = randomInt(4, this.currentMap.width - 4) * 32;
          const y = randomInt(4, this.currentMap.height - 4) * 32;
          if (!this.currentMap.isSolid(x, y) && Math.hypot(x - this.player.x, y - this.player.y) > 260) {
            this.spawnEnemy(tipo, x, y, 1);
            break;
          }
        }
      }
    }
  }

  /** Helper global de partículas */
  addParticles(x, y, preset, count) {
    for (let i = 0; i < count; i++) this.particles.push(Particle.preset(preset, x, y));
  }

  /** Proyectil (jugador o enemigo) */
  addProjectile(cfg) { this.projectiles.push(new Projectile(this, cfg)); }

  /** Añade una sombra al ejército del jugador */
  addShadow(enemy) {
    const s = new Shadow(this, enemy, this.player);
    this.shadows.push(s);
    return s;
  }
}

// Re-export para conveniencia interna
export { Particle, spawnParticles, distEnt, angleVec };
