/* ============================================================
   inventory.js — Inventario: 20 slots, equipamiento y consumibles
   ============================================================ */
import { MAX_INVENTORY_SLOTS } from './constants.js';

export class Inventory {
  constructor(game) {
    this.game = game;
    this.slots = Array(MAX_INVENTORY_SLOTS).fill(null); // {item, cantidad}
    this.equipped = { weapon: null, armor: null, accessory: null };
  }

  addItem(item, cantidad = 1) {
    if (item.stackable) {
      for (const s of this.slots) {
        if (s && s.item.id === item.id && s.cantidad < (item.maxStack || 99)) {
          s.cantidad = Math.min(item.maxStack || 99, s.cantidad + cantidad);
          this.game.player.recalculateStats();
          return true;
        }
      }
    }
    const libre = this.slots.findIndex(s => s === null);
    if (libre === -1) { this.game.ui.toast('🎒 ¡Inventario lleno!', '#e74c3c'); return false; }
    this.slots[libre] = { item, cantidad };
    return true;
  }

  removeItem(idx, cantidad = 1) {
    const s = this.slots[idx];
    if (!s) return;
    s.cantidad -= cantidad;
    if (s.cantidad <= 0) this.slots[idx] = null;
  }

  equip(idx) {
    const s = this.slots[idx];
    if (!s || !['weapon', 'armor', 'accessory'].includes(s.item.type)) return;
    const previo = this.equipped[s.item.type];
    this.equipped[s.item.type] = s.item;
    this.slots[idx] = null;
    if (previo) this.addItem(previo, 1);
    this.game.player.recalculateStats();
    this.game.audio.playSFX('item');
    this.game.ui.toast(`Equipado: ${s.item.name}`, '#9b59b6');
  }

  useItem(idx) {
    const s = this.slots[idx];
    if (!s || s.item.type !== 'consumable') return;
    const p = this.game.player;
    const ef = {
      hp_potion: () => { p.hp = Math.min(p.maxHp, p.hp + 60); },
      mp_potion: () => { p.mp = Math.min(p.maxMp, p.mp + 40); },
      elixir:    () => { p.hp = p.maxHp; p.mp = p.maxMp; }
    }[s.item.id];
    if (ef) {
      ef();
      this.removeItem(idx);
      this.game.addParticles(p.x + 16, p.y + 16, 'heal', 12);
      this.game.audio.playSFX('heal');
    }
  }

  serialize() {
    return {
      slots: this.slots.map(s => s ? { id: s.item.id, cantidad: s.cantidad } : null),
      equipped: Object.fromEntries(Object.entries(this.equipped).map(([k, v]) => [k, v ? v.id : null]))
    };
  }

  deserialize(d) {
    if (!d) return;
    const buscar = id => this.game.data.items.find(i => i.id === id) || null;
    this.slots = (d.slots || []).map(s => s ? { item: buscar(s.id), cantidad: s.cantidad } : null)
                                .map(s => s && s.item ? s : null);
    for (const k of Object.keys(this.equipped)) {
      this.equipped[k] = d.equipped?.[k] ? buscar(d.equipped[k]) : null;
    }
    this.game.player.recalculateStats();
  }
}
