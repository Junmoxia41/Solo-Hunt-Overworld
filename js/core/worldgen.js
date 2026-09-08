/* =========================================================
   worldgen.js — Generación procedural del overworld
   Mapa infinito, determinista a partir de la semilla GPS.
   Biomas, portales por chunk y NPCs.
   ========================================================= */
import { hash2, vnoise } from './rng.js';
import { RANGOS } from '../data/portals.js';

export const TILE = 48;   // px por casilla
export const CHUNK = 16;  // casillas por chunk (máx. 1 portal / 1 NPC por chunk)

export const SEMILLA_OFFLINE = 'offline:40.416,-3.703'; // zona semilla por defecto

/* ---------- Semilla activa (cambia al sincronizar GPS) ---------- */
let _seed = SEMILLA_OFFLINE;
let _bioCache = new Map();

export function setWorldSeed(seed) {
  if (_seed !== seed) { _seed = seed; _bioCache = new Map(); }
}
export function getWorldSeed() { return _seed; }

/* ---------- Biomas ---------- */
export function biomeAt(tx, ty) {
  const k = tx + ',' + ty;
  let b = _bioCache.get(k);
  if (b !== undefined) return b;
  const n = vnoise(tx / 14, ty / 14, _seed + 'A') * 0.65 + vnoise(tx / 5, ty / 5, _seed + 'B') * 0.35;
  b = n < 0.34 ? 'agua' : n < 0.60 ? 'pradera' : n < 0.78 ? 'bosque' : 'roca';
  _bioCache.set(k, b);
  return b;
}
export const caminable = b => b === 'pradera' || b === 'bosque';

/** Punto de aparición caminable en espiral desde el origen (en píxeles) */
export function buscarSpawn() {
  for (let r = 0; r < 64; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (caminable(biomeAt(dx, dy))) return { x: dx * TILE + TILE / 2, y: dy * TILE + TILE / 2 };
    }
  }
  return { x: TILE / 2, y: TILE / 2 };
}

/* ---------- Portales dimensionales ---------- */
function rangoDe(r) {
  if (r < 0.005) return 'SS';
  if (r < 0.02)  return 'S';
  if (r < 0.06)  return 'A';
  if (r < 0.13)  return 'B';
  if (r < 0.25)  return 'C';
  if (r < 0.50)  return 'D';
  return 'E';
}

/** Devuelve el portal del chunk (o null). Determinista por semilla. */
export function portalDelChunk(cx, cy) {
  const r = hash2(cx, cy, _seed + ':p');
  if (r > 0.5) return null; // ~50% de los chunks tienen portal
  const ox = Math.floor(hash2(cx, cy, _seed + ':px') * CHUNK);
  const oy = Math.floor(hash2(cx, cy, _seed + ':py') * CHUNK);
  const tx = cx * CHUNK + ox, ty = cy * CHUNK + oy;
  if (!caminable(biomeAt(tx, ty))) return null;
  const rango = rangoDe(hash2(cx, cy, _seed + ':pr'));
  return {
    key: `${_seed}|${cx},${cy}`,
    x: tx * TILE + TILE / 2,
    y: ty * TILE + TILE / 2,
    rango,
    nivel: RANGOS[rango].nivel
  };
}

/* ---------- NPCs ---------- */
const CARAS = ['🙂', '🧙', '👵', '🧔', '👧', '🧝'];
const FRASES = [
  'Dicen que un portal rango S apareció cerca de aquí…',
  'Los portales rojos son veneno puro. Ve con nivel, joven.',
  'Antes este valle era tranquilo. Luego llegaron las Grietas.',
  'Si ves un portal dorado… entrena mucho antes de entrar.',
  'Los cazadores del Top 100 de la Arena ganan fortunas.',
  'Entrena en portales verdes antes de tocar uno azul.',
  'Tu aura es distinta… ¿eres de los Elegidos?',
  'El oro del Overworld vale más que el oro allá afuera.',
  'Los rangos S y SS están sellados… de momento.',
  'La velocidad decide quién golpea primero en batalla.'
];

export function npcDelChunk(cx, cy) {
  const r = hash2(cx, cy, _seed + ':n');
  if (r > 0.3) return null;
  const ox = Math.floor(hash2(cx, cy, _seed + ':nx') * CHUNK);
  const oy = Math.floor(hash2(cx, cy, _seed + ':ny') * CHUNK);
  const tx = cx * CHUNK + ox, ty = cy * CHUNK + oy;
  if (!caminable(biomeAt(tx, ty))) return null;
  const h = hash2(cx, cy, _seed + ':nf');
  return {
    key: `${cx},${cy}`,
    x: tx * TILE + TILE / 2,
    y: ty * TILE + TILE / 2,
    cara: CARAS[Math.floor(h * CARAS.length)],
    frase: FRASES[Math.floor(hash2(cx, cy, _seed + ':nt') * FRASES.length)],
    fase: h * 9
  };
}
