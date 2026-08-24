import sys
import freetype
from PIL import Image, ImageDraw

def render_zoom(font_path, chars, out_path, px=200, cols=6):
    face = freetype.Face(font_path)
    face.set_pixel_sizes(0, px)
    cell = int(px * 1.5)
    rows = (len(chars) + cols - 1) // cols
    sheet = Image.new("L", (cell * cols, cell * rows), color=255)
    draw = ImageDraw.Draw(sheet)
    for idx, ch in enumerate(chars):
        col, row = idx % cols, idx // cols
        ox, oy = col * cell, row * cell
        draw.rectangle([ox, oy, ox + cell - 1, oy + cell - 1], outline=200)
        face.load_char(ch, freetype.FT_LOAD_RENDER)
        bmp = face.glyph.bitmap
        if bmp.width and bmp.rows:
            glyph_img = Image.frombytes("L", (bmp.width, bmp.rows), bytes(bmp.buffer), "raw", "L", 0, 1)
            glyph_img = Image.eval(glyph_img, lambda p: 255 - p)
            px_pos = ox + 10 + face.glyph.bitmap_left
            py_pos = oy + cell - 50 - face.glyph.bitmap_top
            sheet.paste(glyph_img, (px_pos, py_pos), Image.eval(glyph_img, lambda p: 255 - p))
    sheet.save(out_path)
    print(f"[zoom] {out_path}")

if __name__ == "__main__":
    font_path, chars, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    render_zoom(font_path, chars, out_path)
