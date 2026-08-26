# aiweave

![AIWeave logo](assets/aiweave-logo.svg)

Brand assets for AIWeave are available in `assets/` and are used by the generated site branding:

- `assets/aiweave-logo.svg` (full logo)
- `assets/aiweave-icon.svg` (icon mark)
- `assets/favicon.svg` (favicon)

## Tantu type primitives

`build.py` generates the three Tantu typefaces (`Kasuti-Gauze`, `Talim-Mono`,
`Kalam-Rupa`). They are an **optional layer** — the design system names no
typeface and works without them; see *Fonts are decoupled from the system*
below. It's a from-scratch geometric type system,
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
npm run build:fonts               # python3 build.py
python3 scripts/render_proof.py   # optional: a full-glyph-set PNG per family, for visual QA
```

`npm run build:fonts` writes four things:

| Output | For |
|---|---|
| `fonts/*.{ttf,woff,woff2}` | the aiweave site, uploaded to S3 by the deploy workflow |
| `src/tantu/fonts/*.{woff,woff2}` | the npm package — npm can only publish files inside the package directory |
| `src/tantu/styles/fonts.css` | the opt-in brand layer: `@font-face` plus the role rebind |
| — | a `unicode-range` in that CSS, computed from each font's real cmap |

That last row is why the brand layer is generated rather than written. Without
the range the browser tries a Tantu face for every codepoint and falls back per
glyph, so a line of Devanagari with a Latin word in it renders in two typefaces
at two optical sizes.

The build is **byte-reproducible** — `SOURCE_DATE_EPOCH` is pinned, because
fontTools otherwise stamps `head.modified` with the wall clock and the same
skeletons produce a different `.woff2` every run. That matters for more than
tidiness: CI checks that the committed output still matches what `build.py`
produces, and a check that fails whether or not anything changed is a check
everyone learns to ignore.

Both output directories are committed like any other build artefact (same as
`assets/capillary-bleed.js` and `index.html`). `build:fonts` is not chained
into `npm run build` because it needs Python, not just Node; re-run it by hand
whenever a glyph changes.

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

## Verification

`npm run verify` is the whole chain, and it is exactly what CI runs on every
push and pull request:

```
npm run verify
```

| Step | What it establishes |
| --- | --- |
| `npm run typecheck` | The library and its tests compile under bundler resolution. |
| `npm run test` | 213 tests — see below. |
| `npm run audit:a11y` | 58 real component colour pairings against WCAG 1.4.3 / 1.4.11, computed from the resolved tokens in both themes. |
| `npm run audit:bleed` | The bleed arbitration matrix, run against the *compiled* browser asset. |
| `npm run build` | The site renders under `renderToStaticMarkup` with real content. |
| `npm run audit:browser` | 16 checks that need a real engine — layout, cascade, forced colours, reduced motion, WebGL context count. |

`npm run audit:fonts` is separate because it needs Python; CI runs it in its
own job, alongside a check that the committed `fonts/` still match what
`build.py` produces.

### The test suite

`tests/fixtures.tsx` holds one realistic specimen of every exported component,
and `tests/surface.test.ts` fails if the two lists ever diverge — so adding a
component to `index.ts` without adding a specimen is a test failure, not a
silent gap in coverage. Everything else sweeps that one list:

- **`a11y.test.tsx`** — axe-core over all 47 components × 2 themes × 2
  writing directions. Page-level rules are disabled (the harness is not a
  page); colour contrast is disabled here and audited properly in
  `audit_a11y.mjs`, because jsdom has no cascade to resolve a real colour
  from.
- **`ssr.test.tsx`** — every component rendered with `window`, `document` and
  `navigator` genuinely deleted, not merely undefined, so a `typeof window`
  guard passes and a `window?.foo` guard does not.
- **`keyboard.test.tsx`** — the WAI-ARIA composite-widget contract, including
  the RTL arrow reversal, plus a guard that the page-level Maku shuttle never
  takes a key a component wanted.
- **`dialog.test.tsx`** — focus containment, accessible name, focus
  restoration.
- **`bleed.test.ts`** — that `wickProgress` really is Lucas–Washburn and not a
  curve that merely starts at 0 and ends at 1.
- **`stylesheet.test.ts`** — lint-style guards: no physical inline-axis
  property, no `!important` outside the reduced-motion floor, no universal
  selector reaching into the host document, every font stack ending in a
  generic family.

## Seeing it

```
npm run storybook     # every component, with theme and direction switches
npm run playground    # a working app built with Tantu, not a gallery
```

**Storybook** carries a story for every component plus a Foundations section
that reads its swatches, type ramp and spacing scale out of the live cascade —
a token sheet maintained by hand is a token sheet that will eventually lie
about the system it documents. Theme and writing direction are toolbar globals
rather than per-story args, so any story can be seen in all four combinations
by clicking rather than by editing a file.

**The playground** (`playground/`) is a small working tool — a loom's shift
record — rather than a component gallery, and it consumes Tantu through the
published entry points, so it exercises the real export surface. A gallery
answers "what is in the box"; this answers the question that decides adoption,
which is what it feels like to *build* with the system.

Both are rendered and measured in CI. `npm run audit:stories` loads all 110
story/theme combinations in Chromium, fails on a story that throws or renders
nothing, and runs axe over each with **`color-contrast` enabled** — which the
unit sweep cannot do, because jsdom has no cascade to resolve a colour from.
That check found eight contrast defects that had passed a green token audit,
including a table's zebra striping bound to a theme-invariant cream: near-white
text on a cream row in dark mode, invisible, and passing everything.

## Fonts are decoupled from the system

Tantu's stylesheet names no typeface. Components bind to four *roles* —
display, mono, meta, body — that resolve to stacks every machine already has,
so importing the design system pulls no font files and makes no network
requests. The three Tantu faces are a separate, optional import that rebinds
those roles.

```tsx
import "@aiweave/tantu/styles.css";   // the whole system, no fonts
import "@aiweave/tantu/fonts.css";    // optional: the Tantu typefaces
```

This is not tidiness. The faces are unicase, cover 88 codepoints, and are
still being corrected — a system that could not ship without them would be a
system blocked on them. The browser suite blocks every font request and
confirms the page still renders with no overflow and no errors, and
`tests/typography.test.ts` fails if the stylesheet ever names a face again.

`src/tantu/styles/fonts.css` is generated by `npm run build:fonts`, because
one declaration in it must be derived rather than written: a `unicode-range`
computed from each font's real cmap. Without it the browser tries a Tantu face
for every codepoint and falls back per glyph — a line of Devanagari with a
Latin word in it rendering in two typefaces at two optical sizes. The browser
check measures rendered width for Devanagari, Arabic and CJK to confirm no
Tantu face is selected for any of them.

## For designers

`src/tantu/tokens/` holds the token set in the two formats Figma imports — W3C
DTCG and Tokens Studio — generated from the stylesheet by `npm run tokens` and
checked in CI, so the design library cannot drift from the code.
[The import procedure is documented there](src/tantu/tokens/README.md), along
with the one rule that matters: bind to the semantic tokens, never the dye
primitives. Every contrast defect this system has had came from breaking it.

## Accessibility conformance

[`src/tantu/ACCESSIBILITY-CONFORMANCE-REPORT.md`](src/tantu/ACCESSIBILITY-CONFORMANCE-REPORT.md)
is a VPAT 2.5Rev INT self-assessment covering every WCAG 2.1 and 2.2 A/AA
criterion — what was measured, how, and who determines the outcome for a
component library as opposed to the application embedding it.

It is **not an audit**. No third party has evaluated Tantu and no testing with
assistive technology has been done; every criterion that could not be verified
by measurement is marked *Not Evaluated* rather than assumed, and the four
known defects are named in the report rather than left to be found.

## Writing direction

Tantu mirrors for `dir="rtl"` with no consumer work: every inline-axis rule is
logical, and the components resolve arrow-key direction from their own
computed direction. The full contract, including what the typefaces do and do
not cover for non-Latin scripts, is in
[`src/tantu/README.md`](src/tantu/README.md#right-to-left).

## The library as a package

Tantu is published from `src/tantu/` as `@aiweave/tantu`. Its
[README](src/tantu/README.md), [changelog](src/tantu/CHANGELOG.md) and
[versioning contract](src/tantu/VERSIONING.md) live there. The versioning
document is worth reading before changing a token name or a component's DOM —
both are part of the public API, not just the TypeScript signatures.
