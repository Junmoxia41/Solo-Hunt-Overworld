/* ============================================================
   loader.js — Pantalla de carga POR ESCENA (reutilizable).
   Misma estética que la de arranque: key-art aleatorio, chibi
   corredor aleatorio, barra con saltitos y mensajes por paso.
   Garantiza una duración mínima (3–5 s) para que cada cambio de
   escena "respire" y todo quede listo sin tirones.
   ============================================================ */
import { randomInt } from './utils.js';

const CHARS = ['kaito', 'rin', 'yuna', 'grom', 'sora', 'dante', 'mika', 'roku', 'elena', 'atlas', 'nix', 'hana'];

// v2.2: consejos distintos según el dispositivo (táctil vs teclado)
const ES_MOVIL = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const TIPS = ES_MOVIL ? [
  'Consejo: el botón DSH te vuelve invencible durante el salto',
  'Consejo: extrae sombras con el botón INT sobre cadáveres morados',
  'Consejo: el botón POT bebe una poción de vida al instante',
  'Consejo: el botón MAP abre el mapa completo del bosque',
  'Consejo: junta dos dedos (que no sean el del joystick) para hacer zoom',
  'Consejo: los jefes tienen 3 fases. ¡Cuidado con su furia final!',
  'Consejo: completa mazmorras rápido para un bonus de oro por tiempo'
] : [
  'Consejo: el dash (Shift) te vuelve invencible durante su salto',
  'Consejo: extrae sombras pulsando E sobre los cadáveres que brillan en morado',
  'Consejo: H bebe una poción de vida al instante · J de maná',
  'Consejo: pulsa M para ver el mapa completo del bosque',
  'Consejo: rueda del ratón o +/− para acercar la cámara',
  'Consejo: los jefes tienen 3 fases. ¡Cuidado con su furia final!',
  'Consejo: completa mazmorras rápido para un bonus de oro por tiempo'
];

/**
 * Muestra una pantalla de carga de escena.
 * @param {Game}   game            instancia del juego
 * @param {object} opts            { titulo, sub, minMs, pasos[], alMedias }
 *   - alMedias: callback que se ejecuta a mitad de la barra (aquí se monta
 *     la escena real: generar mapa, spawnear enemigos, etc.)
 * @returns {Promise<void>}        se resuelve cuando la barra llegó al 100%
 */
export function pantallaCarga(game, opts = {}) {
  const {
    titulo = 'SOLO HUNT',
    sub = 'OVERWORLD',
    minMs = 3000,
    pasos = [],
    alMedias = null
  } = opts;

  return new Promise(resolve => {
    game.changeState('LOADING'); // congela el mundo mientras carga

    // — DOM idéntico al del arranque (reutiliza el CSS del loader) —
    const el = document.createElement('div');
    el.id = 'loading';
    el.innerHTML = `
      <img id="load-bg" alt="Arte de Solo Hunt Overworld">
      <div class="load-oscuro"></div>
      <div class="load-wrap">
        <div class="load-title">${titulo}<span>${sub}</span></div>
        <div class="load-bar">
          <div class="load-fill" id="load-fill"></div>
          <img id="load-runner" alt="cazador">
        </div>
        <div id="load-num" class="load-num">0%</div>
        <div id="load-tip" class="load-tip"></div>
      </div>`;
    el.querySelector('#load-bg').src = `assets/ui/loading_${randomInt(1, 4)}.png`;
    el.querySelector('#load-runner').src = `assets/chars/${CHARS[randomInt(0, 11)]}.png`;
    document.body.appendChild(el);

    const fill = el.querySelector('#load-fill');
    const num = el.querySelector('#load-num');
    const runner = el.querySelector('#load-runner');
    const tip = el.querySelector('#load-tip');

    // textos por paso (o consejos si la escena no define pasos)
    const textos = pasos.length ? pasos : TIPS;
    let pasoIdx = 0;
    tip.textContent = textos[0];
    const cambioTip = setInterval(() => {
      pasoIdx = (pasoIdx + 1) % textos.length;
      tip.textContent = textos[pasoIdx];
    }, Math.max(650, minMs / (textos.length + 1)));

    // — animación: nunca supera al reloj, avanza a saltitos —
    const t0 = performance.now();
    let pct = 0, aMediaHecha = false;

    const tick = () => {
      const transcurrido = performance.now() - t0;
      const techo = Math.min(100, (transcurrido / minMs) * 100);
      pct = Math.min(techo, pct + 0.3 + Math.random() * 0.6);
      if (transcurrido >= minMs) pct = 100; // al cumplir el mínimo, cierra

      fill.style.width = pct + '%';
      num.textContent = Math.floor(pct) + '%';
      runner.style.left = `calc(${pct}% - 12px)`;

      // a mitad de barra: montar la escena real (queda oculta tras el overlay)
      if (!aMediaHecha && pct >= 45) {
        aMediaHecha = true;
        try { alMedias && alMedias(); }
        catch (err) { console.error('loader alMedias:', err); }
      }

      if (pct >= 100) {
        clearInterval(cambioTip);
        window.__cargaEscenaMs = Math.round(performance.now() - t0); // depuración/tests
        el.classList.add('done');
        setTimeout(() => el.remove(), 800);
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
