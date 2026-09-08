/* ============================================================
   combat.js — Colisiones de combate, hitlag, screen shake
   y números de daño flotantes
   ============================================================ */
import { rectCollision, randomFloat, angleVec, distEnt } from './utils.js';
import { SHADOW_DAMAGE_RATIO } from './constants.js';

export class Combat {
  constructor(game) {
    this.game = game;
    this.damageNumbers = [];
    this.hitlagTimer = 0;
    this.shake = { x: 0, y: 0, intensity: 0, duration: 0, timer: 0 };
  }

  /* ---------- Colisiones ---------- */
  checkCollisions() {
    const g = this.game;
    const p = g.player;

    // — Jugador golpea enemigos —
    if (p.isAttacking && p.hitbox.active && !p._hitRegistered) {
      for (const e of g.enemies) {
        if (e.isDead) continue;
        let hit;
        if (p.hitbox.circular) {
          const r = p.hitbox.width / 2;
          hit = distEnt({ x: p.hitbox.x, y: p.hitbox.y, width: p.hitbox.width, height: p.hitbox.height }, e) < r + e.width / 2;
        } else {
          hit = rectCollision(p.hitbox, e);
        }
        if (hit) {
          const { damage, isCrit } = p.getAttackDamage();
          const dir = angleVec(p, e);
          e.takeDamage(damage, dir.x, dir.y, isCrit);
          this.spawnDamageNumber(e.x + e.width / 2, e.y, damage, {
            color: isCrit ? '#ffd700' : '#ffffff', size: isCrit ? 22 : 14, crit: isCrit
          });
          g.addParticles(e.x + 16, e.y + 16, isCrit ? 'hit_crit' : 'hit_slash', isCrit ? 15 : 8);
          // Sensación de impacto
          if (isCrit) { this.triggerHitlag(5); this.triggerScreenShake(8, 0.2); }
          else { this.triggerHitlag(2); this.triggerScreenShake(3, 0.1); }
          g.audio.playSFX(isCrit ? 'heavy' : 'hit');
          if (p.attackType !== 'skill') p._hitRegistered = true; // el básico/pesado: 1 blanco; el skill: área
        }
      }
    }

    // — Proyectiles —
    for (const pr of g.projectiles) {
      if (pr.dead) continue;
      if (pr.owner === 'enemy' && rectCollision(pr, p)) {
        p.takeDamage(pr.damage, pr);
        pr.destroy();
      } else if (pr.owner === 'player') {
        for (const e of g.enemies) {
          if (!e.isDead && rectCollision(pr, e)) {
            const kb = angleVec(p, e);
            e.takeDamage(pr.damage, kb.x * 0.5, kb.y * 0.5, false);
            this.spawnDamageNumber(e.x + 16, e.y, pr.damage, { color: '#d7b6ff', size: 13 });
            pr.destroy();
            break;
          }
        }
      }
    }

    // — Sombras del jugador atacan —
    for (const s of g.shadows) {
      if (!s.isAlive || s.attackTimer > 0) continue;
      const objetivo = s.target && !s.target.isDead ? s.target : null;
      if (objetivo && distEnt(s, objetivo) < 46) {
        const dmg = Math.max(1, Math.round(p.atk * SHADOW_DAMAGE_RATIO * (0.9 + Math.random() * 0.2)));
        objetivo.takeDamage(dmg, 0, 0, false);
        this.spawnDamageNumber(objetivo.x + 16, objetivo.y, dmg, { color: '#9b59b6', size: 11 });
        s.attackTimer = s.attackCooldown;
        g.addParticles(objetivo.x + 16, objetivo.y + 16, 'hit_slash', 4);
      }
    }
  }

  /* ---------- Números de daño ---------- */
  spawnDamageNumber(x, y, texto, { color = '#fff', size = 14, crit = false } = {}) {
    this.damageNumbers.push({
      x: x + randomFloat(-8, 8), y: y - 12,
      vy: crit ? -90 : -60,
      text: String(texto), color, size,
      alpha: 1, life: crit ? 1.1 : 0.8
    });
  }

  updateNumeros(dt) {
    for (const n of this.damageNumbers) {
      n.y += n.vy * dt;
      n.vy += 60 * dt; // gravedad suave
      n.life -= dt;
      n.alpha = Math.max(0, n.life / 0.8);
    }
    this.damageNumbers = this.damageNumbers.filter(n => n.life > 0);
  }

  renderNumeros(ctx) {
    for (const n of this.damageNumbers) {
      ctx.save();
      ctx.globalAlpha = n.alpha;
      ctx.font = `${n.size}px "Press Start 2P", monospace`;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeText(n.text, n.x, n.y);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, n.x, n.y);
      ctx.restore();
    }
  }

  /* ---------- Sabor de impacto ---------- */
  triggerHitlag(frames) { this.hitlagTimer = frames / 60; }

  triggerScreenShake(intensity, duration) {
    if (intensity > this.shake.intensity) {
      this.shake.intensity = intensity;
      this.shake.duration = duration;
      this.shake.timer = duration;
    }
  }

  updateTimers(dt) {
    if (this.hitlagTimer > 0) this.hitlagTimer -= dt;
    if (this.shake.timer > 0) {
      this.shake.timer -= dt;
      const f = Math.max(0, this.shake.timer / this.shake.duration);
      this.shake.x = randomFloat(-1, 1) * this.shake.intensity * f;
      this.shake.y = randomFloat(-1, 1) * this.shake.intensity * f;
      if (this.shake.timer <= 0) { this.shake.x = 0; this.shake.y = 0; this.shake.intensity = 0; }
    }
  }
}
