/* ============================================================
   input.js — Entrada unificada: teclado (PC) + táctil (móvil)
   ============================================================ */

export class InputManager {
  constructor(game) {
    this.game = game;
    this.keys = {};
    this.justPressed = {};
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Joystick virtual
    this.joy = { active: false, id: null, startX: 0, startY: 0, dx: 0, dy: 0, baseX: 0, baseY: 0 };
  }

  init() {
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      this.justPressed[e.code] = true;
      this.audioKickstart();
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('pointerdown', () => this.audioKickstart(), { once: true });

    if (this.isMobile) this._setupTouch();
    // Ratón: click izquierdo = atacar (jugando en PC también vale el ratón)
    this.game.canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && this.game.state === 'PLAYING') this.justPressed['KeyZ'] = true;
    });
  }

  /* El navegador exige un gesto del usuario para habilitar WebAudio */
  audioKickstart() { this.game.audio?.desbloquear(); }

  _setupTouch() {
    const cv = this.game.canvas;
    cv.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        // joystick flotante: aparece donde apoyas el dedo (mitad izquierda)
        if (t.clientX < window.innerWidth * 0.5 && !this.joy.active) {
          this.joy.active = true; this.joy.id = t.identifier;
          this.joy.startX = this.joy.baseX = t.clientX;
          this.joy.startY = this.joy.baseY = t.clientY;
          this.joy.dx = this.joy.dy = 0;
        }
      }
      e.preventDefault();
    }, { passive: false });

    cv.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (this.joy.active && t.identifier === this.joy.id) {
          const MAX = 60;
          let dx = t.clientX - this.joy.startX, dy = t.clientY - this.joy.startY;
          const d = Math.hypot(dx, dy);
          if (d > MAX) { dx = dx / d * MAX; dy = dy / d * MAX; }
          this.joy.dx = dx / MAX; this.joy.dy = dy / MAX;
          this.joy.baseX = this.joy.startX + dx;
          this.joy.baseY = this.joy.startY + dy;
        }
      }
      e.preventDefault();
    }, { passive: false });

    const fin = e => {
      for (const t of e.changedTouches) {
        if (this.joy.active && t.identifier === this.joy.id) {
          this.joy.active = false; this.joy.dx = this.joy.dy = 0;
        }
      }
    };
    cv.addEventListener('touchend', fin);
    cv.addEventListener('touchcancel', fin);

    // Botones táctiles (el UI los pinta y emite aquí)
    window.addEventListener('sh-touch', e => { // evento personalizado desde ui.js
      const { accion, activo } = e.detail;
      this.pad = this.pad || {};
      this.pad[accion] = activo;
      if (activo) this.justPressed['_pad_' + accion] = true;
    });
  }

  /* ---------- Lectura ---------- */
  getMovement() {
    if (this.joy.active && (this.joy.dx || this.joy.dy)) return { x: this.joy.dx, y: this.joy.dy };
    let x = 0, y = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) y = -1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) y = 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x = -1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x = 1;
    if (x && y) { x *= 0.707; y *= 0.707; } // diagonal normalizada
    return { x, y };
  }

  isAttack()      { return this.justPressed['KeyZ'] || this.justPressed['_pad_atk']; }
  isHeavyAttack() { return this.justPressed['KeyX'] || this.justPressed['_pad_heavy']; }
  isDash()        { return this.justPressed['ShiftLeft'] || this.justPressed['ShiftRight'] || this.justPressed['_pad_dash']; }
  isSkill()       { return this.justPressed['KeyC'] || this.justPressed['_pad_skill']; }
  isInteract()    { return this.justPressed['KeyE'] || this.justPressed['_pad_int']; }
  isPause()       { return this.justPressed['Escape']; }
  isInventoryKey(){ return this.justPressed['KeyI']; }
  isMuted()       { return this.justPressed['KeyM']; }

  clearFrame() { this.justPressed = {}; }

  /* ---------- Render del joystick (llamado desde UI) ---------- */
  renderJoystick(ctx) {
    if (!this.isMobile || !this.joy.active) return;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#9b59b6';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(this.joy.startX, this.joy.startY, 56, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#9b59b6';
    ctx.beginPath(); ctx.arc(this.joy.baseX, this.joy.baseY, 24, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
