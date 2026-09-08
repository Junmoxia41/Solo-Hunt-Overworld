/* =========================================================
   arena.js — Modo Arena (Fase 5) — capa de datos
   Estructura limpia lista para sincronizar el ranking
   competitivo cuando se conecte el backend (Supabase/Firebase).
   REGLA DE NEGOCIO: la bolsa de premios USDT sale de un porcentaje
   de los ingresos reales del juego. Nunca prometer premios sin
   ingresos previos ni antitrampas en servidor.
   ========================================================= */

// Endpoint del backend de rankings (Fase 5 — pendiente)
export const ARENA_API_URL = null; // ej. 'https://api.solohunt.app/arena'

/**
 * Puntuación de poder del cazador (lo que se enviará al ranking).
 * Fórmula pública y auditable → menos trampas y menos disputas.
 */
export function poderDeCazador(nivel, oro, portalesConquistados) {
  return nivel * 100 + Math.floor(oro * 0.1) + portalesConquistados * 50;
}

/** Snapshot listo para POST al backend cuando exista */
export function snapshotArena(saveData) {
  return {
    jugador: saveData.charId,
    nivel: saveData.nivel,
    poder: poderDeCazador(
      saveData.nivel,
      saveData.oro,
      Object.keys(saveData.derrotados || {}).length
    ),
    timestamp: Date.now(),
    version: '0.2.0'
  };
}

/** Distribución sugerida de la bolsa mensual del Top 100 */
export const REPARTO_BOLSA = [
  { puestos: '1º',        porcentaje: 20 },
  { puestos: '2º',        porcentaje: 10 },
  { puestos: '3º',        porcentaje: 7 },
  { puestos: '4º-10º',    porcentaje: 3 },
  { puestos: '11º-50º',   porcentaje: 1 },
  { puestos: '51º-100º',  porcentaje: 0.5 }
];

/**
 * Envío de puntuación (stub asíncrono).
 * TODO(Fase 5): implementar cuando haya backend + antitrampas + legal.
 */
export async function enviarPuntuacion(saveData) {
  const snap = snapshotArena(saveData);
  if (!ARENA_API_URL) {
    console.info('[Arena] Modo offline. Snapshot preparado para Fase 5:', snap);
    return { enviado: false, snap };
  }
  const resp = await fetch(ARENA_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snap)
  });
  return { enviado: resp.ok, snap };
}
