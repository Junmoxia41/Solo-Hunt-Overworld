/* ============================================================
   ui.js — Interfaz completa: HUD en canvas (barras, hotbar,
   minimapa) + overlays HTML (menú, pausa, level up, game over,
   inventario) + minijuego de extracción ARISE + toasts.
   ============================================================ */
import { COLORS, RARITY_COLORS, DASH_COOLDOWN, HEAVY_ATTACK_COOLDOWN, SKILL_COOLDOWN, SHADOW_MAX, SHADOW_EXTRACT_CD } from './constants.js';
import { clamp, formatNumber } from './utils.js';
import { ICONOS } from './item.js';
import { SaveManager } from './save.js';
import { puedeExtraer } from './shadow.js';

const FONT = '"Press Start 2P", monospace';

export class UI {
  constructor(game) {
    this.game = game;
    this.layer = document.getElementById('ui-layer');
    this._toasts = document.createElement('div');
    this._toasts.id = 'toasts';
    this.layer.appendChild(this._toasts);
    this._overlay = null;

    // Atajos globales de menú
    window.addEventListener('keydown', e => {
      const g = this.game;
      if (e.code === 'Escape') {
        if (g.state === 'PLAYING') g.changeState('PAUSED');
        else if (['PAUSED', 'INVENTORY'].includes(g.state)) g.changeState('PLAYING');
        else if (g.state === 'DIALOGUE') g.dialogue.cerrar();
        else if (g.state === 'EXTRACT') this.cancelarExtraccion();
      }
      if (e.code === 'KeyI') {
        if (g.state === 'PLAYING') g.changeState('INVENTORY');
        else if (g.state === 'INVENTORY') g.changeState('PLAYING');
      }
      if (e.code === 'KeyM') {
        const m = g.audio.toggleMute();
        this.toast(m ? '🔇 Audio silenciado (M)' : '🔊 Audio activado', '#888');
      }
      if (e.code === 'KeyT' && g.shadows.length) { // cambiar rol de las sombras
        for (const s of g.shadows) s.role = s.role === 'attack' ? 'defend' : 'attack';
        this.toast(`🌑 Sombras en modo: ${g.shadows[0].role === 'attack' ? 'ATAQUE' : 'DEFENSA'} (T)`, '#9b59b6');
      }
    });

    this._buildTouchPad();
  }

  /* ==================== Toasts ==================== */
  toast(msg, color = '#ecf0f1', ms = 2600) {
    while (this._toasts.children.length >= 3) this._toasts.firstChild.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.borderColor = color;
    t.textContent = msg;
    this._toasts.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 500); }, ms);
  }

  /* ==================== Overlays por estado ==================== */
  onStateChange(state) {
    this._cerrarOverlay();
    if (state === 'MENU') this._menu();
    else if (state === 'PAUSED') this._pausa();
    else if (state === 'LEVEL_UP') this._levelUp();
    else if (state === 'GAME_OVER') this._gameOver();
    else if (state === 'INVENTORY') this._inventario();
  }

  _cerrarOverlay() {
    if (this._overlay) { this._overlay.remove(); this._overlay = null; }
  }

  _nuevoOverlay(cls = 'menu-overlay') {
    this._cerrarOverlay();
    const o = document.createElement('div');
    o.className = cls;
    this.layer.appendChild(o);
    this._overlay = o;
    return o;
  }

  /* ---------- Menú título ---------- */
  _menu() {
    const o = this._nuevoOverlay();
    const info = SaveManager.getSaveInfo();
    o.innerHTML = `
      <div class="title-logo">SOLO HUNT</div>
      <div class="title-sub">OVERWORLD v2</div>
      <button class="rpg-btn" id="bt-continuar" ${info ? '' : 'disabled'}>▶ Continuar ${info ? `(Nv. ${info.level})` : ''}</button>
      <button class="rpg-btn purple" id="bt-nueva">✦ Nueva partida</button>
      <button class="rpg-btn small" id="bt-creditos">Créditos</button>
      <div class="title-ver">v2.0.0 · M1 — Acción en tiempo real</div>`;
    o.querySelector('#bt-continuar').addEventListener('click', () => {
      this.game.audio.playSFX('menuOk');
      this.game.changeState('PLAYING');
      this.toast('🌲 Zona: Bosque Inicial — busca al Guía del Gremio', '#2ecc71', 3600);
    });
    o.querySelector('#bt-nueva').addEventListener('click', () => {
      this.game.audio.playSFX('menuOk');
      if (SaveManager.hasSave() && !confirm('¿Borrar la partida guardada y empezar de cero?')) return;
      const habiaDatosCargados = !!this.game.saveInfo?.player;
      SaveManager.deleteSave();
      if (habiaDatosCargados) location.reload(); // reinicio limpio si había progreso cargado
      else {
        this.game.changeState('PLAYING');
        this.toast('🌲 Zona: Bosque Inicial — busca al Guía del Gremio', '#2ecc71', 3600);
      }
    });
    o.querySelector('#bt-creditos').addEventListener('click', () => {
      this.game.audio.playSFX('menuMove');
      this.toast('Hecho con ♥ por Junmoxia41 + Arena · Sprites IA originales · Motor: Canvas 2D vanilla', '#9b59b6', 4200);
    });
  }

  /* ---------- Pausa ---------- */
  _pausa() {
    const o = this._nuevoOverlay();
    const g = this.game, p = g.player;
    o.innerHTML = `
      <div class="rpg-panel">
        <h2>⏸ PAUSA</h2>
        <p style="text-align:center">Nivel ${p.level} · 💰 ${formatNumber(p.gold)} · ☠️ ${p.totalKills} bajas · 🌑 ${g.shadows.length}/${SHADOW_MAX} sombras</p>
        <p style="text-align:center;margin-top:6px">ATQ ${p.atk} · DEF ${p.def} · MATQ ${p.matk} · CRIT ${p.critChance.toFixed(1)}%</p>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px;align-items:center">
          <button class="rpg-btn" id="bt-resume">▶ Continuar</button>
          <button class="rpg-btn small" id="bt-inv">🎒 Inventario (I)</button>
          <button class="rpg-btn small" id="bt-mute">${g.audio.isMuted ? '🔊 Quitar silencio' : '🔇 Silenciar'} (M)</button>
          <button class="rpg-btn small green" id="bt-save">💾 Guardar</button>
          <button class="rpg-btn small" id="bt-menu">🚪 Salir al menú</button>
        </div>
      </div>`;
    o.querySelector('#bt-resume').onclick = () => { g.audio.playSFX('menuOk'); g.changeState('PLAYING'); };
    o.querySelector('#bt-inv').onclick = () => g.changeState('INVENTORY');
    o.querySelector('#bt-mute').onclick = e => { const m = g.audio.toggleMute(); e.target.textContent = m ? '🔊 Quitar silencio (M)' : '🔇 Silenciar (M)'; };
    o.querySelector('#bt-save').onclick = () => { SaveManager.save(g); g.audio.playSFX('menuOk'); this.toast('💾 Guardado'); };
    o.querySelector('#bt-menu').onclick = () => { SaveManager.save(g); g.changeState('MENU'); };
  }

  /* ---------- Level Up ---------- */
  _levelUp() {
    const g = this.game, p = g.player;
    const o = this._nuevoOverlay();
    const desc = {
      str: '+2 ATQ', agi: '+1% velocidad · +0,5% crítico', vit: '+10 PV · +regen',
      int: '+3 MATQ · +5 PM', per: '+1% crítico · +2% evasión · +1% drops'
    };
    o.innerHTML = `
      <div class="rpg-panel">
        <h2 class="glitch-txt" style="color:#ffd700">¡LEVEL UP!</h2>
        <p style="text-align:center">Nivel <b>${p.level}</b> alcanzado</p>
        <p style="text-align:center;color:#ffd700">Puntos disponibles: <span id="pts">${p.statPoints}</span></p>
        <div id="stats"></div>
        <button class="rpg-btn" id="bt-ok" style="display:block;margin:14px auto 0" disabled>CONFIRMAR</button>
      </div>`;
    const pintar = () => {
      o.querySelector('#pts').textContent = p.statPoints;
      const cont = o.querySelector('#stats');
      cont.innerHTML = '';
      for (const [k, v] of Object.entries(p.stats)) {
        const row = document.createElement('div');
        row.className = 'stat-row';
        row.innerHTML = `<b>${k.toUpperCase()}: ${v}</b><span class="desc">${desc[k]}</span>`;
        const btn = document.createElement('button');
        btn.className = 'rpg-btn small';
        btn.textContent = '+';
        btn.disabled = p.statPoints <= 0;
        btn.onclick = () => { p.addStat(k); g.audio.playSFX('menuMove'); pintar(); };
        row.appendChild(btn);
        cont.appendChild(row);
      }
      o.querySelector('#bt-ok').disabled = p.statPoints > 0;
    };
    pintar();
    o.querySelector('#bt-ok').onclick = () => { g.audio.playSFX('menuOk'); g.changeState('PLAYING'); };
  }

  /* ---------- Game Over ---------- */
  _gameOver() {
    const g = this.game, p = g.player;
    const o = this._nuevoOverlay();
    o.style.background = 'rgba(60, 5, 10, 0.88)';
    o.innerHTML = `
      <div class="rpg-panel" style="text-align:center">
        <h2 class="glitch-txt">HAS CAÍDO</h2>
        <p>Nivel alcanzado: ${p.level}</p>
        <p style="color:#e74c3c">Oro perdido: ${p.oroPerdido || 0} (-10%)</p>
        <p style="margin-top:8px">Bajas totales: ${p.totalKills}</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="rpg-btn" id="bt-rev">💫 Revivir (50% PV)</button>
          <button class="rpg-btn small" id="bt-menu">Menú</button>
        </div>
      </div>`;
    o.querySelector('#bt-rev').onclick = () => {
      p.revivir();
      g.audio.playSFX('ariseOk');
      g.audio.playBGM('overworld');
      SaveManager.save(g);
      g.changeState('PLAYING');
    };
    o.querySelector('#bt-menu').onclick = () => { SaveManager.save(g); location.reload(); };
  }

  /* ---------- Inventario ---------- */
  _inventario() {
    const g = this.game, p = g.player, inv = g.inventory;
    const o = this._nuevoOverlay();
    const slotHTML = (s, i) => s
      ? `<div class="inv-slot rar-${s.item.rarity}" data-i="${i}">${ICONOS[s.item.type] || '❓'}${s.cantidad > 1 ? `<span class="qty">${s.cantidad}</span>` : ''}</div>`
      : `<div class="inv-slot" data-i="${i}"></div>`;
    o.innerHTML = `
      <div class="rpg-panel" style="max-height:88vh;overflow:auto">
        <h2>🎒 INVENTARIO</h2>
        <div class="inv-grid">${inv.slots.map(slotHTML).join('')}</div>
        <h3>Equipado</h3>
        <p>⚔️ Arma: ${inv.equipped.weapon ? inv.equipped.weapon.name : '—'}<br>
           🛡️ Armadura: ${inv.equipped.armor ? inv.equipped.armor.name : '—'}</p>
        <h3>Cazador</h3>
        <p>ATQ ${p.atk} · DEF ${p.def} · MATQ ${p.matk} · MDEF ${p.mdef}<br>
           CRIT ${p.critChance.toFixed(1)}% · EVA ${p.evasion.toFixed(1)}%</p>
        <p style="margin-top:6px;font-size:8px;color:#888">Click: equipar arma/armadura · usar consumible</p>
        <button class="rpg-btn" id="bt-close" style="display:block;margin:14px auto 0">CERRAR (I)</button>
      </div>`;
    o.querySelectorAll('.inv-slot').forEach(el => {
      el.addEventListener('pointerdown', () => {
        const i = +el.dataset.i;
        const s = inv.slots[i];
        if (!s) return;
        if (s.item.type === 'consumable') inv.useItem(i);
        else if (['weapon', 'armor', 'accessory'].includes(s.item.type)) inv.equip(i);
        this._inventario(); // repintar
      });
      el.addEventListener('pointerenter', () => {
        const s = inv.slots[+el.dataset.i];
        if (!s) return;
        const t = document.createElement('div');
        t.className = 'tooltip';
        t.id = 'tt';
        const st = Object.entries(s.item.stats || {}).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(' · ');
        t.innerHTML = `<b style="color:${RARITY_COLORS[s.item.rarity]}">${s.item.name}</b><br>${s.item.type} · ${s.item.rarity}<br>${st}<br><span style="color:#888">Venta: ${s.item.sellPrice} oro</span>`;
        const r = el.getBoundingClientRect();
        t.style.left = Math.min(window.innerWidth - 240, r.right + 8) + 'px';
        t.style.top = r.top + 'px';
        document.body.appendChild(t);
      });
      el.addEventListener('pointerleave', () => document.getElementById('tt')?.remove());
    });
    o.querySelector('#bt-close').onclick = () => g.changeState('PLAYING');
  }

  /* ==================== Minijuego ARISE ==================== */
  iniciarExtraccion(enemy) {
    const g = this.game;
    const ahora = performance.now();
    if (ahora < (this._cdArise || 0)) {
      return this.toast(`⏳ Extracción en enfriamiento: ${Math.ceil((this._cdArise - ahora) / 1000)}s`, '#e74c3c');
    }
    if (!puedeExtraer(g)) return this.toast(`🌑 Ejército completo (${SHADOW_MAX}/${SHADOW_MAX})`, '#9b59b6');

    g.changeState('EXTRACT');
    const o = this._nuevoOverlay();
    o.style.background = 'rgba(10,0,25,0.75)';
    o.innerHTML = `
      <div id="extract-box" style="position:static;transform:none">
        <h2>✦ ¡ARISE! ✦</h2>
        <p>Detén el indicador en la ZONA VERDE<br>pulsa [E], [ESPACIO] o toca la pantalla</p>
        <div class="extract-track">
          <div class="extract-zone"></div>
          <div class="extract-cursor"></div>
        </div>
        <p style="color:#9b59b6">Extrayendo: ${enemy.nombre}</p>
      </div>`;
    const zona = o.querySelector('.extract-zone');
    const cursor = o.querySelector('.extract-cursor');
    // zona verde aleatoria (20% del ancho)
    const zw = 20, z0 = 8 + Math.random() * (100 - zw - 16);
    zona.style.left = z0 + '%'; zona.style.width = zw + '%';
    let t0 = performance.now(), pos = 0, dir = 1, raf;
    const velocidad = 1.15; // vueltas/segundo
    const anim = now => {
      const dt = (now - t0) / 1000; t0 = now;
      pos += dir * dt * velocidad;
      if (pos > 1) { pos = 1; dir = -1; }
      if (pos < 0) { pos = 0; dir = 1; }
      cursor.style.left = `calc(${(pos * 100).toFixed(2)}% - 2px)`;
      raf = requestAnimationFrame(anim);
    };
    raf = requestAnimationFrame(anim);

    const resolver = exito => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', tecla);
      if (exito) this._ariseExito(enemy);
      else this._ariseFallo(enemy);
    };
    const intentar = () => {
      const dentro = pos * 100 >= z0 && pos * 100 <= z0 + zw;
      resolver(dentro);
    };
    const tecla = e => { if (['KeyE', 'Space', 'Enter'].includes(e.code)) { e.preventDefault(); intentar(); } };
    window.addEventListener('keydown', tecla);
    o.addEventListener('pointerdown', intentar);
    this._extractRef = { cancel: () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', tecla); } };
  }

  _ariseExito(enemy) {
    const g = this.game;
    g.audio.playSFX('arise');
    setTimeout(() => g.audio.playSFX('ariseOk'), 500);
    g.addParticles(enemy.x + 16, enemy.y + 16, 'arise', 50);
    g.combat.triggerScreenShake(10, 0.5);
    enemy.extraible = false;
    enemy.canDropShadow = false;

    this._extractFlash('¡ARISE!', '#9b59b6', () => {
      g.addShadow(enemy);
      enemy.removed = true;
      this.toast(`🌑 ${enemy.nombre} se alza como tu sombra (${g.shadows.length}/${SHADOW_MAX}) · Pulsa T para rol`, '#9b59b6', 3800);
      g.changeState('PLAYING');
    });
  }

  _ariseFallo(enemy) {
    const g = this.game;
    g.audio.playSFX('arriveFail');
    enemy.extraible = false;
    enemy.removed = true;
    this._cdArise = performance.now() + SHADOW_EXTRACT_CD * 1000;
    this._extractFlash('FALLO…', '#e74c3c', () => {
      this.toast(`El alma se desvaneció. Próxima extracción en ${SHADOW_EXTRACT_CD}s`, '#e74c3c');
      g.changeState('PLAYING');
    });
  }

  cancelarExtraccion() {
    this._extractRef?.cancel();
    this._cerrarOverlay();
    this.game.changeState('PLAYING');
  }

  _extractFlash(texto, color, despues) {
    this._cerrarOverlay();
    const o = this._nuevoOverlay();
    o.style.background = 'rgba(0,0,0,0.92)';
    o.innerHTML = `<div class="title-logo" style="color:${color};text-shadow:0 0 40px ${color}">${texto}</div>`;
    setTimeout(() => { this._cerrarOverlay(); despues?.(); }, 1400);
  }

  /* ==================== Pad táctil ==================== */
  _buildTouchPad() {
    if (!this.game.input.isMobile) return;
    const defs = [
      { accion: 'atk',   txt: 'ATK', css: '#e74c3c', right: 18,  bottom: 96 },
      { accion: 'skill', txt: 'SKL', css: '#9b59b6', right: 92,  bottom: 28 },
      { accion: 'dash',  txt: 'DSH', css: '#3498db', right: 18,  bottom: 28 },
      { accion: 'int',   txt: 'INT', css: '#2ecc71', right: 92,  bottom: 96 }
    ];
    for (const d of defs) {
      const b = document.createElement('div');
      b.className = 'touch-btn';
      b.textContent = d.txt;
      b.style.borderColor = d.css;
      b.style.color = d.css;
      b.style.right = d.right + 'px';
      b.style.bottom = `calc(${d.bottom}px + env(safe-area-inset-bottom, 0px))`;
      const ev = activo => window.dispatchEvent(new CustomEvent('sh-touch', { detail: { accion: d.accion, activo } }));
      b.addEventListener('touchstart', e => { e.preventDefault(); ev(true); }, { passive: false });
      b.addEventListener('touchend', () => ev(false));
      this.layer.appendChild(b);
    }
  }

  /* ==================== HUD en canvas ==================== */
  renderHUD(ctx) {
    const g = this.game, p = g.player;
    const W = g.canvas.width, H = g.canvas.height;
    const pad = 12 + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('padding-top')) || 0);

    ctx.save();
    ctx.font = `9px ${FONT}`;
    ctx.textBaseline = 'middle';

    /* --- Panel superior-izquierda: PV / PM / EXP --- */
    const pw = 232;
    ctx.fillStyle = 'rgba(10,10,26,0.85)';
    ctx.fillRect(pad, pad, pw, 64);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(pad, pad, pw, 64);

    // Insignia de nivel
    ctx.fillStyle = '#2a2408';
    ctx.beginPath(); ctx.arc(pad + 26, pad + 32, 20, 0, 7); ctx.fill();
    ctx.strokeStyle = COLORS.gold; ctx.stroke();
    ctx.fillStyle = COLORS.gold;
    ctx.textAlign = 'center';
    ctx.fillText(String(p.level), pad + 26, pad + 33);

    const bx = pad + 54, bw = pw - 66;
    this._barra(ctx, bx, pad + 12, bw, 12, p.hp / p.maxHp, COLORS.hp, `PV ${Math.ceil(p.hp)}/${p.maxHp}`);
    this._barra(ctx, bx, pad + 30, bw, 10, p.mp / p.maxMp, COLORS.mp, `PM ${Math.ceil(p.mp)}/${p.maxMp}`);
    this._barra(ctx, bx, pad + 46, bw, 6, p.exp / p.expToNext, COLORS.exp, '');

    /* --- Oro --- */
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(10,10,26,0.85)';
    ctx.fillRect(pad, pad + 72, 110, 26);
    ctx.strokeStyle = '#444';
    ctx.strokeRect(pad, pad + 72, 110, 26);
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(`💰 ${formatNumber(p.gold)}`, pad + 8, pad + 86);

    /* --- Estado de sombras --- */
    ctx.fillStyle = '#d7b6ff';
    ctx.fillText(`🌑 ${g.shadows.length}/${SHADOW_MAX}`, pad + 8, pad + 114);

    /* --- Combo --- */
    if (p.comboCount > 1 && p.comboTimer > 0) {
      ctx.font = `16px ${FONT}`;
      ctx.fillStyle = COLORS.gold;
      ctx.textAlign = 'center';
      ctx.fillText(`x${p.comboCount} COMBO`, W / 2, 82 + pad);
      ctx.font = `9px ${FONT}`;
    }

    /* --- Hotbar --- */
    const slot = 46, gap = 8, total = slot * 4 + gap * 3;
    const hx = W / 2 - total / 2, hy = H - slot - 14;
    const defs = [
      { k: 'Z', cd: p.attackCooldown, max: 0.3, c: '#e74c3c' },
      { k: 'X', cd: p.heavyCd, max: HEAVY_ATTACK_COOLDOWN, c: '#f1c40f', mp: 15 },
      { k: '⇧', cd: p.dashCooldown, max: DASH_COOLDOWN, c: '#3498db', mp: 10 },
      { k: 'C', cd: p.skillCd, max: SKILL_COOLDOWN, c: '#9b59b6', mp: 30 }
    ];
    defs.forEach((d, i) => {
      const x = hx + i * (slot + gap);
      ctx.fillStyle = 'rgba(15,15,35,0.85)';
      ctx.fillRect(x, hy, slot, slot);
      ctx.strokeStyle = d.c;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, hy, slot, slot);
      ctx.fillStyle = d.c;
      ctx.font = `13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(d.k, x + slot / 2, hy + slot / 2 - 4);
      // enfriamiento: cortina descendente
      const pct = clamp(d.cd / d.max, 0, 1);
      if (pct > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(x, hy, slot, slot * pct);
      }
      if (d.mp && p.mp < d.mp) {
        ctx.fillStyle = 'rgba(20,40,120,0.55)';
        ctx.fillRect(x, hy, slot, slot);
        ctx.fillStyle = '#7fb2ff';
        ctx.font = `7px ${FONT}`;
        ctx.fillText('PM', x + slot / 2, hy + slot - 10);
      }
      ctx.font = `9px ${FONT}`;
    });

    /* --- Recordatorio de extracción --- */
    const cercano = g.enemies.find(e => e.isDead && e.extraible &&
      Math.hypot(e.x - p.x, e.y - p.y) < 60);
    if (cercano) {
      ctx.font = `10px ${FONT}`;
      ctx.fillStyle = '#d7b6ff';
      ctx.textAlign = 'center';
      ctx.fillText('[E] ¡ARISE!', W / 2, H - slot - 34);
      ctx.font = `9px ${FONT}`;
    }

    /* --- Minimapa --- */
    this._minimapa(ctx, W, pad);

    /* --- Joystick táctil --- */
    g.input.renderJoystick(ctx);

    ctx.restore();
  }

  _barra(ctx, x, y, w, h, pct, color, texto) {
    pct = clamp(pct, 0, 1);
    ctx.fillStyle = '#111827';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * pct, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeRect(x + .5, y + .5, w, h);
    if (texto) {
      ctx.fillStyle = '#fff';
      ctx.font = `7px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(texto, x + 5, y + h / 2 + 1);
    }
  }

  _minimapa(ctx, W, pad) {
    const g = this.game, m = g.currentMap;
    const S = 104, x0 = W - S - pad - 4, y0 = pad;
    const esc = S / (m.width * 32);
    ctx.fillStyle = 'rgba(10,10,26,0.85)';
    ctx.fillRect(x0, y0, S, S);
    ctx.strokeStyle = COLORS.gold;
    ctx.strokeRect(x0, y0, S, S);

    const punto = (wx, wy, color, r = 2) => {
      ctx.fillStyle = color;
      ctx.fillRect(x0 + wx * esc - r / 2, y0 + wy * esc - r / 2, r, r);
    };
    // terreno simplificado (1 de cada 4 tiles)
    for (let ty = 0; ty < m.height; ty += 4) for (let tx = 0; tx < m.width; tx += 4) {
      const s = m.suelo[ty * m.width + tx];
      ctx.fillStyle = s === 3 ? '#1e3f8f' : m.solid[ty * m.width + tx] ? '#20242e' : 'rgba(60,140,80,0.5)';
      ctx.fillRect(x0 + tx * 32 * esc, y0 + ty * 32 * esc, 4 * 32 * esc, 4 * 32 * esc);
    }
    for (const p of m.portalesPos) punto(p.x, p.y, p.css, 4);
    for (const n of g.npcs) punto(n.x, n.y, '#2ecc71', 3);
    for (const e of g.enemies) if (!e.isDead) punto(e.x, e.y, '#e74c3c', 2.5);
    punto(g.player.x, g.player.y, '#ffffff', 4);
  }

  /* ==================== Fondo del menú (canvas) ==================== */
  renderMenuCanvas(ctx) {
    const g = this.game;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0a1a');
    grad.addColorStop(1, '#1b0b33');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // estrellas/sombras flotantes
    const t = (g.lastTime || 0) / 1000;
    for (let i = 0; i < 42; i++) {
      const x = ((i * 173.3) % W + Math.sin(t * 0.4 + i) * 14 + W) % W;
      const y = ((i * 91.7) % H - (t * 12 + i * 37) % H + H) % H;
      ctx.fillStyle = i % 3 ? 'rgba(155,89,182,0.5)' : 'rgba(255,215,0,0.35)';
      ctx.fillRect(x, y, 2.5, 2.5);
    }
  }
}
