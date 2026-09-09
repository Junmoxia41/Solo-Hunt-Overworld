/* ============================================================
   player.js — Clase Player: movimiento 8-dir, stats RPG,
   niveles, dash, combos, 4 habilidades y serialización.
   ============================================================ */
import * as C from './constants.js';
import { clamp, randomFloat, lerp } from './utils.js';

export class Player {
  constructor(game, x, y) {
    this.game = game;
    this.charId = 'kaito'; // cazador seleccionado (sprite chibi)

    // Posición y físicas
    this.x = x; this.y = y;
    this.width = 32; this.height = 32;
    this.vx = 0; this.vy = 0;
    this.direction = 'down'; // up|down|left|right
    this.isMoving = false;

    // Dash
    this.isDashing = false;
    this.dashTimer = 0; this.dashCooldown = 0;
    this.dashDirX = 0; this.dashDirY = 0;

    // Combate (cada habilidad lleva su propio enfriamiento)
    this.isAttacking = false;
    this.attackType = 'basic'; // basic | heavy | skill
    this.attackTimer = 0;
    this.attackCooldown = 0; // básico
    this.heavyCd = 0;        // pesado
    this.skillCd = 0;        // Shadow Strike
    this.comboCount = 0;
    this.comboTimer = 0;
    this.hitbox = { x: 0, y: 0, width: 0, height: 0, active: false };
    this._hitRegistered = false;

    // Stats RPG
    this.level = 1; this.exp = 0;
    this.expToNext = C.expToNext(1);
    this.statPoints = 0;
    this.stats = { str: 5, agi: 3, vit: 4, int: 2, per: 1 };

    // Estado
    this.isInvincible = false;
    this.iframeTimer = 0;
    this.isDead = false;
    this.gold = 0;
    this.totalKills = 0;
    this.facingSign = 1; // flip visual del sprite
    this._pie = 40;      // ancla de profundidad: la suela del sprite (y+40)

    // Animación (bobbing, el sprite es una imagen completa)
    this.animTimer = randomFloat(0, 5);

    this.recalculateStats();
    this.hp = this.maxHp;
    this.mp = this.maxMp;
  }

  /* ---------- Stats derivados ---------- */
  recalculateStats() {
    const inv = this.game.inventory;
    const bAtk = inv?.equipped?.weapon?.stats?.atk || 0;
    const bCrit = inv?.equipped?.weapon?.stats?.crit || 0;
    const bDef = (inv?.equipped?.armor?.stats?.def || 0);
    const bHp = (inv?.equipped?.armor?.stats?.hp || 0);
    const s = this.stats;
    this.atk = s.str * 2 + bAtk;
    this.def = Math.round(s.vit * 1.25 + bDef);
    this.matk = s.int * 3;
    this.mdef = s.int * 1.5;
    this.maxHp = 100 + s.vit * 10 + bHp;
    this.maxMp = 50 + s.int * 5;
    this.critChance = 5 + s.per * 1 + s.agi * 0.5 + bCrit; // %
    this.evasion = 2 + s.per * 2;                          // %
    this.dropBonus = s.per * 1;                            // %
    this.hpRegen = 0.5 + s.vit * 0.5;                      // por segundo
    this.mpRegen = 0.3 + s.int * 0.2;
    this.speed = C.PLAYER_SPEED * (1 + s.agi * 0.01);
    this.hp = Math.min(this.hp ?? this.maxHp, this.maxHp);
    this.mp = Math.min(this.mp ?? this.maxMp, this.maxMp);
  }

  /* ---------- Bucle ---------- */
  update(dt) {
    if (this.isDead) return;
    const g = this.game;

    // Regeneración
    this.hp = Math.min(this.maxHp, this.hp + this.hpRegen * dt);
    this.mp = Math.min(this.maxMp, this.mp + this.mpRegen * dt);

    // Timers
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.heavyCd = Math.max(0, this.heavyCd - dt);
    this.skillCd = Math.max(0, this.skillCd - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (this.isInvincible) {
      this.iframeTimer -= dt;
      if (this.iframeTimer <= 0) this.isInvincible = false;
    }
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.comboCount = 0; }

    this._movimiento(dt);
    this._combate(dt);

    // Fin de ataque
    if (this.isAttacking) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) { this.isAttacking = false; this.hitbox.active = false; }
    }

    this.animTimer += dt;
  }

  _movimiento(dt) {
    const input = this.game.input.getMovement();

    if (this.isDashing) {
      this.dashTimer -= dt;
      this.vx = this.dashDirX * C.DASH_SPEED;
      this.vy = this.dashDirY * C.DASH_SPEED;
      this.isInvincible = true; // i-frames durante el dash
      if (this.dashTimer <= 0) { this.isDashing = false; this.iframeTimer = 0.15; }
    } else {
      // aceleración suave: menos "interruptor", mejor sensación de control
      const tx = input.x * this.speed, ty = input.y * this.speed;
      this.vx = lerp(this.vx, tx, 1 - Math.pow(0.0001, dt));
      this.vy = lerp(this.vy, ty, 1 - Math.pow(0.0001, dt));
      if (Math.abs(this.vx) < 2 && tx === 0) this.vx = 0;
      if (Math.abs(this.vy) < 2 && ty === 0) this.vy = 0;
    }

    // Mirada: la dirección 4-vías para el flip y empujes
    if (input.x !== 0 || input.y !== 0) {
      if (Math.abs(input.x) > Math.abs(input.y)) this.direction = input.x > 0 ? 'right' : 'left';
      else this.direction = input.y > 0 ? 'down' : 'up';
      if (input.x !== 0) this.facingSign = input.x > 0 ? 1 : -1;
    }
    this.isMoving = (Math.abs(this.vx) + Math.abs(this.vy)) > 12;

    // Colisión con tiles sólidos (eje a eje para arrastrarse por paredes)
    const mapa = this.game.currentMap;
    const nx = this.x + this.vx * dt;
    if (!mapa.rectSolido(nx + 4, this.y + 10, this.width - 8, this.height - 10)) this.x = nx;
    const ny = this.y + this.vy * dt;
    if (!mapa.rectSolido(this.x + 4, ny + 10, this.width - 8, this.height - 10)) this.y = ny;

    // Límites del mapa
    this.x = clamp(this.x, 8, mapa.pixelW - this.width - 8);
    this.y = clamp(this.y, 8, mapa.pixelH - this.height - 8);
  }

  /* ---------- Puntería: ¿a dónde apunta el jugador? ---------- */
  /** En PC atacamos HACIA EL CURSOR; en táctil, hacia el frente (facing). */
  _aimAngulo() {
    const g = this.game;
    if (g.input.tieneCursor()) {
      const m = g.input.aimMundo(g.camera);
      return Math.atan2(m.y - (this.y + 16), m.x - (this.x + 16));
    }
    return { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[this.direction] ?? 0;
  }

  /* ---------- Combate ---------- */
  _combate(dt) {
    const g = this.game, inp = g.input;

    // — Ataque básico (Z o CLIC; en PC va hacia el cursor) —
    if (inp.isAttack() && this.attackCooldown <= 0 && !this.isAttacking) {
      this.isAttacking = true;
      this.attackType = 'basic';
      this.attackTimer = 0.22;
      this.attackCooldown = C.ATTACK_COOLDOWN;
      this.comboCount = (this.comboTimer > 0) ? this.comboCount + 1 : 1;
      this.comboTimer = 0.6;
      this._activarHitboxAim(40, 38, 1.0);
      g.audio.playSFX('slash' + (1 + this.comboCount % 3));
    }

    // — Ataque pesado (X) —
    if (inp.isHeavyAttack() && this.heavyCd <= 0 && this.mp >= C.HEAVY_COST && !this.isAttacking) {
      this.isAttacking = true;
      this.attackType = 'heavy';
      this.attackTimer = 0.5;
      this.heavyCd = C.HEAVY_ATTACK_COOLDOWN;
      this.attackCooldown = Math.max(this.attackCooldown, 0.15);
      this.mp -= C.HEAVY_COST;
      this._activarHitboxAim(52, 50, 1.15);
      g.audio.playSFX('heavy');
    }

    // — Habilidad: Shadow Strike (C) — explosión circular de sombra —
    if (inp.isSkill() && this.skillCd <= 0 && this.mp >= C.SKILL_COST) {
      this.attackType = 'skill';
      this.attackTimer = 0.4;
      this.skillCd = C.SKILL_COOLDOWN;
      this.attackCooldown = Math.max(this.attackCooldown, 0.2);
      this.isAttacking = true;
      this.mp -= C.SKILL_COST;
      this._activarHitboxSkill();
      g.audio.playSFX('skill');
      g.addParticles(this.x + 16, this.y + 16, 'arise', 35);
      g.combat.triggerScreenShake(7, 0.3);
    }

    // — Dash (Shift) — en PC también sigue al cursor —
    if (inp.isDash() && this.dashCooldown <= 0 && this.mp >= C.DASH_COST && !this.isDashing) {
      let dx, dy;
      if (g.input.tieneCursor()) {
        const m = g.input.aimMundo(g.camera);
        dx = m.x - (this.x + 16); dy = m.y - (this.y + 16);
        this.facingSign = dx >= 0 ? 1 : -1;
        if (Math.abs(dx) >= Math.abs(dy)) this.direction = dx >= 0 ? 'right' : 'left';
      } else {
        const m = inp.getMovement();
        dx = m.x; dy = m.y;
        if (dx === 0 && dy === 0) { dx = this.facingSign; dy = 0; }
      }
      const len = Math.hypot(dx, dy) || 1;
      this.isDashing = true;
      this.dashTimer = C.DASH_DURATION;
      this.dashCooldown = C.DASH_COOLDOWN;
      this.mp -= C.DASH_COST;
      this.dashDirX = dx / len; this.dashDirY = dy / len;
      g.audio.playSFX('dash');
    }

    // — Extraer sombra (E) cerca de un cadáver extraíble —
    if (inp.isInteract()) this._intentarAriseONpc();
  }

  /** Hitbox circular orientada hacia el cursor (o el frente en táctil) */
  _activarHitboxAim(dist, radio, anchoArco) {
    const ang = this._aimAngulo();
    const cx = this.x + 16 + Math.cos(ang) * dist;
    const cy = this.y + 16 + Math.sin(ang) * dist;
    this.hitbox = { x: cx - radio, y: cy - radio, width: radio * 2, height: radio * 2, active: true, circular: true };
    this._hitRegistered = false;
    // el cuerpo gira hacia el golpe (de lado si el golpe es horizontal)
    this.facingSign = Math.cos(ang) >= 0 ? 1 : -1;
    if (Math.abs(Math.cos(ang)) > Math.abs(Math.sin(ang))) this.direction = this.facingSign > 0 ? 'right' : 'left';
    else this.direction = Math.sin(ang) > 0 ? 'down' : 'up';
    this._aimAng = ang; // lo usa el render del arco
  }

  _activarHitboxSkill() {
    const r = C.SKILL_RADIUS;
    this.hitbox = { x: this.x + 16 - r, y: this.y + 16 - r, width: r * 2, height: r * 2, active: true, circular: true };
    this._hitRegistered = false;
  }

  _intentarAriseONpc() {
    const g = this.game;
    // 1) NPC cercano → diálogo
    for (const n of g.npcs) {
      if (Math.hypot(n.x - this.x, n.y - this.y) < n.interactRange) { n.interact(); return; }
    }
    // 2) Item en el suelo → recoger
    for (const it of g.groundItems) {
      if (!it.recogido && Math.hypot(it.x - this.x, it.y - this.y) < 40) { it.recoger(); return; }
    }
    // 3) Portal cercano → salida de mazmorra o prompt de entrada
    for (const p of g.currentMap.portalesPos) {
      if (Math.hypot(p.x - this.x, p.y - this.y) < 46) {
        if (p.salida) { g.dungeon?.avanzar(); return; } // portal de salida del piso
        g.ui.portalPrompt(p); // portal del overworld → pantalla de entrada
        g.audio.playSFX('portal');
        return;
      }
    }
    // 4) Cadáver extraíble → minijuego Arise
    for (const e of g.enemies) {
      if (e.isDead && e.extraible && Math.hypot(e.x - this.x, e.y - this.y) < 60) {
        g.ui.iniciarExtraccion(e);
        return;
      }
    }
  }

  /* ---------- Daño recibido ---------- */
  takeDamage(amount, fuente) {
    if (this.isInvincible || this.isDead) return;
    const g = this.game;
    if (Math.random() < this.evasion / 100) {
      g.combat.spawnDamageNumber(this.x + 16, this.y, 'MISS', { color: '#95a5a6', size: 10 });
      return;
    }
    const dmg = Math.max(1, Math.round(amount - this.def * 0.6));
    this.hp -= dmg;
    this.isInvincible = true;
    this.iframeTimer = C.IFRAMES_DURATION;
    g.combat.spawnDamageNumber(this.x + 16, this.y, dmg, { color: '#e74c3c', size: 13 });
    g.combat.triggerScreenShake(5, 0.18);
    g.audio.playSFX('hit');
    if (this.hp <= 0) this.die();
  }

  die() {
    this.isDead = true;
    this.hp = 0;
    const g = this.game;
    g.totalDeaths++;
    g.addParticles(this.x + 16, this.y + 16, 'death_player', 30);
    g.audio.playSFX('death');
    g.audio.playBGM('gameover');
    this.oroPerdido = Math.floor(this.gold * C.DEATH_GOLD_PENALTY);
    this.gold -= this.oroPerdido;
    g.changeState('GAME_OVER');
  }

  revivir() {
    this.hp = Math.floor(this.maxHp * 0.5);
    this.mp = Math.floor(this.maxMp * 0.5);
    this.isDead = false;
    this.isInvincible = true;
    this.iframeTimer = 2;
  }

  /* ---------- Progresión ---------- */
  gainExp(amount) {
    this.exp += Math.round(amount);
    while (this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.level++;
      this.expToNext = C.expToNext(this.level);
      this.statPoints += C.STAT_POINTS_PER_LEVEL;
      this.recalculateStats();
      this.hp = this.maxHp; this.mp = this.maxMp;
      this.game.addParticles(this.x + 16, this.y + 16, 'level_up', 40);
      this.game.audio.playSFX('levelUp');
      this.game.ui.toast(`🎉 ¡NIVEL ${this.level}! (+${C.STAT_POINTS_PER_LEVEL} puntos de stat)`, '#ffd700');
      if (this.game.state === 'PLAYING') this.game.changeState('LEVEL_UP');
    }
  }

  addStat(nombre) {
    if (this.statPoints <= 0 || !(nombre in this.stats)) return false;
    this.stats[nombre]++;
    this.statPoints--;
    this.recalculateStats();
    return true;
  }

  getAttackDamage() {
    let base;
    if (this.attackType === 'heavy') base = this.atk * 3.0;
    else if (this.attackType === 'skill') base = this.matk * 2.5;
    else base = this.atk * 1.5;
    // tercer golpe del combo pega más
    if (this.attackType === 'basic' && this.comboCount >= 3) base *= 1.4;
    const isCrit = Math.random() < this.critChance / 100;
    const dmg = Math.round(base * (0.9 + Math.random() * 0.2) * (isCrit ? 2 : 1));
    return { damage: dmg, isCrit };
  }

  /* ---------- Render ---------- */
  render(ctx) {
    // Parpadeo de i-frames
    if (this.isInvincible && !this.isDashing && Math.floor(this.iframeTimer * 12) % 2 === 0) return;

    const bob = Math.sin(this.animTimer * (this.isMoving ? 11 : 3)) * (this.isMoving ? 2.5 : 1.2);
    // Sprite de PERFIL al caminar en horizontal; frontal en vertical.
    // Si no hay perfil generado, cae al frontal (que también se voltea).
    const deLado = this.direction === 'left' || this.direction === 'right';
    this._usandoLado = deLado; // (depuración/tests)
    const img = (deLado ? this.game.assets['lado_' + this.charId] : null) ||
                this.game.assets['char_' + this.charId];
    const size = 58;

    // Sombra en los pies (a la altura real de la suela del sprite)
    ctx.save();
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(this.x + 16, this.y + 40, 14, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(this.x + 16, this.y + 18 + bob);
    ctx.scale(this.facingSign, 1);
    if (img) ctx.drawImage(img, -size / 2, -size / 2 - 8, size, size);
    else { // fallback si el sprite no cargó
      ctx.fillStyle = '#8b5cf6';
      ctx.beginPath(); ctx.arc(0, -4, 16, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // Retículo de puntería en PC (punto sutil bajo el cursor)
    if (this.game.input.tieneCursor() && !this.isAttacking) {
      const m = this.game.input.aimMundo(this.game.camera);
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#9b59b6';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(m.x, m.y, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(m.x, m.y, 1.6, 0, Math.PI * 2); ctx.fillStyle = '#9b59b6'; ctx.fill();
      ctx.restore();
    }

    // Efecto visual del ataque (arco de corte hacia donde apunta el cursor)
    if (this.isAttacking && this.attackType !== 'skill') {
      const t = 1 - this.attackTimer / (this.attackType === 'heavy' ? 0.5 : 0.22);
      ctx.save();
      ctx.translate(this.x + 16, this.y + 14);
      ctx.rotate(this._aimAng ?? 0); // el acero sigue al cursor
      ctx.globalAlpha = 0.9 - t * 0.8;
      // triple filo: brillo principal + estela
      ctx.strokeStyle = this.attackType === 'heavy' ? '#ffd700' : '#9b59b6';
      ctx.lineWidth = this.attackType === 'heavy' ? 7 : 4.5;
      ctx.beginPath();
      const reach = this.attackType === 'heavy' ? 52 : 40;
      ctx.arc(0, 0, reach, -1.15 + t * 1.5, -0.15 + t * 1.5);
      ctx.stroke();
      ctx.globalAlpha = (0.9 - t * 0.8) * 0.5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, reach + 6, -1.0 + t * 1.5, -0.3 + t * 1.5);
      ctx.stroke();
      ctx.restore();
    }
    // Onda de la habilidad Shadow Strike
    if (this.isAttacking && this.attackType === 'skill') {
      const t = 1 - this.attackTimer / 0.4;
      ctx.save();
      ctx.globalAlpha = 0.7 - t * 0.7;
      ctx.strokeStyle = '#9b59b6';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(this.x + 16, this.y + 16, C.SKILL_RADIUS * t, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------- Guardado ---------- */
  serialize() {
    return {
      charId: this.charId, x: Math.round(this.x), y: Math.round(this.y),
      level: this.level, exp: this.exp, statPoints: this.statPoints,
      stats: { ...this.stats }, hp: Math.round(this.hp), mp: Math.round(this.mp),
      gold: this.gold, totalKills: this.totalKills,
      inventory: this.game.inventory?.serialize() ?? null
    };
  }

  deserialize(d) {
    if (!d) return;
    Object.assign(this, {
      charId: d.charId || 'kaito', x: d.x, y: d.y, level: d.level, exp: d.exp,
      statPoints: d.statPoints, gold: d.gold ?? 0, totalKills: d.totalKills ?? 0
    });
    this.stats = { str: 5, agi: 3, vit: 4, int: 2, per: 1, ...d.stats };
    this.expToNext = C.expToNext(this.level);
    this.recalculateStats();
    this.hp = clamp(d.hp ?? this.maxHp, 1, this.maxHp);
    this.mp = clamp(d.mp ?? this.maxMp, 0, this.maxMp);
    if (d.inventory && this.game.inventory) this.game.inventory.deserialize(d.inventory);
  }
}
