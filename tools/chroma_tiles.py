#!/usr/bin/env python3
"""Chroma de tiles deco (árbol/flor/roca): verde -> alfa, despill, recorte.
NO cuadra a lienzo: cada sprite conserva su proporción y se reporta su tamaño."""
from PIL import Image

def procesar(src, dst):
    im = Image.open(src).convert('RGBA')
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
    # tope razonable (pero manteniendo proporción)
    LIMITE = 256
    if im.width > LIMITE or im.height > LIMITE:
        f = LIMITE / max(im.width, im.height)
        im = im.resize((int(im.width*f), int(im.height*f)), Image.LANCZOS)
    im.save(dst)
    print(f'OK {dst}  {im.width}x{im.height}')

for n in ['arbol', 'flor', 'roca']:
    procesar(f'/home/user/sho-v2/assets/tiles/raw_{n}.png', f'/home/user/sho-v2/assets/tiles/{n}.png')
