#!/usr/bin/env python3
"""Verifica/corrige la dirección de los sprites de perfil (lado_*.png).
Métrica definitiva: centroide X de los pixeles de PIEL en la zona de la
cara (filas 10–40%). En vista de perfil la cara está del lado al que se
mira. Si algún sprite mira a la izquierda, se voltea horizontalmente.
Todos los lado_*.png deben quedar mirando a la DERECHA (el motor los
espeja con scaleX(-1) para mirar a la izquierda)."""
import sys
from PIL import Image, ImageOps

BASE = '/home/user/sho-v2/assets/chars'
CHARS = ['kaito', 'rin', 'yuna', 'grom', 'sora', 'dante', 'mika', 'roku', 'elena', 'atlas', 'nix', 'hana']

def piel_centrox(im):
    px = im.load(); w, h = im.size
    sx = n = 0
    for y in range(int(h * 0.10), int(h * 0.40)):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a <= 120: continue
            if 205 < r <= 255 and 160 < g < 235 and 130 < b < 215 and r > g > b and (r - b) > 25:
                sx += x; n += 1
    if n < 25: return None, n
    return (sx / n - w / 2) / (w / 2), n

if __name__ == '__main__':
    malos = 0
    for nombre in CHARS:
        p = f'{BASE}/lado_{nombre}.png'
        try:
            im = Image.open(p).convert('RGBA')
        except FileNotFoundError:
            print(f'{nombre}: NO EXISTE'); malos += 1; continue
        c, n = piel_centrox(im)
        if c is None:
            print(f'{nombre:8}: sin señal de piel ({n}px) — sin cambios'); continue
        if c < -0.02:
            ImageOps.mirror(im).save(p)
            c2, _ = piel_centrox(Image.open(p))
            print(f'{nombre:8}: {c:+.3f} IZQ -> VOLTEADO (ahora {c2:+.3f})')
            if c2 is not None and c2 < -0.02: malos += 1
        else:
            print(f'{nombre:8}: {c:+.3f} derecha OK')
    sys.exit(1 if malos else 0)
