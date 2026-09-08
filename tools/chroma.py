#!/usr/bin/env python3
"""Chroma-key de sprites: fondo #00FF00 -> transparente, despill verde,
recorte al contenido -+ margen, exporta 256px."""
import sys, os
from PIL import Image

def procesar(src, dst):
    im = Image.open(src).convert('RGBA')
    px = im.load()
    w, h = im.size
    # Muestrear el verde del fondo desde las esquinas
    esquinas = [px[0,0], px[w-1,0], px[0,h-1], px[w-1,h-1]]
    gr = sum(c[0] for c in esquinas)//4; gg = sum(c[1] for c in esquinas)//4; gb = sum(c[2] for c in esquinas)//4
    UMBRAL = 95
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            dist = abs(r-gr) + abs(g-gg) + abs(b-gb)
            if dist < UMBRAL:
                px[x, y] = (0, 0, 0, 0)
            elif dist < UMBRAL * 2:
                # borde: transición suave + despill (quitar exceso de verde)
                alpha = int(255 * (dist - UMBRAL) / UMBRAL)
                g2 = min(g, max(r, b) + 30)
                px[x, y] = (r, g2, b, (a * alpha) // 255)
    # Recortar al contenido visible
    bbox = im.getbbox()
    if bbox:
        margen = 12
        x0 = max(0, bbox[0]-margen); y0 = max(0, bbox[1]-margen)
        x1 = min(im.width, bbox[2]+margen); y1 = min(im.height, bbox[3]+margen)
        im = im.crop((x0, y0, x1, y1))
    # Estandarizar a 256px cuadrados (centrado, sin deformar)
    lado = max(im.width, im.height)
    lienco = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    lienco.paste(im, ((lado - im.width)//2, (lado - im.height)//2), im)
    lienco = lienco.resize((256, 256), Image.LANCZOS)
    lienco.save(dst)
    print(f'OK {src} -> {dst} ({im.width}x{im.height} recortado)')

if __name__ == '__main__':
    base = '/home/user/sho-v2/assets/sprites'
    for nombre in ['lobo', 'murcielago', 'nomuerto', 'duende', 'mago']:
        procesar(f'{base}/raw_{nombre}.png', f'{base}/{nombre}.png')
