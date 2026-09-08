/* =========================================================
   textures.js — Generación de texturas por código
   Todos los assets del motor (tiles, highlights, monstruos,
   elementos de UI) se dibujan con Phaser Graphics en tiempo
   de carga: cero dependencias de red, 100% offline.
   ========================================================= */

export function generarTexturas(scene) {
  const T = 48;
  const g = scene.add.graphics();

  /* ---------- Tiles de biomas ---------- */
  const biomas = {
    pradera: 0x2f7a3d,
    bosque:  0x1c5530,
    agua:    0x1e3f8f,
    roca:    0x5c6470
  };
  for (const [nombre, color] of Object.entries(biomas)) {
    g.clear();
    g.fillStyle(color, 1).fillRect(0, 0, T, T);
    // motas de textura deterministas
    for (let i = 0; i < 6; i++) {
      const px = (i * 17 + nombre.length * 7) % T, py = (i * 29 + 11) % T;
      g.fillStyle(nombre === 'agua' ? 0x3a66c9 : 0x000000, nombre === 'agua' ? 0.25 : 0.12)
       .fillCircle(px, py, 2 + (i % 3));
    }
    g.lineStyle(1, 0xffffff, 0.05).strokeRect(0.5, 0.5, T - 1, T - 1);
    g.generateTexture('tile_' + nombre, T, T);
  }

  /* ---------- Decoraciones ---------- */
  g.clear();
  g.fillStyle(0x14532d, 1).fillTriangle(24, 4, 8, 34, 40, 34);
  g.fillStyle(0x166534, 1).fillTriangle(24, 12, 4, 42, 44, 42);
  g.fillStyle(0x713f12, 1).fillRect(21, 40, 6, 8);
  g.generateTexture('deco_tree', 48, 48);

  g.clear();
  g.fillStyle(0xf9a8d4, 1);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.fillCircle(12 + Math.cos(a) * 6, 12 + Math.sin(a) * 6, 4); }
  g.fillStyle(0xfde047, 1).fillCircle(12, 12, 3.5);
  g.generateTexture('deco_flower', 24, 24);

  g.clear();
  g.fillStyle(0x9ca3af, 1).fillRoundedRect(2, 6, 24, 16, 6);
  g.fillStyle(0x6b7280, 1).fillRoundedRect(6, 2, 14, 10, 4);
  g.generateTexture('deco_rock', 28, 24);

  /* ---------- Efectos ---------- */
  g.clear(); // brillo radial blanco (se tiñe por rango)
  for (let i = 24; i > 0; i--) g.fillStyle(0xffffff, 0.08 + (1 - i / 24) * 0.4).fillCircle(64, 64, i * 2.4);
  g.generateTexture('glow', 128, 128);

  g.clear();
  g.lineStyle(4, 0xffffff, 1).strokeCircle(32, 32, 26);
  g.lineStyle(2, 0xffffff, 0.6).strokeCircle(32, 32, 19);
  g.generateTexture('ring', 64, 64);

  g.clear();
  g.fillStyle(0x000000, 0.35).fillEllipse(24, 8, 44, 14);
  g.generateTexture('shadow', 48, 16);

  /* ---------- Highlights del tablero táctico ---------- */
  g.clear();
  g.fillStyle(0x3b82f6, 0.35).fillRoundedRect(1, 1, 46, 46, 6);
  g.lineStyle(2, 0x60a5fa, 0.9).strokeRoundedRect(1, 1, 46, 46, 6);
  g.generateTexture('hl_move', 48, 48);

  g.clear();
  g.fillStyle(0xef4444, 0.35).fillRoundedRect(1, 1, 46, 46, 6);
  g.lineStyle(2, 0xf87171, 0.95).strokeRoundedRect(1, 1, 46, 46, 6);
  g.generateTexture('hl_atk', 48, 48);

  g.clear();
  g.fillStyle(0xa855f7, 0.35).fillRoundedRect(1, 1, 46, 46, 6);
  g.lineStyle(2, 0xc084fc, 0.95).strokeRoundedRect(1, 1, 46, 46, 6);
  g.generateTexture('hl_skill', 48, 48);

  /* ---------- Monstruo base (cuerpo tintable + cara aparte) ---------- */
  g.clear();
  g.fillStyle(0xffffff, 1).fillCircle(32, 34, 26);          // cuerpo
  g.fillStyle(0xffffff, 0.55).fillCircle(32, 14, 8);        // oreja superior
  g.fillStyle(0x000000, 0.15).fillEllipse(32, 52, 34, 12);  // base sombreada
  g.generateTexture('mob_body', 64, 64);

  g.clear(); // cara enfadada (sin tintar)
  g.fillStyle(0xffffff, 1).fillCircle(23, 30, 6.5).fillCircle(41, 30, 6.5);
  g.fillStyle(0x111827, 1).fillCircle(24, 31, 3).fillCircle(40, 31, 3);
  g.lineStyle(3, 0x111827, 1);
  g.lineBetween(16, 20, 28, 24); g.lineBetween(48, 20, 36, 24);
  g.generateTexture('mob_face', 64, 64);

  /* ---------- UI común ---------- */
  g.clear();
  g.fillStyle(0xffffff, 1).fillCircle(32, 32, 30);
  g.lineStyle(3, 0xffffff, 0.9).strokeCircle(32, 32, 30);
  g.generateTexture('circ', 64, 64);

  g.clear();
  g.fillStyle(0x6d28d9, 1).fillRoundedRect(0, 0, 120, 44, 14);
  g.lineStyle(2, 0xa78bfa, 0.8).strokeRoundedRect(1, 1, 118, 42, 13);
  g.generateTexture('btn', 120, 44);

  g.clear();
  g.fillStyle(0x121a30, 0.96).fillRoundedRect(0, 0, 96, 96, 16);
  g.lineStyle(2, 0x8b5cf6, 0.5).strokeRoundedRect(1, 1, 94, 94, 15);
  g.generateTexture('panel', 96, 96);

  g.clear();
  g.fillStyle(0xffffff, 0.9).fillRoundedRect(0, 0, 190, 70, 12);
  g.fillStyle(0xffffff, 0.9).fillTriangle(80, 66, 100, 66, 90, 80);
  g.generateTexture('bubble', 190, 80);

  g.clear();
  g.fillStyle(0xffffff, 1).fillRoundedRect(0, 0, 10, 6, 3);
  g.generateTexture('bar', 10, 6);

  g.clear();
  g.fillStyle(0xffffff, 0.14).fillCircle(55, 55, 55);
  g.lineStyle(2, 0xffffff, 0.35).strokeCircle(55, 55, 55);
  g.generateTexture('joy_base', 110, 110);

  g.clear();
  g.fillStyle(0x8b5cf6, 1).fillCircle(24, 24, 22);
  g.fillStyle(0xc4b5fd, 1).fillCircle(17, 15, 8);
  g.generateTexture('joy_knob', 48, 48);

  g.destroy();
}
