#!/usr/bin/env python3
"""Genera los iconos PWA (192, 512, 512 maskable, 180 apple-touch) a partir
del sprite chibi de kaito sobre fondo oscuro con borde dorado."""
import os
from PIL import Image, ImageDraw

BASE = '/home/user/sho-v2'
kaito = Image.open(f'{BASE}/assets/chars/kaito.png').convert('RGBA')
os.makedirs(f'{BASE}/assets/ui', exist_ok=True)

def icono(tam, maskable=False, salida=None):
    im = Image.new('RGBA', (tam, tam), (10, 10, 26, 255))
    # zona segura: 10% o 20% si es maskable (puede recortarse con máscaras circulares)
    margen = int(tam * (0.20 if maskable else 0.06))
    lado = tam - margen * 2
    sp = kaito.resize((lado, lado), Image.LANCZOS)
    im.paste(sp, (margen, margen), sp)
    # borde dorado exterior
    d = ImageDraw.Draw(im)
    b = max(4, tam // 64)
    for i in range(b):
        d.rectangle([i, i, tam - 1 - i, tam - 1 - i], outline=(255, 215, 0, 255))
    im.save(salida)
    print('OK', salida)

icono(192, False, f'{BASE}/assets/ui/icon-192.png')
icono(512, False, f'{BASE}/assets/ui/icon-512.png')
icono(512, True,  f'{BASE}/assets/ui/icon-512-maskable.png')
icono(192, False, f'{BASE}/assets/ui/apple-touch-icon.png')  # 180 recomendado por Apple
print('iconos listos')
