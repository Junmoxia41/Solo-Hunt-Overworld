/* =========================================================
   WorldScene — Exploración del Overworld
   - Mapa procedural infinito anclado a la semilla GPS.
   - Render por pool de tiles (solo se dibuja lo visible).
   - Cámara con seguimiento suave (lerp) al cazador.
   - Portales por rangos (E→SS) con FX, NPCs con diálogos,
     joystick virtual (vía UIScene) + teclado WASD/flechas.
   ========================================================= */
import { TILE, CHUNK, biomeAt, caminable, buscarSpawn, portalDelChunk, npcDelChunk, setWorldSeed } from '../core/worldgen.js';
import { Save } from '../core/save.js';
import { tokenPersonaje, FONT } from '../core/widgets.js';
import { getPersonaje } from '../data/characters.js';
import { esPremium, desbloqueado } from '../data/premium.js';
import { RANGOS } from '../data/portals.js';

const RADIO_PORTAL = TILE * 1.9;  // distancia de interacción

export class WorldScene extends Phaser.Scene {
  constructor() { super('world'); }

  create() {
    /* ---------- Estado ---------- */
    this.tilePool = [];      // pool de imágenes de bioma visibles
    this.portales = new Map();   // key -> contenedor visual
    this.npcs = new Map();       // key -> {contenedor, datos, bubble}
    this._rk = '';               // clave del rango de tiles pintado
    this._chunkKey = '';         // clave de chunks cargados
    this._cercaKey = null;
    this._ultimoBubble = 0;
    this.timePlayerBob = 0;

    /* ---------- Jugador ---------- */
    if (!Save.data.spawnOk) {
      const s = buscarSpawn();
      Save.data.x = s.x; Save.data.y = s.y; Save.data.spawnOk = true; Save.write();
    }
    this.player = this.add.container(Save.data.x, Save.data.y).setDepth(10); // SIEMPRE sobre el suelo
    this.sombra = this.add.image(0, 18, 'shadow');
    this.player.add(this.sombra);
    this.tokenJugador = null;
    this._reconstruirTokenJugador();
    this.jugadorMirando = 1;

    /* ---------- Cámara con seguimiento suave + zoom ---------- */
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBackgroundColor('#050816');
    this._setupZoom();

    /* ---------- Entrada: teclado (joystick llega por registry) ---------- */
    this.teclas = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');

    /* ---------- Eventos de aplicación ---------- */
    this.game.events.on('gps:sync', this._onGps, this);
    this.game.events.on('char:changed', this._reconstruirTokenJugador, this);
    this.game.events.on('portal:enter', this._entrarPortal, this);
    this.game.events.on('portal:battle_result', this._alVolverDeBatalla, this);
    this.events.once('shutdown', () => {
      this.game.events.off('gps:sync', this._onGps, this);
      this.game.events.off('char:changed', this._reconstruirTokenJugador, this);
      this.game.events.off('portal:enter', this._entrarPortal, this);
      this.game.events.off('portal:battle_result', this._alVolverDeBatalla, this);
    });

    /* ---------- UI ---------- */
    if (!this.registry.get('ui:started')) {
      this.scene.launch('ui');
      this.registry.set('ui:started', 1);
    }

    this.scale.on('resize', () => this._refrescarTiles(true));
    this._refrescarTiles(true);
    this._reconstruirEntorno(true);

    // Aviso de seguridad inicial
    this.time.delayedCall(900, () => {
      if (!Save.data.charId) {
        this.game.events.emit('app:toast', '👆 Elige a tu primer Cazador para comenzar');
      }
    });
  }

  /* ============================================================
     JUGADOR
     ============================================================ */
  _reconstruirTokenJugador() {
    if (this.tokenJugador) this.tokenJugador.destroy();
    const char = getPersonaje(Save.data.charId || 'kaito');
    this.charData = char;
    this.tokenJugador = tokenPersonaje(this, char, 62);
    this.player.addAt(this.tokenJugador, 1);
    // Animación idle: flotación suave (bobbing)
    this.tweens.add({
      targets: this.tokenJugador, y: -4, duration: 900,
      yoyo: true, repeat: -1, ease: 'Sine.inOut'
    });
  }

  _moverJugador(dt) {
    const stick = this.registry.get('stick') || { x: 0, y: 0 };
    let vx = stick.x, vy = stick.y;
    const k = this.teclas;
    if (k.A.isDown || k.LEFT.isDown) vx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) vx += 1;
    if (k.W.isDown || k.UP.isDown) vy -= 1;
    if (k.S.isDown || k.DOWN.isDown) vy += 1;

    const m = Math.hypot(vx, vy);
    if (m < 0.08) return false;
    if (m > 1) { vx /= m; vy /= m; }
    // Giro del cazador: flipX sobre el sprite (un scaleX negativo sobre el
    // contenedor rompe el culling de la cámara y lo deja invisible al andar)
    if (Math.abs(vx) > 0.15) {
      this.jugadorMirando = vx > 0 ? 1 : -1;
      const spr = this.tokenJugador && this.tokenJugador.spriteImage;
      if (spr) spr.setFlipX(this.jugadorMirando < 0);
    }

    const vel = 150; // px/s
    const nx = this.player.x + vx * vel * dt, ny = this.player.y + vy * vel * dt;
    const libre = (px, py) => caminable(biomeAt(Math.floor(px / TILE), Math.floor(py / TILE)));
    if (libre(nx, this.player.y)) this.player.x = nx;   // eje X independiente
    if (libre(this.player.x, ny)) this.player.y = ny;   // eje Y independiente
    return true;
  }

  /* ============================================================
     TILES: pool del tamaño de la pantalla (mundo infinito)
     ============================================================ */
  _refrescarTiles(force = false) {
    const cam = this.cameras.main;
    // worldView tiene en cuenta el zoom de la cámara (área visible en coords de mundo)
    const view = cam.worldView;
    const x0 = Math.floor(view.x / TILE) - 1, y0 = Math.floor(view.y / TILE) - 1;
    const cols = Math.ceil(view.width / TILE) + 2, rows = Math.ceil(view.height / TILE) + 2;
    const key = `${x0},${y0},${cols}x${rows}`;
    if (!force && key === this._rk) return;
    this._rk = key;

    const total = cols * rows;
    while (this.tilePool.length < total) {
      // Profundidades negativas: el suelo NUNCA tapa a jugadores/portales/NPCs
      const base = this.add.image(0, 0, 'tile_pradera').setDepth(-10);
      const deco = this.add.image(0, 0, 'deco_tree').setDepth(-9);
      this.tilePool.push({ base, deco });
    }

    for (let i = 0; i < this.tilePool.length; i++) {
      const celda = this.tilePool[i];
      if (i >= total) { celda.base.setVisible(false); celda.deco.setVisible(false); continue; }
      const tx = x0 + (i % cols), ty = y0 + Math.floor(i / cols);
      const b = biomeAt(tx, ty);
      const px = tx * TILE + TILE / 2, py = ty * TILE + TILE / 2;
      celda.base.setVisible(true).setTexture('tile_' + b).setPosition(px, py);

      // Decoración determinista por casilla
      const hsh = (tx * 73856093 ^ ty * 19349663) >>> 0;
      const r = (hsh % 1000) / 1000;
      let decoKey = null, esc = 1;
      if (b === 'bosque' && r > 0.45) decoKey = 'deco_tree';
      else if (b === 'pradera' && r > 0.9) { decoKey = 'deco_flower'; esc = 1.1; }
      else if (b === 'roca' && r > 0.82) { decoKey = 'deco_rock'; esc = 1.2; }
      if (decoKey) {
        celda.deco.setVisible(true).setTexture(decoKey).setScale(esc)
          .setPosition(px + (r * 20 - 10), py + (r * 14 - 7));
      } else celda.deco.setVisible(false);
    }
  }

  /* ============================================================
     PORTALES + NPCS: construcción por chunks cercanos
     ============================================================ */
  _reconstruirEntorno(force = false) {
    const pcx = Math.floor(this.player.x / TILE / CHUNK);
    const pcy = Math.floor(this.player.y / TILE / CHUNK);
    const ck = `${pcx},${pcy}`;
    if (!force && ck === this._chunkKey) return;
    this._chunkKey = ck;

    const necesarios = new Set();
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) necesarios.add((pcx + dx) + ',' + (pcy + dy));

    // Eliminar visuales lejanos
    for (const [key, obj] of this.portales) if (!necesarios.has(obj.ck)) { obj.destroy(); this.portales.delete(key); }
    for (const [key, obj] of this.npcs) if (!necesarios.has(obj.ck)) { obj.cont.destroy(); this.npcs.delete(key); }

    // Crear los del entorno
    for (const ck2 of necesarios) {
      const [cx, cy] = ck2.split(',').map(Number);
      const p = portalDelChunk(cx, cy);
      if (p && !Save.estaDerrotado(p.key) && !this.portales.has(p.key)) this._crearPortalVisual(p, ck2);
      const n = npcDelChunk(cx, cy);
      if (n && !this.npcs.has(n.key)) this._crearNpcVisual(n, ck2);
    }
  }

  _crearPortalVisual(p, ck) {
    const info = RANGOS[p.rango];
    const cont = this.add.container(p.x, p.y).setDepth(4);
    const bloq = esPremium(p.rango) && !desbloqueado(p.rango, Save.data.nivel);

    const glow = this.add.image(0, 0, 'glow').setTint(info.color).setScale(1.1);
    if (bloq) glow.setAlpha(0.35);
    const ring = this.add.image(0, 0, 'ring').setTint(info.color).setScale(0.85);
    const label = this.add.text(0, -42, 'RANGO ' + p.rango, {
      fontFamily: FONT, fontSize: '12px', fontStyle: '900', color: info.colorCss, stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5);
    cont.add([glow, ring, label]);
    if (bloq) cont.add(this.add.text(0, 12, '🔒', { fontSize: '16px' }).setOrigin(0.5));

    // FX: rotación del anillo + pulso del aura
    this.tweens.add({ targets: ring, angle: 360, duration: 4200, repeat: -1, ease: 'Linear' });
    this.tweens.add({ targets: glow, scale: 1.35, alpha: bloq ? 0.25 : 0.75, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    cont.datos = p;
    cont.ck = ck;
    this.portales.set(p.key, cont);
  }

  _crearNpcVisual(n, ck) {
    const cont = this.add.container(n.x, n.y).setDepth(5);
    const cuerpo = this.add.image(0, 0, 'circ').setTint(0x37415f).setDisplaySize(34, 34);
    const cara = this.add.text(0, -1, n.cara, { fontSize: '17px' }).setOrigin(0.5);
    // Bocadillo de diálogo (oculto hasta acercarse)
    const bubble = this.add.container(0, -52)
      .add(this.add.image(0, 0, 'bubble').setTint(0x0e1425).setDisplaySize(190, 70))
      .add(this.add.text(0, -8, n.frase, { fontFamily: FONT, fontSize: '11px', color: '#e7ecff', align: 'center', wordWrap: { width: 165 } }).setOrigin(0.5));
    bubble.setVisible(false);
    cont.add([cuerpo, cara, bubble]);
    this.tweens.add({ targets: cont, y: n.y - 4, duration: 1200 + n.fase * 80, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.npcs.set(n.key, { cont, datos: n, bubble, ck });
  }

  /* ============================================================
     INTERACCIÓN CON PORTALES
     ============================================================ */
  _proximidad() {
    let cerca = null, mejor = RADIO_PORTAL;
    for (const cont of this.portales.values()) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, cont.x, cont.y);
      if (d < mejor) { mejor = d; cerca = cont.datos; }
    }
    this.portalCercano = cerca;
    const key = cerca ? cerca.key : null;
    if (key !== this._cercaKey) {
      this._cercaKey = key;
      if (cerca) {
        const bloq = esPremium(cerca.rango) && !desbloqueado(cerca.rango, Save.data.nivel);
        this.game.events.emit('portal:near', { ...cerca, bloqueado: bloq });
      } else this.game.events.emit('portal:none');
    }

    // NPCs: mostrar bocadillo al acercarse (con enfriamiento)
    const ahora = this.time.now;
    for (const obj of this.npcs.values()) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, obj.cont.x, obj.cont.y);
      if (d < TILE * 1.7 && ahora - this._ultimoBubble > 6000) {
        this._ultimoBubble = ahora;
        obj.bubble.setVisible(true).setScale(0.6).setAlpha(0);
        this.tweens.add({ targets: obj.bubble, scale: 1, alpha: 1, duration: 220, ease: 'Back.out' });
        this.time.delayedCall(3800, () => {
          this.tweens.add({ targets: obj.bubble, alpha: 0, duration: 250, onComplete: () => obj.bubble.setVisible(false) });
        });
      }
    }
  }

  _entrarPortal() {
    const p = this.portalCercano;
    if (!p || this._enBatalla) return;
    if (Array.from(this.portales.values()).every(c => c.datos.key !== p.key)) return;
    this._enBatalla = true;
    this.game.events.emit('app:battle-ini');
    this.scene.sleep();
    this.scene.launch('battle', { portal: p });
  }

  _alVolverDeBatalla(resultado) {
    this._enBatalla = false;
    if (resultado.tipo === 'victoria') {
      const cont = this.portales.get(resultado.portal.key);
      if (cont) { cont.destroy(); this.portales.delete(resultado.portal.key); }
      this._cercaKey = null;
      this.game.events.emit('portal:none');
    }
    Save.data.x = this.player.x; Save.data.y = this.player.y; Save.write();
  }

  _onGps({ lat, lon }) {
    const seed = `gps:${lat.toFixed(4)},${lon.toFixed(4)}`;
    setWorldSeed(seed);
    Save.setSemilla(seed);
    const s = buscarSpawn();
    this.player.setPosition(s.x, s.y);
    this.portales.forEach(c => c.destroy()); this.portales.clear();
    this.npcs.forEach(o => o.cont.destroy()); this.npcs.clear();
    this._rk = ''; this._chunkKey = ''; this._cercaKey = null;
    this.game.events.emit('portal:none');
    this._refrescarTiles(true);
    this._reconstruirEntorno(true);
    this.game.events.emit('app:toast', `📍 Zona sincronizada: ${lat.toFixed(3)}, ${lon.toFixed(3)}`);
  }

  /* ============================================================
     ZOOM — pinza táctil, rueda de ratón y botones ➕➖ (UIScene)
     ============================================================ */
  _setupZoom() {
    let z0 = Save.data.zoom;
    if (!z0) { // zoom por defecto: más cercano en móvil (vertical) para lucir al personaje
      const W = this.scale.width, H = this.scale.height;
      z0 = W < H ? 1.5 : 1.15;
    }
    this.zoomActual = z0;
    this.cameras.main.setZoom(z0);
    this._pinch = null;
    this.input.on('wheel', (pointer, over, dx, dy) => {
      this._setZoom(this.zoomActual - Math.sign(dy) * 0.15);
    });
    this.game.events.on('zoom:delta', this._onZoomDelta, this);
  }

  _onZoomDelta(d) { this._setZoom(this.zoomActual + d); }

  _setZoom(z) {
    this.zoomActual = Phaser.Math.Clamp(z, 0.6, 2.6);
    this.cameras.main.setZoom(this.zoomActual);
    Save.data.zoom = this.zoomActual;
  }

  /** Pinza con dos dedos (se evalúa en cada frame del overworld) */
  _gestionarPinza() {
    const p1 = this.input.pointer1, p2 = this.input.pointer2;
    if (p1 && p2 && p1.isDown && p2.isDown) {
      const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      if (this._pinch) this._setZoom(this.zoomActual * (d / this._pinch));
      this._pinch = d;
    } else if (this._pinch) {
      this._pinch = null;
      Save.write(); // conservar el zoom elegido
    }
  }

  /* ============================================================
     BUCLE
     ============================================================ */
  update(time, dtMs) {
    const dt = Math.min(0.05, dtMs / 1000);
    this._gestionarPinza();
    if (Save.data.charId && !this._enBatalla) {
      if (this._moverJugador(dt)) {
        // deriva de posición para guardado (throttle natural del bucle)
        this._posTimer = (this._posTimer || 0) + dt;
        if (this._posTimer > 3) { this._posTimer = 0; Save.data.x = this.player.x; Save.data.y = this.player.y; Save.write(); }
      }
      // Regeneración de vida fuera de combate
      if (Save.data.hp < Save.maxHp()) {
        Save.data.hp = Math.min(Save.maxHp(), Save.data.hp + dt * 3);
        if (((this._hpTimer = (this._hpTimer || 0) + dt)) > 0.5) { this._hpTimer = 0; this.game.events.emit('hud:update'); }
      }
      this._proximidad();
    }
    this._refrescarTiles();
    this._reconstruirEntorno();
  }
}
