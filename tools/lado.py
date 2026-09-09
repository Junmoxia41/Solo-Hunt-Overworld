#!/usr/bin/env python3
"""Procesa los sprites de perfil (lado_*.png): chroma-key del fondo verde,
recorte al contenido, escalado a la altura del sprite frontal y montado
centrado-abajo en un lienzo 512x512 (mismo encuadre que los frontales).

ADEMÁS detecta hacia dónde mira el perfil (pelo atrás / pie adelantado /
ojos claros al frente) y voltea horizontalmente los que miren a la
IZQUIERDA: todos los lado_*.png quedan mirando a la DERECHA (el motor
los espeja con scaleX(-1) para mirar a la izquierda)."""
import os
from PIL import Image, ImageOps

BASE = '/home/user/sho-v2/assets/chars'
CHARS = ['kaito', 'rin', 'yuna', 'grom', 'sora', 'dante', 'mika', 'roku', 'elena', 'atlas', 'nix', 'hana']
LIENZO = 512

def chroma(im):
    """Quita el fondo verde (muestreado de las esquinas) con despill suave."""
    px = im.load()
    w, h = im.size
    esq = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    gr = sum(c[0] for c in esq) // 4
    gg = sum(c[1] for c in esq) // 4
    gb = sum(c[2] for c in esq) // 4
    UMB = 95
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            d = abs(r - gr) + abs(g - gg) + abs(b - gb)
            if d < UMB:
                px[x, y] = (0, 0, 0, 0)
            elif d < UMB * 2:
                al = int(255 * (d - UMB) / UMB)
                g2 = min(g, max(r, b) + 30)  # despill: quita verde rezagado
                px[x, y] = (r, g2, b, (a * al) // 255)
    return im

def metrica_centrox(im, f0, f1, solo_brillantes=False):
    """Centroide X de los pixeles opacos entre las fracciones de alto f0..f1.
    Con solo_brillantes=True solo cuenta pixeles muy claros (esclerótica del ojo)."""
    px = im.load()
    w, h = im.size
    y0, y1 = int(h * f0), int(h * f1)
    sx = n = 0
    for y in range(y0, min(y1, h)):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a <= 100: continue
            if solo_brillantes and not (r > 175 and g > 175 and b > 175): continue
            sx += x; n += 1
    return (sx / n) if n else None

def detectar_facing(im):
    """Devuelve (score, detalle). score > 0 = mira a la DERECHA.
    Señales: pelo (masa atrás, arriba), pie adelantado (piernas), ojos claros al frente."""
    cx = im.width / 2
    c_pelo = metrica_centrox(im, 0.04, 0.30) or cx
    c_pier = metrica_centrox(im, 0.62, 0.90) or cx
    c_ojos = metrica_centrox(im, 0.10, 0.32, solo_brillantes=True)
    s_pelo = (cx - c_pelo) / cx          # pelo a la izquierda -> mira derecha (+)
    s_pier = (c_pier - cx) / cx          # pie adelantado a la derecha -> mira derecha (+)
    s_ojos = ((c_ojos - cx) / cx) if c_ojos else 0.0
    score = s_pelo + s_pier + 0.6 * s_ojos
    return score, (s_pelo, s_pier, s_ojos)

def procesar(nombre, reporte):
    src = f'{BASE}/raw_lado_{nombre}.png'
    dst = f'{BASE}/lado_{nombre}.png'
    if not os.path.exists(src):
        reporte.append((nombre, None, None, 'SIN RAW'))
        return
    frente = Image.open(f'{BASE}/{nombre}.png').convert('RGBA')
    fbb = frente.getbbox() or (0, 0, LIENZO, LIENZO)
    alto_frente = fbb[3] - fbb[1]
    pie_frente = fbb[3]

    im = chroma(Image.open(src).convert('RGBA'))
    bb = im.getbbox()
    if not bb:
        reporte.append((nombre, None, None, 'VACIO'))
        return
    im = im.crop(bb)

    # ¿Hacia dónde mira? Si mira a la IZQUIERDA, voltear (todos quedan a la DERECHA)
    score, det = detectar_facing(im)
    volteado = score < 0
    if volteado:
        im = ImageOps.mirror(im)
        score2, _ = detectar_facing(im)
    else:
        score2 = score

    # escalar para que la altura del personaje coincida con el frontal
    f = alto_frente / im.height
    im = im.resize((max(1, round(im.width * f)), alto_frente), Image.LANCZOS)

    # montar en lienzo 512 centrado-abajo (pies a la misma altura que el frontal)
    lienzo = Image.new('RGBA', (LIENZO, LIENZO), (0, 0, 0, 0))
    x = (LIENZO - im.width) // 2
    y = pie_frente - alto_frente
    lienzo.paste(im, (x, y), im)
    lienzo.save(dst)

    # residuo verde
    px = lienzo.load()
    opacos = verdes = 0
    for yy in range(0, LIENZO, 4):
        for xx in range(0, LIENZO, 4):
            r, g, b, a = px[xx, yy]
            if a > 100:
                opacos += 1
                if g > 120 and g > r + 40 and g > b + 40:
                    verdes += 1
    reporte.append((nombre, score, score2, ('VOLTEADO (miraba izq)' if volteado else 'ok') + f'  opacos={opacos} verde={verdes}'))

if __name__ == '__main__':
    reporte = []
    for c in CHARS:
        procesar(c, reporte)
    print(f"{'personaje':10} {'score_antes':>11} {'score_despues':>13}  resultado")
    print('-' * 62)
    for nombre, s0, s1, info in reporte:
        print(f"{nombre:10} {(f'{s0:+.3f}' if s0 is not None else '—'):>11} {(f'{s1:+.3f}' if s1 is not None else '—'):>13}  {info}")
    faltan = [n for n, s0, _, info in reporte if s0 is None]
    if faltan:
        print(f'\n!! FALTAN: {", ".join(faltan)}')
    else:
        print('\nTODOS LOS 12 PERFILES LISTOS ✓')
