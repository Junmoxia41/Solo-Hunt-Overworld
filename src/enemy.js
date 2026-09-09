/* ============================================================
   enemy.js — Enemigos con IA por máquina de estados (FSM)
   Estados: IDLE | CHASE | ATTACK | FLEE | STUNNED | DEAD
   Subclases: lobo (manada), murciélago (zigzag), no-muerto
   (tanque), duende arquero (kitea y dispara) y mago oscuro
   (bola de fuego + teletransporte).
   ============================================================ */
import { distEnt, angleVec, randomFloat, randomInt } from './utils.js';
import { crearItem, GroundItem } from './item.js';

export class Enemy {
  constructor(game, x, y, type, nivelZona = 1) {
    const d = game.data.enemies[type];
    this.game = game;
    this.type = type;
    this.nombre = d.nombre;
    this.emoji = d.emoji;
    this.color = d.color;
    this.x = x; this.y = y;
    this.width = 32; this.height = 32;
    this.level = nivelZona;

    // Escalado por zona
    const m = 1 + (nivelZona - 1) * 0.35;
    this.maxHp = Math.round(d.hp * m);
    this.hp = this.maxHp;
    this.atk = Math.round(d.atk * m);
    this.def = Math.round(d.def * m);
    this.speed = d.speed;
    this.expReward = Math.round(d.exp * m);
    this.goldReward = randomInt(d.gold[0], d.gold[1]) * nivelZona;
    this.dropTable = d.drops || [];

    this.detectionRange = d.detectionRange ?? 200;
    this.attackRange = d.attackRange ?? 40;
    this.attackCooldownBase = d.attackCooldown ?? 1.5;
    this.attackTimer = 0;
    this.windupT = d.windup ?? 0.4; // v2.3: aviso de carga antes de golpear
    this._windup = 0;
    this.inmuebleStun = !!d.inmuneStun;
    this.escapa = !!d.escapa;
    this.distanciaSegura = d.distanciaSegura ?? 0;

    this.state = 'IDLE';
    this.stateTimer = 0;
    this.direction = 'down';
    this.isDead = false;
    this.deathTimer = 0;
    this.canDropShadow = true;
    this.extraible = false; // cadáver con energía residual para Arise
    this.knockbackVx = 0; this.knockbackVy = 0;
    this.animT = randomFloat(0, 9);
    this.wanderT = 0; this.wanderX = 0; this.wanderY = 0;
    this.retroceder = 0; // murciélago: picada y retroceso
    this._pie = 37;      // ancla de profundidad: la suela del sprite (y+37)
  }

  /* ---------- Utilidades de movimiento con colisión de mapa ---------- */
  _mover(dx, dy) {
    const m = this.game.currentMap;
    if (dx && !m.rectSolido(this.x + dx + 4, this.y + 8, this.width - 8, this.height - 8)) this.x += dx;
    if (dy && !m.rectSolido(this.x + 4, this.y + dy + 8, this.width - 8, this.height - 8)) this.y += dy;
  }

  _irHacia(obj, mult = 1, dt = 0.016) {
    const v = angleVec(this, obj);
    this._mover(v.x * this.speed * mult * dt, v.y * this.speed * mult * dt);
  }

  _wander(dt) {
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = randomFloat(1, 2.5);
      const a = Math.random() * Math.PI * 2;
      this.wanderX = Math.cos(a) * 0.4;
      this.wanderY = Math.sin(a) * 0.4;
    }
    this._mover(this.wanderX * this.speed * dt, this.wanderY * this.speed * dt);
  }

  /* ---------- Bucle ---------- */
  update(dt, player) {
    this.animT += dt;
    if (this.isDead) {
      this.deathTimer += dt;
      // v2.3: élite explosivo — mecha tras morir y ¡BOOM! si estás cerca
      if (this.fusel != null) {
        this.fusel -= dt;
        if (this.fusel <= 0) {
          this.fusel = null;
          const g = this.game;
          g.addParticles(this.x + 16, this.y + 16, 'arise', 30);
          g.combat.triggerScreenShake(9, 0.4);
          g.audio.playSFX('heavy');
          if (Math.hypot(g.player.x - this.x, g.player.y - this.y) < 64) {
            g.player.takeDamage(Math.round(this.atk * 1.5), this);
          }
        }
      }
      return;
    }
    this.attackTimer = Math.max(0, this.attackTimer - dt);

    // Knockback residual
    if (this.knockbackVx || this.knockbackVy) {
      this._mover(this.knockbackVx * dt, 0);
      this._mover(0, this.knockbackVy * dt);
      this.knockbackVx *= 0.86; this.knockbackVy *= 0.86;
      if (Math.abs(this.knockbackVx) < 2) this.knockbackVx = 0;
      if (Math.abs(this.knockbackVy) < 2) this.knockbackVy = 0;
    }

    const d = distEnt(this, player);

    switch (this.state) {
      case 'IDLE':
        this._wander(dt);
        if (d < this.detectionRange && !player.isDead) this.state = 'CHASE';
        break;

      case 'STUNNED':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.state = 'CHASE';
        break;

      case 'FLEE': {
        const v = angleVec(player, this); // dirección contraria al jugador
        this._mover(v.x * this.speed * 1.1 * dt, v.y * this.speed * 1.1 * dt);
        if (d > 260) this.state = 'IDLE';
        break;
      }

      case 'CHASE':
        if (player.isDead || d > this.detectionRange * 1.7) { this.state = 'IDLE'; break; }
        if (this.escapa && d < this.distanciaSegura) { this.state = 'FLEE'; break; }
        this._persecucion(dt, player, d);
        if (d < this.attackRange * 0.95) this.state = 'ATTACK';
        break;

      case 'ATTACK':
        if (player.isDead) { this.state = 'IDLE'; this._windup = 0; break; }
        if (d > this.attackRange * 1.4) { this.state = 'CHASE'; this._windup = 0; break; }
        this._mirarHacia(player);
        // v2.3: WINDUP — el golpe se telegrafía antes de caer (esquivable)
        if (this.attackTimer <= 0) {
          if (this._windup <= 0) this._windup = this.windupT;
          else {
            this._windup -= dt;
            if (this._windup <= 0) {
              this._atacar(player, d);
              this.attackTimer = this.attackCooldownBase;
            }
          }
        }
        break;
    }

    // Fuga por miedo cuando está a punto de morir (si aplica)
    if (this.escapa && this.hp < this.maxHp * 0.2 && this.state !== 'FLEE') this.state = 'FLEE';
  }

  _mirarHacia(player) { this._dirV = angleVec(this, player); }

  /** v2.3: convierte a este enemigo en ÉLITE con un afijo (más duro, más botín) */
  hacerElite(afijo = null) {
    this.esElite = true;
    this.afijo = afijo || ['veloz', 'escudado', 'vampirico', 'explosivo'][randomInt(0, 3)];
    this.maxHp = Math.round(this.maxHp * 2.2); this.hp = this.maxHp;
    this.atk = Math.round(this.atk * 1.3);
    this.expReward = Math.round(this.expReward * 2.5);
    this.goldReward = Math.round(this.goldReward * 2.5);
    if (this.afijo === 'veloz') this.speed = Math.round(this.speed * 1.4);
    if (this.afijo === 'escudado') this.def = Math.round(this.def * 2.5 + 2);
    this.nombre = 'Élite ' + this.nombre;
    this.escalaRender = 1.25;
  }

  /** Comportamiento de persecución base (las subclases lo sobreescriben) */
  _persecucion(dt, player) { this._irHacia(player, 1, dt); }

  /** Ataque base: melé de contacto */
  _atacar(player, d) {
    if (d < this.attackRange * 1.15) {
      player.takeDamage(this.atk, this);
      if (this.afijo === 'vampirico') { // v2.3: élite vampírico roba vida
        this.hp = Math.min(this.maxHp, this.hp + Math.round(this.atk * 0.5));
        this.game.addParticles(this.x + 16, this.y + 16, 'heal', 5);
      }
      this.game.audio.playSFX('slash2');
    }
  }

  /* ---------- Daño ---------- */
  takeDamage(amount, kbx = 0, kby = 0, isCrit = false) {
    if (this.isDead) return;
    const dmg = Math.max(1, Math.round(amount - this.def * 0.5));
    this.hp -= dmg;
    this.knockbackVx = kbx * 220;
    this.knockbackVy = kby * 220;
    if (isCrit && !this.inmuebleStun) { this.state = 'STUNNED'; this.stateTimer = 0.45; this._windup = 0; }
    if (this.hp <= 0) this.die();
    else if (this.state === 'IDLE') this.state = 'CHASE'; // atacar despierta
  }

  die() {
    const g = this.game;
    this.isDead = true;
    this.deathTimer = 0;
    if (this.esElite && this.afijo === 'explosivo') this.fusel = 0.75; // mecha
    g.player.gainExp(this.expReward);
    g.player.gold += this.goldReward;
    g.player.totalKills++;
    g.killLog = g.killLog || {};
    g.killLog[this.type] = (g.killLog[this.type] || 0) + 1;
    g.dungeon?.registrarMuerte(this.expReward, this.goldReward); // estadísticas de incursión
    g.addParticles(this.x + 16, this.y + 16, 'death_enemy', 18);
    g.audio.playSFX('death');
    g.combat.triggerScreenShake(4, 0.12);

    // Drops
    for (const drop of this.dropTable) {
      const chance = drop.chance * (1 + g.player.dropBonus / 100);
      if (Math.random() < chance) {
        const item = crearItem(g, drop.itemId);
        if (item) {
          const gi = new GroundItem(g, item, this.x + randomFloat(-10, 10), this.y + randomFloat(-10, 10));
          gi.cantidad = drop.cantidad || 1;
          g.groundItems.push(gi);
        }
      }
    }

    // Energía residual para Arise (25%)
    if (this.canDropShadow && Math.random() < 0.25) {
      this.extraible = true;
      g.ui.toast('🌑 Cadáver inestable… acércate y pulsa [E] / [INT] para extraer', '#9b59b6');
    }
    g.dungeon?.lootExtra(this); // botín adicional de mazmorra
  }

  /* ---------- Render ---------- */
  render(ctx) {
    const img = this.game.assets['mob_' + this.type];
    const bob = this.isDead ? 0 : Math.sin(this.animT * 7) * 2;

    // Sombra en el suelo (bien bajo los pies del sprite)
    ctx.save();
    ctx.globalAlpha = this.isDead ? Math.max(0, 0.3 - this.deathTimer * 0.03) : 0.32;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(this.x + 16, this.y + 37, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (this.isDead) {
      // Cadáver: alpha decreciente; si es extraíble, resplandor morado
      ctx.save();
      ctx.globalAlpha = Math.max(0.25, 0.85 - this.deathTimer * 0.06);
      ctx.translate(this.x + 16, this.y + 16);
      ctx.rotate(Math.PI / 2); // tumbado
      this._dibujarCuerpo(ctx, img, bob);
      ctx.restore();

      if (this.extraible) {
        const pulso = 0.5 + Math.sin(this.animT * 6) * 0.3;
        ctx.save();
        ctx.globalAlpha = pulso;
        const grad = ctx.createRadialGradient(this.x + 16, this.y + 16, 4, this.x + 16, this.y + 16, 30);
        grad.addColorStop(0, 'rgba(155,89,182,0.8)');
        grad.addColorStop(1, 'rgba(155,89,182,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(this.x + 16, this.y + 16, 30, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#d7b6ff';
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[E] ARISE', this.x + 16, this.y - 16 + bob);
      }
      return;
    }

    // v2.3: aura de élite
    if (this.esElite) {
      const AF = { veloz: '#00e5ff', escudado: '#b0bec5', vampirico: '#e74c3c', explosivo: '#ff9800' };
      const c = AF[this.afijo] || '#ffd700';
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(this.animT * 5) * 0.12;
      const gr = ctx.createRadialGradient(this.x + 16, this.y + 16, 8, this.x + 16, this.y + 16, 34);
      gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(this.x + 16, this.y + 16, 34, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // v2.3: telegraph del golpe (anillo que se cierra)
    if (this._windup > 0) {
      const pr = 1 - this._windup / this.windupT;
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(this.animT * 30) * 0.35;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(this.x + 16, this.y + 16, 26 - 12 * pr, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // Flash de aturdimiento
    if (this.state === 'STUNNED') {
      ctx.save();
      ctx.globalAlpha = 0.6 + Math.sin(this.animT * 20) * 0.3;
    }
    this._dibujarCuerpo(ctx, img, bob);
    if (this.state === 'STUNNED') ctx.restore();

    // ¡Alerta! al detectar al jugador / estrella de élite
    if (this.state === 'CHASE' && !this.esElite) {
      ctx.fillStyle = '#e74c3c';
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', this.x + 16, this.y - 14 + bob);
    }
    if (this.esElite) {
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('★', this.x + 16, this.y - 12 + bob);
    }

    // Barra de vida si está dañado
    if (this.hp < this.maxHp) {
      ctx.fillStyle = 'rgba(10,10,20,0.8)';
      ctx.fillRect(this.x - 3, this.y - 10, 38, 5);
      ctx.fillStyle = this.hp / this.maxHp > 0.4 ? '#e67e22' : '#e74c3c';
      ctx.fillRect(this.x - 2, this.y - 9, 36 * (this.hp / this.maxHp), 3);
    }
  }

  _dibujarCuerpo(ctx, img, bob) {
    // Volteo horizontal: la bestia mira hacia su presa (el jugador)
    const p = this.game.player;
    const fs = p && (p.x + 16) < (this.x + 16) ? -1 : 1;
    if (img) {
      const S = 56 * (this.escalaRender || 1); // élites más grandes
      ctx.save();
      ctx.translate(this.x + 16, this.y + 10 + bob); // centro del sprite
      ctx.scale(fs, 1);
      ctx.drawImage(img, -S / 2, -S / 2, S, S);
      ctx.restore();
    } else {
      // Arte procedural de respaldo: silueta redonda + emoji
      ctx.save();
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x + 16, this.y + 16 + bob, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '20px serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.emoji, this.x + 16, this.y + 23 + bob);
      ctx.restore();
    }
  }
}

/* ============================================================
   Subclases con comportamiento propio
   ============================================================ */

/** 🐺 Lobo — rápido; en manada rodean al jugador */
export class WolfEnemy extends Enemy {
  constructor(g, x, y, n) { super(g, x, y, 'lobo', n); }
  _persecucion(dt, player, d) {
    const manada = this.game.enemies.some(e =>
      e !== this && !e.isDead && e.type === 'lobo' && distEnt(this, e) < 110 && e.state !== 'IDLE');
    if (manada && d > this.attackRange) {
      // Flanquear: uno va por un lado y otro por el otro
      const v = angleVec(this, player);
      const lado = (this.game.enemies.indexOf(this) % 2) ? 1 : -1;
      this._mover((v.x + -v.y * 0.7 * lado) * this.speed * dt,
                  (v.y + v.x * 0.7 * lado) * this.speed * dt);
    } else this._irHacia(player, 1, dt);
  }
}

/** 🦇 Murciélago — zigzag y picadas */
export class BatEnemy extends Enemy {
  constructor(g, x, y, n) { super(g, x, y, 'murcielago', n); }
  _persecucion(dt, player) {
    const v = angleVec(this, player);
    const zig = Math.sin(this.animT * 9) * 0.9;
    this._mover((v.x + -v.y * zig) * this.speed * dt, (v.y + v.x * zig) * this.speed * dt);
  }
  _atacar(player, d) {
    super._atacar(player, d);
    this.retroceder = 0.3; // tras picar, echa atrás
    const v = angleVec(player, this);
    this.knockbackVx = v.x * 260; this.knockbackVy = v.y * 260;
  }
}

/** 🧟 No-muerto — lento, tanque, sin miedo ni aturdimiento */
export class UndeadEnemy extends Enemy {
  constructor(g, x, y, n) { super(g, x, y, 'nomuerto', n); }
}

/** 👺 Duende arquero — dispara flechas y huye si te acercas */
export class GoblinArcherEnemy extends Enemy {
  constructor(g, x, y, n) { super(g, x, y, 'duende', n); }
  _persecucion(dt, player, d) {
    // Mantiene distancia óptima de disparo
    if (d < this.distanciaSegura) {
      const v = angleVec(player, this);
      this._mover(v.x * this.speed * dt, v.y * this.speed * dt);
    } else if (d > this.attackRange * 0.8) this._irHacia(player, 1, dt);
    // dentro del anillo: se queda quieto y dispara
  }
  _atacar(player) {
    const v = angleVec(this, player);
    this.game.addProjectile({
      x: this.x + 12, y: this.y + 12,
      vx: v.x * 260, vy: v.y * 260,
      damage: this.atk * 0.85, owner: 'enemy',
      tipo: 'flecha', color: '#d8b26a', size: 10, life: 2.2, trail: false
    });
    this.game.audio.playSFX('arrow');
  }
}

/** 🧙 Mago oscuro — bola de fuego y teletransporte evasivo */
export class DarkMageEnemy extends Enemy {
  constructor(g, x, y, n) { super(g, x, y, 'mago', n); }
  _persecucion(dt, player, d) {
    if (d < 62) { // ¡teletransporte!
      const ang = Math.random() * Math.PI * 2;
      const nx = this.x + Math.cos(ang) * 150, ny = this.y + Math.sin(ang) * 150;
      if (!this.game.currentMap.isSolid(nx, ny)) {
        this.game.addParticles(this.x + 16, this.y + 16, 'extract_smoke', 14);
        this.x = nx; this.y = ny;
        this.game.addParticles(this.x + 16, this.y + 16, 'extract_smoke', 14);
        this.game.audio.playSFX('portal');
      }
    } else if (d > this.attackRange * 0.85) this._irHacia(player, 0.8, dt);
  }
  _atacar(player) {
    const v = angleVec(this, player);
    this.game.addProjectile({
      x: this.x + 10, y: this.y + 10,
      vx: v.x * 170, vy: v.y * 170,
      damage: this.atk, owner: 'enemy',
      tipo: 'bola', color: '#9b59b6', size: 14, life: 3.5, trail: true
    });
    this.game.audio.playSFX('fireball');
  }
}
