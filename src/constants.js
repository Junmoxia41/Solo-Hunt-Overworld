/* ============================================================
   constants.js — Constantes globales y configuración del juego
   ============================================================ */

export const CANVAS_WIDTH  = () => window.innerWidth;   // función: el canvas es responsivo
export const CANVAS_HEIGHT = () => window.innerHeight;

export const TILE_SIZE   = 32;
export const MAP_W       = 80;   // mapa en tiles
export const MAP_H       = 80;
export const FPS_TARGET  = 60;
export const GRAVITY     = 0;    // top-down (se usa leve en partículas)

// --- Movimiento / combate del jugador ---
export const PLAYER_SPEED          = 200;   // px/segundo
export const DASH_SPEED            = 600;
export const DASH_DURATION         = 0.2;
export const DASH_COOLDOWN         = 1.5;
export const DASH_COST             = 10;
export const ATTACK_COOLDOWN       = 0.3;
export const HEAVY_ATTACK_COOLDOWN = 2.0;
export const HEAVY_COST            = 15;
export const SKILL_COOLDOWN        = 8.0;
export const SKILL_COST            = 30;
export const SKILL_RADIUS          = 80;    // Shadow Strike
export const IFRAMES_DURATION      = 1.0;

// --- Sombras (mecánica Arise) ---
export const SHADOW_MAX           = 5;
export const SHADOW_DAMAGE_RATIO  = 0.3;
export const SHADOW_RESPAWN       = 60;    // segundos
export const SHADOW_EXTRACT_CD    = 30;

// --- Progresión ---
export const EXP_BASE             = 100;
export const EXP_GROWTH           = 1.5;
export const STAT_POINTS_PER_LEVEL = 3;
export const MAX_LEVEL            = 50;

// --- Inventario / economía ---
export const MAX_INVENTORY_SLOTS  = 20;
export const DEATH_GOLD_PENALTY   = 0.10;  // pierde 10% del oro al caer
export const AUTOSAVE_INTERVAL    = 60000; // ms

// --- Rareza de items ---
export const RARITY_COLORS = {
  common:    '#ffffff',
  uncommon:  '#2ecc71',
  rare:      '#3498db',
  epic:      '#9b59b6',
  legendary: '#ffd700'
};

// Colores de marca del juego
export const COLORS = {
  bg: '#0a0a1a', gold: '#ffd700', hp: '#e74c3c', mp: '#3498db',
  exp: '#f1c40f', txt: '#ecf0f1', purple: '#9b59b6', green: '#2ecc71'
};

/** Experiencia necesaria para pasar de `level` a `level+1` */
export function expToNext(level) {
  return Math.floor(EXP_BASE * Math.pow(level, EXP_GROWTH));
}
