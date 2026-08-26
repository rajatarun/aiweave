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

## Bleed architecture

Several Tantu components wick dye, and each one used to answer pointer
gestures on its own. Composed, they multiplied: a bleeding `TantuButton`
inside a `CapillaryBleedSurface` over the loom substrate is three dye fronts
for one press, none aware of the others — and the largest, longest one wins
the eye, which is backwards, since the innermost is what actually answers
the press. `src/tantu/lib/bleed-bus.ts` arbitrates so that **one gesture
produces one dye front**.

Responders declare a **layer**. The innermost registered owner of whatever
was touched answers; everything else stands down for that gesture.

| Layer | Who | Answers |
| --- | --- | --- |
| `substrate` | loom ground (`TantuBleedCanvas`) | only gestures nothing else owns |
| `surface` | `CapillaryBleedSurface` | presses inside its own region |
| `control` | `TantuButton` | presses on the control itself |
| `narrative` | `ChambaRumalCard` flip | the action it *is* the response to; also mutes ambient while it runs |

Ownership is by **registration, not listener order** — which matters because
the participants do not all listen to the same event (the substrate reacts to
`pointerdown`, a card flip starts on `click`), so an ordering-based scheme
would let the substrate fire before the card could claim the gesture.

```tsx
// A component that dyes on its own behalf:
useEffect(() => registerBleedNode(hostRef.current, "surface"), []);
// ...then, before emitting:
if (!shouldBleed(event.nativeEvent, "surface")) return;

// Static markup / many instances:
registerBleedSelector(".tantu-rumal-flip", "narrative");

// A bleed that owns the moment while it plays:
const release = holdAmbientBleed();   // ambient layers stay dry
// ...call release() when the front stops moving.
```

### The wick law

How far the wet front has travelled is one shared function, `wickProgress`,
used by both the CSS-driven fronts and the GLSL shader so they cannot drift.

Dye advancing through a porous medium follows the **Lucas–Washburn law**,
L ∝ √t. The system previously grew fronts as `1 − e^(−kt)`, which is a
*saturation* curve — right for how wet one point becomes as dye pools there,
wrong for where the front has reached. Driving a radius with it stalls the
edge: measured against its own peak speed, an exponential front is 92%
stopped by t=0.75 and 95% by t=0.90, so the back half of the animation is
dead air. Washburn holds ~22% of peak speed all the way to the end, which is
the gradual, still-travelling slowdown real cloth shows.

`WICK_T0` regularises the start (pure Washburn has infinite speed at t=0;
cloth has an inertial regime first). `WICK_ANISOTROPY` stretches the front
along warp and weft, because cloth conducts along its threads faster than on
the bias — so fronts are ellipses, not circles.

`shouldBleed` is also the single reduced-motion gate, so every responder
honours it identically. It is policy only — it never touches the shader;
`capillary-bleed.ts` stays pure mechanism (one shared WebGL context for the
whole page, see its header).

Adding a bleed-enabled component means registering it at a layer. Nothing
else in the system needs to learn about it.

```
node scripts/verify_bleed_bus.mjs   # arbitration matrix, runs on the built asset
```
