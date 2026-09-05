import sys
import os
import shutil
import math

# Reproducible output.
#
# fontTools stamps `head.modified` with the wall clock, so the same skeletons
# produced a byte-different .woff2 on every run — and the .woff2 size moved
# too, because the compressor sees different bytes. That makes any "are the
# committed fonts stale?" check meaningless: it fails whether or not a glyph
# changed, so it gets ignored, and a real staleness then ships unnoticed.
#
# fontTools reads SOURCE_DATE_EPOCH (reproducible-builds.org/specs/source-date-epoch),
# so pinning it makes the build a pure function of the skeletons. An explicit
# value from the environment still wins, which is what a release process would
# set.
os.environ.setdefault("SOURCE_DATE_EPOCH", "1700000000")
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
ADVANCE = 600  # every glyph in every family shares one advance (Talim must be
                # monospace; Kasuti/Kalam just borrow the convention for a
                # consistent, simple V0.1 metric across the whole system).

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

# ---------------------------------------------------------------------------
# LOW-LEVEL PEN PRIMITIVES
#
# Every primitive below winds its contour counter-clockwise. That's the one
# rule that has to hold everywhere: with removeOverlaps=False (pathops is
# mocked out — see "iOS SANDBOX ARMOR" above), overlapping strokes in a
# glyph are never boolean-unioned, they just rely on the nonzero fill rule
# to add up. Same winding direction always adds; opposite winding directions
# would punch a hole wherever two shapes cross. So: CCW, always.
# ---------------------------------------------------------------------------

def draw_rect(pen, x, y, w, h):
    pen.moveTo((x, y))
    pen.lineTo((x + w, y))
    pen.lineTo((x + w, y + h))
    pen.lineTo((x, y + h))
    pen.closePath()

def draw_knot(pen, cx, cy, radius=40):
    # A small diamond, wound CCW (bottom -> right -> top -> left).
    pen.moveTo((cx, cy - radius))
    pen.lineTo((cx + radius, cy))
    pen.lineTo((cx, cy + radius))
    pen.lineTo((cx - radius, cy))
    pen.closePath()

def _perp(dx, dy):
    """Unit normal, rotated 90 degrees clockwise from (dx, dy)."""
    length = math.hypot(dx, dy)
    if length == 0:
        return (0.0, 0.0)
    return (dy / length, -dx / length)

def _tangents(points):
    """Local travel direction at each point of a polyline."""
    n = len(points)
    out = []
    for i in range(n):
        if i == 0:
            dx, dy = points[1][0] - points[0][0], points[1][1] - points[0][1]
        elif i == n - 1:
            dx, dy = points[-1][0] - points[-2][0], points[-1][1] - points[-2][1]
        else:
            dx, dy = points[i + 1][0] - points[i - 1][0], points[i + 1][1] - points[i - 1][1]
        out.append((dx, dy))
    return out

# The Kalam nib. "Kalam" is the reed pen (क़लम / قلم), so the display face is
# modelled as one: a broad nib held at a fixed angle. A broad nib lays down
# its full width only when the stroke travels perpendicular to the nib edge,
# and narrows to a hairline when the stroke runs along it — which is exactly
# where a humanist face's thick/thin modulation comes from, and what the
# spec means by "organic, varied stroke widths."
KALAM_NIB_ANGLE = 30.0   # degrees from horizontal, the classic broad-nib hold
KALAM_NIB_FLOOR = 0.15   # thinnest stroke as a fraction of full nib width;
                         # never 0, or the outline would pinch shut

def nib_width(dx, dy, base, angle_deg=KALAM_NIB_ANGLE, floor=KALAM_NIB_FLOOR):
    """Width the nib projects for a stroke travelling along (dx, dy)."""
    if dx == 0 and dy == 0:
        return base
    theta = math.atan2(dy, dx)
    alpha = math.radians(angle_deg)
    return base * (floor + (1.0 - floor) * abs(math.sin(theta - alpha)))

def draw_ribbon(pen, points, width):
    """Fill a thick polyline through `points`, CCW.

    `width` is either a scalar (a uniform monoline ribbon — Talim's thread)
    or a callable (dx, dy) -> width, evaluated per point against the local
    travel direction, which is how Kalam gets its nib modulation.
    """
    n = len(points)
    if n < 2:
        return
    tangents = _tangents(points)
    if callable(width):
        halves = [width(dx, dy) / 2 for dx, dy in tangents]
    else:
        if width <= 0:
            return
        halves = [width / 2] * n
    normals = [_perp(dx, dy) for dx, dy in tangents]
    left = [(points[i][0] + normals[i][0] * halves[i], points[i][1] + normals[i][1] * halves[i]) for i in range(n)]
    right = [(points[i][0] - normals[i][0] * halves[i], points[i][1] - normals[i][1] * halves[i]) for i in range(n)]
    pen.moveTo(left[0])
    for p in left[1:]:
        pen.lineTo(p)
    for p in reversed(right):
        pen.lineTo(p)
    pen.closePath()

def draw_square_dot(pen, cx, cy, size):
    draw_rect(pen, cx - size / 2, cy - size / 2, size, size)

# ---------------------------------------------------------------------------
# STROKE SKELETONS
#
# Every letterform is authored exactly once, as an abstract "skeleton" of
# strokes — a straight line ('L', x1, y1, x2, y2) or a circular/elliptical
# arc ('A', cx, cy, rx, ry, angle0, angle1), in degrees. The three families
# each turn that same skeleton into outlines their own way (see the three
# stroke_fn implementations below): Kasuti rasterizes it into axis-aligned
# blocks (never a diagonal line — "no diagonals allowed"), Talim threads it
# as straight ribbon segments knotted at every joint, Kalam draws it as a
# smooth ribbon with slab serifs. One drawing, three weavings.
# ---------------------------------------------------------------------------

def sample_stroke(stroke, n=16):
    kind = stroke[0]
    if kind == 'L':
        # Subdivided even though a straight ribbon only needs its two
        # endpoints (extra collinear points don't change that shape) —
        # stroke_kasuti needs the intermediate points to lay down enough
        # overlapping blocks to cover the whole segment.
        _, x1, y1, x2, y2 = stroke
        return [(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n) for i in range(n + 1)]
    if kind == 'A':
        _, cx, cy, rx, ry, a0, a1 = stroke
        pts = []
        for i in range(n + 1):
            t = i / n
            a = math.radians(a0 + (a1 - a0) * t)
            pts.append((cx + rx * math.cos(a), cy + ry * math.sin(a)))
        return pts
    raise ValueError(f"unknown stroke kind {kind!r}")

def _path_length(pts):
    return sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1))

# Glyph box (shared by every letter/digit skeleton below).
xL, xL2, xM, xR2, xR = 110, 220, 300, 380, 490
yB, yQ1, yH, yQ3, yT = 0, 175, 350, 525, 700

L = lambda x1, y1, x2, y2: ('L', x1, y1, x2, y2)
A = lambda cx, cy, rx, ry, a0, a1: ('A', cx, cy, rx, ry, a0, a1)

CAPS = {
    # --- Letters ---------------------------------------------------------
    "A": [L(xL, yB, xM, yT), L(xM, yT, xR, yB), L(180, 230, 420, 230)],
    "B": [
        L(xL, yB, xL, yT),
        A(xL, 530, 300, 170, -90, 90),
        A(xL, 175, 340, 175, -90, 90),
    ],
    "C": [A(300, 350, 190, 350, 40, 320)],
    "D": [L(xL, yB, xL, yT), A(xL, yH, 380, 350, -90, 90)],
    "E": [L(xL, yB, xL, yT), L(xL, yT, 450, yT), L(xL, yH, 400, yH), L(xL, yB, 450, yB)],
    "F": [L(xL, yB, xL, yT), L(xL, yT, 450, yT), L(xL, yH, 400, yH)],
    "G": [A(300, 350, 190, 350, 40, 320), L(445, 125, 445, 300), L(300, 300, 445, 300)],
    "H": [L(xL, yB, xL, yT), L(xR, yB, xR, yT), L(xL, yH, xR, yH)],
    "I": [L(xM, yB, xM, yT)],
    "J": [L(400, yT, 400, 180), A(290, 180, 110, 180, 0, -110)],
    "K": [L(xL, yB, xL, yT), L(xL, yH, xR, yT), L(xL, yH, xR, yB)],
    "L": [L(xL, yB, xL, yT), L(xL, yB, 450, yB)],
    "M": [L(xL, yB, xL, yT), L(xL, yT, xM, 250), L(xM, 250, xR, yT), L(xR, yT, xR, yB)],
    "N": [L(xL, yB, xL, yT), L(xL, yT, xR, yB), L(xR, yB, xR, yT)],
    "O": [A(300, 350, 190, 350, 0, 360)],
    "P": [L(xL, yB, xL, yT), A(xL, 530, 340, 170, -90, 90)],
    "Q": [A(300, 350, 190, 350, 0, 360), L(340, 120, 470, -60)],
    "R": [L(xL, yB, xL, yT), A(xL, 530, 340, 170, -90, 90), L(xL, yH, 480, yB)],
    # Two arcs meeting exactly at (295, 364), spanning the full yB..yT box
    # like O/B/E do. Each sweeps ~230 degrees rather than a clean 180: a
    # half-ellipse would stop dead on the centreline at the apex and nadir,
    # leaving the upper-right and lower-left corners empty and throwing all
    # the weight onto a "\" diagonal, which reads as a tilted S. Carrying
    # each terminal past the apex — to upper-right and lower-left, where a
    # real S puts them — balances it. The junction sits slightly above
    # centre so the upper bowl stays the smaller of the two, as in B/3/8.
    "S": [
        A(295, 532, 172, 168, 270, 40),
        A(295, 182, 190, 182, -130, 90),
    ],
    "T": [L(xL, yT, xR, yT), L(xM, yT, xM, yB)],
    "U": [L(xL, yT, xL, 200), A(300, 200, 190, 200, 180, 360), L(xR, 200, xR, yT)],
    "V": [L(xL, yT, xM, yB), L(xM, yB, xR, yT)],
    "W": [L(xL, yT, 195, yB), L(195, yB, xM, 480), L(xM, 480, 405, yB), L(405, yB, xR, yT)],
    "X": [L(xL, yT, xR, yB), L(xL, yB, xR, yT)],
    "Y": [L(xL, yT, xM, yH), L(xR, yT, xM, yH), L(xM, yH, xM, yB)],
    "Z": [L(xL, yT, xR, yT), L(xR, yT, xL, yB), L(xL, yB, xR, yB)],
    # --- Digits ------------------------------------------------------------
    "zero": [A(300, 350, 190, 350, 0, 360)],
    "one": [L(xM, yB, xM, yT), L(xM, yT, 220, 600), L(220, yB, 380, yB)],
    # The bowl swept -90..90, i.e. bottom -> right -> top, which draws the
    # *right* half of an ellipse and leaves the left half missing: the result
    # read as a mirrored 2. A 2's bowl is the other sweep — it starts at the
    # upper left, runs clockwise over the top and down the right side, then
    # hands off to the diagonal that falls to the baseline.
    "two": [
        A(300, 545, 170, 145, 200, -35),
        L(439, 462, 150, yB),
        L(140, yB, 470, yB),
    ],
    # The upper bowl swept 255 degrees, wrapping so far around the left that
    # it read as a closed loop rather than a 3's open bowl, and a bridging
    # line at x=455 papered over the gap between the two bowls (the same
    # visible-seam artefact that S had). Both bowls now stop at the waist,
    # meeting exactly at (349, 350) — the direction reversal there is the
    # pinch a 3 is supposed to have — so no connector is needed.
    "three": [
        A(295, 520, 165, 180, 165, -71),
        A(295, 180, 165, 180, 71, -165),
    ],
    "four": [L(380, yT, 120, 250), L(120, 250, 460, 250), L(380, yT, 380, yB)],
    "five": [
        L(460, yT, 150, yT),
        L(150, yT, 150, 380),
        A(150, 175, 320, 175, -90, 90),
    ],
    # The spine used to stop at (274, 283), well inside the bowl rather than
    # on its rim, so the two strokes crossed instead of joining. Sharing a
    # centre with the bowl lets the spine land exactly on its leftmost point
    # (145, 180), where both are travelling straight down — a clean tangent
    # join. Same construction as nine, rotated.
    "six": [
        A(305, 180, 160, 520, 60, 180),
        A(305, 180, 160, 175, 0, 360),
    ],
    "seven": [L(120, yT, 470, yT), L(470, yT, 230, yB)],
    "eight": [
        A(300, 515, 155, 170, 0, 360),
        A(300, 180, 175, 175, 0, 360),
    ],
    # As six, rotated 180 degrees: the tail began at (249, 408) inside the
    # bowl; it now leaves the bowl's rightmost point (455, 520) on a shared
    # tangent and falls to a terminal at the lower left.
    "nine": [
        A(295, 520, 160, 520, 240, 360),
        A(295, 520, 160, 175, 0, 360),
    ],
    # --- Symbols -----------------------------------------------------------
    "space": [],
    "period": [L(xM, 20, 301, 20)],
    "comma": [L(290, 60, 240, -70)],
    "colon": [L(xM, 180, 301, 180), L(xM, 420, 301, 420)],
    "semicolon": [L(xM, 420, 301, 420), L(290, 190, 240, 60)],
    "hyphen": [L(160, yH, 440, yH)],
    "underscore": [L(100, -60, 500, -60)],
    "slash": [L(140, yB, 460, yT)],
    "backslash": [L(140, yT, 460, yB)],
    "parenleft": [A(480, yH, 220, 430, 110, 250)],
    "parenright": [A(120, yH, 220, 430, -70, 70)],
    "exclam": [L(xM, 250, xM, yT), L(xM, 20, 301, 20)],
    "question": [
        A(300, 560, 140, 130, -90, 90),
        L(300, 430, 300, 280),
        L(xM, 20, 301, 20),
    ],
    "quotesingle": [L(xM, 600, xM, 720)],
    "quotedbl": [L(250, 600, 250, 720), L(350, 600, 350, 720)],
    "plus": [L(150, yH, 450, yH), L(xM, 200, xM, 500)],
    "equal": [L(150, 270, 450, 270), L(150, 430, 450, 430)],
    "asterisk": [L(xM, 340, xM, 600), L(190, 405, 410, 535), L(190, 535, 410, 405)],
    # "&" descends from an "et" ligature: a closed upper bowl over a larger
    # lower bowl that is open on the right, with the diagonal tail of the
    # "t" crossing out through it to the lower right. The bowls share a
    # centre line and meet exactly at (270, 440); the tail starts on the
    # upper bowl's lower-left quadrant so it reads as one continuous stroke.
    # (The previous skeleton was a free-floating circle, a detached diagonal
    # and an unattached dash — it rendered as a lollipop, not an ampersand.)
    "ampersand": [
        A(270, 565, 118, 125, 0, 360),
        A(270, 225, 160, 215, 90, 375),
        L(187, 477, 490, 50),
    ],
    "at": [A(300, 350, 220, 220, 0, 360), A(320, 340, 90, 90, 0, 340)],
    "numbersign": [L(220, 50, 220, 650), L(380, 50, 380, 650), L(120, 220, 480, 220), L(120, 480, 480, 480)],
    "percent": [A(180, 530, 80, 80, 0, 360), A(420, 170, 80, 80, 0, 360), L(150, yB, 450, yT)],
    "less": [L(420, 600, 180, 350), L(180, 350, 420, 100)],
    "greater": [L(180, 600, 420, 350), L(420, 350, 180, 100)],
    "bracketleft": [L(280, yT, 280, yB), L(280, yT, 420, yT), L(280, yB, 420, yB)],
    "bracketright": [L(320, yT, 320, yB), L(180, yT, 320, yT), L(180, yB, 320, yB)],
}

LETTER_KEYS = [k for k in CAPS if len(k) == 1 and k.isalpha() and k.isupper()]

# ufo2ft builds the cmap strictly from each glyph's `unicodes` list — it does
# NOT infer a codepoint from an AGL-standard glyph name on its own. Leaving
# unicodes unset (or explicitly []) produces a font with an *empty* cmap:
# every glyph still exists and still has outlines, but nothing routes a
# character to it, so a renderer effectively picks glyphs at random. Every
# name below maps back to the exact character it draws.
GLYPH_UNICODE = {
    "space": " ", "period": ".", "comma": ",", "colon": ":", "semicolon": ";",
    "hyphen": "-", "underscore": "_", "slash": "/", "backslash": "\\",
    "parenleft": "(", "parenright": ")", "exclam": "!", "question": "?",
    "quotesingle": "'", "quotedbl": '"', "plus": "+", "equal": "=",
    "asterisk": "*", "ampersand": "&", "at": "@", "numbersign": "#",
    "percent": "%", "less": "<", "greater": ">", "bracketleft": "[",
    "bracketright": "]",
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
}
for _k in LETTER_KEYS:
    GLYPH_UNICODE[_k] = _k
    GLYPH_UNICODE[_k.lower()] = _k.lower()

def scale_skeleton(skeleton, y_scale):
    """Squash a skeleton toward the baseline (cap-height -> x-height)."""
    out = []
    for s in skeleton:
        if s[0] == 'L':
            _, x1, y1, x2, y2 = s
            out.append(('L', x1, y1 * y_scale, x2, y2 * y_scale))
        else:
            _, cx, cy, rx, ry, a0, a1 = s
            out.append(('A', cx, cy * y_scale, rx, ry * y_scale, a0, a1))
    return out

LOWER_SCALE = X_HEIGHT / CAP_HEIGHT

# ---------------------------------------------------------------------------
# FAMILY RENDERERS
# ---------------------------------------------------------------------------

def stroke_kasuti(pen, stroke, size):
    """Rasterize any stroke into overlapping axis-aligned blocks — the
    Kasuti Matrix rule is strictly orthogonal, no diagonals, so every mark
    laid down is a rectangle, even when the skeleton it traces is a diagonal
    line or an arc."""
    pts = sample_stroke(stroke, n=18)
    if _path_length(pts) < size * 0.6:
        draw_square_dot(pen, pts[0][0], pts[0][1], size)
        return
    last = None
    for (x, y) in pts:
        if last is not None and math.hypot(x - last[0], y - last[1]) < size * 0.45:
            continue
        draw_rect(pen, x - size / 2, y - size / 2, size, size)
        last = (x, y)

def stroke_talim(pen, stroke, width):
    """Thread ribbon + a knot at every joint — the connected string-knots
    of a Kashmiri shawl code."""
    pts = sample_stroke(stroke, n=10)
    if _path_length(pts) < width * 0.6:
        draw_knot(pen, pts[0][0], pts[0][1], radius=width * 0.9)
        return
    draw_ribbon(pen, pts, width)
    draw_knot(pen, pts[0][0], pts[0][1], radius=width * 0.55)
    draw_knot(pen, pts[-1][0], pts[-1][1], radius=width * 0.55)

def _serif(pen, p_end, p_next, width):
    dx, dy = p_end[0] - p_next[0], p_end[1] - p_next[1]
    length = math.hypot(dx, dy)
    if length == 0:
        return
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    sw = width * 1.7
    sl = width * 0.5
    x0, y0 = p_end
    x1, y1 = x0 + ux * sl, y0 + uy * sl
    hw = sw / 2
    pen.moveTo((x0 - px * hw, y0 - py * hw))
    pen.lineTo((x1 - px * hw, y1 - py * hw))
    pen.lineTo((x1 + px * hw, y1 + py * hw))
    pen.lineTo((x0 + px * hw, y0 + py * hw))
    pen.closePath()

def stroke_kalam(pen, stroke, width):
    """Reed-nib ribbon with slab serifs at the stroke ends — the display face.

    The ribbon width is not constant: it is what the broad nib projects for
    the local direction of travel (see nib_width), so verticals come out
    full-weight, horizontals thin, and curves swell and taper continuously
    around the bowl. That modulation is the spec's "organic, varied stroke
    widths"; a single scalar width here would make this face a monoline,
    geometrically identical to Talim.
    """
    pts = sample_stroke(stroke, n=24)
    if _path_length(pts) < width * 0.6:
        draw_square_dot(pen, pts[0][0], pts[0][1], width * 1.2)
        return
    draw_ribbon(pen, pts, lambda dx, dy: nib_width(dx, dy, width))
    # Serifs pick up the nib width of the stroke they cap, so a thin
    # horizontal terminal doesn't sprout a full-weight slab.
    for end, nxt in ((pts[0], pts[1]), (pts[-1], pts[-2])):
        _serif(pen, end, nxt, nib_width(end[0] - nxt[0], end[1] - nxt[1], width))

def build_family(family_name, stroke_fn, weight, is_mono=False):
    font = init_font(family_name, is_mono=is_mono)
    for name, skeleton in CAPS.items():
        glyph = font.newGlyph(name)
        glyph.width = ADVANCE
        glyph.unicodes = [ord(GLYPH_UNICODE[name])]
        pen = glyph.getPen()
        for stroke in skeleton:
            stroke_fn(pen, stroke, weight)
    for upper in LETTER_KEYS:
        lower = upper.lower()
        glyph = font.newGlyph(lower)
        glyph.width = ADVANCE
        glyph.unicodes = [ord(GLYPH_UNICODE[lower])]
        pen = glyph.getPen()
        for stroke in scale_skeleton(CAPS[upper], LOWER_SCALE):
            stroke_fn(pen, stroke, weight)
    return font

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
    n_glyphs = len(verify_font.getGlyphOrder())
    print(f"[+] Successfully built {out_name} ({n_glyphs} glyphs; TTF, WOFF)")

    # The package needs its own copy: npm can only publish files inside the
    # package directory, and the brand layer references them relatively.
    os.makedirs(PKG_FONT_DIR, exist_ok=True)
    for ext in ("woff2", "woff"):
        src = f"fonts/{out_name}.{ext}"
        if os.path.exists(src):
            shutil.copyfile(src, os.path.join(PKG_FONT_DIR, f"{out_name}.{ext}"))

    covered = sorted(TTFont(woff_path).getBestCmap().keys())
    print(f"    {len(covered)} codepoints mapped; range {unicode_range(covered)}\n")
    return covered


# ---------------------------------------------------------------------------
# THE BRAND LAYER
#
# Tantu's stylesheet names no typeface. Its components bind to *roles* —
# display, mono, meta, body — and the roles resolve to stacks the reader's
# machine already has. That is the whole system, and it works with no font
# files at all.
#
# This file is the optional layer that rebinds those roles to the Tantu faces,
# and it is generated rather than written because one thing in it has to be
# derived rather than asserted: `unicode-range`. These faces cover Latin,
# digits and punctuation and nothing else. Without the range the browser tries
# them for every codepoint and falls back per glyph, so a line of Devanagari
# with a Latin word in it renders in two typefaces at two optical sizes. With
# it, the browser never reaches for a face that cannot set the text — the
# "don't use them if they aren't ready" rule enforced per character, by the
# engine, rather than by a note in the docs.
# ---------------------------------------------------------------------------

PKG_FONT_DIR = "src/tantu/fonts"
PKG_STYLE_DIR = "src/tantu/styles"

def unicode_range(codepoints):
    """Collapse a sorted codepoint list into CSS `unicode-range` syntax."""
    spans, start, prev = [], None, None
    for cp in codepoints:
        if start is None:
            start = prev = cp
        elif cp == prev + 1:
            prev = cp
        else:
            spans.append((start, prev))
            start = prev = cp
    if start is not None:
        spans.append((start, prev))
    return ", ".join(
        f"U+{a:04X}" if a == b else f"U+{a:04X}-{b:04X}" for a, b in spans
    )


BRAND_LAYER_HEADER = """/**
 * Tantu brand typefaces — OPTIONAL.
 *
 * GENERATED by build.py. Do not edit; run `npm run build:fonts`.
 *
 * Importing `@weaveaijs/tantu/styles.css` gets you the whole design system with
 * no font files and no network requests: the type roles resolve to stacks
 * every machine already has. Import this file *as well* to rebind those roles
 * to the three Tantu faces:
 *
 *     import "@weaveaijs/tantu/styles.css";
 *     import "@weaveaijs/tantu/fonts.css";   // optional
 *
 * The faces are deliberately not the default. They are unicase, they cover
 * Latin only, and they are still being corrected — so a consumer opts into
 * them knowingly rather than inheriting them and discovering the limits
 * later. Nothing in the system depends on them; they change how it looks, not
 * how it works.
 *
 * `unicode-range` below is computed from each font's real cmap, so the
 * browser will not select a Tantu face for a codepoint it cannot set. Text in
 * a script these faces do not cover renders wholly in the fallback rather
 * than in a mix of two.
 */
"""


def write_brand_layer(coverage):
    os.makedirs(PKG_STYLE_DIR, exist_ok=True)
    parts = [BRAND_LAYER_HEADER]

    for family, codepoints in coverage.items():
        parts.append(
            f"""
@font-face {{
  font-family: "{family}";
  src: url("../fonts/{family}.woff2") format("woff2"),
       url("../fonts/{family}.woff") format("woff");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  unicode-range: {unicode_range(codepoints)};
}}
"""
        )

    parts.append(
        """
/* Rebind the roles. A consumer who wants only one of the three can copy the
   line they want instead of importing this file. */
:root {
  --tantu-font-display: "Kalam-Rupa", var(--tantu-font-display-fallback);
  --tantu-font-mono: "Talim-Mono", var(--tantu-font-mono-fallback);
  --tantu-font-meta: "Kasuti-Gauze", var(--tantu-font-meta-fallback);
}
"""
    )
    path = os.path.join(PKG_STYLE_DIR, "fonts.css")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("".join(parts))
    print(f"[+] Wrote {path}")


if __name__ == "__main__":
    print("=== Tantu V0.1 Loom Engine Build ===")

    coverage = {}

    kasuti = build_family("Kasuti-Gauze", stroke_kasuti, weight=78)
    coverage["Kasuti-Gauze"] = compile_and_save(kasuti, "Kasuti-Gauze")

    talim = build_family("Talim-Mono", stroke_talim, weight=44, is_mono=True)
    coverage["Talim-Mono"] = compile_and_save(talim, "Talim-Mono")

    # Base = the nib's FULL width, reached only on strokes running square to
    # the nib; most strokes render lighter, so this sits above the old
    # monoline 56 to keep the stems' visual weight.
    kalam = build_family("Kalam-Rupa", stroke_kalam, weight=70)
    coverage["Kalam-Rupa"] = compile_and_save(kalam, "Kalam-Rupa")

    write_brand_layer(coverage)

    print("=== Build Complete ===")
