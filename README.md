# 🔥 Solo Hunt: Overworld

RPG Táctico 2D por turnos (estilo Final Fantasy Tactics) con exploración de mundo anclada al GPS del jugador y sistema de Cazadores de Portales. **PWA 100% Offline-First** instalable en iOS, Android, iPad, Windows y Mac.

## ▶️ Cómo jugar

1. Abre la app (o instálala con **⬇️ Instalar** / en iPhone: Compartir → "Añadir a pantalla de inicio").
2. Elige tu primer **Cazador** entre 12 héroes coleccionables.
3. Muévete por el mundo con el **joystick virtual** (o **WASD**/flechas en PC).
4. Acércate a un **portal** y pulsa *"⚡ Entrar"*:
   - Rangos **E → D → C → B → A** abiertos a todos.
   - **S / SS** = contenido premium (🔒) — Fase 4. En modo pruebas se desbloquean al Nv 15.
5. En combate táctico: **turnos por iniciativa (SPD)**, casillas azules = movimiento (BFS), rojas = ataque, moradas = habilidad con cooldown. Acciones: Mover · Atacar · Habilidad · Defender · Huir · Terminar.
6. Gana **oro 🪙 + XP**, sube de nivel, conquista portales. Partida guardada automáticamente (offline).
7. **📍 Mi zona** genera el mundo desde tu ubicación GPS real (sin moverte en la vida real).

## 🧱 Arquitectura (Phaser 3 + ES Modules)

```
solo-hunt/
├── index.html                  # Punto de entrada PWA
├── css/style.css               # Layout full-screen, safe-area, touch-action:none
├── manifest.webmanifest        # Instalación nativa
├── sw.js                       # Service Worker — Cache-First estricto (offline)
├── vendor/phaser.min.js        # Phaser 3.80 local (sin CDN)
├── assets/chars/               # Sprites chibi (kaito, rin, yuna generados)
└── js/
    ├── main.js                 # Configuración Phaser + registro SW + install prompt
    ├── core/
    │   ├── rng.js              # Hash/ruido/PRNG deterministas (semilla GPS)
    │   ├── save.js             # Persistencia LocalStorage (API lista para IndexedDB)
    │   ├── safearea.js         # Safe Area Insets → píxeles
    │   ├── worldgen.js         # Biomas, portales y NPCs por chunk (determinista)
    │   ├── textures.js         # Texturas generadas por código (cero red)
    │   └── widgets.js          # Tokens de personaje, botones, paneles, popups
    ├── data/
    │   ├── characters.js       # Roster de 12 cazadores + escalado por nivel
    │   ├── enemies.js          # Escuadrones de portal por rango
    │   ├── portals.js          # Tabla de rangos, colores y recompensas
    │   ├── premium.js          # Puertas bloqueadas S/SS (Fase 4: pagos)
    │   └── arena.js            # Poder, snapshot y reparto de bolsa (Fase 5)
    └── scenes/
        ├── BootScene.js        # Arranque: safe area, partida, semilla
        ├── PreloadScene.js     # Splash + carga de assets + generación de texturas
        ├── WorldScene.js       # Overworld infinito, cámara lerp, portales, NPCs
        ├── BattleTacticsScene.js # Táctica por turnos: BFS, críticos, IA, recompensas
        └── UIScene.js          # HUD, joystick, toasts, modales (roster/premium/arena)
```

## 🗺️ Roadmap

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Overworld GPS + portales + 3 sprites reales | ✅ |
| 2 | **Combate táctico FFT** (iniciativa, BFS, IA, habilidades) | ✅ |
| 2.5 | Sprites chibi de los 12 cazadores | ✅ |
| 3 | Historia, misiones de NPCs, jefes únicos, más biomas | 📋 |
| 4 | Portales premium S/SS de pago + publicidad recompensada | 📋 |
| 5 | Arena online Top 100 con bolsa USDT (backend + antitrampas + revisión legal) | 📋 |

## ⚖️ Nota de diseño honesto

Los premios USDT de la Arena saldrán de un **porcentaje de los ingresos reales** del juego, con servidor antitrampas y revisión legal por país. Sin humo: primero se recauda, luego se reparte.

*Universo, personajes y nombre 100% originales. Inspirado en mecánicas (no en assets) de la fantasía de cazadores y portales.*
