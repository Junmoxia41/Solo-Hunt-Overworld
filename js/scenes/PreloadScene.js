/* =========================================================
   PreloadScene — Carga de assets con splash estilizado
   Carga los sprites chibi reales disponibles y genera por
   código el resto de texturas del motor (tiles, UI, FX).
   ========================================================= */
import { generarTexturas } from '../core/textures.js';
import { FONT } from '../core/widgets.js';
import { PERSONAJES } from '../data/characters.js';

export class PreloadScene extends Phaser.Scene {
  constructor() { super('preload'); }

  preload() {
    const { width, height } = this.scale;

    /* ---------- Splash: logo ---------- */
    const cx = width / 2, cy = height / 2;
    const titulo = this.add.text(cx, cy - 110, 'SOLO HUNT', {
      fontFamily: FONT, fontSize: '42px', fontStyle: '900', color: '#c4b5fd'
    }).setOrigin(0.5).setLetterSpacing(6);
    this.add.text(cx, cy - 72, 'OVERWORLD', {
      fontFamily: FONT, fontSize: '15px', color: '#22d3ee'
    }).setOrigin(0.5).setLetterSpacing(10);

    /* ---------- Barra de progreso ---------- */
    const barW = Math.min(300, width * 0.7), barH = 12;
    const fondo = this.add.graphics().fillStyle(0x1c2440, 1)
      .fillRoundedRect(cx - barW / 2, cy - 30, barW, barH, 6);
    const relleno = this.add.graphics();
    const pct = this.add.text(cx, cy - 2, '0%', {
      fontFamily: FONT, fontSize: '13px', color: '#8f9bbd'
    }).setOrigin(0.5);

    this.load.on('progress', v => {
      relleno.clear().fillGradientStyle(0x22d3ee, 0x22d3ee, 0x8b5cf6, 0x8b5cf6, 1)
        .fillRoundedRect(cx - barW / 2, cy - 30, barW * v, barH, 6);
      pct.setText(Math.round(v * 100) + '%');
    });

    /* ---------- Sprites chibi disponibles (resto: Fase arte) ---------- */
    for (const p of PERSONAJES) {
      if (p.img) this.load.image('char_' + p.id, `assets/chars/${p.id}.png`);
    }
    this.load.image('icon_app', 'assets/icon-512.png');
  }

  create() {
    // Texturas generadas por código (tiles, monstruos, UI…) — cero red
    generarTexturas(this);

    // Breve pausa dramática y a explorar
    this.time.delayedCall(500, () => {
      this.scene.start('world');
    });
  }
}
