"""Verify each Tantu family against the design spec's testable claims.

Spec (Tantu Architecture Spec V3.0, section 2 "Typographic Engine"):
  Talim Script  — "Simulates connected string knots based on Kashmiri shawl coding."
  Kalam Rupa    — "Continuous variable display for headers. Organic, varied stroke widths."
  Kasuti Matrix — "Strictly orthogonal metadata rendering. No diagonals allowed."

QA only; not part of the font build.
"""
import math
from collections import Counter
from fontTools.ttLib import TTFont

LETTERS = [chr(c) for c in range(ord("A"), ord("Z") + 1)]
DIGITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]


def contours(glyph, glyf):
    """Yield each contour as a list of (x, y) points."""
    if glyph.numberOfContours <= 0:
        return
    coords = list(glyph.coordinates)
    start = 0
    for end in glyph.endPtsOfContours:
        yield coords[start:end + 1]
        start = end + 1


def edges(contour):
    """Yield each edge (p0, p1) of a closed contour."""
    n = len(contour)
    for i in range(n):
        yield contour[i], contour[(i + 1) % n]


def check_orthogonal(path, names):
    """Kasuti: every edge must be axis-aligned (horizontal or vertical)."""
    font = TTFont(path)
    glyf = font["glyf"]
    total = 0
    diagonal = 0
    worst = []
    for name in names:
        if name not in glyf:
            continue
        for contour in contours(glyf[name], glyf):
            for (x0, y0), (x1, y1) in edges(contour):
                dx, dy = abs(x1 - x0), abs(y1 - y0)
                if dx == 0 and dy == 0:
                    continue
                total += 1
                # Axis-aligned means one component is exactly zero.
                if dx != 0 and dy != 0:
                    diagonal += 1
                    worst.append((name, (x0, y0), (x1, y1)))
    return total, diagonal, worst[:5]


def stroke_contrast(path):
    """Kalam: measure stroke contrast the way type design does — the ratio of
    O's side stems to its top/bottom arches.

    NB: a naive "spread of ink run-lengths" statistic does NOT work here. It
    is dominated by scanlines crossing diagonals and joins at an angle, so it
    scores a monoline face and a modulated one almost identically (Talim and
    an early monoline Kalam both landed at cv≈0.30, while genuinely modulated
    DejaVu Serif scored *lower* at 0.24). The O-contrast ratio separates them
    cleanly because both measurements are taken perpendicular to the stroke.
    """
    import freetype
    face = freetype.Face(path)
    face.set_pixel_sizes(0, 300)
    face.load_char("O", freetype.FT_LOAD_RENDER)
    b = face.glyph.bitmap
    w, h, buf = b.width, b.rows, bytes(b.buffer)
    if not w or not h:
        return 0.0, 0.0, 0.0

    def scan(fixed, along, horizontal):
        runs, run = [], 0
        for i in range(along):
            lit = buf[fixed * w + i] > 128 if horizontal else buf[i * w + fixed] > 128
            if lit:
                run += 1
            else:
                if run:
                    runs.append(run)
                run = 0
        if run:
            runs.append(run)
        return sum(runs) / len(runs) if runs else 0

    side = scan(h // 2, w, True)    # crosses the left/right stems
    arch = scan(w // 2, h, False)   # crosses the top/bottom arches
    return side, arch, (side / arch if arch else 0)


def count_knots(path, names):
    """Talim: knots are drawn as small diamonds — 4-point contours whose
    edges are all diagonal (the diamond is rotated 45 degrees)."""
    font = TTFont(path)
    glyf = font["glyf"]
    knots = 0
    glyphs_with_knots = 0
    for name in names:
        if name not in glyf:
            continue
        found = 0
        for contour in contours(glyf[name], glyf):
            if len(contour) != 4:
                continue
            xs = [p[0] for p in contour]
            ys = [p[1] for p in contour]
            cx, cy = sum(xs) / 4, sum(ys) / 4
            # A diamond has each vertex offset from the centre along exactly
            # one axis.
            if all(
                (abs(x - cx) < 1) != (abs(y - cy) < 1)
                for x, y in contour
            ):
                found += 1
        knots += found
        if found:
            glyphs_with_knots += 1
    return knots, glyphs_with_knots


def stats(values):
    if not values:
        return None
    values = sorted(values)
    n = len(values)
    mean = sum(values) / n
    var = sum((v - mean) ** 2 for v in values) / n
    return {
        "n": n,
        "min": values[0],
        "max": values[-1],
        "mean": round(mean, 1),
        "stdev": round(math.sqrt(var), 2),
        "cv": round(math.sqrt(var) / mean, 3) if mean else 0,
        "distinct": len(set(values)),
        "common": Counter(values).most_common(5),
    }


if __name__ == "__main__":
    names = LETTERS + DIGITS

    print("=" * 68)
    print('KASUTI-GAUZE — spec: "Strictly orthogonal. No diagonals allowed."')
    print("=" * 68)
    total, diag, worst = check_orthogonal("fonts/Kasuti-Gauze.ttf", names)
    print(f"  edges checked : {total}")
    print(f"  diagonal edges: {diag}")
    print(f"  VERDICT       : {'PASS' if diag == 0 else 'FAIL'}")
    for w in worst:
        print(f"    e.g. {w[0]}: {w[1]} -> {w[2]}")

    print()
    print("=" * 68)
    print('TALIM-MONO — spec: "connected string knots (Kashmiri shawl coding)"')
    print("=" * 68)
    knots, gl = count_knots("fonts/Talim-Mono.ttf", names)
    print(f"  knot contours found: {knots}")
    print(f"  glyphs carrying knots: {gl}/{len(names)}")
    print(f"  VERDICT: {'PASS' if gl >= len(names) * 0.9 else 'FAIL'}")

    print()
    print("=" * 68)
    print('KALAM-RUPA — spec: "Organic, VARIED stroke widths"')
    print("=" * 68)
    rows = [
        ("fonts/Kalam-Rupa.ttf", "Kalam-Rupa (must be modulated)"),
        ("fonts/Talim-Mono.ttf", "Talim-Mono (must stay monoline)"),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", "  ref: DejaVu Serif (modulated)"),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", "  ref: DejaVu Mono (monoline)"),
    ]
    kalam_ratio = talim_ratio = 0
    for path, label in rows:
        try:
            side, arch, ratio = stroke_contrast(path)
            print(f"  {label:34s} side={side:5.1f} arch={arch:5.1f} contrast={ratio:.2f}")
            if "Kalam-Rupa (" in label:
                kalam_ratio = ratio
            if "Talim-Mono (" in label:
                talim_ratio = ratio
        except Exception as e:
            print(f"  {label:34s} unavailable ({e})")
    print(f"  VERDICT Kalam modulated : "
          f"{'PASS' if kalam_ratio > 1.4 else 'FAIL — effectively monoline'}")
    print(f"  VERDICT Talim monoline  : "
          f"{'PASS' if talim_ratio < 1.3 else 'FAIL — unexpectedly modulated'}")
