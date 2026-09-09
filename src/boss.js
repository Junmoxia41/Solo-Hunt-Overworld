/* ============================================================
   boss.js — Jefes de mazmorra con 3 fases (100/60/30%)
   Cada fase cambia de patrón: básico → invocación de esbirros
   → anillos de proyectiles + teletransporte (enrage final).
   Muerte: ARISE garantizado, botín raro y fin de mazmorra.
   ============================================================ */
import { Enemy } from './enemy.js';
import { distEnt, angleVec, randomFloat } from './utils.js';

export class Boss extends Enemy {
  /** @param config {nombre, tipo, zona, hpMult, atkMult, color, css} */
  constructor(game, x, y, config) {
    super(game, x, y, config.tipo, config.zona);
    // Escalado de jefe sobre la base del tipo
    this.maxHp = Math.round(this.maxHp * config.hpMult);
    this.hp = this.maxHp;
    this.atk = Math.round(this.atk * config.atkMult);
    // FIX v2.2: antes decía "expaReward" (typo) y el oro no se sobreescribía:
    // los jefes entregaban la EXP/oro de un enemigo normal, no la prometida.
    this.expReward = config.recompensaExp;
    this.goldReward = config.recompensaOro;
    this.goldReward = config.recompensaOro;
    this.detectionRange = 9999; // siempre atento
    this.attackRange = 64;
    this.attackCooldownBase = 1.4;

    this.nombre = config.nombre;
    this.cssBoss = config.css || '#ffd700';
    this.esBoss = true;
    this.scale = 1.9; // dibujado grande
    this.canDropShadow = true;
    this.extraibleGarantizado = true;

    // Fases y sus patrones
    this.phase = 1;
    this.phaseThresholds = [1.0, 0.6, 0.3];
    this._patronT = 0;      // temporizador de patrón activo
    this._anilloT = 0;      // anillos de proyectiles (fase 3)
    this._anuncioT = 0;
    this.inmuebleStun = true; // los jefes no se aturden

    // Anuncio de entrada
    game.ui.toast(`⚠️ JEFE — ${this.nombre}`, this.cssBoss, 3600);
    game.audio.playSFX('arise');
    game.combat.triggerScreenShake(9, 0.5);
    game.audio.playBGM('boss');
  }

  /* ---------- Bucle con lógica de fases ---------- */
  update(dt, player) {
    this.animT += dt;
    if (this.isDead) { this.deathTimer += dt; return; }
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this._anilloT = Math.max(0, this._anilloT - dt);

    // Caída de knockback residual (los jefes apenas sufren empuje)
    if (this.knockbackVx || this.knockbackVy) { this.knockbackVx = 0; this.knockbackVy = 0; }

    // --- Transición de fase ---
    const pct = this.hp / this.maxHp;
    const nueva = pct <= this.phaseThresholds[2] ? 3 : pct <= this.phaseThresholds[1] ? 2 : 1;
    if (nueva !== this.phase) {
      this.phase = nueva;
      const msg = nueva === 2
        ? `🔥 ${this.nombre} — FASE 2: invoca a sus esbirros`
        : `💜 ${this.nombre} — FASE 3: ¡ENAJENACIÓN OSCURA!`;
      this.game.ui.toast(msg, this.cssBoss, 3200);
      this.game.audio.playSFX('skill');
      this.game.combat.triggerScreenShake(8, 0.4);
      this.game.addParticles(this.x + 16, this.y + 16, 'arise', 40);
    }

    const d = distEnt(this, player);
    const velMult = this.phase === 3 ? 1.35 : this.phase === 2 ? 1.15 : 1;

    if (player.isDead) return;

    // --- Movimiento y ataque cuerpo a cuerpo (con windup esquivable) ---
    if (d > this.attackRange) { this._irHacia(player, velMult, dt); this._windupM = 0; }
    else if (this.attackTimer <= 0) {
      if (!this._windupM) this._windupM = 0.45; // v2.3: carga telegrafiada
      else {
        this._windupM -= dt;
        if (this._windupM <= 0) {
          this._windupM = 0;
          if (d < this.attackRange * 1.3) { // te dio tiempo a esquivar
            player.takeDamage(this.atk, this);
            this.game.addParticles(player.x + 16, player.y + 16, 'hit_slash', 10);
            this.game.combat.triggerScreenShake(4, 0.15);
          }
          this.attackTimer = this.attackCooldownBase;
        }
      }
    }

    // --- Patrón fase 2: invocar esbirros (máx 6 vivos) ---
    if (this.phase >= 2) {
      this._patronT -= dt;
      if (this._patronT <= 0) {
        this._patronT = 7;
        const vivos = this.game.enemies.filter(e => !e.isDead && !e.esBoss).length;
        for (let i = 0; i < Math.min(2, 6 - vivos); i++) {
          const ang = Math.random() * Math.PI * 2;
          const rx = this.x + Math.cos(ang) * 90, ry = this.y + Math.sin(ang) * 90;
          if (!this.game.currentMap.isSolid(rx + 16, ry + 16)) {
            this.game.dungeon?.spawnEsbirros(rx, ry);
            this.game.addParticles(rx + 16, ry + 16, 'extract_smoke', 12);
          }
        }
        this.game.audio.playSFX('portal');
      }
    }

    // --- Patrón fase 3: anillos de proyectiles + blink ---
    if (this.phase >= 3) {
      if (this._anilloT <= 0) {
        if (!this._cargaAnillo) this._cargaAnillo = 0.5; // v2.3: media carga visible
        else {
          this._cargaAnillo -= dt;
          if (this._cargaAnillo <= 0) {
            this._cargaAnillo = 0;
            this._anilloT = 3.4;
            this._anillo(projectileCountFromPhase(this.phase), player);
          }
        }
      }
      if (d > 220 && Math.random() < 0.005) {
        // Parpadeo hacia el jugador si se aleja
        this.game.addParticles(this.x + 16, this.y + 16, 'extract_smoke', 14);
        const v = angleVec(this, player);
        this.x += v.x * 120; this.y += v.y * 120;
        if (this.game.currentMap.isSolid(this.x + 16, this.y + 16)) { this.x -= v.x * 120; this.y -= v.y * 120; }
        this.game.addParticles(this.x + 16, this.y + 16, 'extract_smoke', 14);
      }
    }
  }

  /** Anillo radial de proyectiles de oscuridad */
  _anillo(n, player) {
    const g = this.game;
    const baseAng = Math.atan2(player.y - this.y, player.x - this.x);
    for (let i = 0; i < n; i++) {
      const a = baseAng + (i / n) * Math.PI * 2;
      g.addProjectile({
        x: this.x + 10, y: this.y + 10,
        vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
        damage: this.atk * 0.6, owner: 'enemy',
        tipo: 'bola', color: this.cssBoss, size: 12, life: 2.6, trail: true
      });
    }
    g.audio.playSFX('fireball');
    g.combat.triggerScreenShake(5, 0.2);
  }

  /* ---------- Daño: blindado pero no invencible ---------- */
  takeDamage(amount, kbx = 0, kby = 0, isCrit = false) {
    if (this.isDead) return;
    const dmg = Math.max(1, Math.round((amount - this.def * 0.5) * 0.9)); // 10% de armadura innata
    this.hp -= dmg;
    if (this.hp <= 0) this.die();
  }

  die() {
    const g = this.game;
    // Heredar efectos base y luego potenciar: ARISE garantizado
    this.extraibleSeguro = true;
    super.die();
    this.extraible = true; // su cadáver SIEMPRE es extraíble
    this.deathTimer = 0;
    // Botín del jefe: lluvia de oro + objeto raro vía controlador de mazmorra
    g.dungeon?.lootBoss(this);
    g.addParticles(this.x + 16, this.y + 16, 'arise', 60);
    g.combat.triggerScreenShake(12, 0.7);
    g.ui.toast(`👑 ${this.nombre} ha caído — su alma resplandece. ¡ARISE disponible!`, '#ffd700', 4200);
  }

  /* ---------- Render: sprite grande teñido + corona ---------- */
  render(ctx) {
    const g = this.game;
    const img = g.assets['mob_' + this.type];
    const bob = this.isDead ? 0 : Math.sin(this.animT * 5) * 2.5;
    const S = 56 * this.scale;

    // Aura de jefe
    ctx.save();
    const aura = ctx.createRadialGradient(this.x + 16, this.y + 16, 10, this.x + 16, this.y + 16, 70);
    aura.addColorStop(0, this.cssBoss + '55');
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(this.x + 16, this.y + 16, 70, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Cuerpo (hereda render base: cadáver con brillo ARISE incluido)
    if (this.isDead) { super.render(ctx); return; }

    ctx.save();
    ctx.translate(this.x + 16, this.y + 16 + bob);
    if (img) {
      ctx.filter = `brightness(1.5) saturate(1.3) drop-shadow(0 0 12px ${this.cssBoss})`;
      ctx.drawImage(img, -S / 2, -S / 2, S, S);
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // v2.3: telegraphs del jefe
    if (this._windupM > 0) {
      const pr = 1 - this._windupM / 0.45;
      ctx.save();
      ctx.globalAlpha = 0.6 + Math.sin(this.animT * 28) * 0.3;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(this.x + 16, this.y + 16, 44 - 20 * pr, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (this._cargaAnillo > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(this.animT * 34) * 0.25;
      const gr2 = ctx.createRadialGradient(this.x + 16, this.y + 16, 20, this.x + 16, this.y + 16, 90);
      gr2.addColorStop(0, this.cssBoss); gr2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr2;
      ctx.beginPath(); ctx.arc(this.x + 16, this.y + 16, 90, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // Corona de poder
    ctx.font = '20px serif';
    ctx.textAlign = 'center';
    ctx.fillText('👑', this.x + 16, this.y - 18 + bob);

    // Púas de fase actuales bajo el nombre
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = this.cssBoss;
    ctx.fillText('●'.repeat(this.phase) + '○'.repeat(3 - this.phase), this.x + 16, this.y + S / 2 + 14);
  }
}

/** Número de proyectiles del anillo según fase */
function projectileCountFromPhase(f) { return 8 + (f - 3) * 3; }
