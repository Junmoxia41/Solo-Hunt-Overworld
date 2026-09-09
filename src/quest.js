/* ============================================================
   quest.js — QuestManager: cadena de misiones del Guía del Gremio
   v2.3: soporta 3 tipos de objetivo:
     - kill:     cazar N enemigos de un tipo (killLog)
     - collect:  reunir N objetos (se consumen al entregar)
     - dungeon:  completar la mazmorra de un rango
   La cadena avanza en orden; el progreso se guarda en la partida.
   ============================================================ */

import { SaveManager } from './save.js';

export class QuestGuia {
  constructor(game) {
    this.game = game;
    this.defs = game.data.quests || [];
    this.hechas = game.questsDone || [];
    this._restaurar();
  }

  /** La misión actual es la primera de la cadena sin completar */
  _restaurar() {
    this.def = this.defs.find(q => !this.hechas.includes(q.id)) || null;
    const prog = this.game.questProgreso || {};
    this.aceptada = !!(this.def && prog.actual === this.def.id && prog.aceptada);
    this._base = prog.base || 0; // línea base de kills al aceptar
    this.completada = !this.def; // cadena terminada
  }

  /* ---------- Progreso ---------- */
  progreso() {
    if (!this.def || !this.aceptada) return 0;
    const g = this.game;
    if (this.def.tipo === 'kill') {
      return Math.max(0, (g.killLog?.[this.def.objetivoTipo] || 0) - this._base);
    }
    if (this.def.tipo === 'collect') {
      return g.inventory.contarItem(this.def.objetivoTipo);
    }
    if (this.def.tipo === 'dungeon') {
      return (g.mazmorrasCompletadas?.[this.def.objetivoTipo] || 0) > 0 ? 1 : 0;
    }
    return 0;
  }

  get objetivo() { return this.def?.objetivo || 0; }
  get lista() { return !!this.def && this.aceptada && this.progreso() >= this.objetivo; }

  /** Etiqueta corta para el HUD */
  etiqueta() {
    if (!this.def) return '';
    const d = this.def;
    if (d.tipo === 'kill') {
      const NOMBRES = { lobo: 'lobos', murcielago: 'murciélagos', nomuerto: 'no-muertos', duende: 'duendes', mago: 'magos' };
      return `Caza ${d.objetivo} ${NOMBRES[d.objetivoTipo] || d.objetivoTipo}`;
    }
    if (d.tipo === 'collect') {
      const it = this.game.data.items.find(i => i.id === d.objetivoTipo);
      return `Reúne ${d.objetivo} ${it ? it.name : d.objetivoTipo}`;
    }
    return `Completa mazmorra Rango ${d.objetivoTipo}`;
  }

  /* ---------- Acciones ---------- */
  aceptar() {
    if (!this.def || this.aceptada) return;
    this.aceptada = true;
    this._base = this.game.killLog?.[this.def.objetivoTipo] || 0;
    this.game.audio.playSFX('quest');
    this.game.ui.toast(`📜 Misión aceptada: ${this.etiqueta()}`, '#2ecc71', 3200);
  }

  entregar() {
    const g = this.game, d = this.def;
    if (!d || !this.lista) return;
    // consumir materiales si es de recolección
    if (d.tipo === 'collect') {
      let faltan = d.objetivo;
      g.inventory.slots.forEach((s, i) => {
        if (!s || faltan <= 0 || s.item.id !== d.objetivoTipo) return;
        const quita = Math.min(faltan, s.cantidad);
        g.inventory.removeItem(i, quita);
        faltan -= quita;
      });
      if (faltan > 0) return; // seguridad: no debería pasar
    }
    const r = d.recompensa || {};
    g.player.gainExp(r.exp || 0);
    g.player.gold += r.oro || 0;
    this.hechas = [...this.hechas, d.id];
    g.questsDone = this.hechas;
    g.audio.playSFX('levelUp');
    g.addParticles(g.player.x + 16, g.player.y + 16, 'level_up', 30);
    let msg = `🏆 ¡Misión completada! +${r.exp || 0} EXP · +${r.oro || 0} oro`;
    // objeto de recompensa (síncrono via crearItem directo)
    if (r.item) {
      const it = this._crearItemSync(r.item.id);
      if (it && g.inventory.addItem(it, r.item.cantidad || 1)) {
        msg += ` · [${it.name}${r.item.cantidad > 1 ? ' x' + r.item.cantidad : ''}]`;
      }
    }
    g.ui.toast(msg, '#ffd700', 4200);
    // avanzar la cadena
    this.def = this.defs.find(q => !this.hechas.includes(q.id)) || null;
    this.completada = !this.def;
    this.aceptada = false;
    this._base = 0;
    if (!g.dungeon) { try { SaveManager.save(g); } catch (e) {} } // v2.3: guardar al entregar
  }

  /** crearItem síncrono (evita import dinámico) */
  _crearItemSync(id) {
    const base = this.game.data.items.find(i => i.id === id);
    return base ? { ...base, stats: { ...(base.stats || {}) } } : null;
  }

  /** Notificación de eventos del mundo (completar mazmorra, etc.) */
  notificar(evento, dato) {
    if (evento === 'dungeon' && this.def?.tipo === 'dungeon' && this.def.objetivoTipo === dato && this.aceptada) {
      this.game.ui.toast('📜 ¡Objetivo de misión cumplido! Vuelve con el Guía del Gremio', '#2ecc71', 4200);
    }
  }
}
