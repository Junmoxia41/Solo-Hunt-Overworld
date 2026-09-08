/* ============================================================
   save.js — Guardado en localStorage con versionado
   ============================================================ */
import { Shadow } from './shadow.js';

const KEY = 'soloHuntSaveV2';
const VERSION = '2.0.0';

export class SaveManager {
  static save(game) {
    const data = {
      version: VERSION,
      timestamp: Date.now(),
      player: game.player.serialize(),
      shadows: game.shadows.map(s => ({ tipo: s.tipo, nombre: s.nombre, role: s.role })),
      questsDone: game.questsDone || [],
      questProgreso: game.questProgreso || {},
      playTime: game.playTime,
      totalDeaths: game.totalDeaths,
      settings: {
        bgm: game.audio.bgmVolume,
        sfx: game.audio.sfxVolume,
        muted: game.audio.isMuted
      }
    };
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  }

  static load() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      if (data.version !== VERSION) return { ...data, migrado: true }; // futura migración
      return data;
    } catch (e) { console.error('Error cargando partida:', e); return null; }
  }

  /** Aplica una partida cargada al estado del juego */
  static applyToGame(game, data) {
    game.player.deserialize(data.player);
    game.playTime = data.playTime || 0;
    game.totalDeaths = data.totalDeaths || 0;
    game.questsDone = data.questsDone || [];
    game.questProgreso = data.questProgreso || {};
    if (data.settings) {
      game.audio.bgmVolume = data.settings.bgm;
      game.audio.sfxVolume = data.settings.sfx;
      game.audio.isMuted = data.settings.muted;
    }
    // Recrear el ejército de sombras desde la partida guardada
    game.shadows = [];
    for (const s of data.shadows || []) {
      const base = game.data.enemies[s.tipo];
      if (!base) continue;
      const fantasma = {
        type: s.tipo, nombre: base.nombre, maxHp: base.hp,
        speed: base.speed, x: game.player.x, y: game.player.y
      };
      const sh = new Shadow(game, fantasma, game.player);
      sh.role = s.role || 'attack';
      game.shadows.push(sh);
    }
  }

  static hasSave() { return localStorage.getItem(KEY) !== null; }

  static deleteSave() { localStorage.removeItem(KEY); }

  static getSaveInfo() {
    const d = this.load();
    if (!d) return null;
    return {
      level: d.player?.level ?? 1,
      date: new Date(d.timestamp).toLocaleDateString('es')
    };
  }
}
