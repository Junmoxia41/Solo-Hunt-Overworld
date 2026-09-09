#!/usr/bin/env python3
"""Chroma genérico para tiles de biomas: raw_<nombre>.png -> <nombre>.png
(fondo verde -> alfa, despill, recorte con margen, tope 256 manteniendo proporción)."""
import sys
from PIL import Image

BASE = '/home/user/sho-v2/assets/tiles'

def procesar(nombre):
    im = Image.open(f'{BASE}/raw_{nombre}.png').convert('RGBA')
    px = im.load(); w, h = im.size
    esq = [px[0,0], px[w-1,0], px[0,h-1], px[w-1,h-1]]
    gr = sum(c[0] for c in esq)//4; gg = sum(c[1] for c in esq)//4; gb = sum(c[2] for c in esq)//4
    UMB = 95
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            d = abs(r-gr)+abs(g-gg)+abs(b-gb)
            if d < UMB: px[x, y] = (0,0,0,0)
            elif d < UMB*2:
                al = int(255*(d-UMB)/UMB)
                px[x, y] = (r, min(g, max(r,b)+30), b, (a*al)//255)
    bb = im.getbbox()
    if bb:
        m = 6
        im = im.crop((max(0,bb[0]-m), max(0,bb[1]-m), min(w,bb[2]+m), min(h,bb[3]+m)))
    LIMITE = 256
    if im.width > LIMITE or im.height > LIMITE:
        f = LIMITE / max(im.width, im.height)
        im = im.resize((int(im.width*f), int(im.height*f)), Image.LANCZOS)
    im.save(f'{BASE}/{nombre}.png')
    # residuo verde
    p = im.load(); op = ve = 0
    for yy in range(0, im.height, 4):
        for xx in range(0, im.width, 4):
            r, g, b, a = p[xx, yy]
            if a > 100:
                op += 1
                if g > 120 and g > r + 40 and g > b + 40: ve += 1
    print(f'OK {nombre}: {im.width}x{im.height}  opacos={op}  verde={ve}')

if __name__ == '__main__':
    for n in sys.argv[1:]:
        procesar(n)
