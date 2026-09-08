/* =========================================================
   premium.js — Sistema de portales premium (Fase 4)
   Estructura lista para monetización: los portales rango
   S y SS son puertas bloqueadas hasta comprar el pack
   correspondiente.
   CÓMO MONETIZAR DESPUÉS: sustituir `desbloqueado()` por la
   comprobación de compra (Stripe/Paddle vía web, ya que al
   ser PWA no necesitamos tiendas de apps ni sus comisiones).
   ========================================================= */

export const PACKS = {
  S:  { nombre: 'Pack de Portales Rango S',  precio: '4,99 €', ventajas: ['Portales S ilimitados', 'Jefes Dragón Joven', 'Botín x3'] },
  SS: { nombre: 'Pack de Portales Rango SS', precio: '9,99 €', ventajas: ['Portal Rey del Umbral', 'Botín x6', 'Aura exclusiva dorada'] }
};

export const RANGOS_PREMIUM = ['S', 'SS'];

/** Devuelve true si el portal exige pack premium */
export function esPremium(rango) {
  return RANGOS_PREMIUM.includes(rango);
}

/**
 * ¿Está desbloqueado el rango?
 * FASE 4: leerá el estado de compra del usuario.
 * De momento: desbloquea si el jugador alcanza el nivel mínimo (modo pruebas).
 */
export function desbloqueado(rango, nivelJugador = 1) {
  if (!esPremium(rango)) return true;
  const NIVEL_PRUEBAS = 15; // TODO(Fase 4): reemplazar por compra real
  return nivelJugador >= NIVEL_PRUEBAS;
}

export function packDe(rango) { return PACKS[rango]; }
