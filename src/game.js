/* ============================================================
   game.js — Clase Game: loop principal, estados y escena
   ============================================================ */
import { CANVAS_WIDTH, CANVAS_HEIGHT, AUTOSAVE_INTERVAL } from './constants.js';
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
    if (this.camera) { this.camera.width = this.canvas.width; this.camera.height = this.canvas.height; }
  }

  /* ---------- Carga de recursos ---------- */
  async loadImage(src) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null); // nunca bloquear por un sprite
      img.src = src;
    });
  }

  async init() {
    this.resize();

    // Datos JSON (enemigos, items, misiones, diálogos)
    const [enemiesData, itemsData, questsData, dialoguesData] = await Promise.all([
      fetch('data/enemies.json').then(r => r.json()),
      fetch('data/items.json').then(r => r.json()),
      fetch('data/quests.json').then(r => r.json()),
      fetch('data/dialogues.json').then(r => r.json())
    ]);
    this.data = { enemies: enemiesData, items: itemsData, quests: questsData, dialogues: dialoguesData };

    // Sprites de los 12 cazadores (jugador seleccionable en futuras builds)
    const CHARS = ['kaito','rin','yuna','grom','sora','dante','mika','roku','elena','atlas','nix','hana'];
    await Promise.all(CHARS.map(async c => { this.assets['char_' + c] = await this.loadImage(`assets/chars/${c}.png`); }));
    // Sprites de enemigos (si existen; si no, se dibujan por código)
    for (const t of ['lobo','murcielago','nomuerto','duende','mago']) {
      this.assets['mob_' + t] = await this.loadImage(`assets/sprites/${t}.png`);
    }

    // Sistemas
    this.input = new InputManager(this);
    this.input.init();
    this.audio = new AudioManager();
    this.ui = new UI(this);
    this.combat = new Combat(this);
    this.camera = new Camera(0, 0, this.canvas.width, this.canvas.height);
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

    // Autoguardado (nunca dentro de una mazmorra: el mapa sería temporal)
    this._autosave = setInterval(() => {
      if (this.state === 'PLAYING' && !this.dungeon) { SaveManager.save(this); this.ui.toast('💾 Guardado automático', '#888'); }
    }, AUTOSAVE_INTERVAL);

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
    ctx.translate(
      -Math.round(this.camera.x + this.combat.shake.x),
      -Math.round(this.camera.y + this.combat.shake.y)
    );

    this.currentMap.render(ctx, this.camera);

    // Orden de render por profundidad (y) para efecto top-down
    const dibujables = [
      ...this.groundItems.map(g => ({ y: g.y, o: g })),
      ...this.npcs.map(n => ({ y: n.y, o: n })),
      ...this.shadows.map(s => ({ y: s.y, o: s })),
      ...this.enemies.map(e => ({ y: e.y, o: e })),
      { y: this.player.y, o: this.player }
    ].sort((a, b) => a.y - b.y);
    for (const d of dibujables) if (this.camera.isVisible(d.o)) d.o.render(ctx);

    for (const p of this.projectiles) p.render(ctx);
    for (const pt of this.particles) pt.render(ctx);
    this.combat.renderNumeros(ctx);
    this.currentMap.renderOverlay(ctx, this.camera);

    ctx.restore();

    // HUD por encima del mundo (también durante diálogos y paneles congelados)
    if (['PLAYING', 'PAUSED', 'DIALOGUE', 'PORTAL', 'DUNGEON_END', 'EXTRACT', 'SHOP'].includes(this.state)) {
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
