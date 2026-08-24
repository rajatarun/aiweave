# aiweave

![AIWeave logo](assets/aiweave-logo.svg)

Brand assets for AIWeave are available in `assets/` and are used by the generated site branding:

- `assets/aiweave-logo.svg` (full logo)
- `assets/aiweave-icon.svg` (icon mark)
- `assets/favicon.svg` (favicon)

## Tantu type primitives

`build.py` generates the three Tantu typefaces (`Kasuti-Gauze`, `Talim-Mono`,
`Kalam-Rupa`) referenced by `--font-*` tokens in `src/tantu/styles/tantu.css`,
into `fonts/*.{ttf,woff,woff2}`. It's a from-scratch geometric type system,
not a derivative of any existing font: every glyph — A–Z, a–z, 0–9, and a
practical symbol set — is authored once as an abstract stroke skeleton (a
straight line or a circular/elliptical arc), and each family renders that
same skeleton its own way: Kasuti rasterizes it into orthogonal blocks
(no diagonals, per the design system's "Kasuti Matrix" rule), Talim threads
it as knotted straight ribbon segments, and Kalam draws it as a smooth
ribbon with slab serifs. Lowercase is the uppercase skeleton scaled to
x-height (a deliberate unicase treatment, not a bug).

```
pip install -r requirements-fonts.txt
python3 build.py                 # writes fonts/
python3 scripts/render_proof.py  # optional: renders a full-glyph-set PNG per family to /tmp, for visual QA
```

These fonts aren't wired into any `@font-face` rule yet — the `--font-*`
tokens still fall back to their IBM Plex stack until that's done.
