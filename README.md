# ⚔️ Solo Hunt: Overworld — v2 (Action RPG 2D, JavaScript Vanilla)

## 🌍 v2.4.0 — P3-WORLD: EL VOLUMEN (actual)
- **Historia original** (ver `HISTORIA.md`): el mundo es un libro que se escribió a sí mismo; cada bioma es el "Folio" de un recuerdo. La amenaza no es un señor oscuro: es **La Tinta Blanca**, la autora arrepentida que borra su propia obra. Tú eres **la Página en Blanco** — sin pasado, capaz de sostener sombras ajenas (ARISE) e inmune a los Recuerdos Sellados.
- **Mundo 160×160 (4× el tamaño anterior)** con **4 biomas/Folios jugables**:
  - **Folio I — Bosque de Penumbra** (1-4) · portal E
  - **Folio II — Praderas del Mediodía Eterno** (4-8) · hierba dorada, girasoles, robles dorados · portal D
  - **Folio III — Campos de los Nombres** (6-10) · hierba pálida, niebla rasante, árboles muertos y **tumbas con colisión** · portal C
  - **Folio IV — Ciénaga de los Espejos** (9-13) · pantanos negros, sauces llorones, flores bioluminiscentes · portal S
- Bordes **orgánicos** entre biomas (ruido determinista), caminos cruzados que conectan los 4 Folios, aviso "📖 Folio…" al entrar en cada región.
- **Tiles nuevos por bioma** (árboles, flores, tumbas) + suelo/tierra/agua con paleta propia por Folio y detalles: briznas doradas, niebla animada, lodo.
- **Fauna por Folio** con niveles de zona (cementerio nv.8, ciénaga nv.11…) — el respawn también es del bioma local.
- Diálogos reescritos con el lore (Orlen el Archive, Krow el Cuervo) y las 10 misiones reescritas como "recuerdos".
- Arquitectura data-driven (`src/world.js`): añadir el Folio V+ es añadir su entrada + tiles. Diseño completo de los 10 Folios en `MUNDO.md`.
- Service Worker `sh-v2-2.4.0`.

## ⚔️ v2.3.0 — P2: profundidad de combate y progresión
- **Ataques telegrafiados**: los enemigos cargan su golpe (anillo blanco que se cierra) antes de atacar — esquivable con dash o alejándote. Los jefes también (melé y carga del anillo de proyectiles).
- **Élites con afijos** (★): veloz, escudado, vampírico o explosivo. ×2.2 vida, ×2.5 EXP/oro, aura de color y 25% más grandes. 10% en el bosque, 15% en mazmorras. El explosivo detona al morir: ¡aléjate de la mecha!
- **Cadena de 10 misiones** del Guía del Gremio (cazar / recolectar / completar mazmorras E-D-C) con recompensas crecientes y objetos. Rastreador en el HUD y **flecha guía** al objetivo.
- **Refinar equipo** en la tienda: oro + materiales (colmillos/huesos/alas) → +10% stats por nivel, hasta +5. Los materiales por fin sirven para algo.
- **Sombras con talento propio**: las sombras de duende/mago disparan desde lejos; el resto pelea cuerpo a cuerpo.
- **ARISE con dificultad variable**: la zona verde se encoge con el nivel del enemigo; parar en el CENTRO exacto = **¡PERFECTO!** sombra con +25% de vida.
- **Regeneración limitada en combate** (las pociones importan) y **redistribución de stats** por oro en la pausa.
- Refinado y misiones incluidos en el guardado. Service Worker `sh-v2-2.3.0`.

## ✨ v2.2.0 — P1: fixes de balance y calidad de vida
- **FIX jefes**: entregan la EXP y el oro prometidos (antes un bug les daba la recompensa de un enemigo normal).
- **FIX móvil**: el zoom por pellizco ya no se dispara al apoyar un segundo dedo junto al joystick.
- **Poción rápida**: tecla **H** (vida) y **J** (maná) en PC · botón **POT** en móvil · slot H con contador en el hotbar.
- **Botón MAP** en móvil para el mapa completo.
- **6 accesorios nuevos** (anillos, colgante, pluma, ojo, sello) con drops, botín de jefes y tienda; suman ATQ/DEF/PV/CRÍT/velocidad.
- **Tooltip comparativo** al equipar (mejora verde / empeora roja) y botón **ORDENAR MOCHILA**.
- **Pausa automática** al perder el foco de la ventana (alt-tab).
- Tips de carga adaptados a PC/móvil. Service Worker `sh-v2-2.2.0`.

## 🎥 v2.1.1 — Cámara con zoom, colisiones y profundidad
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
| Zoom de cámara | Rueda del ratón / + y − | Pellizco con dos dedos (no el del joystick) |
| Poción rápida | H (vida) · J (maná) | Botón POT |
| Mapa completo | M | Botón MAP |
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
