#!/usr/bin/env python3
"""Generate Tab Alcove PNG icons (16, 48, 128px).

Design: amber rounded square + white arch (alcove) with two tab lines inside.
The arch directly represents an architectural alcove/niche.
"""
import struct, zlib, os, math

AMBER     = (196,  86,  28, 255)  # --accent #c4561c
WHITE     = (255, 255, 255, 220)
WHITE_DIM = (255, 255, 255, 130)


def make_png(size):
    img = [[(0, 0, 0, 0)] * size for _ in range(size)]

    # ── helpers ──────────────────────────────────────────────────────────
    def set_px(x, y, color):
        if 0 <= x < size and 0 <= y < size and img[y][x][3] > 0:
            img[y][x] = color

    def fill_rect(x0, y0, x1, y1, color):
        for ry in range(max(0, y0), min(size, y1)):
            for rx in range(max(0, x0), min(size, x1)):
                set_px(rx, ry, color)

    # ── background: amber rounded square ─────────────────────────────────
    pad = max(1, round(size * 0.08))
    r   = max(2, round(size * 0.18))

    for y in range(size):
        for x in range(size):
            dx = max(0, pad + r - x, x - (size - pad - r - 1))
            dy = max(0, pad + r - y, y - (size - pad - r - 1))
            if dx * dx + dy * dy <= r * r:
                img[y][x] = AMBER

    # ── arch / alcove icon ────────────────────────────────────────────────
    # Content box inside the background square
    m  = max(2, round(size * 0.20))   # margin from bg edge to icon
    s  = max(1, round(size * 0.11))   # stroke thickness

    x0, x1 = m, size - m
    y0, y1 = m, size - m

    # Arch: top bar + two side pillars (open at bottom = alcove entrance)
    fill_rect(x0,         y0,      x1,      y0 + s,  WHITE)   # top bar
    fill_rect(x0,         y0,      x0 + s,  y1,      WHITE)   # left pillar
    fill_rect(x1 - s,     y0,      x1,      y1,      WHITE)   # right pillar

    # Rounded inner corners where top bar meets pillars (soften the arch join)
    corner_r = max(1, s)
    for ry in range(y0, y0 + corner_r + 1):
        for rx in range(x0 + s, x0 + s + corner_r + 1):
            dist = math.hypot(rx - (x0 + s), ry - (y0 + s))
            if dist <= corner_r and img[ry][rx][3] > 0:
                img[ry][rx] = AMBER  # carve inner corner
        for rx in range(x1 - s - corner_r, x1 - s):
            dist = math.hypot(rx - (x1 - s), ry - (y0 + s))
            if dist <= corner_r and img[ry][rx][3] > 0:
                img[ry][rx] = AMBER

    # Tab lines inside the arch
    ix0 = x0 + s + max(1, round(s * 0.6))
    ix1 = x1 - s - max(1, round(s * 0.6))
    iy0 = y0 + s + max(1, round(s * 0.5))
    iy1 = y1

    ih       = iy1 - iy0
    line_h   = max(1, round(size * 0.07))
    gap      = max(line_h + 1, round(ih * 0.28))

    if ih > line_h * 2 + gap:
        # Line 1 – full inner width, bright
        ly1 = iy0 + round(ih * 0.30)
        fill_rect(ix0, ly1, ix1, ly1 + line_h, WHITE)

        # Line 2 – slightly shorter, dimmer (suggests depth / more tabs)
        ly2 = ly1 + gap
        if ly2 + line_h <= iy1:
            short = round((ix1 - ix0) * 0.65)
            fill_rect(ix0, ly2, ix0 + short, ly2 + line_h, WHITE_DIM)

    # ── PNG encode ────────────────────────────────────────────────────────
    def pack_chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    rows = b''.join(
        bytes([0]) + b''.join(bytes([r, g, b, a]) for r, g, b, a in row)
        for row in img
    )
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)

    return (
        b'\x89PNG\r\n\x1a\n'
        + pack_chunk(b'IHDR', ihdr)
        + pack_chunk(b'IDAT', zlib.compress(rows, 9))
        + pack_chunk(b'IEND', b'')
    )


script_dir = os.path.dirname(os.path.abspath(__file__))
for sz in (16, 48, 128):
    path = os.path.join(script_dir, f'icon{sz}.png')
    with open(path, 'wb') as f:
        f.write(make_png(sz))
    print(f'Created {path}  ({sz}×{sz})')
