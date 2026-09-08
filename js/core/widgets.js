/* =========================================================
   widgets.js — Fábricas de UI reutilizables
   Tokens de personaje (sprite real o avatar generado),
   botones y paneles con estilo unificado del juego.
   ========================================================= */

export const FONT = 'system-ui, -apple-system, sans-serif';

/**
 * Token visual de un cazador: usa su sprite chibi real si existe
 * (kaito, rin, yuna…) o un avatar generado con inicial + color de rol.
 * Los 9 sprites restantes se añadirán en cuanto se apruebe el estilo:
 * basta soltar `assets/chars/<id>.png` y marcar `img: true` en data.
 */
export function tokenPersonaje(scene, char, size = 56) {
  const c = scene.add.container(0, 0);
  const key = 'char_' + char.id;
  if (char.img && scene.textures.exists(key)) {
    const img = scene.add.image(0, 0, key);
    const esc = size / Math.max(img.width, img.height);
    img.setScale(esc);
    c.add(img);
    // Referencia directa al sprite para poder girarlo con flipX
    // (NUNCA usar scaleX negativo sobre contenedores: rompe el culling)
    c.spriteImage = img;
  } else {
    const bg = scene.add.image(0, 0, 'circ').setTint(char.color).setDisplaySize(size, size);
    const ini = scene.add.text(0, 0, char.nombre[0], {
      fontFamily: FONT, fontSize: Math.round(size * 0.42) + 'px', fontStyle: '900', color: '#ffffff'
    }).setOrigin(0.5);
    ini.setShadow(0, 2, 'rgba(0,0,0,0.45)', 4);
    c.add([bg, ini]);
  }
  c.setSize(size, size);
  return c;
}

/** Botón con textura generada, texto y callback */
export function crearBoton(scene, x, y, { texto = '', ancho = 120, alto = 44, fontSize = 14, tinte = null, onTap = null, color = '#ffffff' } = {}) {
  const btn = scene.add.image(0, 0, 'btn').setDisplaySize(ancho, alto);
  if (tinte !== null) btn.setTint(tinte);
  const label = scene.add.text(0, 0, texto, {
    fontFamily: FONT, fontSize: fontSize + 'px', fontStyle: '800', color, align: 'center'
  }).setOrigin(0.5);
  const c = scene.add.container(x, y, [btn, label]);
  c.setSize(ancho, alto);
  c.setInteractive({ useHandCursor: true });
  if (onTap) c.on('pointerdown', onTap);
  c.label = label; c.fondo = btn;
  return c;
}

/** Panel oscuro con borde violeta, escalable */
export function crearPanel(scene, x, y, ancho, alto) {
  return scene.add.image(x, y, 'panel').setDisplaySize(ancho, alto);
}

/** Texto flotante de daño / curación con animación de subida y desvanecido */
export function textoFlotante(scene, x, y, msg, color = '#ffffff', size = 20) {
  const t = scene.add.text(x, y, msg, {
    fontFamily: FONT, fontSize: size + 'px', fontStyle: '900', color, stroke: '#000000', strokeThickness: 3
  }).setOrigin(0.5).setDepth(900);
  scene.tweens.add({
    targets: t, y: y - 42, alpha: 0, duration: 900, ease: 'Cubic.out',
    onComplete: () => t.destroy()
  });
  return t;
}
