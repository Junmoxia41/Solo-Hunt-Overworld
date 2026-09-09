/* ============================================================
   ui.js — Interfaz completa: HUD en canvas (barras, hotbar,
   minimapa) + overlays HTML (menú, pausa, level up, game over,
   inventario) + minijuego de extracción ARISE + toasts.
   ============================================================ */
import { COLORS, RARITY_COLORS, DASH_COOLDOWN, HEAVY_ATTACK_COOLDOWN, SKILL_COOLDOWN, SHADOW_MAX, SHADOW_EXTRACT_CD, CARGA_MS } from './constants.js';
import { clamp, formatNumber } from './utils.js';
import { ICONOS, crearItem } from './item.js';
import { SaveManager } from './save.js';
import { puedeExtraer } from './shadow.js';
import { Dungeon, RANGOS } from './dungeon.js';
import { pantallaCarga } from './loader.js';

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
        else if (g.state === 'PORTAL' || g.state === 'SHOP' || g.state === 'MAPVIEW') g.changeState('PLAYING');
      }
      if (e.code === 'KeyI') {
        if (g.state === 'PLAYING') g.changeState('INVENTORY');
        else if (g.state === 'INVENTORY') g.changeState('PLAYING');
      }
      if (e.code === 'KeyM') { // MAPA completo del mundo
        if (g.state === 'PLAYING') g.changeState('MAPVIEW');
        else if (g.state === 'MAPVIEW') g.changeState('PLAYING');
      }
      if (e.code === 'KeyN') { // silencio (mute)
        const m = g.audio.toggleMute();
        this.toast(m ? '🔇 Audio silenciado (N)' : '🔊 Audio activado', '#888');
      }
      // v2.2: poción rápida sin abrir el inventario
      if (e.code === 'KeyH' && g.state === 'PLAYING') g.inventory.usarRapido('hp_potion');
      if (e.code === 'KeyJ' && g.state === 'PLAYING') g.inventory.usarRapido('mp_potion');
      if (e.code === 'KeyT' && g.shadows.length) { // cambiar rol de las sombras
        for (const s of g.shadows) s.role = s.role === 'attack' ? 'defend' : 'attack';
        this.toast(`🌑 Sombras en modo: ${g.shadows[0].role === 'attack' ? 'ATAQUE' : 'DEFENSA'} (T)`, '#9b59b6');
      }
    });

    this._buildTouchPad();

    // v2.2: botones táctiles especiales (MAP/POT) — el resto van por InputManager
    window.addEventListener('sh-touch', e => {
      const { accion, activo } = e.detail;
      if (!activo) return;
      const g = this.game;
      if (accion === 'map') {
        if (g.state === 'PLAYING') g.changeState('MAPVIEW');
        else if (g.state === 'MAPVIEW') g.changeState('PLAYING');
      } else if (accion === 'pot' && g.state === 'PLAYING') {
        g.inventory.usarRapido('hp_potion');
      }
    });
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
    else if (state === 'MAPVIEW') this._mapaGrande();
  }

  /* ---------- Mapa mundial a pantalla completa (tecla M) ---------- */
  _mapaGrande() {
    const g = this.game, m = g.currentMap;
    const o = this._nuevoOverlay();
    const LADO = Math.min(window.innerWidth, window.innerHeight) * 0.86;
    const cv = document.createElement('canvas');
    const celdas = Math.max(m.width, m.height);
    const cel = Math.max(4, Math.floor(LADO / celdas));
    cv.width = m.width * cel; cv.height = m.height * cel;
    cv.style.cssText = `image-rendering:pixelated;max-width:92vw;max-height:70vh;border:2px solid var(--gold);`;
    const c2 = cv.getContext('2d');
    // terreno
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
      const i = y * m.width + x;
      c2.fillStyle = m.solid[i] === 1 || m.solid[i] === 3 ? '#20242e'
        : m.solid[i] === 4 ? '#5c6673' // rocas (ahora sólidas)
        : m.suelo[i] === 3 ? '#1e3f8f'
        : m.suelo[i] === 2 ? '#6b4f2a'
        : (x + y) % 2 ? '#2f7a3d' : '#2a6f38';
      c2.fillRect(x * cel, y * cel, cel, cel);
    }
    // portales, npc, player
    for (const p of m.portalesPos) { c2.fillStyle = p.css; c2.fillRect(p.x / 32 * cel - 3, p.y / 32 * cel - 3, 7, 7); }
    for (const n of g.npcs) { c2.fillStyle = '#2ecc71'; c2.fillRect(n.x / 32 * cel - 2, n.y / 32 * cel - 2, 5, 5); }
    c2.fillStyle = '#fff';
    c2.beginPath(); c2.arc(g.player.x / 32 * cel, g.player.y / 32 * cel, 5, 0, 7); c2.fill();
    c2.strokeStyle = '#9b59b6'; c2.lineWidth = 2;
    c2.beginPath(); c2.arc(g.player.x / 32 * cel, g.player.y / 32 * cel, 7, 0, 7); c2.stroke();

    const wrap = document.createElement('div');
    wrap.className = 'rpg-panel'; wrap.style.textAlign = 'center';
    wrap.innerHTML = `
      <h2>🗺️ MAPA — ${m.name === 'mazmorra' ? `MAZMORRA ${g.dungeon?.rango || ''}` : 'BOSQUE INICIAL'}</h2>
      <div style="display:flex;justify-content:center;gap:14px;font-size:8px;margin-bottom:8px">
        <span style="color:#fff">● tú</span><span style="color:#2ecc71">● NPC</span><span style="color:#8bc34a">● portal E</span><span style="color:#ff9800">● portal S</span>
      </div>`;
    wrap.appendChild(cv);
    const btn = document.createElement('button');
    btn.className = 'rpg-btn small'; btn.style.marginTop = '10px';
    btn.textContent = 'CERRAR MAPA (M)';
    btn.onclick = () => g.changeState('PLAYING');
    wrap.appendChild(btn);
    wrap.style.pointerEvents = 'auto';
    o.appendChild(wrap);
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
    o.classList.add('title-bg'); // exponer el key-art de fondo
    const info = SaveManager.getSaveInfo();
    o.innerHTML = `
      <div class="title-logo">SOLO HUNT</div>
      <div class="title-sub">OVERWORLD ✦ REMASTER</div>
      <button class="rpg-btn" id="bt-continuar" ${info ? '' : 'disabled'}>▶ Continuar ${info ? `(Nv. ${info.level})` : ''}</button>
      <button class="rpg-btn purple" id="bt-nueva">✦ Nueva partida</button>
      <button class="rpg-btn small" id="bt-cazador">🧝 Cazador</button>
      <button class="rpg-btn small" id="bt-creditos">Créditos</button>
      <div class="title-ver">v2.2.0 · H poción · I inventario · M mapa · N sonido · zoom: rueda/+/−</div>`;
    o.querySelector('#bt-continuar').addEventListener('click', async () => {
      this.game.audio.playSFX('menuOk');
      await this._entrarBosque();
    });
    o.querySelector('#bt-nueva').addEventListener('click', () => {
      this.game.audio.playSFX('menuOk');
      if (SaveManager.hasSave() && !confirm('¿Borrar la partida guardada y empezar de cero?')) return;
      const habiaDatosCargados = !!this.game.saveInfo?.player;
      SaveManager.deleteSave();
      if (habiaDatosCargados) location.reload(); // reinicio limpio si había progreso cargado
      else this._entrarBosque();
    });
    o.querySelector('#bt-cazador').addEventListener('click', () => {
      this.game.audio.playSFX('menuMove');
      this._selectorCazador();
    });
    o.querySelector('#bt-creditos').addEventListener('click', () => {
      this.game.audio.playSFX('menuMove');
      this.toast('Hecho con ♥ por Junmoxia41 + Arena · Sprites IA originales · Motor: Canvas 2D vanilla', '#9b59b6', 4200);
    });
  }

  /* ---------- Entrar al bosque desde el menú (con carga de escena) ---------- */
  async _entrarBosque() {
    const g = this.game;
    await pantallaCarga(g, {
      titulo: 'BOSQUE',
      sub: 'EL BOSQUE DE PENUMBRA',
      minMs: CARGA_MS.bosque,
      pasos: [
        'Espabilando a los lobos…',
        'Meciéndose las flores…',
        'Encendiendo las luciérnagas…',
        'El Guía del Gremio te espera…'
      ]
    });
    g.camera.snap(g.player, g.currentMap);
    g.changeState('PLAYING');
    this.toast('🌲 Zona: Bosque Inicial — busca al Guía del Gremio', '#2ecc71', 3600);
  }

  /* ==================== Tienda del Mercader Krow ==================== */
  abrirTienda() {
    this.game.changeState('SHOP');
    this._pintarTienda();
  }

  _pintarTienda() {
    const g = this.game, inv = g.inventory;
    const CATALOGO = ['hp_potion', 'mp_potion', 'rusty_sword', 'leather_armor', 'iron_sword', 'elixir', 'anillo_duende', 'colgante_hueso'];
    const o = this._nuevoOverlay();
    o.innerHTML = `
      <div class="rpg-panel" style="max-height:88vh;overflow:auto;min-width:min(92vw,480px)">
        <h2>🛒 MERCADER KROW</h2>
        <p style="text-align:center;color:#ffd700">Oro: <b>${formatNumber(g.player.gold)}</b> 💰</p>
        <h3>Comprar</h3>
        <div id="shop-buy"></div>
        <h3>Vender (toca tus objetos)</h3>
        <div id="shop-sell"></div>
        <button class="rpg-btn small" id="bt-end" style="display:block;margin:14px auto 0">CERRAR TIENDA (ESC)</button>
      </div>`;

    // — Comprar — (precio = valor de venta × 3)
    const cont = o.querySelector('#shop-buy');
    for (const id of CATALOGO) {
      const proto = g.data.items.find(i => i.id === id);
      if (!proto) continue;
      const precio = Math.max(8, Math.ceil(proto.sellPrice * 3));
      const fila = document.createElement('div');
      fila.className = 'shop-row';
      const statsTxt = Object.entries(proto.stats || {}).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(' · ');
      fila.innerHTML = `
        <span>${ICONOS[proto.type] || '❓'} <b style="color:${RARITY_COLORS[proto.rarity]}">${proto.name}</b><br>
        <small style="color:#888">${statsTxt}</small></span>
        <button class="rpg-btn small" ${g.player.gold < precio ? 'disabled' : ''}>💰 ${precio}</button>`;
      fila.querySelector('button').onclick = () => {
        if (g.player.gold < precio) return;
        g.player.gold -= precio;
        inv.addItem(crearItem(g, id), 1);
        g.audio.playSFX('coin');
        this.toast(`🛒 Compraste: ${proto.name}`, '#2ecc71');
        this._pintarTienda();
      };
      cont.appendChild(fila);
    }

    // — Vender —
    const vend = o.querySelector('#shop-sell');
    const vendibles = inv.slots.map((s, i) => ({ s, i })).filter(x => x.s);
    if (!vendibles.length) vend.innerHTML = '<p style="color:#666">Tu mochila está vacía… caza algo y vuelve.</p>';
    for (const { s, i } of vendibles) {
      const fila = document.createElement('div');
      fila.className = 'shop-row';
      fila.innerHTML = `
        <span>${ICONOS[s.item.type]} ${s.item.name}${s.cantidad > 1 ? ' x' + s.cantidad : ''}</span>
        <button class="rpg-btn small green">+${s.item.sellPrice} 💰</button>`;
      fila.querySelector('button').onclick = () => {
        inv.removeItem(i, 1);
        g.player.gold += s.item.sellPrice;
        g.audio.playSFX('coin');
        this.toast(`+${s.item.sellPrice} oro por ${s.item.name}`, '#ffd700');
        this._pintarTienda();
      };
      vend.appendChild(fila);
    }
    o.querySelector('#bt-end').onclick = () => g.changeState('PLAYING');
  }

  /* ==================== Selector de cazador ==================== */
  _selectorCazador() {
    const g = this.game;
    const CHARS = ['kaito','rin','yuna','grom','sora','dante','mika','roku','elena','atlas','nix','hana'];
    const o = this._nuevoOverlay();
    o.innerHTML = `
      <div class="rpg-panel" style="text-align:center;max-width:min(94vw,560px)">
        <h2>ELIGE TU CAZADOR</h2>
        <p style="margin-bottom:10px">El elegido se guarda al continuar la partida</p>
        <div id="cgrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;"></div>
        <button class="rpg-btn small" id="bt-back-menu" style="margin-top:14px">VOLVER</button>
      </div>`;
    const grid = o.querySelector('#cgrid');
    for (const c of CHARS) {
      const img = g.assets['char_' + c];
      const cel = document.createElement('div');
      cel.className = 'char-cell' + (g.player.charId === c ? ' sel' : '');
      cel.innerHTML = img
        ? `<img src="${img.src}" alt="${c}"><span>${c.toUpperCase()}</span>`
        : `<span style="font-size:22px">🧝</span><span>${c.toUpperCase()}</span>`;
      cel.addEventListener('pointerdown', () => {
        g.player.charId = c;
        g.audio.playSFX('menuOk');
        this.toast(`🧝 Ahora cazas como ${c.toUpperCase()}`, '#9b59b6');
        if (SaveManager.hasSave()) SaveManager.save(g);
        this._menu();
      });
      grid.appendChild(cel);
    }
    o.querySelector('#bt-back-menu').onclick = () => this._menu();
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
        <p style="text-align:center;font-size:8px;color:#b9b9d0;margin-top:8px">🎥 Cámara: rueda del ratón o +/− (pellizco en móvil) · ahora x${g.camera ? g.camera.zoom.toFixed(2) : '—'}</p>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px;align-items:center">
          <button class="rpg-btn" id="bt-resume">▶ Continuar</button>
          <button class="rpg-btn small" id="bt-inv">🎒 Inventario (I)</button>
          <button class="rpg-btn small" id="bt-mute">${g.audio.isMuted ? '🔊 Quitar silencio' : '🔇 Silenciar'} (N)</button>
          <button class="rpg-btn small green" id="bt-save">💾 Guardar</button>
          <button class="rpg-btn small" id="bt-menu">🚪 Salir al menú</button>
        </div>
      </div>`;
    o.querySelector('#bt-resume').onclick = () => { g.audio.playSFX('menuOk'); g.changeState('PLAYING'); };
    o.querySelector('#bt-inv').onclick = () => g.changeState('INVENTORY');
    o.querySelector('#bt-mute').onclick = e => { const m = g.audio.toggleMute(); e.target.textContent = m ? '🔊 Quitar silencio (N)' : '🔇 Silenciar (N)'; };
    o.querySelector('#bt-save').onclick = () => {
      if (g.dungeon) return this.toast('🚫 No puedes guardar dentro de una mazmorra', '#e74c3c');
      SaveManager.save(g); g.audio.playSFX('menuOk'); this.toast('💾 Guardado');
    };
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
      if (g.dungeon) {
        // Caer dentro: la incursión fracasa, sales castigado al exterior
        g.dungeon.fail('El vínculo se rompió tras tu caída');
      } else {
        g.audio.playBGM('overworld');
        SaveManager.save(g);
        g.changeState('PLAYING');
      }
    };
    o.querySelector('#bt-menu').onclick = () => { SaveManager.save(g); location.reload(); };
  }

  /* ---------- Inventario estilo WoW: muñeco + equipo + stats ---------- */
  _inventario() {
    const g = this.game, p = g.player, inv = g.inventory;
    const o = this._nuevoOverlay();

    // slots de equipamiento (tipo papel-doll: clic para equipar/quitar)
    const eqSlot = (tipo, icono) => {
      const it = inv.equipped[tipo];
      return `<div class="equip-slot" data-tipo="${tipo}" title="">
        <span class="eq-ico">${it ? ICONOS[tipo] : icono}</span>
        ${it ? `<span class="eq-name" style="color:${RARITY_COLORS[it.rarity]}">${it.name}</span>`
             : `<span class="eq-name eq-void">vacío</span>`}
      </div>`;
    };

    const slotHTML = (s, i) => s
      ? `<div class="inv-slot rar-${s.item.rarity}" data-i="${i}">${ICONOS[s.item.type] || '❓'}${s.cantidad > 1 ? `<span class="qty">${s.cantidad}</span>` : ''}</div>`
      : `<div class="inv-slot" data-i="${i}"></div>`;

    const imgChar = g.assets['char_' + p.charId];
    o.innerHTML = `
      <div class="rpg-panel papel" style="max-height:92vh;overflow:auto">
        <h2>${p.charId.toUpperCase()} — Nivel ${p.level}</h2>
        <div class="papel-cols">
          <div class="papel-col">
            <div class="papel-marco">
              ${imgChar ? `<img src="${imgChar.src}" alt="cazador">` : '🧝'}
              ${eqSlot('weapon', '⚔️')}
              ${eqSlot('armor', '🛡️')}
              ${eqSlot('accessory', '💍')}
            </div>
          </div>
          <div class="papel-col papel-inv">
            <h3>🎒 Mochila (${inv.slots.filter(Boolean).length}/${inv.slots.length})</h3>
            <div class="inv-grid">${inv.slots.map(slotHTML).join('')}</div>
            <button class="rpg-btn small" id="bt-ordenar" style="margin-top:8px">🧹 ORDENAR MOCHILA</button>
            <p class="ayuda">Click: equipar/usar · H poción rápida en partida</p>
          </div>
          <div class="papel-col">
            <h3 style="color:#ffd700">📊 Estadísticas</h3>
            <table class="stat-table">
              <tr><td>PV</td><td>${Math.ceil(p.hp)} / ${p.maxHp}</td></tr>
              <tr><td>PM</td><td>${Math.ceil(p.mp)} / ${p.maxMp}</td></tr>
              <tr><td>ATQ</td><td>${p.atk}</td></tr>
              <tr><td>DEF</td><td>${p.def}</td></tr>
              <tr><td>MATQ</td><td>${p.matk}</td></tr>
              <tr><td>MDEF</td><td>${p.mdef}</td></tr>
              <tr><td>CRÍT</td><td>${p.critChance.toFixed(1)}%</td></tr>
              <tr><td>EVASIÓN</td><td>${p.evasion.toFixed(1)}%</td></tr>
              <tr><td>DROPS</td><td>+${p.dropBonus.toFixed(1)}%</td></tr>
              <tr><td>REGEN</td><td>${p.hpRegen.toFixed(1)}/s</td></tr>
              <tr><td style="color:#ffd700">ORO</td><td>${formatNumber(p.gold)}</td></tr>
              <tr><td>☠️ Bajas</td><td>${p.totalKills}</td></tr>
            </table>
          </div>
        </div>
        <button class="rpg-btn" id="bt-close" style="display:block;margin:12px auto 0">CERRAR (I)</button>
      </div>`;

    // clicks en ranuras de equipo → desequipar
    o.querySelectorAll('.equip-slot').forEach(el => {
      el.addEventListener('pointerdown', () => {
        const tipo = el.dataset.tipo;
        const it = inv.equipped[tipo];
        if (!it) return;
        inv.equipped[tipo] = null;
        inv.addItem(it, 1);
        g.player.recalculateStats();
        g.audio.playSFX('item');
        this.toast(`🔓 Desequipado: ${it.name}`, '#95a5a6');
        this._inventario();
      });
    });
    // v2.2: botón de ordenar
    o.querySelector('#bt-ordenar').onclick = () => { inv.ordenar(); this._inventario(); };
    // clicks en mochila
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
        t.className = 'tooltip'; t.id = 'tt';
        // v2.2: comparativa con lo equipado (verde = mejora, rojo = empeora)
        const NS = { atk: 'ATQ', def: 'DEF', hp: 'PV', crit: 'CRÍT', spd: 'VEL%' };
        let st;
        if (['weapon', 'armor', 'accessory'].includes(s.item.type)) {
          const eq = inv.equipped[s.item.type];
          const keys = [...new Set([...Object.keys(s.item.stats || {}), ...Object.keys(eq?.stats || {})])];
          st = keys.map(k => {
            const nuevo = s.item.stats?.[k] || 0, actual = eq?.stats?.[k] || 0;
            const d = nuevo - actual;
            const color = d > 0 ? '#2ecc71' : d < 0 ? '#e74c3c' : '#95a5a6';
            const marca = d === 0 ? '' : ` <span style="color:${color}">(${d > 0 ? '+' : ''}${d})</span>`;
            return `+${nuevo} ${NS[k] || k.toUpperCase()}${marca}`;
          }).join('<br>') + `<br><span style="color:#888">vs ${eq ? eq.name : 'nada equipado'}</span>`;
        } else {
          st = Object.entries(s.item.stats || {}).map(([k, v]) => `+${v} ${NS[k] || k.toUpperCase()}`).join(' · ');
        }
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

  /* ==================== Mazmorras: prompt y resultados ==================== */
  /** Pantalla de confirmación al pisar un portal del overworld */
  portalPrompt(portal) {
    const g = this.game;
    const cfg = RANGOS[portal.rango];
    if (!cfg) return;
    g.changeState('PORTAL');
    const o = this._nuevoOverlay();
    const nivelOk = g.player.level >= cfg.nivelMin;
    const tiempo = Math.floor((cfg.pisos * cfg.segPiso + cfg.segExtra) / 60);
    o.innerHTML = `
      <div class="rpg-panel" style="border-color:${portal.css};text-align:center">
        <h2 style="color:${portal.css}">🌀 PORTAL RANGO ${portal.rango}</h2>
        <p>Mazmorra procedural · ${cfg.pisos} pisos · bestias de zona ${cfg.zona}</p>
        <p>Jefe: <b>${cfg.jefe.nombre}</b></p>
        <p>Límite de tiempo aprox: ${tiempo} min · EXP ×2 al completar</p>
        <p style="color:${nivelOk ? '#2ecc71' : '#e74c3c'};margin-top:8px">
          ${nivelOk ? `✔ Nivel ${cfg.nivelMin}+ requerido (eres nivel ${g.player.level})`
                     : `✘ Requiere nivel ${cfg.nivelMin} — tú eres nivel ${g.player.level}`}</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="rpg-btn green" id="bt-enter" ${nivelOk ? '' : 'disabled'}>⚔️ ENTRAR</button>
          <button class="rpg-btn small" id="bt-back">Atrás</button>
        </div>
      </div>`;
    o.querySelector('#bt-back').onclick = () => g.changeState('PLAYING');
    if (nivelOk) o.querySelector('#bt-enter').onclick = async () => {
      g.addParticles(g.player.x + 16, g.player.y + 16, 'portal', 30);
      await new Dungeon(g, portal.rango).entrar(); // entra con su pantalla de carga
    };
  }

  /** Pantalla de resultados al completar la mazmorra */
  mostrarResultadosDungeon(d) {
    const g = this.game;
    g.changeState('DUNGEON_END');
    const o = this._nuevoOverlay();
    o.innerHTML = `
      <div class="rpg-panel" style="border-color:#ffd700;text-align:center">
        <h2 style="color:#ffd700">🏆 MAZMORRA SUPERADA</h2>
        <p style="font-size:14px;color:#ffd700;margin:6px 0">RANGO ${d.rango} COMPLETADO</p>
        <div style="text-align:left;display:inline-block;margin:8px auto">
          <p>☠️ Bajas: <b>${d.kills}</b></p>
          <p>⭐ EXP ganada: ${d.exp} <span style="color:#2ecc71">(+${d.bonusExp} bonus ×2)</span></p>
          <p>💰 Oro ganado: ${d.oro} <span style="color:#ffd700">(+${d.oroTotal} recompensa)</span></p>
          <p>⏱️ Tiempo restante: ${d.tiempoSobra}</p>
          <p>🌑 Sombras en servicio: ${d.sombras}/${SHADOW_MAX}</p>
        </div>
        <button class="rpg-btn" id="bt-end" style="margin-top:14px">SEGUIR CAZANDO</button>
      </div>`;
    o.querySelector('#bt-end').onclick = () => {
      g.audio.playSFX('menuOk');
      // si quedaron puntos de stat pendientes tras la lluvia de EXP, abrir su panel
      g.changeState(g.player.statPoints > 0 ? 'LEVEL_UP' : 'PLAYING');
    };
  }

  /** Pantalla de fracaso (tiempo agotado o caída) */
  mostrarFalloDungeon(d) {
    const g = this.game;
    g.changeState('DUNGEON_END');
    const o = this._nuevoOverlay();
    o.style.background = 'rgba(30, 5, 10, 0.85)';
    o.innerHTML = `
      <div class="rpg-panel" style="border-color:#e74c3c;text-align:center">
        <h2 style="color:#e74c3c">💔 INCURSIÓN FALLIDA</h2>
        <p>${d.motivo}</p>
        <p style="margin-top:8px">Alcanzaste el piso ${d.pisos} del rango ${d.rango}</p>
        <p>☠️ ${d.kills} bajas · 💰 te llevas ${d.oro} de oro saqueado</p>
        <button class="rpg-btn" id="bt-end" style="margin-top:14px">REAGRUPARSE</button>
      </div>`;
    o.querySelector('#bt-end').onclick = () => { g.audio.playSFX('menuOk'); g.changeState('PLAYING'); };
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
      { accion: 'heavy', txt: 'HVY', css: '#f1c40f', right: 18,  bottom: 170 },
      { accion: 'skill', txt: 'SKL', css: '#9b59b6', right: 92,  bottom: 28 },
      { accion: 'dash',  txt: 'DSH', css: '#3498db', right: 18,  bottom: 28 },
      { accion: 'int',   txt: 'INT', css: '#2ecc71', right: 92,  bottom: 96 },
      { accion: 'map',   txt: 'MAP', css: '#8bc34a', right: 92,  bottom: 170 },
      { accion: 'pot',   txt: 'POT', css: '#e57373', right: 166, bottom: 28 }
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

    /* --- Hotbar (en PC incluye H = poción de vida rápida) --- */
    const defs = [
      { k: 'Z', cd: p.attackCooldown, max: 0.3, c: '#e74c3c' },
      { k: 'X', cd: p.heavyCd, max: HEAVY_ATTACK_COOLDOWN, c: '#f1c40f', mp: 15 },
      { k: '⇧', cd: p.dashCooldown, max: DASH_COOLDOWN, c: '#3498db', mp: 10 },
      { k: 'C', cd: p.skillCd, max: SKILL_COOLDOWN, c: '#9b59b6', mp: 30 }
    ];
    if (!g.input.isMobile) defs.push({ k: 'H', cd: 0, max: 1, c: '#2ecc71', pot: true });
    const slot = 46, gap = 8, total = slot * defs.length + gap * (defs.length - 1);
    const hx = W / 2 - total / 2, hy = H - slot - 14;
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
      if (d.pot) { // contador de pociones de vida
        const n = g.inventory.contarItem('hp_potion');
        if (n === 0) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, hy, slot, slot); }
        ctx.font = `8px ${FONT}`;
        ctx.fillStyle = n > 0 ? '#fff' : '#777';
        ctx.textAlign = 'right';
        ctx.fillText('x' + n, x + slot - 5, hy + slot - 7);
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

    /* --- Cinta de mazmorra: rango, piso y cuenta atrás --- */
    if (g.dungeon) {
      const d = g.dungeon;
      const cinta = `🌀 ${d.rango} · Piso ${d.piso}/${d.cfg.pisos} · ${d._tmm()}`;
      ctx.font = `9px ${FONT}`;
      const cw = ctx.measureText(cinta).width + 26;
      const quedanPoco = d.tiempoRestante < 30;
      ctx.fillStyle = 'rgba(10,10,26,0.85)';
      ctx.fillRect(W / 2 - cw / 2, pad, cw, 24);
      ctx.strokeStyle = quedanPoco ? COLORS.hp : '#42a5f5';
      ctx.strokeRect(W / 2 - cw / 2, pad, cw, 24);
      ctx.fillStyle = quedanPoco ? COLORS.hp : '#9fd3ff';
      ctx.textAlign = 'center';
      ctx.fillText(cinta, W / 2, pad + 13);
    }

    /* --- Barra del jefe con marcas de fase --- */
    const boss = g.enemies.find(e => e.esBoss && !e.isDead);
    if (boss) {
      const bw = Math.min(420, W - 60);
      const bx = W / 2 - bw / 2, by = pad + (g.dungeon ? 34 : 6);
      ctx.font = `10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = boss.cssBoss;
      ctx.fillText(`👑 ${boss.nombre}`, W / 2, by - 2);
      // barra
      ctx.fillStyle = '#1a0a12';
      ctx.fillRect(bx, by + 8, bw, 12);
      ctx.fillStyle = boss.cssBoss;
      ctx.fillRect(bx, by + 8, bw * clamp(boss.hp / boss.maxHp, 0, 1), 12);
      ctx.strokeStyle = '#000';
      ctx.strokeRect(bx + .5, by + 8.5, bw, 12);
      // marcas de fase (60% y 30%)
      ctx.fillStyle = '#000';
      ctx.fillRect(bx + bw * 0.4 - 1, by + 8, 2, 12);
      ctx.fillRect(bx + bw * 0.7 - 1, by + 8, 2, 12);
      ctx.font = `7px ${FONT}`;
      ctx.fillStyle = COLORS.txt;
      ctx.fillText(`FASE ${boss.phase}${boss.phase === 3 ? ' — ENAJENACIÓN' : ''}`, W / 2, by + 30);
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
    // terreno simplificado (1 de cada 4 tiles) — color según tipo de mapa
    const esMazmorra = m.name === 'mazmorra';
    const colorSuelo = esMazmorra ? 'rgba(150,150,180,0.55)' : 'rgba(60,140,80,0.5)';
    for (let ty = 0; ty < m.height; ty += 4) for (let tx = 0; tx < m.width; tx += 4) {
      const s = m.suelo[ty * m.width + tx];
      ctx.fillStyle = s === 3 ? '#1e3f8f' : m.solid[ty * m.width + tx] ? (esMazmorra ? '#0c0a14' : '#20242e') : colorSuelo;
      ctx.fillRect(x0 + tx * 32 * esc, y0 + ty * 32 * esc, 4 * 32 * esc, 4 * 32 * esc);
    }
    for (const p of m.portalesPos) punto(p.x, p.y, p.css, 4);
    for (const n of g.npcs) punto(n.x, n.y, '#2ecc71', 3);
    for (const e of g.enemies) if (!e.isDead) punto(e.x, e.y, '#e74c3c', 2.5);
    punto(g.player.x, g.player.y, '#ffffff', 4);

    // Rectángulo de la vista de la cámara (respeta el zoom)
    if (g.camera) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        x0 + g.camera.x * esc, y0 + g.camera.y * esc,
        Math.max(3, g.camera.width * esc), Math.max(3, g.camera.height * esc)
      );
      // indicador de zoom
      ctx.fillStyle = '#c7d2fe';
      ctx.font = `7px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(`🔍 x${g.camera.zoom.toFixed(1)}`, x0 + S / 2, y0 + S + 12);
    }
  }

  /* ==================== Fondo del menú (canvas) ==================== */
  renderMenuCanvas(ctx) {
    const g = this.game;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const bg = g.assets['menu_bg'];
    if (bg) { // key-art de fondo (cover)
      const es = Math.max(W / bg.width, H / bg.height);
      const w = bg.width * es, h = bg.height * es;
      ctx.drawImage(bg, (W - w) / 2, (H - h) / 2, w, h);
      ctx.fillStyle = 'rgba(5, 5, 18, 0.55)'; // barniz para que el título lea
      ctx.fillRect(0, 0, W, H);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0a0a1a');
      grad.addColorStop(1, '#1b0b33');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
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
