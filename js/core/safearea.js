/* =========================================================
   safearea.js — Lectura de los Safe Area Insets (iOS/Android)
   Usa la "sonda" #safe-probe del DOM para convertir los
   env() de CSS a píxeles utilizables por las escenas.
   ========================================================= */

export function leerSafeArea() {
  const el = document.getElementById('safe-probe');
  if (!el) return { top: 0, right: 0, bottom: 0, left: 0 };
  const cs = getComputedStyle(el);
  const n = v => parseInt(cs.getPropertyValue(v), 10) || 0;
  return {
    top: n('padding-top'),
    right: n('padding-right'),
    bottom: n('padding-bottom'),
    left: n('padding-left')
  };
}

/** Margen seguro combinado (inset + colchón extra en px) */
export function margen(lado, extra = 10) {
  const s = leerSafeArea();
  return (s[lado] || 0) + extra;
}
