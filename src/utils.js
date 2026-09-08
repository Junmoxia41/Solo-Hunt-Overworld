/* ============================================================
   utils.js — Funciones helper de matemáticas y colisiones
   ============================================================ */

export const lerp  = (a, b, t) => a + (b - a) * t;
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}
/** Distancia entre dos entidades (usa su centro) */
export function distEnt(a, b) {
  return distance(a.x + a.width / 2, a.y + a.height / 2, b.x + b.width / 2, b.y + b.height / 2);
}
/** Ángulo entre dos puntos (radianes) */
export function angle(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}
/** Vector unitario de a hacia b */
export function angleVec(a, b) {
  const ang = angle(a.x + a.width / 2, a.y + a.height / 2, b.x + b.width / 2, b.y + b.height / 2);
  return { x: Math.cos(ang), y: Math.sin(ang) };
}

export const randomInt   = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
export const randomFloat = (min, max) => Math.random() * (max - min) + min;
export const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function rectCollision(r1, r2) {
  return r1.x < r2.x + r2.width && r1.x + r1.width > r2.x &&
         r1.y < r2.y + r2.height && r1.y + r1.height > r2.y;
}
export function circleCollision(c1, c2) {
  const r1 = c1.radius ?? c1.width / 2, r2 = c2.radius ?? c2.width / 2;
  return distance(c1.x + (c1.width ?? r1 * 2) / 2, c1.y + (c1.height ?? r1 * 2) / 2,
                  c2.x + (c2.width ?? r2 * 2) / 2, c2.y + (c2.height ?? r2 * 2) / 2) < r1 + r2;
}
export const pointInRect = (px, py, r) => px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height;

export const degToRad = d => d * Math.PI / 180;
export const radToDeg = r => r * 180 / Math.PI;

/** 75 → "01:15" */
export function formatTime(s) {
  s = Math.floor(s);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
/** 12500 → "12.5K" */
export function formatNumber(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.floor(n));
}

/** PRNG con semilla (para mapas reproducibles por zona) */
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
