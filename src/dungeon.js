/* ============================================================
   dungeon.js — Mazmorras procedurales (MILESTONE 2)
   Estructura: grid 7x7, random walk de salas, sala del jefe,
   temporizador por rango y pantalla de resultados.
   Ver GDD v2.0 §FASE 7. Los portales del overworld ya están
   posicionados; al pisarlos hoy se notifica "Milestone 2".
   ============================================================ */

export class Dungeon {
  constructor(game, rango) {
    this.game = game;
    this.rango = rango;
    this.currentFloor = 1;
    this.floors = { E: 3, D: 5, C: 7, B: 10, S: 12 }[rango] || 3;
    this.rooms = [];
    // TODO(M2): generateLayout() con random walk, enterDungeon(),
    // clearRoom(), spawnBossRoom() y completeDungeon() con
    // pantalla de resultados (EXP x2, oro, bonus de tiempo).
  }
}
