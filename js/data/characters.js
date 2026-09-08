/* =========================================================
   characters.js — Roster de los 12 cazadores coleccionables
   Estilo: chibi anime, fondo transparente, sin armas.
   img: true  → ya existe sprite real en assets/chars/<id>.png
   img: true → avatar generado por código (hasta aprobar arte)
   Stats: HP/PV vida, ATK ataque, DEF defensa, SPD velocidad
   (iniciativa), MOV casillas de movimiento, RNG alcance.
   ========================================================= */

export const PERSONAJES = [
  {
    id: 'kaito', nombre: 'Kaito', rol: 'Cazador Sombrío', color: 0x8b5cf6, img: true,
    stats: { hp: 110, atk: 14, def: 8, spd: 12, mov: 4, rng: 1 },
    habilidad: { nombre: 'Corte Umbral', desc: 'Hendiente de sombra letal', mult: 2.2, cd: 3 }
  },
  {
    id: 'rin', nombre: 'Rin', rol: 'Maga de Fuego', color: 0xef4444, img: true,
    stats: { hp: 85, atk: 17, def: 6, spd: 10, mov: 3, rng: 3 },
    habilidad: { nombre: 'Explosión Ígnea', desc: 'Daño en área alrededor del objetivo', mult: 1.6, aoe: 1, cd: 3 }
  },
  {
    id: 'yuna', nombre: 'Yuna', rol: 'Oráculo de Luz', color: 0xfbbf24, img: true,
    stats: { hp: 95, atk: 11, def: 9, spd: 11, mov: 3, rng: 2 },
    habilidad: { nombre: 'Luz Sanadora', desc: 'Cura un 50% de la vida máxima', cura: 0.5, cd: 2 }
  },
  {
    id: 'grom', nombre: 'Grom', rol: 'Tanque Colosal', color: 0x9a6b4f, img: true,
    stats: { hp: 160, atk: 12, def: 14, spd: 6, mov: 3, rng: 1 },
    habilidad: { nombre: 'Golpe Sísmico', desc: 'Golpe brutal con la fuerza de la tierra', mult: 1.8, cd: 4 }
  },
  {
    id: 'sora', nombre: 'Sora', rol: 'Danzante del Viento', color: 0x22d3ee, img: true,
    stats: { hp: 90, atk: 13, def: 7, spd: 14, mov: 5, rng: 2 },
    habilidad: { nombre: 'Danza Cortante', desc: 'Ráfaga de viento doble', mult: 2.0, cd: 3 }
  },
  {
    id: 'dante', nombre: 'Dante', rol: 'Caballero Caído', color: 0xb91c1c, img: true,
    stats: { hp: 120, atk: 15, def: 11, spd: 9, mov: 3, rng: 1 },
    habilidad: { nombre: 'Juicio Oscuro', desc: 'Golpe cargado de energía prohibida', mult: 2.4, cd: 4 }
  },
  {
    id: 'mika', nombre: 'Mika', rol: 'Asesina Veloz', color: 0xa855f7, img: true,
    stats: { hp: 88, atk: 18, def: 6, spd: 16, mov: 5, rng: 1 },
    habilidad: { nombre: 'Golpe Letal', desc: 'Apuñalamiento crítico por la espalda', mult: 2.6, cd: 3 }
  },
  {
    id: 'roku', nombre: 'Roku', rol: 'Monje del Trueno', color: 0xfacc15, img: true,
    stats: { hp: 105, atk: 14, def: 9, spd: 12, mov: 4, rng: 1 },
    habilidad: { nombre: 'Puño Voltaico', desc: 'Impacto eléctrico devastador', mult: 2.0, cd: 3 }
  },
  {
    id: 'elena', nombre: 'Elena', rol: 'Invocadora Estelar', color: 0x6366f1, img: true,
    stats: { hp: 92, atk: 16, def: 7, spd: 10, mov: 3, rng: 3 },
    habilidad: { nombre: 'Lluvia Astral', desc: 'Meteoritos en área', mult: 1.5, aoe: 1, cd: 3 }
  },
  {
    id: 'atlas', nombre: 'Atlas', rol: 'Guardián de Hielo', color: 0x38bdf8, img: true,
    stats: { hp: 135, atk: 12, def: 13, spd: 8, mov: 3, rng: 1 },
    habilidad: { nombre: 'Lanza Glacial', desc: 'Cristal de hielo perforante', mult: 1.7, cd: 3 }
  },
  {
    id: 'nix', nombre: 'Nix', rol: 'Nigromante', color: 0x64748b, img: true,
    stats: { hp: 90, atk: 16, def: 7, spd: 10, mov: 4, rng: 3 },
    habilidad: { nombre: 'Drenar Alma', desc: 'Roba vida del enemigo', mult: 1.8, robaVida: 0.5, cd: 3 }
  },
  {
    id: 'hana', nombre: 'Hana', rol: 'Santa de la Aurora', color: 0xfb7185, img: true,
    stats: { hp: 100, atk: 13, def: 10, spd: 12, mov: 4, rng: 2 },
    habilidad: { nombre: 'Bendición Aurora', desc: 'Cura un 40% de la vida máxima', cura: 0.4, cd: 2 }
  }
];

export function getPersonaje(id) {
  return PERSONAJES.find(p => p.id === id) || PERSONAJES[0];
}

/** Escala las stats base del cazador con su nivel */
export function statsDeNivel(char, nivel) {
  const s = char.stats;
  return {
    maxHp: s.hp + (nivel - 1) * 22,
    atk: s.atk + (nivel - 1) * 3,
    def: s.def + (nivel - 1) * 2,
    spd: s.spd, mov: s.mov, rng: s.rng
  };
}
