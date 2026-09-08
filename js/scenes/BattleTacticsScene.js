/* =========================================================
   BattleTacticsScene — Combate táctico por turnos (estilo FFT)
   - Tablero ortogonal 9x9 generado por la semilla del portal.
   - Iniciativa por SPD (el más rápido actúa antes).
   - Movimiento BFS con casillas resaltadas en azul.
   - Ataques/habilidades con rango resaltado en rojo/morado.
   - Animaciones con Tweens: avance, sacudida de daño,
     desvanecimiento de derrota, popups de daño/curación.
   - IA enemiga: acercarse por el mejor camino y atacar.
   ========================================================= */
import { mulberry } from '../core/rng.js';
import { Save } from '../core/save.js';
import { tokenPersonaje, crearBoton, crearPanel, textoFlotante, FONT } from '../core/widgets.js';
import { getPersonaje, statsDeNivel } from '../data/characters.js';
import { escuadronDelPortal } from '../data/enemies.js';
import { RANGOS, recompensasDe } from '../data/portals.js';
import { leerSafeArea } from '../core/safearea.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class BattleTacticsScene extends Phaser.Scene {
  constructor() { super('battle'); }

  init(data) { this.portal = data.portal; }

  /* ================= CONSTRUCCIÓN ================= */
  create() {
    const W = this.scale.width, H = this.scale.height;
    this.safe = leerSafeArea();
    const info = RANGOS[this.portal.rango];
    this.rng = mulberry(this.portal.key + ':board');
    this.bloqueadas = new Set();
    this.unidades = [];
    this.highlights = [];
    this.resultadoListo = false;

    /* ---------- Medidas del tablero ---------- */
    this.cols = 9; this.rows = 9;
    const altoMenu = 108, altoCabeza = 86 + this.safe.top;
    this.TS = Math.max(26, Math.min(
      Math.floor((W - 16) / this.cols),
      Math.floor((H - altoCabeza - altoMenu - this.safe.bottom) / this.rows),
      54
    ));
    this.ox = (W - this.cols * this.TS) / 2;
    this.oy = altoCabeza;

    /* ---------- Cabecera ---------- */
    this.add.text(W / 2, this.safe.top + 12, `⚔️ Portal Rango ${this.portal.rango}`, {
      fontFamily: FONT, fontSize: '17px', fontStyle: '900', color: info.colorCss, stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5, 0);
    this.banner = this.add.text(W / 2, this.safe.top + 36, '', {
      fontFamily: FONT, fontSize: '13px', color: '#8f9bbd'
    }).setOrigin(0.5, 0);
    this.tira = this.add.container(W / 2, this.safe.top + 66); // tira de iniciativa

    /* ---------- Suelo y obstáculos ---------- */
    this._pintarSuelo(info);

    /* ---------- Unidades ---------- */
    const char = getPersonaje(Save.data.charId || 'kaito');
    const ps = statsDeNivel(char, Save.data.nivel);
    const jugador = {
      bando: 'aliado', char, nombre: char.nombre,
      cx: 1, cy: Math.floor(this.rows / 2),
      maxHp: Save.maxHp(), hp: Math.max(1, Math.round(Save.data.hp)),
      atk: ps.atk, def: ps.def, spd: ps.spd, mov: ps.mov, rng: ps.rng,
      cool: 0, defendiendo: false, vivo: true
    };
    this._crearUnidadVisual(jugador);
    this.jugador = jugador;
    this.unidades.push(jugador);

    // Escuadrón enemigo (determinista por portal)
    let colocados = 0;
    for (const ficha of escuadronDelPortal(this.portal)) {
      const celda = this._celdaLibreEnemiga(colocados);
      const u = {
        bando: 'enemigo', nombre: ficha.nombre, rango: this.portal.rango,
        cx: celda[0], cy: celda[1],
        maxHp: ficha.maxHp, hp: ficha.maxHp,
        atk: ficha.atk, def: ficha.def, spd: ficha.spd, mov: ficha.mov, rng: ficha.rng,
        escala: ficha.escala, vivo: true
      };
      this._crearUnidadVisual(u);
      this.unidades.push(u);
      colocados++;
    }

    /* ---------- Entrada del tablero ---------- */
    this.add.zone(this.ox, this.oy, this.cols * this.TS, this.rows * this.TS)
      .setOrigin(0).setInteractive()
      .on('pointerdown', p => this._tapTablero(p));

    this.menu = this.add.container(0, 0);

    /* ---------- Iniciativa: orden por SPD ---------- */
    this.cola = [...this.unidades].sort((a, b) => b.spd - a.spd || (a.bando === 'aliado' ? -1 : 1));
    this.turnoIdx = -1;
    this.time.delayedCall(600, () => this._siguienteTurno());
  }

  _pintarSuelo(info) {
    const g = this.add.graphics();
    const libres = [];
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      const px = this.ox + x * this.TS, py = this.oy + y * this.TS;
      g.fillStyle((x + y) % 2 ? 0x101a33 : 0x0d1528, 1).fillRect(px, py, this.TS, this.TS);
      g.lineStyle(1, 0xffffff, 0.06).strokeRect(px + 0.5, py + 0.5, this.TS - 1, this.TS - 1);
      libres.push([x, y]);
    }
    // Ambiente teñido por el rango del portal
    g.fillStyle(info.color, 0.06).fillRect(this.ox, this.oy, this.cols * this.TS, this.rows * this.TS);

    // Obstáculos: ni en la zona de despliegue del jugador ni de los enemigos
    let colocados = 0;
    while (colocados < 7) {
      const [x, y] = libres[Math.floor(this.rng() * libres.length)];
      if (x <= 2 || x >= this.cols - 3) continue;
      const k = x + ',' + y;
      if (this.bloqueadas.has(k)) continue;
      this.bloqueadas.add(k); colocados++;
      const px = this.ox + x * this.TS + this.TS / 2, py = this.oy + y * this.TS + this.TS / 2;
      this.add.image(px, py + 3, 'shadow').setDisplaySize(this.TS * 0.8, this.TS * 0.25);
      this.add.image(px, py - 2, 'deco_rock').setScale(this.TS / 34);
    }
  }

  _celdaLibreEnemiga(i) {
    for (let intento = 0; intento < 60; intento++) {
      const x = this.cols - 2 + (i % 2), y = 1 + Math.floor(this.rng() * (this.rows - 2));
      if (!this.bloqueadas.has(x + ',' + y) && !this.unidadEn(x, y)) return [x, y];
    }
    return [this.cols - 1, i];
  }

  _crearUnidadVisual(u) {
    const { x, y } = this._cellXY(u.cx, u.cy);
    u.cont = this.add.container(x, y).setDepth(100 + u.cy);
    u.sombra = this.add.image(0, this.TS * 0.5, 'shadow').setDisplaySize(this.TS * 0.72, this.TS * 0.2);

    if (u.bando === 'aliado') {
      u.cuerpo = tokenPersonaje(this, u.char, this.TS * 1.15);
    } else {
      const cuerpo = this.add.image(0, 0, 'mob_body').setTint(RANGOS[u.rango].color);
      const cara = this.add.image(0, 0, 'mob_face');
      u.cuerpo = this.add.container(0, 0, [cuerpo, cara]).setScale(this.TS / 58 * (u.escala || 1));
    }
    // Bobbing idle
    this.tweens.add({ targets: u.cuerpo, y: -3, duration: 800 + this.rng() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // Barra de vida (por encima de la cabeza, sin tapar el sprite)
    u.barBg = this.add.image(0, -this.TS * 0.68, 'bar').setDisplaySize(this.TS - 10, 6).setTint(0x111827);
    u.barFill = this.add.image(-(this.TS - 10) / 2, -this.TS * 0.68, 'bar').setOrigin(0, 0.5).setDisplaySize(this.TS - 10, 6)
      .setTint(u.bando === 'aliado' ? 0x22c55e : 0xef4444);

    u.cont.add([u.sombra, u.cuerpo, u.barBg, u.barFill]);
  }

  _cellXY(cx, cy) { return { x: this.ox + cx * this.TS + this.TS / 2, y: this.oy + cy * this.TS + this.TS / 2 }; }
  unidadEn(x, y) { return this.unidades.find(u => u.vivo && u.cx === x && u.cy === y); }

  _pintarVida(u) {
    u.barFill.setDisplaySize(Math.max(0, (this.TS - 10) * u.hp / u.maxHp), 6);
  }

  /* ================= MOTOR DE TURNOS ================= */
  _siguienteTurno() {
    if (this.resultadoListo) return;
    // Condiciones de fin
    if (!this.jugador.vivo) return this._derrota();
    if (!this.unidades.some(u => u.vivo && u.bando === 'enemigo')) return this._victoria();

    this.turnoIdx = (this.turnoIdx + 1) % this.cola.length;
    const u = this.cola[this.turnoIdx];
    if (!u.vivo) return this._siguienteTurno();

    this.activo = u;
    u.defendiendo = false;
    u.usoMov = false; u.usoAct = false;
    if (u.cool > 0) u.cool--;

    this.banner.setText(`Turno de ${u.nombre} · VEL ${u.spd}`);
    this._pintarTiraIniciativa();

    if (u.bando === 'aliado') {
      this.estado = 'menu';
      this._mostrarMenu();
    } else {
      this.estado = 'ia';
      this._ocultarMenu();
      this.time.delayedCall(450, () => this._turnoIA(u));
    }
  }

  _pintarTiraIniciativa() {
    this.tira.removeAll(true);
    const vivos = this.cola.filter(u => u.vivo);
    const ancho = vivos.length * 34;
    vivos.forEach((u, i) => {
      const x = -ancho / 2 + 17 + i * 34;
      const esActivo = u === this.activo;
      const color = u.bando === 'aliado' ? (u.char ? u.char.color : 0x8b5cf6) : RANGOS[u.rango].color;
      const chip = this.add.container(x, 0);
      chip.add(this.add.image(0, 0, 'circ').setTint(color).setDisplaySize(esActivo ? 30 : 22, esActivo ? 30 : 22).setAlpha(esActivo ? 1 : 0.75));
      chip.add(this.add.text(0, 0, u.nombre[0], { fontFamily: FONT, fontSize: (esActivo ? 14 : 10) + 'px', fontStyle: '900', color: '#fff' }).setOrigin(0.5));
      if (esActivo) {
        const anillo = this.add.image(0, 0, 'ring').setTint(0xfbbf24).setDisplaySize(40, 40);
        this.tweens.add({ targets: anillo, angle: 360, duration: 2400, repeat: -1 });
        chip.add(anillo);
      }
      this.tira.add(chip);
    });
  }

  /* ================= MENÚ DE ACCIONES ================= */
  _mostrarMenu() {
    this._ocultarMenu();
    const W = this.scale.width, H = this.scale.height;
    const u = this.activo;
    const btnW = Math.min(106, (W - 26) / 3), btnH = 40;
    const y0 = H - this.safe.bottom - 2 * btnH - 20;

    const defs = [
      { t: '🚶 Mover', dis: u.usoMov, fn: () => this._modoMover() },
      { t: '⚔️ Atacar', dis: u.usoAct, fn: () => this._modoObjetivo('atak') },
      { t: `✨ ${u.char.habilidad.nombre}${u.cool > 0 ? ` (${u.cool})` : ''}`, dis: u.usoAct || u.cool > 0, fn: () => this._usarHabilidad() },
      { t: '🛡️ Defender', dis: u.usoAct, fn: () => this._defender() },
      { t: '🏃 Huir', dis: false, fn: () => this._huir() },
      { t: '⏭️ Terminar', dis: false, fn: () => this._finDeAccion(), tinte: 0x37415f }
    ];
    defs.forEach((d, i) => {
      const col = i % 3, fil = Math.floor(i / 3);
      const b = crearBoton(this, -btnW * 1.5 + btnW / 2 + col * btnW + 6 * (col - 1), fil * (btnH + 8), {
        texto: d.t, ancho: btnW - 6, alto: btnH, fontSize: 12,
        tinte: d.tinte || null, onTap: d.fn
      });
      if (d.dis) { b.setAlpha(0.35); b.disableInteractive(); }
      this.menu.add(b);
    });
    this.menu.setPosition(W / 2, y0);
  }

  _ocultarMenu() { this.menu.removeAll(true); }

  /* ================= MOVIMIENTO (BFS) ================= */
  _alcance(u) {
    const vis = new Set([u.cx + ',' + u.cy]);
    const res = new Map();
    const cola = [[u.cx, u.cy, 0]];
    while (cola.length) {
      const [x, y, d] = cola.shift();
      if (d >= u.mov) continue;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
        if (vis.has(k) || this.bloqueadas.has(k)) continue;
        const oc = this.unidadEn(nx, ny);
        if (oc && oc.bando !== u.bando) { vis.add(k); continue; } // enemigos bloquean el paso
        vis.add(k);
        if (!oc) res.set(k, { x: nx, y: ny });
        cola.push([nx, ny, d + 1]);
      }
    }
    return res;
  }

  _modoMover() {
    this.estado = 'mover';
    this._ocultarMenu();
    this.casillasMov = this._alcance(this.activo);
    for (const { x, y } of this.casillasMov.values()) {
      const hl = this.add.image(this.ox + x * this.TS, this.oy + y * this.TS, 'hl_move').setOrigin(0).setDisplaySize(this.TS, this.TS).setDepth(50);
      this.highlights.push(hl);
    }
    this.banner.setText('Elige una casilla azul para moverte');
  }

  _moverUnidadA(u, cx, cy, alTerminar) {
    const { x, y } = this._cellXY(cx, cy);
    u.cx = cx; u.cy = cy;
    u.cont.setDepth(100 + cy);
    this.tweens.add({
      targets: u.cont, x, y, duration: 240, ease: 'Sine.inOut',
      onStart: () => this.tweens.add({ targets: u.cuerpo, scaleY: (u.cuerpo.scaleY || 1) * 0.92, yoyo: true, duration: 120 }),
      onComplete: () => { this._limpiarHighlights(); alTerminar && alTerminar(); }
    });
  }

  /* ================= ATAQUE / HABILIDAD ================= */
  _objetivosAlAlcance(u) {
    return this.cola.filter(e =>
      e.vivo && e.bando !== u.bando &&
      Math.abs(e.cx - u.cx) + Math.abs(e.cy - u.cy) <= u.rng
    );
  }

  _modoObjetivo(modo) {
    this.estado = modo === 'atak' ? 'objetivo' : 'habilidad';
    this._ocultarMenu();
    const alcanzables = this._objetivosAlAlcance(this.activo);
    if (!alcanzables.length) {
      textoFlotante(this, this.scale.width / 2, this.oy - 14, 'Sin objetivos al alcance', '#fca5a5', 15);
      this.estado = 'menu'; this._mostrarMenu();
      return;
    }
    const tex = modo === 'atak' ? 'hl_atk' : 'hl_skill';
    for (const e of alcanzables) {
      const hl = this.add.image(this.ox + e.cx * this.TS, this.oy + e.cy * this.TS, tex).setOrigin(0).setDisplaySize(this.TS, this.TS).setDepth(50);
      this.tweens.add({ targets: hl, alpha: 0.5, duration: 380, yoyo: true, repeat: -1 });
      this.highlights.push(hl);
    }
    this.banner.setText(modo === 'atak' ? 'Elige un objetivo rojo para atacar' : `✨ ${this.activo.char.habilidad.nombre}: elige objetivo`);
  }

  _calcDanio(att, def, mult) {
    const reduccion = def.def * (def.defendiendo ? 1.2 : 0.6);
    const base = Math.max(1, att.atk * mult - reduccion);
    const variado = base * (0.85 + Math.random() * 0.3);
    const crit = Math.random() < 0.12;
    return { dmg: Math.max(1, Math.round(variado * (crit ? 1.6 : 1))), crit };
  }

  _golpear(att, obj, mult, opts = {}) {
    const { dmg, crit } = this._calcDanio(att, obj, mult);
    obj.hp -= dmg;
    this._pintarVida(obj);
    const { x, y } = this._cellXY(obj.cx, obj.cy);
    textoFlotante(this, x, y - this.TS * 0.5, (crit ? '¡CRIT! ' : '') + `-${dmg}`, crit ? '#fbbf24' : '#ff8a8a', crit ? 20 : 15);
    if (opts.robaVida && att.vivo) {
      const cura = Math.min(att.maxHp - att.hp, Math.round(dmg * opts.robaVida));
      if (cura > 0) { att.hp += cura; this._pintarVida(att); const a = this._cellXY(att.cx, att.cy); textoFlotante(this, a.x, a.y - this.TS * 0.5, `+${cura}`, '#86efac', 14); }
    }
    // FX: flash + sacudida
    this._fxGolpe(obj);
    this.cameras.main.shake(90, 0.0035);
    if (obj.hp <= 0) this._matar(obj);
  }

  _fxGolpe(u) {
    if (u.bando === 'enemigo') {
      const cuerpo = u.cuerpo.list[0];
      cuerpo.setTintFill(0xffffff);
      this.time.delayedCall(120, () => { cuerpo.clearTint(); cuerpo.setTint(RANGOS[u.rango].color); });
    }
    this.tweens.add({ targets: u.cont, x: u.cont.x + 5, duration: 45, yoyo: true, repeat: 3 });
  }

  _matar(u) {
    u.vivo = false;
    const nombre = u.nombre;
    this.tweens.add({
      targets: u.cont, alpha: 0, scale: 0.2, duration: 420, ease: 'Cubic.in',
      onComplete: () => u.cont.destroy()
    });
    textoFlotante(this, this.scale.width / 2, this.oy - 14, `☠ ${nombre} eliminado`, '#e7ecff', 15);
  }

  _ejecutarAtaque(att, obj, mult = 1, opts = {}) {
    this.estado = 'anim';
    this._limpiarHighlights();
    // Avance (% mayor si es cuerpo a cuerpo)
    const acercar = att.rng <= 1 ? 0.35 : 0.12;
    const dx = (obj.cont.x - att.cont.x) * acercar, dy = (obj.cont.y - att.cont.y) * acercar;
    this.tweens.add({
      targets: att.cont, x: att.cont.x + dx, y: att.cont.y + dy, duration: 130, yoyo: true,
      onYoyo: () => {
        if (opts.aoe) { // daño en área alrededor del objetivo
          const afectados = this.cola.filter(e => e.vivo && e.bando !== att.bando &&
            Math.abs(e.cx - obj.cx) + Math.abs(e.cy - obj.cy) <= opts.aoe);
          afectados.forEach(e => this._golpear(att, e, mult, opts));
        } else this._golpear(att, obj, mult, opts);
      },
      onComplete: () => this.time.delayedCall(320, () => this._finDeAccion())
    });
  }

  _usarHabilidad() {
    const h = this.activo.char.habilidad;
    if (h.cura) { // habilidad de curación (autocast)
      this.estado = 'anim';
      const u = this.activo;
      const cura = Math.min(u.maxHp - u.hp, Math.round(u.maxHp * h.cura));
      u.hp += cura; this._pintarVida(u);
      const { x, y } = this._cellXY(u.cx, u.cy);
      textoFlotante(this, x, y - this.TS * 0.5, `✨ +${cura}`, '#86efac', 17);
      const halo = this.add.image(x, y, 'glow').setTint(0x86efac).setScale(0.4).setAlpha(0.8).setDepth(400);
      this.tweens.add({ targets: halo, scale: 1.6, alpha: 0, duration: 600, onComplete: () => halo.destroy() });
      u.cool = h.cd + 1;
      u.usoAct = true;
      this.time.delayedCall(400, () => this._finDeAccion());
      return;
    }
    this._modoObjetivo('skill');
  }

  _defender() {
    const u = this.activo;
    u.defendiendo = true; u.usoAct = true;
    const { x, y } = this._cellXY(u.cx, u.cy);
    textoFlotante(this, x, y - this.TS * 0.5, '🛡️ DEFENSA', '#93c5fd', 14);
    this._finDeAccion();
  }

  _finDeAccion() {
    if (this.resultadoListo) return;
    this._limpiarHighlights();
    this._ocultarMenu();
    this.time.delayedCall(180, () => this._siguienteTurno());
  }

  _huir() {
    textoFlotante(this, this.scale.width / 2, this.oy - 14, '🏃 Retirada táctica…', '#e7ecff', 15);
    this.time.delayedCall(500, () => this._salir({ tipo: 'huida', portal: this.portal }));
  }

  /* ================= TAP EN EL TABLERO ================= */
  _tapTablero(pointer) {
    if (!this.activo || this.activo.bando !== 'aliado') return;
    const cx = Math.floor((pointer.x - this.ox) / this.TS);
    const cy = Math.floor((pointer.y - this.oy) / this.TS);
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return;

    if (this.estado === 'mover') {
      const destino = this.casillasMov && this.casillasMov.get(cx + ',' + cy);
      if (!destino) return;
      const u = this.activo;
      u.usoMov = true;
      this.estado = 'anim';
      this._moverUnidadA(u, cx, cy, () => { this.estado = 'menu'; this._mostrarMenu(); });
    } else if (this.estado === 'objetivo' || this.estado === 'habilidad') {
      const obj = this.unidadEn(cx, cy);
      if (!obj || obj.bando === 'aliado') return;
      const u = this.activo;
      u.usoAct = true;
      if (this.estado === 'habilidad') {
        const h = u.char.habilidad;
        u.cool = h.cd + 1;
        this._ejecutarAtaque(u, obj, h.mult || 2, { aoe: h.aoe, robaVida: h.robaVida });
      } else this._ejecutarAtaque(u, obj, 1);
    }
  }

  _limpiarHighlights() { this.highlights.forEach(h => h.destroy()); this.highlights = []; }

  /* ================= IA ENEMIGA ================= */
  _turnoIA(u) {
    if (this.resultadoListo || !u.vivo) return this._siguienteTurno();
    const obj = this.jugador;
    const dist = Math.abs(obj.cx - u.cx) + Math.abs(obj.cy - u.cy);

    const atacarYSalir = () => {
      this.time.delayedCall(200, () => this._ejecutarAtaque(u, obj, 1));
    };

    if (dist <= u.rng) return atacarYSalir();

    // Buscar la casilla alcanzable que más acerque al jugador
    const alcanzables = this._alcance(u);
    let mejor = null, mejorDist = dist;
    for (const { x, y } of alcanzables.values()) {
      const d = Math.abs(obj.cx - x) + Math.abs(obj.cy - y);
      if (d < mejorDist) { mejorDist = d; mejor = { x, y }; }
    }
    if (!mejor) return this._finDeAccion();
    this._moverUnidadA(u, mejor.x, mejor.y, () => {
      const nuevaDist = Math.abs(obj.cx - u.cx) + Math.abs(obj.cy - u.cy);
      if (nuevaDist <= u.rng && obj.vivo) atacarYSalir();
      else this._finDeAccion();
    });
  }

  /* ================= FIN DE COMBATE ================= */
  _panelFin(titulo, color, lineas, boton, cb) {
    this.resultadoListo = true;
    this._ocultarMenu(); this._limpiarHighlights();
    const W = this.scale.width, H = this.scale.height;
    const capa = this.add.container(0, 0).setDepth(999);
    capa.add(this.add.zone(W / 2, H / 2, W, H).setInteractive());
    capa.add(this.add.rectangle(W / 2, H / 2, W, H, 0x050816, 0.78));
    capa.add(crearPanel(this, W / 2, H / 2, Math.min(W - 40, 340), 240));
    capa.add(this.add.text(W / 2, H / 2 - 84, titulo, { fontFamily: FONT, fontSize: '20px', fontStyle: '900', color }).setOrigin(0.5));
    lineas.forEach((l, i) => capa.add(this.add.text(W / 2, H / 2 - 44 + i * 22, l, { fontFamily: FONT, fontSize: '13px', color: '#c7d2fe' }).setOrigin(0.5)));
    capa.add(crearBoton(this, W / 2, H / 2 + 84, { texto: boton, ancho: 200, onTap: cb }));
  }

  _victoria() {
    const r = recompensasDe(this.portal.rango, this.rng);
    Save.addOro(r.oro);
    const subidas = Save.addXp(r.xp);
    Save.marcarDerrotado(this.portal.key);
    Save.data.hp = Math.max(1, Math.round(this.jugador.hp));
    Save.write();
    const lineas = [`+${r.oro} 🪙 oro    +${r.xp} XP`];
    if (subidas > 0) lineas.push(`🎉 ¡Nivel ${Save.data.nivel} alcanzado!`);
    lineas.push(`Vida restante: ${Math.round(this.jugador.hp)}`);
    this._panelFin(`¡PORTAL RANGO ${this.portal.rango} CONQUISTADO!`, RANGOS[this.portal.rango].colorCss, lineas, '🌍 Volver al mundo', () => this._salir({ tipo: 'victoria', portal: this.portal }));
  }

  _derrota() {
    Save.data.hp = Save.maxHp(); // revives con vida completa en tu zona
    Save.write();
    this._panelFin('HAS CAÍDO…', '#f87171',
      ['Los monstruos te arrastran de vuelta al mundo real.', 'Te despiertas curado, pero sin botín.'],
      '💫 Despertar', () => this._salir({ tipo: 'derrota', portal: this.portal }));
  }

  _salir(resultado) {
    Save.data.hp = Save.data.hp ?? Save.maxHp();
    Save.write();
    this.game.events.emit('app:battle-fin');
    this.game.events.emit('portal:battle_result', resultado);
    this.scene.stop();
    this.scene.get('world').scene.wake();
  }
}
