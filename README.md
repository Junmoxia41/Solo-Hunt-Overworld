# ⚔️ Solo Hunt: Overworld — v2 (Action RPG 2D, JavaScript Vanilla)

Reescritura total en **HTML5 + CSS3 + JS ES6+ puro** (sin frameworks, sin dependencias, sin build).
Motor propio sobre **Canvas 2D API**, audio **Web Audio API sintetizado** (0 MB de archivos),
guardado en **localStorage** (`soloHuntSaveV2`), módulos ES6, `requestAnimationFrame`.

## 🎮 Controles
| Acción | Teclado | Móvil |
|---|---|---|
| Moverse | WASD / Flechas | Joystick virtual (mitad izquierda) |
| Ataque básico | Z o clic | Botón ATK |
| Ataque pesado | X | — |
| Dash (i-frames) | Shift | Botón DSH |
| Shadow Strike | C | Botón SKL |
| Interactuar / ARISE | E | Botón INT |
| Inventario | I | (desde pausa) |
| Pausa | Esc | — |
| Silencio | M | — |
| Rol sombras (ataque/defensa) | T | — |

## ✨ Milestone 1 (actual) — Overworld jugable
- Combate en tiempo real: combo ×3, pesado ×3 ATK, dash con i-frames, Shadow Strike AoE.
- Jugabilidad RPG: 5 stats (str/agi/vit/int/per), 3 puntos por nivel, `exp = 100 · level^1.5`.
- 5 enemigos con IA por estados: lobo (manada flanqueante), murciélago (zigzag),
  no-muerto (tanque inmune a aturdimiento), duende arquero (kitea y dispara),
  mago oscuro (teletransporte + bolas de fuego).
- **¡ARISE!**: minijuego de barra de timing sobre cadáveres (25% de probabilidad),
  máximo 5 sombras, doble rol ataque/defensa, reaparición a los 60 s.
- Mundo 80×80 tiles con semilla fija: lago, pinos, flores, 4 portales (E/D/C/S).
- NPC Guía del Gremio con diálogo typewriter y misión «Primeros colmillos».
- Inventario de 20 slots con rarezas, equipo y consumibles; drops con bonus de PER.
- Guardado completo (jugador, inventario, sombras, misión) + autoguardado cada 60 s.
- Juice: hitlag, screen shake, números de daño, parpadeo de i-frames.
- HUD en canvas: barras, hotbar con enfriamientos, minimapa en vivo, combo.

## 🗺️ Milestone 2 (siguiente)
Mazmorras procedurales por portal (ranks E→S), jefes con 3 fases,
temporizadores y pantalla de resultados.

## 🔧 Desarrollo
```bash
python3 -m http.server 8001   # servir y jugar en http://localhost:8001
node --check src/*.js         # chequeo de sintaxis
```

## 📁 Estructura
```
index.html · style.css
src/  → main game constants utils camera input player enemy boss
        combat projectile particle item inventory quest npc dialogue
        shadow map ui audio save dungeon   (22 módulos comentados en español)
data/ → enemies.json items.json quests.json dialogues.json
assets/ → 12 cazadores chibi, 5 sprites de enemigo, fuente Press Start 2P (woff2 locales)
```

Versiones: guardado `v2.0.0` · La v1 (Phaser táctico) sigue en producción, intacta.
