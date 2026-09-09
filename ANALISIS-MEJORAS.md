# 📋 ANÁLISIS COMPLETO Y HOJA DE RUTA — Solo Hunt: Overworld v2.1.1

> Análisis de todo el juego: mecánicas, sistemas, diseño, contenido, arte, audio
> y técnica. Cada punto indica qué mejorar y cómo. Al final, roadmap priorizado.
> Generado el 2026-09-09 tras revisar los 22 módulos, los 4 JSON de datos y el flujo completo.

---

## 🐛 1. BUGS REALES DETECTADOS (arreglar primero)

| # | Bug | Dónde | Impacto |
|---|-----|-------|---------|
| B1 | **Los jefes dan la EXP equivocada**: `boss.js` escribe `expaReward` (typo) y el motor lee `expReward`. Un jefe Rango E promete 260 EXP pero entrega ~18–50 (la de un enemigo normal). El panel de resultados muestra la cifra acumulada mal también. | `boss.js:18` | Alto — rompe la progresión |
| B2 | **Pellizco accidental en móvil**: si mueves con el joystick (dedo izquierdo sobre el canvas) y apoyas otro dedo sobre el canvas (no sobre un botón), se activa el pinch y **la cámara hace zoom sola**. Habría que exigir que el pellizco empiece con dos dedos que NO sean el del joystick. | `input.js` `_trackPinch` | Alto en móvil |
| B3 | **El slot de accesorio no se puede llenar nunca**: el inventario tiene hueco para `accessory` pero **no existe ni un solo item de tipo accesorio** en `data/items.json` (ni en tienda, ni en drops). | `data/items.json` | Medio — contenido muerto |
| B4 | **Materiales sin uso**: colmillo de lobo, ala de murciélago y hueso solo sirven para venderse. No hay crafteo ni mejora de equipo que los consuma. | `data/items.json` | Medio — economía sin profundidad |
| B5 | **En móvil no hay botón de mapa**: la tecla M no existe en táctil y el mapa completo es inaccesible desde el móvil. Tampoco hay botón de poción rápida. | `ui.js` `_buildTouchPad` | Medio |
| B6 | Los consejos de la pantalla de carga mencionan teclas de PC ("Shift", "pulsa E") aunque estés en móvil. | `index.html` / `loader.js` | Bajo — pulido |
| B7 | La regeneración pasiva de vida (0.5 + VIT×0.5 por seg) cura demasiado fuera de combate: esperas 10 segundos y estás full. Las pociones pierden valor. | `player.js` | Bajo — balance |

---

## ⚔️ 2. COMBATE Y MECÁNICAS

### Lo que ya funciona bien
- Ataque hacia el cursor con hitbox circular + combos x3 con golpe final potenciado.
- Hitlag (micro-congelación al impacto), screen shake y números de daño con críticos — muy buen game feel base.
- Dash con i-frames, ataque pesado con coste de maná, habilidad AoE (Shadow Strike).
- 5 enemigos con personalidad (lobo cazador, murciélago errático, no-muerto tanque, duende que mantiene distancia y dispara, mago que se teleporta).

### Mejoras propuestas
1. **Telegrafiar los ataques enemigos**: ahora el enemigo daña AL INSTANTE al entrar en rango. Un "windup" (0.35s de animación/flash antes del golpe) haría el combate justo y legible, especialmente en móvil.
2. **Animación de ataque del personaje**: hoy el ataque solo se ve como un arco dibujado; faltaría que el sprite haga un poseo/lunge hacia el golpe (traslación de 4–6px hacia el aim) — barato de hacer y se ve enorme.
3. **Ataque pesado atraviesa**: ahora básico y pesado golpean a 1 solo enemigo. El pesado debería atravesar varios (es lento y caro, merece la pena).
4. **Knockback al jugador** cuando un golpe te alcanza (pequeño empujón) — vende el impacto.
5. **Enemigos élite**: variantes con aura y 1 afijo aleatorio (veloz, escudado, vampírico, explosivo) con más oro/EXP. Reutiliza los 5 sprites (tinte + tamaño).
6. **Nuevos patrones de enemigo**: un cargador (embestida telegrafiada), un bombardeo suicida (explota al morir cerca), un invocador. Con 3 arquetipos nuevos el bestiario se siente el doble de grande.
7. **Jefes**: añadir un ataque cargado esquivable (línea/área telegrafiada en el suelo), usar los pilares de la sala como cobertura frente al anillo de proyectiles, y un "enrage suave" si tardas demasiado.
8. **Lock-on opcional** (tecla o botón): fija el aim al enemigo más cercano al cursor — gran QoL en móvil.
9. **Sombras (ARISE) más profundas**: hoy atacan cuerpo a cuerpo y ya. Cada tipo podría conservar un rasgo: sombra de duende dispara flechas, sombra de mago dispara bolas, sombra de no-muerto taquea y provoca. Además: comando individual (no global con T) y "última orden" persistente.
10. **Minijuego ARISE con dificultad variable**: la zona verde podría encogerse según el nivel del enemigo, y un "PERFECTO" (centro exacto) daría la sombra con +25% de vida.

---

## 📈 3. PROGRESIÓN Y EQUIPO

1. **Fix del bug de EXP del jefe (B1)** y revisar la curva completa: hoy el nivel 1→5 vuela y luego se aplana.
2. **Más slots de equipo**: casco, guantes, botas y anillo (además de arma/pecho/accesorio). El papel-doll WoW ya tiene la estructura, solo ampliar.
3. **Armas/armaduras intermedias**: entre "Espada de Hierro" (12 ATQ) y "Hoja de Sombras" (35) hay un salto enorme. Añadir 4–6 piezas por ranura repartidas por rareza.
4. **Accesorios** (arregla B3): anillos y amuletos con stats secundarios (crit, evasión, regen, velocidad).
5. **Mejora de equipo en la tienda** (arregla B4): "refinar" el arma con oro + materiales (colmillos/huesos) → +1, +2, +3… con brillo visual. Crea el sumidero de oro y el uso de materiales que falta.
6. **Sets con bonus**: 2 piezas de la misma familia = bonus (ej. "Set Sombra: +10% crítico").
7. **Talentos por nivel** (árbol pequeño de 3 ramas: Filo/Sombra/Cuerpo) para personalizar builds con los puntos que ya ganas.
8. **Respec de stats** por oro — permite corregir errores sin borrar partida.
9. **Logros/bestiario**: contador de bajas por tipo (ya existe `killLog` internamente), recompensas a hitos (50 lobos → título + oro).

---

## 🌍 4. CONTENIDO: MUNDO, MAZMORRAS, MISIONES

1. **Segundo bioma**: conectar el portal "norte" del mapa a un **Cementerio Niebloso** (tiles grises/lápides, nomuerto/duende de élite, jefe propio). El motor de mapa ya es genérico — es el contenido más rentable por esfuerzo.
2. **Ciclo día/noche**: tinte del ambiente + enemigos más agresivos/de más nivel de noche (el overlay ya existe, solo animarlo).
3. **Sala del tesoro y trampas en mazmorras**: cofres con botín por piso, losas de pinchos, santuario de curación 1 uso por piso. Rompe la monotonía de "limpia y avanza".
4. **Modo infinito**: tras completar Rango S, desbloquear "Rango ∞" con pisos que escalan para siempre (leaderboard local de profundidad).
5. **Cadena de misiones**: hoy solo hay UNA misión (caza 5 lobos) y el Guía se queda mudo para siempre. Mínimo 8–10 misiones encadenadas (caza X, recoge Y materiales, limpia mazmorra E, derrota élite) con recompensas y texto.
6. **Tercer NPC — la Herrera Vex**: en el campamento, mejora equipo (ver punto 5.5) y vende accesorios.
7. **Eventos de mundo aleatorios**: cada 3–5 min, un "élite errante" con marcador en el minimapa y botín garantizado; una lluvia de meteoros de oro, etc.
8. **Fast travel**: al descubrir un portal, poder viajar desde el mapa M pagando oro.
9. **Niebla de guerra en el mapa/minimapa**: ahora ves todo el mapa de inicio; explorar para revelarlo da un motivo para recorrer el bosque.

---

## 🖥️ 5. UI/UX (PC y MÓVIL)

1. **Hotbar con cooldowns visuales**: hoy los CDs del pesado/skill/dash solo se saben "a oído". Dibujar 4 casillas (Z/X/C/Shift) con reloj de barrido — es EL estándar del género.
2. **Botón/tecla de poción rápida** (tecla H / botón POT en móvil) — ahora curarse exige abrir el inventario, impensable en combate.
3. **Tooltips comparativos al equipar**: "+12 ATQ (−5 actual)" en verde/rojo antes de confirmar.
4. **Barra de vida bajo el jugador** (opcional) — con el zoom alto, mirar arriba-izquierda cuesta.
5. **Flecha guía de misión**: indicador en el borde de pantalla hacia el objetivo actual.
6. **Fix pinch accidental (B2)** y botones de **mapa (B5)** y poción en móvil.
7. **Ordenar inventario** con un botón (por rareza/tipo) y tooltips de stats al mantener pulsado.
8. **Pausa automática** al perder el foco de la ventana (ya limpiamos teclas; falta pausar).
9. **Opciones de accesibilidad**: escala de fuente del HUD (la fuente pixel de 7px es pequeña), reducción de partículas/flash, y modo daltónico para rarezas.
10. **Pantalla de ajustes real**: volúmenes BGM/SFX con slider (el Audio Manager ya soporta los valores, falta la UI).

---

## 🎨 6. ARTE Y AUDIO

1. **Spritesheet de caminar** (2–4 frames) para el jugador por dirección — es la mejora visual nº1: hoy solo hay bobbing. Con los perfiles ya hechos, generar 2 frames más por dirección.
2. **Frames de ataque** (1 frame de poseo por arma) y de dash (estela ya existe).
3. **Autotile de orillas**: el agua ya tiene espuma; añadir transiciones hierba↔tierra con esquinas orgánicas (dibujado por código, sin assets).
4. **Variación de tiles**: 2–3 variantes de árbol/roca (tinte/escala/rotación leve determinista) para romper repetición.
5. **Sombras largues de atardecer** y luciérnagas nocturnas — el overlay de ambiente ya está, es barato.
6. **Música por capas**: ahora hay 1 pad + arpegio. Añadir percusión sintetizada en combate/jefe, y una melodía distinta por bioma. El sintetizador ya existe — solo faltan patrones.
7. **Más SFX**: golpe al escudo/bloqueo, pasos por superficie, venta de item, level-up de arma.
8. **Iconos de items dibujados** (SVG/canvas) en vez de emojis para el inventario — coherencia con el estilo pixel (aunque los emojis actuales funcionan).

---

## ⚙️ 7. TÉCNICO

1. **Guardar tras eventos importantes**: hoy solo autoguarda cada 60s fuera de mazmorra. Guardar también al: completar misión, comprar, salir de mazmorra, subir nivel.
2. **Exportar/importar partida**: botón que copia un código (base64) para respaldar o cambiar de dispositivo — hoy un "borrar datos del navegador" borra horas.
3. **Pre-render del terreno a canvas** por chunks (el suelo se repinta cada frame tile a tile). Con zoom alto no es urgente, pero es la mejora de rendimiento más grande disponible.
4. **Object pooling de partículas/proyectiles** (se crean/destruyen cientos por minuto).
5. **Soporte de mando (Gamepad API)**: stick para mover, botones para atacar — gratis en PC y móvil con mando.
6. **Vibración háptica** en móvil al recibir golpes/críticos (`navigator.vibrate`, 1 línea).
7. **Aviso de "nueva versión disponible"**: con el SW ya basta un toast pidiendo recargar cuando llegue update — los jugadores con PWA instalada no saben cuándo hay cambios.
8. **Test de largo plazo**: partida simulada de 15 min midiendo memoria y FPS (detectar fugas antes de que las vea el usuario).

---

## 🗺️ 8. ROADMAP PRIORIZADO

### 🔴 P1 — QUICK WINS — ✅ COMPLETADO EN v2.2.0 (2026-09-09)
1. ✅ Fix bug EXP del jefe (B1) — también se arregló el ORO del jefe (mismo bug).
2. ✅ Fix pinch accidental en móvil (B2).
3. ✅ Poción rápida (tecla H vida / J maná en PC + botón POT en móvil) y slot H en el hotbar con contador.
4. ✅ Botón de mapa en móvil + tips de carga según dispositivo (B5/B6).
5. ✅ 6 accesorios con drops por enemigo, pools de jefes y tienda — el slot ya no está muerto (B3) y suman ATQ/DEF/PV/CRÍT/velocidad.
6. ✅ Tooltip comparativo al equipar (+7 en verde / −x en rojo vs lo equipado) + botón ORDENAR MOCHILA.
7. ✅ Pausa automática al perder foco (blur / cambiar de pestaña).

### 🟡 P2 — PROFUNDIDAD (2–3 sesiones)
1. Windup/telegraph de ataques enemigos + élites con afijos.
2. Mejora de equipo en tienda (refinar con oro + materiales) → usa los materiales (B4).
3. Cadena de 10 misiones + herrera Vex + flecha guía de misión.
4. Frames de caminar del jugador (spritesheet) + poseo de ataque.
5. Sombras con habilidad según su tipo + ARISE con dificultad variable.
6. Ajustes de balance (regen, curva EXP, saltos de equipo) + respeto por oro.
7. Niebla de guerra en mapa/minimapa + fast travel.

### 🟢 P3 — GRANDES (varias sesiones)
1. Segundo bioma: Cementerio Niebloso (tiles, enemigos élite, jefe, misión de apertura).
2. Ciclo día/noche + eventos de mundo + clima.
3. Salas de tesoro/trampas/santuarios en mazmorras + Rango ∞ infinito.
4. Talentos por nivel (árbol de 3 ramas) y sets de equipo con bonus.
5. Música por capas/bioma + percusión en jefe.
6. Pre-render de terreno + pooling (rendimiento) + exportar/importar partida.

---

*La base técnica es sólida (motor vanilla limpio, PWA offline, game feel ya pulido). Los quick wins de P1 + profundidad de P2 llevarían el juego de "demo jugable" a "juego con progresión real" sin tocar el motor.*
