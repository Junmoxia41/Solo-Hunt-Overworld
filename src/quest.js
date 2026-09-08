/* ============================================================
   quest.js — Misión de caza del Guía del Gremio
   Estructura pensada para crecer a un QuestManager completo
   con data/quests.json (Milestone 3).
   ============================================================ */

export class QuestGuia {
  constructor(game) {
    this.game = game;
    const def = game.data.quests?.[0];
    this.id = def?.id || 'primeros_colmillos';
    this.objetivo = def?.objetivo || 5;
    this.tipoObjetivo = def?.tipo || 'lobo';
    this.aceptada = false;
    this.completada = !!(game.questsDone || []).includes(this.id);
    this._base = null; // kills al aceptar
  }

  progreso() {
    if (!this.aceptada) return 0;
    return (this.game.killLog?.[this.tipoObjetivo] || 0) - this._base;
  }
  get lista() { return this.aceptada && this.progreso() >= this.objetivo; }

  aceptar() {
    this.aceptada = true;
    this._base = this.game.killLog?.[this.tipoObjetivo] || 0;
    this.game.ui.toast(`📜 Misión aceptada: caza ${this.objetivo} lobos`, '#2ecc71');
    this.game.audio.playSFX('quest');
  }

  entregar() {
    this.completada = true;
    this.game.questsDone = [...(this.game.questsDone || []), this.id];
    this.game.player.gainExp(100);
    this.game.player.gold += 50;
    this.game.ui.toast('🏆 ¡Misión completada! +100 EXP · +50 oro', '#ffd700');
    this.game.audio.playSFX('levelUp');
    this.game.addParticles(this.game.player.x + 16, this.game.player.y + 16, 'level_up', 30);
  }
}
