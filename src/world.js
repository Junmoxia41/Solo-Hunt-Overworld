/* ============================================================
   world.js — EL VOLUMEN: definición de biomas (Folios)
   El mundo es un libro: cada bioma es el recuerdo de algo.
   Toda la configuración de un bioma vive aquí (data-driven):
   añadir un Folio nuevo = añadir su entrada + sus tiles.
   ============================================================ */

export const ORDEN_BIOMAS = ['bosque', 'pradera', 'cementerio', 'cenaga'];

export const BIOMAS = {
  /* — FOLIO I: el recuerdo de la primera lluvia — */
  bosque: {
    nombre: 'Bosque de Penumbra', folio: 'I', niveles: '1-4', nivelSpawn: 1,
    sueloA: '#2f7a3d', sueloB: '#2a6f38', tierra: '#6b4f2a', tierraClara: '#755a31',
    aguaA: '#16407c', aguaB: '#1b4a90', aguaC: '#123a74',
    brizna: 'rgba(20,70,35,0.55)', detalle: 'briznas',
    ambiente: 'rgba(20, 8, 40, 0.10)',
    deco: { arbol: 'tile_arbol', flor: 'tile_flor', solido: 'tile_roca', solidoTipo: 'roca' },
    umbrales: { arbol: 0.93, flor: 0.965, solido: 0.975 },
    fauna: [['lobo', 8], ['murcielago', 4], ['nomuerto', 2], ['duende', 2], ['mago', 1]],
    faunaRespawn: ['lobo', 'lobo', 'murcielago', 'nomuerto', 'duende', 'mago'],
    aguaExtra: { tipo: 'lago', cx: 20, cy: 56, rx: 9, ry: 6 } // el lago original
  },

  /* — FOLIO II: el último día de paz — */
  pradera: {
    nombre: 'Praderas del Mediodía Eterno', folio: 'II', niveles: '4-8', nivelSpawn: 5,
    sueloA: '#b3a24a', sueloB: '#a89742', tierra: '#a58a4a', tierraClara: '#b39a54',
    aguaA: '#2e6fb8', aguaB: '#3a7bc8', aguaC: '#2865a8',
    brizna: 'rgba(120,90,20,0.5)', detalle: 'briznas_altas',
    ambiente: 'rgba(255, 200, 80, 0.07)',
    deco: { arbol: 'tile_pradera_arbol', flor: 'tile_pradera_flor', solido: 'tile_roca', solidoTipo: 'roca' },
    umbrales: { arbol: 0.958, flor: 0.93, solido: 0.985 },
    fauna: [['duende', 5], ['lobo', 4], ['murcielago', 3]],
    faunaRespawn: ['duende', 'lobo', 'murcielago'],
    aguaExtra: { tipo: 'estanques', lista: [[100, 22, 5, 4], [138, 58, 4, 3]] }
  },

  /* — FOLIO III: los que la Tinta borró — */
  cementerio: {
    nombre: 'Campos de los Nombres', folio: 'III', niveles: '6-10', nivelSpawn: 8,
    sueloA: '#4a4f5e', sueloB: '#404553', tierra: '#55505c', tierraClara: '#635e6b',
    aguaA: '#3a4450', aguaB: '#43505c', aguaC: '#333c46',
    brizna: 'rgba(30,32,44,0.6)', detalle: 'niebla',
    ambiente: 'rgba(180, 180, 200, 0.14)',
    deco: { arbol: 'tile_cementerio_arbol', flor: null, solido: 'tile_cementerio_tumba', solidoTipo: 'tumba' },
    umbrales: { arbol: 0.952, flor: 1.1, solido: 0.963 }, // flor 1.1 = nunca
    fauna: [['nomuerto', 8], ['murcielago', 4], ['mago', 2]],
    faunaRespawn: ['nomuerto', 'nomuerto', 'murcielago', 'mago'],
    aguaExtra: { tipo: 'estanques', lista: [[26, 104, 4, 3]] }
  },

  /* — FOLIO IV: el reflejo que quedó — */
  cenaga: {
    nombre: 'Ciénaga de los Espejos', folio: 'IV', niveles: '9-13', nivelSpawn: 11,
    sueloA: '#3d5a45', sueloB: '#35503e', tierra: '#4a3d2e', tierraClara: '#574936',
    aguaA: '#1a2f38', aguaB: '#203842', aguaC: '#152730',
    brizna: 'rgba(15,40,30,0.6)', detalle: 'lodo',
    ambiente: 'rgba(10, 30, 25, 0.18)',
    deco: { arbol: 'tile_cenaga_arbol', flor: 'tile_cenaga_flor', solido: 'tile_roca', solidoTipo: 'roca' },
    umbrales: { arbol: 0.94, flor: 0.962, solido: 0.984 },
    fauna: [['mago', 4], ['nomuerto', 4], ['murcielago', 4]],
    faunaRespawn: ['mago', 'nomuerto', 'murcielago'],
    aguaExtra: { tipo: 'pantano', ruido: 42, umbral: 0.62 } // manchas orgánicas grandes
  }
};

/** Índice de bioma (0-3) desde coordenadas de tile, con bordes orgánicos
 *  (el límite entre Folios "tiembla" con ruido determinista) */
export function biomaIdx(tx, ty, ruido) {
  const jx = (ruido(tx, ty, 21) - 0.5) * 12;
  const jy = (ruido(tx, ty, 22) - 0.5) * 12;
  const este = tx + jx >= 80, sur = ty + jy >= 80;
  return (este ? 1 : 0) + (sur ? 2 : 0); // 0 bosque | 1 pradera | 2 cementerio | 3 ciénaga
}
