import sys
import os
from unittest.mock import MagicMock

# --- iOS SANDBOX ARMOR ---
sys.modules['pathops'] = MagicMock()
sys.modules['pyclipper'] = MagicMock()
sys.modules['pyclipper._pyclipper'] = MagicMock()

import defcon
import ufo2ft
from fontTools.ttLib import TTFont

# --- TANTU TYPE PRIMITIVES ---
UPM = 1000
ASCENDER = 900
DESCENDER = -200
CAP_HEIGHT = 700
X_HEIGHT = 500

def init_font(family_name, is_mono=False):
    font = defcon.Font()
    font.info.familyName = family_name
    font.info.unitsPerEm = UPM
    font.info.ascender = ASCENDER
    font.info.descender = DESCENDER
    font.info.capHeight = CAP_HEIGHT
    font.info.xHeight = X_HEIGHT
    if is_mono:
        font.info.postscriptIsFixedPitch = True
    return font

def draw_rect(pen, x, y, w, h):
    pen.moveTo((x, y))
    pen.lineTo((x + w, y))
    pen.lineTo((x + w, y + h))
    pen.lineTo((x, y + h))
    pen.closePath()

def draw_knot(pen, cx, cy, radius=40):
    pen.moveTo((cx - radius, cy))
    pen.lineTo((cx, cy - radius))
    pen.lineTo((cx + radius, cy))
    pen.lineTo((cx, cy + radius))
    pen.closePath()

def build_kasuti_gauze(font):
    T = 80
    glyph_A = font.newGlyph("A")
    glyph_A.width = 600
    pen = glyph_A.getPen()
    draw_rect(pen, 100, 0, T, CAP_HEIGHT)
    draw_rect(pen, 420, 0, T, CAP_HEIGHT)
    draw_rect(pen, 100, CAP_HEIGHT - T, 320 + T, T)
    draw_rect(pen, 100, 300, 320 + T, T)

    glyph_0 = font.newGlyph("zero")
    glyph_0.width = 600
    pen = glyph_0.getPen()
    draw_rect(pen, 100, 0, T, CAP_HEIGHT)
    draw_rect(pen, 420, 0, T, CAP_HEIGHT)
    draw_rect(pen, 100, 0, 320 + T, T)
    draw_rect(pen, 100, CAP_HEIGHT - T, 320 + T, T)
    draw_rect(pen, 260, 300, T, T)

def build_talim_mono(font):
    T = 40
    MONO_WIDTH = 600
    glyph_A = font.newGlyph("A")
    glyph_A.width = MONO_WIDTH
    pen = glyph_A.getPen()
    pen.moveTo((150, 0))
    pen.lineTo((150+T, 0))
    pen.lineTo((300+T, CAP_HEIGHT))
    pen.lineTo((300, CAP_HEIGHT))
    pen.closePath()
    pen.moveTo((450, 0))
    pen.lineTo((450-T, 0))
    pen.lineTo((300-T, CAP_HEIGHT))
    pen.lineTo((300, CAP_HEIGHT))
    pen.closePath()
    draw_rect(pen, 200, 250, 200, T)
    draw_knot(pen, 300, CAP_HEIGHT)
    draw_knot(pen, 220, 250 + T/2)
    draw_knot(pen, 380, 250 + T/2)

def build_kalam_rupa(font):
    glyph_A = font.newGlyph("A")
    glyph_A.width = 650
    pen = glyph_A.getPen()
    pen.moveTo((120, 0))
    pen.curveTo((150, 200), (250, 500), (325, CAP_HEIGHT))
    pen.lineTo((365, CAP_HEIGHT))
    pen.curveTo((300, 500), (200, 200), (180, 0))
    pen.closePath()
    pen.moveTo((530, 0))
    pen.curveTo((510, 200), (420, 500), (325, CAP_HEIGHT))
    pen.lineTo((365, CAP_HEIGHT))
    pen.curveTo((450, 500), (560, 200), (590, 0))
    pen.closePath()
    pen.moveTo((200, 280))
    pen.curveTo((300, 290), (400, 270), (480, 290))
    pen.lineTo((480, 330))
    pen.curveTo((400, 310), (300, 330), (200, 320))
    pen.closePath()

def compile_and_save(font_obj, out_name):
    print(f"[*] Compiling {out_name}...")

    ttf = ufo2ft.compileTTF(font_obj, removeOverlaps=False)
    os.makedirs("fonts", exist_ok=True)

    ttf_path = f"fonts/{out_name}.ttf"
    ttf.save(ttf_path)

    woff_path = f"fonts/{out_name}.woff"
    ttf.flavor = "woff"
    ttf.save(woff_path)

    # Attempt WOFF2 but gracefully swallow the iOS crash if it happens
    try:
        woff2_path = f"fonts/{out_name}.woff2"
        ttf.flavor = "woff2"
        ttf.save(woff2_path)
    except ImportError:
        pass

    # Validate the WOFF file instead of WOFF2 to prevent verification crash
    verify_font = TTFont(woff_path)
    assert 'glyf' in verify_font, "Validation Failed: No glyph data."
    print(f"[+] Successfully built {out_name} (TTF, WOFF)\n")

if __name__ == "__main__":
    print("=== Tantu V0.1 Loom Engine Build ===")

    kasuti = init_font("Kasuti-Gauze")
    build_kasuti_gauze(kasuti)
    compile_and_save(kasuti, "Kasuti-Gauze")

    talim = init_font("Talim-Mono", True)
    build_talim_mono(talim)
    compile_and_save(talim, "Talim-Mono")

    kalam = init_font("Kalam-Rupa")
    build_kalam_rupa(kalam)
    compile_and_save(kalam, "Kalam-Rupa")

    print("=== Build Complete ===")
