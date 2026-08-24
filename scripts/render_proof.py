"""Render a glyph proof sheet for each built font, for visual QA only.
Not part of the font build itself."""
import freetype
from PIL import Image, ImageDraw

CHARS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ") + list("abcdefghijklmnopqrstuvwxyz") + \
    list("0123456789") + list(" .,:;-_/\\()!?'\"+=*&@#%<>[]")

def render_sheet(font_path, out_path, px=64, cols=16):
    face = freetype.Face(font_path)
    face.set_pixel_sizes(0, px)
    cell = int(px * 1.6)
    rows = (len(CHARS) + cols - 1) // cols
    sheet = Image.new("L", (cell * cols, cell * rows), color=255)
    draw = ImageDraw.Draw(sheet)
    for idx, ch in enumerate(CHARS):
        col, row = idx % cols, idx // cols
        ox, oy = col * cell, row * cell
        draw.rectangle([ox, oy, ox + cell - 1, oy + cell - 1], outline=200)
        try:
            face.load_char(ch, freetype.FT_LOAD_RENDER)
        except Exception as e:
            draw.text((ox + 4, oy + 4), "ERR", fill=0)
            print(f"  ! failed to render {ch!r}: {e}")
            continue
        bmp = face.glyph.bitmap
        if bmp.width == 0 or bmp.rows == 0:
            continue  # space, etc.
        glyph_img = Image.frombytes("L", (bmp.width, bmp.rows), bytes(bmp.buffer), "raw", "L", 0, 1)
        glyph_img = Image.eval(glyph_img, lambda p: 255 - p)
        px_pos = ox + 6 + face.glyph.bitmap_left
        py_pos = oy + cell - 20 - face.glyph.bitmap_top
        sheet.paste(glyph_img, (px_pos, py_pos), Image.eval(glyph_img, lambda p: 255 - p))
    sheet.save(out_path)
    print(f"[proof] {out_path}")

if __name__ == "__main__":
    import sys
    for name in ["Kasuti-Gauze", "Talim-Mono", "Kalam-Rupa"]:
        render_sheet(f"fonts/{name}.ttf", f"/tmp/proof-{name}.png")
