/* =========================================================
   enemies.js — Monstruos de los portales por rango
   Las stats escalan con el multiplicador del rango.
   ========================================================= */
import { mulberry } from '../core/rng.js';
import { RANGOS } from './portals.js';

const FICHA = {
  E:  { n: 'Duende Rencoroso', spd: 7,  rng: 1 },
  D:  { n: 'Lobo Sombrío',     spd: 11, rng: 1 },
  C:  { n: 'Gólem de Roca',    spd: 5,  rng: 1 },
  B:  { n: 'Quimera Feral',    spd: 12, rng: 1 },
  A:  { n: 'Espectro Mayor',   spd: 10, rng: 2 },
  S:  { n: 'Dragón Joven',     spd: 13, rng: 2 },
  SS: { n: 'Rey del Umbral',   spd: 15, rng: 2 }
};

const CUANTOS = { E: 1, D: 1, C: 2, B: 2, A: 3, S: 3, SS: 4 };

/** Escuadrón de un portal: determinista según la llave del portal */
export function escuadronDelPortal(portal) {
  const rango = portal.rango;
  const mult = RANGOS[rango].mult;
  const rng = mulberry(portal.key + ':squad');
  const n = CUANTOS[rango];
  const base = FICHA[rango];
  const lista = [];
  for (let i = 0; i < n; i++) {
    // Variación de ±10% por unidad del mismo portal
    const v = 0.9 + rng() * 0.2;
    lista.push({
      nombre: n > 1 ? `${base.n} ${['α', 'β', 'γ', 'δ'][i]}` : base.n,
      rango,
      maxHp: Math.round(26 * mult * v),
      atk:   Math.round(6 * mult * 0.9 * v),
      def:   Math.round(2.5 * mult * v),
      spd:   base.spd + Math.floor(rng() * 3),
      mov:   3,
      rng:   base.rng,
      escala: 0.85 + (i * 0.06) + (rango === 'SS' ? 0.35 : rango === 'S' ? 0.2 : 0)
    });
  }
  return lista;
}
