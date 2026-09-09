# ⚔️ Solo Hunt: Overworld — v2 (Action RPG 2D, JavaScript Vanilla)

## 🎥 v2.1.1 — Cámara con zoom, colisiones y profundidad (actual)
- **Cámara con zoom real**: el personaje se ve más de cerca (x1.85 en PC, x2.05 en móvil). Zoom suave con **rueda del ratón**, teclas **+/−** y **pellizco** en móvil. Límites x1.15–x3.25 y la vista aparece dibujada en el minimapa.
- **Árboles con colisión de ÁREA (tronco)**: solo el tronco bloquea; puedes rodear el árbol y acercarte a la copa. El orden de dibujo compara los PIES de cada entidad contra la base del tronco: por delante te ves encima del árbol, por detrás te tapa la copa.
- **Rocas**: colisionan (tile sólido) pero se dibujan SIEMPRE debajo del jugador.
- **Sin teclas pegadas**: al perder el foco de la ventana (alt-tab / cambio de pestaña) se soltaban teclas "fantasma" que dejaban al personaje caminando solo; ahora se limpian al instante. También se eliminó la basura de memoria por frame (tirones).
- **Sprites de perfil**: los 12 cazadores tienen vista lateral (`lado_*.png`, verificados mirando a la derecha con detector de tono de piel); caminar a la derecha/izquierda voltea el sprite. Enemigos y sombras también miran hacia su objetivo.
- **Pantallas de carga por escena (3–5 s)**: arranque (4.2 s), entrar al bosque, cada piso de mazmorra, piso del jefe (3.8 s) y regreso al bosque. Barra animada con pasos temáticos, key-art y chibi aleatorios.
- Service Worker `sh-v2-2.1.1` (precarga total, offline).

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
| Mapa mundial | M | — |
| Pausa | Esc | — |
| Silencio | N | — |
| Zoom de cámara | Rueda del ratón / + y − | Pellizco con dos dedos |
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

## 🗺️ Milestone 2 — Mazmorras y jefes
- 4 portales (E/D/C/S) → mazmorras procedurales de 3-7 pisos con salas+pasillos,
  temporizador por rango y portal de salida al limpiar.
- 5 jefes de 3 fases (esbirros, anillos de proyectiles, enrage) con barra grande.
- Resultados con EXP ×2, oro de rango y bonus de tiempo; castigo al fallar.

## ✨ Remasterización (actual)
- **Arte nuevo**: sprites chibi reales para árboles, flores y rocas (chroma-key propio),
  suelos retexturizados (hierba con briznas, tierra con guijarros, agua con orillas espumosas).
- **Sombras bien ancladas** bajo los pies de jugador, enemigos y sombras aliadas.
- **PC: el ataque y el dash siguen al cursor** con retículo de puntería; arco de corte con estela.
- **Movimiento con aceleración suave** (menos sensación de interruptor).
- **M = mapa mundial** a pantalla completa · **N = silencio**.
- **Pantalla de carga** con 4 key-arts aleatorios, consejos, barra animada y chibi corredor.
- **Menú principal con key-art épico** de fondo.
- **Inventario estilo WoW**: muñeco de papel con slots de equipo, rejilla de mochila
  y tabla de estadísticas completa.

## 🛒 Milestone 3 — Economía y PWA
- Mercader Krow con tienda completa (comprar ×3 / vender al valor de ficha).
- Selector de cazador con los 12 personajes chibi (se guarda en la partida).
- **PWA instalable y 100% offline**: manifiesto + Service Worker con precache total,
  iconos kaito 192/512/maskable. Se instala como app nativa en móvil y escritorio.

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
