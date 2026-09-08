/* ============================================================
   particle.js — Sistema de partículas con presets
   ============================================================ */
import { randomFloat, randomChoice } from './utils.js';

export class Particle {
  constructor(x, y, cfg = {}) {
    this.x = x; this.y = y;
    this.vx = cfg.vx ?? 0; this.vy = cfg.vy ?? 0;
    this.size = cfg.size ?? 4;
    this.color = cfg.color ?? '#ffffff';
    this.maxLife = cfg.life ?? 1;
    this.life = this.maxLife;
    this.alpha = 1;
    this.gravity = cfg.gravity ?? 0;
    this.friction = cfg.friction ?? 0.98;
    this.shrink = cfg.shrink ?? true;
    this.type = cfg.type ?? 'circle'; // circle | spark | smoke | square
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.gravity * dt;
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.life -= dt;
    this.alpha = Math.max(0, this.life / this.maxLife);
    if (this.shrink) this.size *= 0.985;
  }

  render(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    if (this.type === 'spark') {
      // chispa: línea en la dirección del movimiento
      ctx.strokeStyle = this.color;
      ctx.lineWidth = Math.max(1, this.size / 2);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * 0.03, this.y - this.vy * 0.03);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(0.5, this.size), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  isDead() { return this.life <= 0; }

  /** Fábrica con presets con nombre (usados en todo el juego) */
  static preset(nombre, x, y) {
    const P = PRESETS[nombre] || PRESETS.hit_slash;
    const ang = Math.random() * Math.PI * 2;
    const speed = randomFloat(P.speed[0], P.speed[1]);
    return new Particle(x, y, {
      vx: Math.cos(ang) * speed + (P.vx || 0),
      vy: Math.sin(ang) * speed + (P.vy || 0),
      size: randomFloat(P.size[0], P.size[1]),
      color: randomChoice(P.colors),
      life: randomFloat(P.life[0], P.life[1]),
      gravity: P.gravity || 0,
      type: P.type || 'circle',
      friction: P.friction ?? 0.98
    });
  }
}

/** Lanza `count` partículas de un preset */
export function spawnParticles(list, x, y, preset, count) {
  for (let i = 0; i < count; i++) list.push(Particle.preset(preset, x, y));
}

/* ---------- Catálogo de efectos (tuning visual del juego) ---------- */
const PRESETS = {
  hit_slash:    { colors: ['#ffffff', '#f1c40f', '#ffeaa7'], speed: [80, 220], life: [0.15, 0.35], size: [2, 4], type: 'spark' },
  hit_crit:     { colors: ['#ffd700', '#fff', '#ff8c00'],    speed: [140, 320], life: [0.25, 0.55], size: [2, 5], type: 'spark' },
  death_enemy:  { colors: ['#e74c3c', '#2c0a0a', '#6e1e1e'], speed: [30, 130], life: [0.5, 1.1], size: [3, 7], type: 'smoke', friction: 0.96 },
  death_player: { colors: ['#e74c3c', '#ffffff'],            speed: [60, 240], life: [0.8, 1.6], size: [3, 6], type: 'smoke' },
  level_up:     { colors: ['#ffd700', '#fff8dc', '#f1c40f'], speed: [20, 90],  life: [1.0, 2.0], size: [2, 5], vy: -60, type: 'circle' },
  arise:        { colors: ['#9b59b6', '#2c0045', '#00e5ff'], speed: [100, 340], life: [0.7, 1.6], size: [3, 8], type: 'smoke', friction: 0.94 },
  dash_trail:   { colors: ['#3498db', '#9b59b6'],            speed: [0, 25],   life: [0.2, 0.4], size: [3, 6], type: 'smoke' },
  heal:         { colors: ['#2ecc71', '#a9ffbf'],            speed: [10, 55],  life: [0.6, 1.1], size: [2, 4], vy: -50, type: 'circle' },
  portal:       { colors: ['#9b59b6', '#3498db', '#00e5ff'], speed: [8, 30],   life: [0.8, 1.5], size: [2, 4], type: 'circle' },
  gold_pickup:  { colors: ['#ffd700', '#fff3a0'],            speed: [20, 70],  life: [0.3, 0.6], size: [2, 4], vy: -40, type: 'circle' },
  extract_smoke:{ colors: ['#6a0dad', '#1a0030', '#9b59b6'], speed: [5, 40],   life: [0.6, 1.3], size: [4, 9], type: 'smoke' }
};
