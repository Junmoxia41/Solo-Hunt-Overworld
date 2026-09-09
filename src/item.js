/* ============================================================
   item.js — Items del mundo: datos, drops en el suelo y recogida
   ============================================================ */
import { RARITY_COLORS } from './constants.js';

/** Convierte una entrada de data/items.json en objeto jugable */
export function crearItem(game, id) {
  const base = game.data.items.find(i => i.id === id);
  return base ? { ...base, stats: { ...(base.stats || {}) } } : null;
}

export const ICONOS = {
  weapon: '⚔️', armor: '🛡️', consumable: '🧪', material: '🦷', accessory: '💍'
};

/** Item tirado en el suelo (entidad ligera) */
export class GroundItem {
  constructor(game, item, x, y) {
    this.game = game;
    this.item = item;
    this.cantidad = item.cantidadDrop || 1;
    this.x = x; this.y = y;
    this.width = 24; this.height = 24;
    this.recogido = false;
    this.t = Math.random() * 6;
    this._pie = 22; // ancla de profundidad: apoyado en el suelo
  }

  update(dt) { this.t += dt; }

  recoger() {
    const g = this.game;
    if (g.inventory.addItem(this.item, this.cantidad)) {
      this.recogido = true;
      g.ui.toast(`✨ Obtuviste [${this.item.name}]${this.cantidad > 1 ? ' x' + this.cantidad : ''}`, RARITY_COLORS[this.item.rarity]);
      g.audio.playSFX('item');
      g.addParticles(this.x, this.y, 'gold_pickup', 6);
    }
  }

  render(ctx) {
    const bob = Math.sin(this.t * 4) * 3;
    const color = RARITY_COLORS[this.item.rarity];
    ctx.save();
    // brillo de rareza
    ctx.globalAlpha = 0.35 + Math.sin(this.t * 5) * 0.12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(this.x + 12, this.y + 12 + bob, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = '14px serif';
    ctx.textAlign = 'center';
    ctx.fillText(ICONOS[this.item.type] || '❓', this.x + 12, this.y + 17 + bob);
    ctx.restore();
  }
}
