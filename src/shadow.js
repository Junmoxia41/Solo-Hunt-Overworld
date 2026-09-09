/* ============================================================
   shadow.js — Sombras extraídas con ¡ARISE!
   Ejército personal: siguen al jugador y luchan a su lado.
   ============================================================ */
import { distEnt, angleVec } from './utils.js';
import { SHADOW_DAMAGE_RATIO, SHADOW_RESPAWN, SHADOW_MAX } from './constants.js';

export class Shadow {
  constructor(game, enemy, player) {
    this.game = game;
    this.player = player;
    this.tipo = enemy.type;
    this.nombre = 'Sombra de ' + enemy.nombre;
    this.x = enemy.x; this.y = enemy.y;
    this.width = 32; this.height = 32;
    this.maxHp = Math.max(30, Math.round(enemy.maxHp * 0.5));
    this.hp = this.maxHp;
    this.speed = Math.min(230, enemy.speed * 1.15);
    this.range = 46;
    this.attackCooldown = 1.0;
    this.attackTimer = 0;
    this.followDistance = 54;
    this.role = 'attack'; // 'attack' | 'defend'
    this.esDistancia = ['duende', 'mago'].includes(this.tipo); // v2.3: dispara de lejos
    this._disparoT = 0;
    this.isAlive = true;
    this.respawnTimer = 0;
    this.target = null;
    this.t = Math.random() * 9;
    this._humoT = 0;
    this._pie = 37; // ancla de profundidad: la suela del sprite
  }

  get atk() { return this.player.atk * SHADOW_DAMAGE_RATIO; }

  update(dt, player, enemies) {
    this.t += dt;
    this.attackTimer = Math.max(0, this.attackTimer - dt);

    if (!this.isAlive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.isAlive = true;
        this.hp = this.maxHp;
        this.x = player.x; this.y = player.y + 10;
        this.game.addParticles(this.x + 16, this.y + 16, 'extract_smoke', 18);
        this.game.audio.playSFX('ariseOk');
      }
      return;
    }

    // Humo oscuro constante
    this._humoT -= dt;
    if (this._humoT <= 0) {
      this._humoT = 0.12;
      this.game.particles.push(this._humo());
    }

    // Seleccionar objetivo según rol
    if (this.role === 'defend') {
      this.target = this._buscar(enemies, 110, player); // defiende un anillo alrededor del jugador
    } else {
      this.target = this._buscar(enemies, 210, this);
    }

    if (this.target && !this.target.isDead) {
      const d = distEnt(this, this.target);
      // v2.3: las sombras de arquero/mago disparan desde lejos
      if (this.esDistancia) {
        this._disparoT = Math.max(0, this._disparoT - dt);
        if (d < 175 && this._disparoT === 0) {
          this._disparoT = 1.8;
          const v = angleVec(this, this.target);
          this.game.addProjectile({
            x: this.x + 12, y: this.y + 10,
            vx: v.x * 240, vy: v.y * 240,
            damage: Math.max(1, Math.round(this.atk * 1.2)), owner: 'shadow',
            tipo: this.tipo === 'mago' ? 'bola' : 'flecha',
            color: '#00e5ff', size: 8, life: 1.6, trail: true
          });
        }
        if (d < 110) { /* mantiene la distancia */ }
        else this._irHacia(this.target, dt);
      } else if (d > this.range) this._irHacia(this.target, dt);
      // el golpe melé lo resuelve combat.js cuando target esté a rango
    } else {
      // Formación detrás del jugador
      const idx = this.game.shadows.indexOf(this);
      const ang = (idx / Math.max(1, this.game.shadows.length)) * Math.PI * 2 + Math.PI;
      const gx = player.x + Math.cos(ang) * this.followDistance;
      const gy = player.y + Math.cos(ang) * this.followDistance * 0.4 + 14;
      const d = Math.hypot(gx - this.x, gy - this.y);
      if (d > 12) {
        const v = angleVec(this, { x: gx, y: gy, width: 1, height: 1 });
        this._mover(v.x * this.speed * dt, v.y * this.speed * dt);
      }
    }
    // Nunca perderlo de vista
    if (distEnt(this, player) > 420) { this.x = player.x + 20; this.y = player.y + 20; }
  }

  _buscar(enemies, rango, desde) {
    let mejor = null, md = rango;
    for (const e of enemies) {
      if (e.isDead) continue;
      const d = distEnt(desde, e);
      if (d < md) { md = d; mejor = e; }
    }
    return mejor;
  }

  _irHacia(obj, dt) {
    const v = angleVec(this, obj);
    this._mover(v.x * this.speed * dt, v.y * this.speed * dt);
  }

  _mover(dx, dy) {
    const m = this.game.currentMap;
    if (!m.rectSolido(this.x + dx + 4, this.y + 8, 24, 24)) this.x += dx;
    if (!m.rectSolido(this.x + 4, this.y + dy + 8, 24, 24)) this.y += dy;
  }

  _humo() {
    return {
      x: this.x + 8 + Math.random() * 16, y: this.y + 20 + Math.random() * 10,
      vx: (Math.random() - 0.5) * 14, vy: -22 - Math.random() * 20,
      size: 3 + Math.random() * 4, color: Math.random() < 0.5 ? '#4a1a7a' : '#1a0030',
      maxLife: 0.7, life: 0.7, alpha: 1, gravity: 0, friction: 0.98, shrink: true, type: 'smoke',
      update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt; this.alpha = this.life / this.maxLife; this.size *= 0.99; },
      render(ctx) { ctx.save(); ctx.globalAlpha = this.alpha * 0.7; ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, 7); ctx.fill(); ctx.restore(); },
      isDead() { return this.life <= 0; }
    };
  }

  takeDamage(amount) {
    if (!this.isAlive) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.isAlive = false;
      this.respawnTimer = SHADOW_RESPAWN;
      this.game.addParticles(this.x + 16, this.y + 16, 'death_enemy', 14);
      this.game.ui.toast(`☁️ ${this.nombre} se disipó… regresa en ${SHADOW_RESPAWN}s`, '#7f8c8d');
    }
  }

  render(ctx) {
    if (!this.isAlive) return;
    const img = this.game.assets['mob_' + this.tipo];
    const bob = Math.sin(this.t * 6) * 2.5;

    // sombra en suelo (al nivel de los pies)
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#220044';
    ctx.beginPath(); ctx.ellipse(this.x + 16, this.y + 37, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // cuerpo: sprite del tipo original oscurecido con tinte umbrío
    // (volteado hacia su objetivo si lo tiene)
    ctx.save();
    ctx.filter = 'brightness(0.38) hue-rotate(200deg) saturate(1.6)';
    const S = 54;
    if (img) {
      const fs = this.target && this.target.x + 16 < this.x + 16 ? -1 : 1;
      ctx.translate(this.x + 16, this.y + 11 + bob);
      ctx.scale(fs, 1);
      ctx.drawImage(img, -S / 2, -S / 2, S, S);
    } else {
      ctx.fillStyle = '#2b1055';
      ctx.beginPath(); ctx.arc(this.x + 16, this.y + 16 + bob, 15, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // ojos brillantes cyan — el sello del ejército de sombras
    ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(this.x + 11, this.y + 10 + bob, 1.8, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(this.x + 21, this.y + 10 + bob, 1.8, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;

    // barra de vida
    if (this.hp < this.maxHp) {
      ctx.fillStyle = 'rgba(10,10,20,0.8)';
      ctx.fillRect(this.x - 2, this.y - 8, 34, 4);
      ctx.fillStyle = '#9b59b6';
      ctx.fillRect(this.x - 1, this.y - 7, 32 * (this.hp / this.maxHp), 2);
    }
  }
}

/** ¿Se puede invocar otra sombra? */
export function puedeExtraer(game) {
  return game.shadows.length < SHADOW_MAX;
}
