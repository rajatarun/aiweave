import sys
import freetype
from PIL import Image, ImageDraw

def render_line(font_path, text, out_path, px=72):
    face = freetype.Face(font_path)
    face.set_pixel_sizes(0, px)
    slots = []
    pen_x = 0
    max_top = 0
    max_below = 0
    for ch in text:
        face.load_char(ch, freetype.FT_LOAD_RENDER)
        g = face.glyph
        bmp = g.bitmap
        # FreeType reuses one glyph-slot buffer across load_char calls, so
        # the bitmap must be copied out (as a real image) right now — not
        # stored as a reference for later, or every slot ends up showing
        # whatever glyph was loaded last.
        if bmp.width and bmp.rows:
            glyph_img = Image.frombytes("L", (bmp.width, bmp.rows), bytes(bmp.buffer), "raw", "L", 0, 1).copy()
        else:
            glyph_img = None
        slots.append((pen_x, g.bitmap_left, g.bitmap_top, bmp.rows, glyph_img))
        max_top = max(max_top, g.bitmap_top)
        max_below = max(max_below, bmp.rows - g.bitmap_top)
        pen_x += g.advance.x >> 6
    width = pen_x + 40
    height = max_top + max_below + 40
    img = Image.new("L", (width, height), 255)
    for (px0, bl, bt, rows, glyph_img) in slots:
        if glyph_img is None:
            continue
        glyph_img = Image.eval(glyph_img, lambda p: 255 - p)
        x = 20 + px0 + bl
        y = 20 + max_top - bt
        img.paste(glyph_img, (x, y), Image.eval(glyph_img, lambda p: 255 - p))
    img.save(out_path)
    print(f"[text] {out_path}")

if __name__ == "__main__":
    render_line(sys.argv[1], sys.argv[2], sys.argv[3])
