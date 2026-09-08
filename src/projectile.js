/* ============================================================
   projectile.js — Proyectiles (flechas de duende, bolas de fuego)
   ============================================================ */

export class Projectile {
  constructor(game, cfg) {
    this.game = game;
    this.x = cfg.x; this.y = cfg.y;
    this.width = cfg.size || 12;
    this.height = cfg.size || 12;
    this.vx = cfg.vx; this.vy = cfg.vy;
    this.damage = cfg.damage;
    this.owner = cfg.owner; // 'player' | 'enemy'
    this.color = cfg.color || '#e67e22';
    this.tipo = cfg.tipo || 'bola'; // bola | flecha
    this.life = cfg.life || 3;
    this.dead = false;
    this.trail = cfg.trail ?? true;
    this._t = 0;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    this._t += dt;
    if (this.life <= 0) this.dead = true;
    // Colisión con paredes
    if (this.game.currentMap.isSolid(this.x + this.width / 2, this.y + this.height / 2)) this.destroy();
    // Estela
    if (this.trail && this._t > 0.03) {
      this._t = 0;
      this.game.particles.push({
        x: this.x + this.width / 2, y: this.y + this.height / 2,
        vx: 0, vy: 0, size: 3, color: this.color, maxLife: 0.25, life: 0.25,
        alpha: 1, gravity: 0, friction: 1, shrink: true, type: 'circle',
        update(dt) { this.life -= dt; this.alpha = this.life / this.maxLife; },
        render(ctx) {
          ctx.save(); ctx.globalAlpha = this.alpha; ctx.fillStyle = this.color;
          ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        },
        isDead() { return this.life <= 0; }
      });
    }
  }

  render(ctx) {
    ctx.save();
    if (this.tipo === 'flecha') {
      const ang = Math.atan2(this.vy, this.vx);
      ctx.translate(this.x + 6, this.y + 6);
      ctx.rotate(ang);
      ctx.fillStyle = this.color;
      ctx.fillRect(-8, -1.5, 16, 3);
      ctx.beginPath();
      ctx.moveTo(8, -4); ctx.lineTo(14, 0); ctx.lineTo(8, 4);
      ctx.fill();
    } else {
      const cx = this.x + this.width / 2, cy = this.y + this.height / 2;
      const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, this.width);
      glow.addColorStop(0, '#fff');
      glow.addColorStop(0.4, this.color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, this.width, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    if (this.tipo === 'bola') {
      this.game.addParticles(this.x + 6, this.y + 6, 'hit_slash', 6);
      this.game.audio.playSFX('hit');
    }
  }
}
