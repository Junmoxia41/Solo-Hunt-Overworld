/* ============================================================
   dialogue.js — Gestor de diálogos con efecto typewriter
   Renderiza sobre la capa HTML (#ui-layer) en #dialogue-box.
   ============================================================ */

export class DialogueManager {
  constructor(game) {
    this.game = game;
    this.activo = false;
    this._timer = null;
  }

  iniciar(npc, lineas, opciones = null) {
    this.cerrar();
    this.game.changeState('DIALOGUE');
    this.activo = true;
    this.opciones = opciones;
    this._pintarCaja(npc.nombre, '');
    this._escribir(lineas, 0);
  }

  _pintarCaja(nombre, texto) {
    let box = document.getElementById('dialogue-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'dialogue-box';
      document.getElementById('ui-layer').appendChild(box);
      box.addEventListener('pointerdown', () => this._avanzar());
    }
    box.innerHTML = `
      <div class="npc-name">${nombre}</div>
      <div class="dlg-text"></div>
      <div class="dlg-next">▼</div>
      <div class="dlg-opciones" style="margin-top:10px;display:none;flex-direction:column;gap:8px;"></div>`;
    box.style.display = 'block';
    this._box = box;
    this._lineasRestantes = null;
  }

  _escribir(lineas, idx) {
    this._lineasRestantes = lineas.slice(idx + 1);
    const texto = lineas[idx];
    this._ultimaLinea = texto; // para el clic "completar línea al instante"
    this._opcionesPuestas = false;
    const destino = this._box.querySelector('.dlg-text');
    let i = 0;
    destino.textContent = '';
    this.game.audio.playSFX('menuMove');
    this._timer = setInterval(() => {
      i++;
      destino.textContent = texto.slice(0, i);
      if (i >= texto.length) {
        clearInterval(this._timer);
        this._timer = null;
        if (!this._lineasRestantes.length) this._mostrarOpciones();
      }
    }, 26); // typewriter
  }

  _avanzar() {
    if (!this.activo) return;
    if (this._timer) { // completar la línea instantáneo
      clearInterval(this._timer);
      this._timer = null;
      this._box.querySelector('.dlg-text').textContent = this._ultimaLinea || '';
      if (!this._lineasRestantes?.length) this._mostrarOpciones();
      return;
    }
    if (this._lineasRestantes && this._lineasRestantes.length) this._escribir(this._lineasRestantes, 0);
    else if (!this.opciones) this.cerrar();
  }

  _mostrarOpciones() {
    const cont = this._box?.querySelector('.dlg-opciones');
    if (!cont || !this.opciones?.length || this._opcionesPuestas) return;
    this._opcionesPuestas = true;
    cont.innerHTML = '';
    cont.style.display = 'flex';
    for (const op of this.opciones) {
      const b = document.createElement('button');
      b.className = 'rpg-btn small purple';
      b.textContent = op.texto;
      b.style.pointerEvents = 'auto';
      b.addEventListener('pointerdown', e => {
        e.stopPropagation();
        this.game.audio.playSFX('menuOk');
        op.accion();
        this.cerrar();
      });
      cont.appendChild(b);
    }
  }

  cerrar() {
    this.activo = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    document.getElementById('dialogue-box')?.remove();
    this._box = null;
    if (this.game.state === 'DIALOGUE') this.game.changeState('PLAYING');
  }
}
