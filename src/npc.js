/* ============================================================
   npc.js — NPCs del mundo con diálogo y misión
   ============================================================ */

export class NPC {
  constructor(game, x, y, id) {
    this.game = game;
    this.id = id;
    const d = game.data.dialogues[id];
    this.nombre = d?.nombre || '???';
    this.emoji = d?.emoji || '🧙';
    this.lineas = d?.lineas || ['…'];
    this.x = x; this.y = y;
    this.width = 32; this.height = 32;
    this.interactRange = 58;
    this.t = Math.random() * 6;
  }

  update(dt) { this.t += dt; }

  interact() {
    const g = this.game;
    const q = g.quests; // QuestManager
    let opcoes = null;

    // Lógica de misión del Guía del Gremio
    if (this.id === 'guia_gremio') {
      if (q && !q.aceptada && !q.completada) {
        opcoes = [{ texto: '⚔️ Aceptar misión: caza 5 lobos', accion: () => q.aceptar() }];
      } else if (q && q.aceptada && !q.lista) {
        const llevas = Math.min(q.progreso(), q.objetivo);
        this.lineasVivas = [`Los lobos no se cazan solos… llevas ${llevas}/${q.objetivo}.`];
      } else if (q && q.lista && !q.completada) {
        opcoes = [{ texto: '🎁 Entregar misión (+100 EXP, +50 oro)', accion: () => q.entregar() }];
      } else if (q && q.completada) {
        this.lineasVivas = ['Has demostrado tu valía. Los portales Rango E te esperan, cazador.'];
      }
    }

    // El Mercader abre su escaparate directamente
    if (this.id === 'mercader') {
      opcoes = [{ texto: '🛒 Comerciar (comprar / vender)', accion: () => g.ui.abrirTienda() }];
    }
    g.dialogue.iniciar(this, this.lineasVivas || this.lineas, opcoes);
  }

  render(ctx) {
    const bob = Math.sin(this.t * 2.4) * 2;
    // sombra
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(this.x + 16, this.y + 30, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // cuerpo
    ctx.fillStyle = '#1a2340';
    ctx.beginPath(); ctx.arc(this.x + 16, this.y + 16 + bob, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9b59b6'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(this.x + 16, this.y + 16 + bob, 15, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '17px serif'; ctx.textAlign = 'center';
    ctx.fillText(this.emoji, this.x + 16, this.y + 22 + bob);
    // indicador de interacción (misión solo en el Guía)
    const q = this.game.quests;
    const marca = q && this.id === 'guia_gremio'
      ? (!q.aceptada || q.lista) && !q.completada ? '!' : (q.completada ? '✓' : '…')
      : (this.id === 'mercader' ? '💰' : '!');
    ctx.fillStyle = marca === '!' ? '#ffd700' : '#2ecc71';
    ctx.font = '11px "Press Start 2P", monospace';
    ctx.fillText(marca, this.x + 16, this.y - 12 + bob);
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#c7d2fe';
    ctx.fillText(this.nombre, this.x + 16, this.y + 46);
  }
}
