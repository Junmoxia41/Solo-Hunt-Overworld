/* =========================================================
   UIScene — HUD y menús superpuestos (siempre encima)
   - HUD: cazador activo (avatar, nivel, barras de XP/HP), oro.
   - Joystick analógico virtual (compartido por registry).
   - Botones: GPS 📍, Arena ⚔️ (Fase 5), Cambiar cazador 👥,
     Instalar PWA ⬇️.
   - Modales: selección de los 12 cazadores, portal premium,
     Arena, y sistema de toasts.
   ========================================================= */
import { Save } from '../core/save.js';
import { leerSafeArea } from '../core/safearea.js';
import { PERSONAJES, getPersonaje } from '../data/characters.js';
import { tokenPersonaje, crearBoton, FONT } from '../core/widgets.js';
import { packDe } from '../data/premium.js';
import { poderDeCazador, REPARTO_BOLSA } from '../data/arena.js';

export class UIScene extends Phaser.Scene {
  constructor() { super('ui'); }

  create() {
    this.safe = leerSafeArea();
    this.modalAbierto = null;
    this._toastActual = null;

    this._buildHud();
    this._buildBotones();
    this._buildJoystick();
    this._buildBotonPortal();

    /* ---------- Eventos globales ---------- */
    const ev = this.game.events;
    ev.on('app:toast', m => this.toast(m));
    ev.on('hud:update', () => this._pintarHud());
    ev.on('char:changed', () => this._pintarHud());
    ev.on('portal:near', d => this._mostrarPortalBtn(d));
    ev.on('portal:none', () => this.portalBtn.setVisible(false));
    ev.on('app:battle-ini', () => this._modoBatalla(true));
    ev.on('app:battle-fin', () => { this._modoBatalla(false); this._pintarHud(); });
    this.events.once('shutdown', () => ev.removeAllListeners());

    document.addEventListener('pwa:instalable', () => {
      if (this.btnInstall) this.btnInstall.setVisible(true);
    });

    this.scale.on('resize', () => this._layout());
    this._layout();
    this._pintarHud();

    // Primera partida: elegir cazador
    if (!Save.data.charId) this.time.delayedCall(500, () => this._modalRoster(true));
  }

  /* ================= HUD ================= */
  _buildHud() {
    this.hud = this.add.container(0, 0).setDepth(500);

    this.chipJugador = this.add.image(0, 0, 'panel').setDisplaySize(226, 86);
    this.avatar = this.add.container(0, 0);
    this.txtNombre = this.add.text(0, 0, '—', { fontFamily: FONT, fontSize: '14px', fontStyle: '800', color: '#e7ecff' });
    this.txtNivel  = this.add.text(0, 0, '',   { fontFamily: FONT, fontSize: '11px', color: '#8f9bbd' });
    this.barXpBg   = this.add.image(0, 0, 'bar').setOrigin(0, 0.5).setDisplaySize(120, 5).setTint(0x1c2440);
    this.barXp     = this.add.image(0, 0, 'bar').setOrigin(0, 0.5).setDisplaySize(0, 5).setTint(0x22d3ee);
    this.txtHp     = this.add.text(0, 0, '',   { fontFamily: FONT, fontSize: '10px', color: '#86efac' });

    this.chipOroBg = this.add.image(0, 0, 'panel').setDisplaySize(110, 30);
    this.txtOro    = this.add.text(0, 0, '🪙 0', { fontFamily: FONT, fontSize: '13px', fontStyle: '800', color: '#fbbf24' }).setOrigin(0.5);

    this.hud.add([
      this.chipJugador, this.barXpBg, this.barXp,
      this.txtNombre, this.txtNivel, this.txtHp,
      this.chipOroBg, this.txtOro
    ]);
  }

  _reconstruirAvatar() {
    this.avatar.removeAll(true);
    const c = getPersonaje(Save.data.charId || 'kaito');
    // Círculo de rol + aro: el sprite del cazador siempre resalta en el HUD
    this.avatar.add(this.add.image(0, 0, 'circ').setTint(0x0e1425).setDisplaySize(54, 54));
    this.avatar.add(tokenPersonaje(this, c, 50));
    this.avatar.add(this.add.image(0, 0, 'ring').setTint(c.color).setDisplaySize(60, 60));
  }

  _pintarHud() {
    const c = getPersonaje(Save.data.charId || 'kaito');
    if (!this._ultimoChar || this._ultimoChar !== c.id) { this._ultimoChar = c.id; this._reconstruirAvatar(); if (!this.hud.list.includes(this.avatar)) this.hud.addAt(this.avatar, 1); }
    this.txtNombre.setText(c.nombre);
    this.txtNivel.setText(`Nv ${Save.data.nivel} · ${c.rol}`);
    this.barXp.setDisplaySize(120 * Math.min(1, Save.data.xp / Save.xpNecesaria()), 5);
    this.txtHp.setText(`❤️ ${Math.max(0, Math.round(Save.data.hp))}/${Save.maxHp()}`);
    this.txtOro.setText(`🪙 ${Save.data.oro.toLocaleString('es')}`);
  }

  /* ================= BOTONES SUPERIORES ================= */
  _buildBotones() {
    // Botones con ancho automático según el texto (nunca se cortan ni se solapan)
    const mk = (txt, cb, alto = 34) => {
      const b = crearBoton(this, 0, 0, { texto: txt, ancho: 108, alto, fontSize: 12, onTap: cb });
      const w = Math.max(88, b.label.width + 26);
      b.fondo.setDisplaySize(w, alto);
      b.setSize(w, alto);
      b.anchoReal = w;
      this.hud.add(b);
      return b;
    };
    this.btnGps     = mk('📍 Mi zona', () => this._sincronizarGps());
    this.btnArena   = mk('⚔️ Arena', () => this._modalArena());
    this.btnRoster  = mk('👥 Cazadores', () => this._modalRoster(false));
    this.btnInstall = mk('⬇️ Instalar', () => this._instalar());
    this.btnInstall.setVisible(!!window.__installEvt);
    // Zoom manual — alternativa a la pinza (táctil) y la rueda (PC)
    this.btnZoomMas   = mk('➕', () => this.game.events.emit('zoom:delta', 0.2), 42);
    this.btnZoomMenos = mk('➖', () => this.game.events.emit('zoom:delta', -0.2), 42);
  }

  _sincronizarGps() {
    if (!navigator.geolocation) return this.toast('Tu dispositivo no tiene GPS disponible.');
    this.toast('📍 Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      pos => this.game.events.emit('gps:sync', { lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => this.toast('Sin señal GPS. Sigues en la zona semilla.'),
      { timeout: 9000, enableHighAccuracy: true }
    );
  }

  async _instalar() {
    if (window.__installEvt) { window.__installEvt.prompt(); window.__installEvt = null; this.btnInstall.setVisible(false); }
    else this.toast('En iPhone/iPad: Compartir → "Añadir a pantalla de inicio" 📲', 3400);
  }

  /* ================= JOYSTICK ANALÓGICO ================= */
  _buildJoystick() {
    this.joyActivado = false;
    this.joyId = null;
    this.joyBase = this.add.image(0, 0, 'joy_base').setDepth(490).setAlpha(0.9);
    this.joyKnob = this.add.image(0, 0, 'joy_knob').setDepth(491);
    this.joyZone = this.add.zone(0, 0, 10, 10).setOrigin(0).setInteractive().setDepth(10);

    this.joyZone.on('pointerdown', p => {
      this.joyActivado = true; this.joyId = p.id;
      this._moverKnob(p);
    });
    this.input.on('pointermove', p => { if (this.joyActivado && p.id === this.joyId) this._moverKnob(p); });
    const soltar = p => {
      if (!this.joyActivado || (p && p.id !== this.joyId)) return;
      this.joyActivado = false;
      this.registry.set('stick', { x: 0, y: 0 });
      this.joyKnob.setPosition(this.joyBase.x, this.joyBase.y);
    };
    this.input.on('pointerup', soltar);
    this.input.on('pointerupoutside', soltar);
  }

  _moverKnob(p) {
    const MAX = 44;
    let dx = p.x - this.joyBase.x, dy = p.y - this.joyBase.y;
    const d = Math.hypot(dx, dy);
    if (d > MAX) { dx = dx / d * MAX; dy = dy / d * MAX; }
    this.joyKnob.setPosition(this.joyBase.x + dx, this.joyBase.y + dy);
    this.registry.set('stick', { x: dx / MAX, y: dy / MAX });
  }

  /* ================= BOTÓN DE PORTAL ================= */
  _buildBotonPortal() {
    this.portalBtn = this.add.container(0, 0).setDepth(600).setVisible(false);
    const fondo = this.add.image(0, 0, 'btn').setDisplaySize(230, 54);
    this.portalBtnTxt = this.add.text(0, -9, '', { fontFamily: FONT, fontSize: '15px', fontStyle: '900', color: '#fff' }).setOrigin(0.5);
    this.portalBtnSub = this.add.text(0, 11, '', { fontFamily: FONT, fontSize: '10px', color: '#ddd6fe' }).setOrigin(0.5);
    this.portalBtn.add([fondo, this.portalBtnTxt, this.portalBtnSub]);
    this.portalBtn.setSize(230, 54).setInteractive({ useHandCursor: true });
    // Pulso constante para atraer el dedo
    this.tweens.add({ targets: this.portalBtn, scale: 1.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.portalBtn.on('pointerdown', () => {
      const d = this.portalBtn.datos;
      if (!d) return;
      if (d.bloqueado) this._modalPremium(d);
      else this.game.events.emit('portal:enter');
    });
  }

  _mostrarPortalBtn(d) {
    this.portalBtn.datos = d;
    const peligro = d.nivel > Save.data.nivel + 2;
    this.portalBtnTxt.setText(d.bloqueado ? `🔒 Portal ${d.rango} · Premium` : `⚡ Entrar · Portal ${d.rango}`);
    this.portalBtnSub.setText(`Nivel recomendado: ${d.nivel}` + (peligro ? '  ·  ⚠️ ¡PELIGRO!' : ''));
    this.portalBtn.list[0].setTint(d.bloqueado ? 0x37415f : (peligro ? 0xb91c1c : 0xffffff));
    this.portalBtn.setVisible(!this.enBatalla);
  }

  /* ================= TOASTS ================= */
  toast(msg, ms = 2400) {
    if (this._toastActual) { this._toastActual.destroy(); this._toastActual = null; }
    const W = this.scale.width;
    const y = this.safe.top + 120;
    const txt = this.add.text(0, 0, msg, { fontFamily: FONT, fontSize: '13px', fontStyle: '600', color: '#e7ecff', align: 'center', wordWrap: { width: Math.min(W * 0.8, 340) } }).setOrigin(0.5);
    const bg = this.add.image(0, 0, 'panel').setDisplaySize(txt.width + 30, txt.height + 20);
    const c = this.add.container(W / 2, y, [bg, txt]).setDepth(950).setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, y: y + 8, duration: 200 });
    this.tweens.add({ targets: c, alpha: 0, delay: ms, duration: 300, onComplete: () => c.destroy() });
    this._toastActual = c;
  }

  /* ================= MODALES ================= */
  _abrirModal(alto, anchoMax = 440) {
    this._cerrarModal();
    const W = this.scale.width, H = this.scale.height;
    const ancho = Math.min(W - 24, anchoMax);
    const capa = this.add.container(0, 0).setDepth(800);
    capa.add(this.add.zone(W / 2, H / 2, W, H).setInteractive()); // bloquea toques traseros
    capa.add(this.add.rectangle(W / 2, H / 2, W, H, 0x050816, 0.8));
    capa.add(this.add.image(W / 2, H / 2, 'panel').setDisplaySize(ancho, alto));
    capa.ancho = ancho; capa.alto = alto;
    this.modalAbierto = capa;
    return capa;
  }

  _cerrarModal() {
    if (this.modalAbierto) { this.modalAbierto.destroy(); this.modalAbierto = null; }
  }

  /** Modal de selección entre los 12 cazadores */
  _modalRoster(primeraVez) {
    const W = this.scale.width, H = this.scale.height;
    const cols = 3, filas = Math.ceil(PERSONAJES.length / cols);
    const hueco = 8;
    const cardW = Math.min(104, (Math.min(W - 24, 440) - 32 - hueco * (cols - 1)) / cols);
    let cardH = cardW + 52;
    const header = 60, pie = primeraVez ? 0 : 40;
    let alto = header + filas * cardH + (filas - 1) * hueco + pie + 20;
    if (alto > H - 30) { // pantallas bajas: compactar tarjetas
      cardH = (H - 30 - header - pie - 20 - (filas - 1) * hueco) / filas;
      alto = H - 30;
    }
    const capa = this._abrirModal(alto);
    const top = H / 2 - alto / 2;

    capa.add(this.add.text(W / 2, top + 18, 'Elige tu Cazador', { fontFamily: FONT, fontSize: '19px', fontStyle: '900', color: '#c4b5fd' }).setOrigin(0.5, 0));
    capa.add(this.add.text(W / 2, top + 42, '12 héroes coleccionables del Overworld', { fontFamily: FONT, fontSize: '11px', color: '#8f9bbd' }).setOrigin(0.5, 0));

    const gridW = cols * cardW + (cols - 1) * hueco;
    PERSONAJES.forEach((p, i) => {
      const col = i % cols, fil = Math.floor(i / cols);
      const x = W / 2 - gridW / 2 + cardW / 2 + col * (cardW + hueco);
      const y = top + header + fil * (cardH + hueco) + cardH / 2;
      const card = this.add.container(x, y);
      const elegido = Save.data.charId === p.id;
      const bgc = this.add.image(0, 0, 'panel').setDisplaySize(cardW, cardH);
      if (elegido) bgc.setTint(0xd8b4fe);
      const tamTok = Math.min(cardW * 0.55, cardH * 0.45);
      card.add(bgc);
      card.add(tokenPersonaje(this, p, tamTok).setY(-cardH * 0.16));
      card.add(this.add.text(0, cardH * 0.18, p.nombre, { fontFamily: FONT, fontSize: '12px', fontStyle: '800', color: '#fff' }).setOrigin(0.5));
      card.add(this.add.text(0, cardH * 0.18 + 14, p.rol, { fontFamily: FONT, fontSize: '8.5px', color: '#22d3ee' }).setOrigin(0.5));
      card.add(this.add.text(0, cardH * 0.18 + 27, `ATQ${p.stats.atk} DEF${p.stats.def} VEL${p.stats.spd}`, { fontFamily: FONT, fontSize: '8.5px', color: '#8f9bbd' }).setOrigin(0.5));
      if (elegido) card.add(this.add.text(cardW / 2 - 12, -cardH / 2 + 12, '✔', { fontSize: '12px', color: '#fbbf24' }).setOrigin(0.5));
      card.setSize(cardW, cardH).setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => {
        Save.setCazador(p.id);
        this.game.events.emit('char:changed');
        this.toast(`✨ ${p.nombre} se une a tu aventura — Pellizca la pantalla o usa ➕➖ para el zoom`, 3400);
        this._cerrarModal();
      });
      capa.add(card);
    });

    if (!primeraVez) {
      capa.add(crearBoton(this, W / 2, top + alto - 22, { texto: 'Cerrar', ancho: 120, alto: 32, fontSize: 12, tinte: 0x37415f, onTap: () => this._cerrarModal() }));
    }
  }

  /** Modal de portal premium (Fase 4: pasarela de pago) */
  _modalPremium(d) {
    const pack = packDe(d.rango);
    const W = this.scale.width, H = this.scale.height;
    const capa = this._abrirModal(280);
    const top = H / 2 - 140;
    capa.add(this.add.text(W / 2, top + 22, `🔒 ${pack.nombre}`, { fontFamily: FONT, fontSize: '17px', fontStyle: '900', color: '#fbbf24' }).setOrigin(0.5, 0));
    capa.add(this.add.text(W / 2, top + 50, 'Mazmorras de alta dificultad exclusivas', { fontFamily: FONT, fontSize: '11px', color: '#8f9bbd' }).setOrigin(0.5, 0));
    pack.ventajas.forEach((v, i) => {
      capa.add(this.add.text(W / 2, top + 80 + i * 20, `✔ ${v}`, { fontFamily: FONT, fontSize: '12px', color: '#c7d2fe' }).setOrigin(0.5, 0));
    });
    capa.add(this.add.text(W / 2, top + 152, `${pack.precio}  ·  Disponible en la Fase 4 (pagos web)`, { fontFamily: FONT, fontSize: '11.5px', fontStyle: '600', color: '#fca5a5', align: 'center', wordWrap: { width: capa.ancho - 50 } }).setOrigin(0.5, 0));
    // En modo pruebas: aviso de desbloqueo por nivel
    capa.add(this.add.text(W / 2, top + 190, '🧪 Modo pruebas: se desbloquea al alcanzar Nv 15', { fontFamily: FONT, fontSize: '10px', color: '#6ee7b7' }).setOrigin(0.5, 0));
    capa.add(crearBoton(this, W / 2, top + 240, { texto: 'Entendido', ancho: 150, alto: 36, onTap: () => this._cerrarModal() }));
  }

  /** Modal de la Arena (Fase 5: ranking online + premios) */
  _modalArena() {
    const W = this.scale.width, H = this.scale.height;
    const capa = this._abrirModal(300);
    const top = H / 2 - 150;
    const poder = poderDeCazador(Save.data.nivel, Save.data.oro, Object.keys(Save.data.derrotados || {}).length);
    capa.add(this.add.text(W / 2, top + 20, '⚔️ ARENA DEL OVERWORLD', { fontFamily: FONT, fontSize: '18px', fontStyle: '900', color: '#fbbf24' }).setOrigin(0.5, 0));
    capa.add(this.add.text(W / 2, top + 48, `Tu puntuación de poder actual: ${poder}`, { fontFamily: FONT, fontSize: '13px', color: '#e7ecff' }).setOrigin(0.5, 0));
    capa.add(this.add.text(W / 2, top + 74, 'Ranking global Top 100 con bolsa de premios USDT — Fase 5', { fontFamily: FONT, fontSize: '11px', color: '#8f9bbd' }).setOrigin(0.5, 0));
    capa.add(this.add.text(W / 2, top + 100, 'Reparto de la bolsa mensual:', { fontFamily: FONT, fontSize: '11px', fontStyle: '700', color: '#c4b5fd' }).setOrigin(0.5, 0));
    REPARTO_BOLSA.forEach((r, i) => {
      capa.add(this.add.text(W / 2 - 70, top + 122 + i * 15, r.puestos, { fontFamily: FONT, fontSize: '10px', color: '#c7d2fe' }).setOrigin(0.5, 0));
      capa.add(this.add.text(W / 2 + 40, top + 122 + i * 15, `${r.porcentaje}%`, { fontFamily: FONT, fontSize: '10px', color: '#86efac' }).setOrigin(0.5, 0));
    });
    capa.add(this.add.text(W / 2, top + 232, 'La bolsa se financia con un % de los ingresos reales del juego.\nSin promesas vacías: primero el juego recauda, luego reparte. 💪', { fontFamily: FONT, fontSize: '10px', color: '#fca5a5', align: 'center', wordWrap: { width: capa.ancho - 44 } }).setOrigin(0.5, 0));
    capa.add(crearBoton(this, W / 2, top + 272, { texto: 'A por el Top 100 💪', ancho: 190, alto: 34, onTap: () => this._cerrarModal() }));
  }

  /* ================= MODO BATALLA ================= */
  _modoBatalla(on) {
    this.enBatalla = on;
    this.hud.setVisible(!on);
    this.joyBase.setVisible(!on);
    this.joyKnob.setVisible(!on);
    this.joyZone.removeInteractive();
    if (!on) {
      this.joyZone.setInteractive();
      this.portalBtn.setVisible(false); // la proximidad volverá a emitirse
    }
    if (on) this.registry.set('stick', { x: 0, y: 0 });
  }

  /* ================= LAYOUT RESPONSIVE ================= */
  _layout() {
    const W = this.scale.width, H = this.scale.height;
    this.safe = leerSafeArea();
    const sx = this.safe.left, sy = this.safe.top;

    // Chip de jugador (arriba-izquierda)
    this.chipJugador.setPosition(sx + 12 + 113, sy + 12 + 43);
    this.avatar.setPosition(sx + 12 + 36, sy + 12 + 43);
    this.txtNombre.setPosition(sx + 12 + 68, sy + 12 + 16);
    this.txtNivel.setPosition(sx + 12 + 68, sy + 12 + 34);
    this.barXpBg.setPosition(sx + 12 + 68, sy + 12 + 54);
    this.barXp.setPosition(sx + 12 + 68, sy + 12 + 54);
    this.txtHp.setPosition(sx + 12 + 68, sy + 12 + 66);

    // Chip de oro
    this.chipOroBg.setPosition(sx + 12 + 55, sy + 12 + 86 + 18);
    this.txtOro.setPosition(sx + 12 + 55, sy + 12 + 86 + 18);

    // Botones (columna arriba-derecha, alineados por el borde derecho real)
    const borde = W - this.safe.right - 10;
    let by = sy + 12 + 17;
    for (const b of [this.btnGps, this.btnArena, this.btnRoster, this.btnInstall]) {
      b.setPosition(borde - (b.anchoReal || 108) / 2, by);
      by += 40;
    }

    // Zoom manual (lateral derecho, zona media-baja; la pinza/rueda también funcionan)
    this.btnZoomMas.setPosition(W - this.safe.right - 34, H - this.safe.bottom - 190);
    this.btnZoomMenos.setPosition(W - this.safe.right - 34, H - this.safe.bottom - 140);

    // Joystick (abajo-izquierda)
    this.joyBase.setPosition(sx + 88, H - this.safe.bottom - 100);
    this.joyKnob.setPosition(this.joyBase.x, this.joyBase.y);
    this.joyZone.setPosition(0, H * 0.5).setSize(W * 0.55, H * 0.5);

    // Botón de portal (abajo-centro)
    this.portalBtn.setPosition(W / 2, H - this.safe.bottom - 46);

    // Toast: reposicionar si existe
    if (this._toastActual) this._toastActual.setPosition(W / 2, sy + 120);
  }
}
