/* ============================================================
   audio.js — AudioManager 100% WebAudio sintetizado
   Cero archivos de audio: los SFX y el ambiente se sintetizan
   con osciladores y ruido filtrado (offline total, 0 MB).
   ============================================================ */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bgmVolume = 0.4;
    this.sfxVolume = 0.7;
    this.isMuted = false;
    this._bgmNodes = null;
    this._ducked = false;
    this._pasos = 0;
  }

  /* Debe llamarse tras un gesto del usuario (política de autoplay) */
  desbloquear() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.isMuted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this._arrancarBgm();
  }

  /* ---------- Sintetizadores ---------- */
  _tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, when = 0 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol * this.sfxVolume, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  _noise(dur, { vol = 0.25, frec = 1800, when = 0, baja = false } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = baja ? 'lowpass' : 'highpass';
    flt.frequency.value = frec;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol * this.sfxVolume, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  /* ---------- Banco de SFX ---------- */
  playSFX(nombre) {
    if (!this.ctx || this.isMuted) return;
    const S = {
      slash1: () => this._noise(0.12, { vol: 0.30, frec: 2600 }),
      slash2: () => this._noise(0.10, { vol: 0.26, frec: 3200 }),
      slash3: () => this._noise(0.14, { vol: 0.32, frec: 2100 }),
      heavy:  () => { this._tone(120, 0.3, { type: 'sawtooth', vol: 0.35, slide: -70 }); this._noise(0.25, { vol: 0.3, frec: 500, baja: true }); },
      hit:    () => this._tone(180, 0.1, { type: 'square', vol: 0.22, slide: -60 }),
      dash:   () => this._noise(0.18, { vol: 0.22, frec: 900 }),
      skill:  () => { this._tone(80, 0.5, { type: 'sawtooth', vol: 0.35, slide: -40 }); this._noise(0.4, { vol: 0.2, frec: 300, baja: true }); },
      levelUp:() => [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.18, { type: 'square', vol: 0.18, when: i * 0.09 })),
      coin:   () => { this._tone(988, 0.07, { type: 'square', vol: 0.16 }); this._tone(1319, 0.12, { type: 'square', vol: 0.16, when: 0.07 }); },
      item:   () => this._tone(700, 0.15, { type: 'triangle', vol: 0.22, slide: 300 }),
      death:  () => this._tone(220, 0.8, { type: 'sawtooth', vol: 0.3, slide: -180 }),
      arise:  () => { this._tone(55, 1.1, { type: 'sawtooth', vol: 0.4, slide: 30 }); this._tone(58, 1.2, { type: 'sawtooth', vol: 0.3, slide: -8 }); },
      ariseOk:() => [110, 165, 220, 330].forEach((f, i) => this._tone(f, 0.5, { type: 'triangle', vol: 0.2, when: i * 0.16 })),
      arriveFail: () => this._tone(160, 0.5, { type: 'square', vol: 0.2, slide: -80 }),
      portal: () => this._tone(300, 0.5, { type: 'sine', vol: 0.2, slide: 500 }),
      chest:  () => this._tone(500, 0.2, { type: 'triangle', vol: 0.2, slide: 200 }),
      fireball:() => this._noise(0.3, { vol: 0.26, frec: 700, baja: true }),
      arrow:  () => this._noise(0.08, { vol: 0.2, frec: 3400 }),
      menuMove:   () => this._tone(440, 0.05, { type: 'square', vol: 0.1 }),
      menuOk: () => { this._tone(523, 0.07, { type: 'square', vol: 0.14 }); this._tone(784, 0.1, { type: 'square', vol: 0.14, when: 0.06 }); },
      quest:  () => [392, 523, 659].forEach((f, i) => this._tone(f, 0.14, { type: 'triangle', vol: 0.16, when: i * 0.08 })),
      heal:   () => [660, 880].forEach((f, i) => this._tone(f, 0.12, { type: 'sine', vol: 0.14, when: i * 0.09 }))
    };
    (S[nombre] || S.hit)();
  }

  /* ---------- Música/ambiente por capas sintetizadas ---------- */
  _arrancarBgm() {
    // Pad ambiental lento: dos triángulos desafinados + arpegio suave
    this._bgmNodes = { osc: [], timer: null, modo: 'overworld' };
    const mk = (freq, type, vol) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = vol * this.bgmVolume;
      o.connect(g); g.connect(this.master);
      o.start();
      this._bgmNodes.osc.push({ o, g, baseVol: vol });
    };
    mk(110, 'triangle', 0.16);   // A2 — base grave
    mk(110.7, 'triangle', 0.12); // desafinado: batido lento
    mk(220, 'sine', 0.05);       // octava suave
    // Arpegio menor cada 0.5s (misterio, estilo mazmorra)
    const NOTAS = [220, 261.6, 329.6, 261.6, 220, 196, 164.8, 196];
    let paso = 0;
    this._bgmNodes.timer = setInterval(() => {
      if (!this.ctx || this.isMuted || this._ducked) return;
      const f = NOTAS[paso % NOTAS.length]; paso++;
      this._tone(f, 0.45, { type: 'triangle', vol: 0.05 * this.bgmVolume * 2 });
    }, 500);
  }

  /** Cambios de "pista" = cambio de color del ambiente */
  playBGM(modo) {
    if (!this.ctx || !this._bgmNodes || this._bgmNodes.modo === modo) return;
    this._bgmNodes.modo = modo;
    const M = {
      overworld: { base: 110,  tinte: 'triangle' },
      combat:    { base: 87.3, tinte: 'sawtooth' },
      gameover:  { base: 65.4, tinte: 'sine' },
      boss:      { base: 98,   tinte: 'sawtooth' }
    }[modo] || { base: 110, tinte: 'triangle' };
    this._bgmNodes.osc.forEach(({ o }, i) => {
      o.frequency.exponentialRampToValueAtTime(M.base * (i === 1 ? 1.007 : i === 2 ? 2 : 1), this.ctx.currentTime + 0.8);
    });
  }

  duck(on) {
    this._ducked = on;
    if (this._bgmNodes) this._bgmNodes.osc.forEach(({ g, baseVol }) => {
      g.gain.value = baseVol * this.bgmVolume * (on ? 0.25 : 1);
    });
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.master) this.master.gain.value = this.isMuted ? 0 : 1;
    return this.isMuted;
  }
}
