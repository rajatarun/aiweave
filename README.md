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
npm run build:fonts               # writes fonts/ (python3 build.py)
python3 scripts/render_proof.py   # optional: renders a full-glyph-set PNG per family to /tmp, for visual QA
```

`generate_site.jsx` registers all three via `@font-face`, pointing at
`fonts/*.woff2`/`.woff`; the `--font-*` tokens already name these families
first in their stacks, so the browser prefers them over the IBM Plex
fallback automatically. `fonts/` is committed like any other build
output (same as `assets/capillary-bleed.js` and `index.html` itself) —
`npm run build:fonts` isn't chained into the default `npm run build`
because it needs Python, not just Node; re-run it by hand whenever a
glyph changes, then `npm run build` to regenerate the site against the
new files.
