#!/usr/bin/env python3
"""Procesa los sprites de perfil (lado_*.png): chroma-key del fondo verde,
recorte al contenido, escalado a la altura del sprite frontal y montado
centrado-abajo en un lienzo 512x512 (mismo encuadre que los frontales).
Los que no existan simplemente se saltan (el juego usa el frontal de respaldo)."""
import os
from PIL import Image

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

def procesar(nombre):
    src = f'{BASE}/raw_lado_{nombre}.png'
    dst = f'{BASE}/lado_{nombre}.png'
    if not os.path.exists(src):
        print(f'--  {nombre}: sin raw (se usará el frontal en el juego)')
        return
    frente = Image.open(f'{BASE}/{nombre}.png').convert('RGBA')
    fbb = frente.getbbox() or (0, 0, LIENZO, LIENZO)
    alto_frente = fbb[3] - fbb[1]
    pie_frente = fbb[3]

    im = chroma(Image.open(src).convert('RGBA'))
    bb = im.getbbox()
    if not bb:
        print(f'!!  {nombre}: vacío tras el chroma')
        return
    im = im.crop(bb)
    # escalar para que la altura del personaje coincida con el frontal
    f = alto_frente / im.height
    im = im.resize((max(1, round(im.width * f)), alto_frente), Image.LANCZOS)

    # montar en lienzo 512 centrado-abajo (pies a la misma altura que el frontal)
    lienzo = Image.new('RGBA', (LIENZO, LIENZO), (0, 0, 0, 0))
    x = (LIENZO - im.width) // 2
    y = pie_frente - alto_frente
    lienzo.paste(im, (x, y), im)
    lienzo.save(dst)

    # informe: tamaño + residuo verde restante (calidad del chroma)
    px = lienzo.load()
    opacos = verdes = 0
    for yy in range(0, LIENZO, 4):
        for xx in range(0, LIENZO, 4):
            r, g, b, a = px[xx, yy]
            if a > 100:
                opacos += 1
                if g > 120 and g > r + 40 and g > b + 40:
                    verdes += 1
    print(f'OK  {nombre}: lado_{nombre}.png  alto={alto_frente}px  opacos={opacos}  residuoVerde={verdes}')

if __name__ == '__main__':
    for c in CHARS:
        procesar(c)
