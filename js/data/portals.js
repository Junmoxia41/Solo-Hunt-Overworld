/* =========================================================
   portals.js — Definición de rangos de portales
   Color, multiplicador de dificultad y nivel recomendado.
   ========================================================= */

export const RANGOS = {
  E:  { color: 0x8bc34a, colorCss: '#8bc34a', mult: 1,   nivel: 1  },
  D:  { color: 0x26c6da, colorCss: '#26c6da', mult: 1.6, nivel: 2  },
  C:  { color: 0x42a5f5, colorCss: '#42a5f5', mult: 2.4, nivel: 3  },
  B:  { color: 0xab47bc, colorCss: '#ab47bc', mult: 3.6, nivel: 5  },
  A:  { color: 0xef5350, colorCss: '#ef5350', mult: 5.5, nivel: 8  },
  S:  { color: 0xff9800, colorCss: '#ff9800', mult: 9,   nivel: 12 },
  SS: { color: 0xffd600, colorCss: '#ffd600', mult: 16,  nivel: 20 }
};

/** Recompensas al conquistar un portal */
export function recompensasDe(rango, rng = Math.random) {
  const m = RANGOS[rango].mult;
  return {
    oro: Math.round(8 * m + rng() * 6 * m),
    xp:  Math.round(10 * m + rng() * 5 * m)
  };
}
