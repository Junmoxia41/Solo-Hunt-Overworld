/* =========================================================
   save.js — Capa de persistencia (LocalStorage, offline-first)
   Singleton de partida: personaje, nivel, oro, posición,
   semilla GPS y portales derrotados.
   NOTA: la API está pensada para migrar a IndexedDB en la
   Fase 2 sin tocar el resto del código.
   ========================================================= */

const KEY = 'solo_hunt_save_v1';

const defaults = () => ({
  charId: null,        // id del cazador activo (ver data/characters.js)
  x: 0, y: 0,          // posición en el overworld (px)
  spawnOk: false,      // ¿ya se calculó un punto de aparición caminable?
  seed: null,          // semilla del mundo ("gps:lat,lon" u offline)
  oro: 0,
  xp: 0,
  nivel: 1,
  hp: null,            // null => se inicializa a maxHp
  derrotados: {},      // { "seed|cx,cy": 1 } portales conquistados
  arena: { poder: 0, ultimaSync: null } // Fase 5: snapshot para ranking online
});

export const Save = {
  data: defaults(),

  /* --- Ciclo de vida --- */
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...defaults(), ...JSON.parse(raw) };
    } catch (e) { /* almacenamiento corrupto -> partida nueva */ }
    if (this.data.hp === null || this.data.hp > this.maxHp()) this.data.hp = this.maxHp();
    return this.data;
  },
  write() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) {}
  },

  /* --- Progresión --- */
  xpNecesaria() { return 50 + (this.data.nivel - 1) * 45; },
  maxHp() { return 40 + this.data.nivel * 22; },

  /** Devuelve cuántos niveles se han subido */
  addXp(q) {
    let subidas = 0;
    this.data.xp += q;
    while (this.data.xp >= this.xpNecesaria()) {
      this.data.xp -= this.xpNecesaria();
      this.data.nivel++;
      subidas++;
      this.data.hp = this.maxHp(); // curación completa al subir de nivel
    }
    this.write();
    return subidas;
  },

  addOro(q) { this.data.oro += q; this.write(); },
  marcarDerrotado(key) { this.data.derrotados[key] = 1; this.write(); },
  estaDerrotado(key) { return !!this.data.derrotados[key]; },

  setSemilla(seed) { this.data.seed = seed; this.data.spawnOk = false; this.write(); },
  setCazador(id) { this.data.charId = id; this.write(); }
};
