# Tantu playground

A working application built with Tantu — a loom's shift record — rather than a
gallery of components. A gallery answers "what is in the box"; this answers the
question that actually decides adoption, which is what it feels like to *build*
something with the system.

**Live at [tantu-playground.netlify.app](https://tantu-playground.netlify.app)**
— evaluation should cost one click, not a clone. `netlify.toml` at the
repository root is what configures that deploy; `base = "playground"` is the
line that makes a root-level config publish this subdirectory.

To run it locally instead:

```
npm install
npm run dev
```

Or from the repository root:

```
npm run playground
```

Then open http://localhost:5173.

## What to try

- **Put a different beam on the loom.** The beam register is the app's state,
  not a table beside it. Pressing *Dress* on a row loads that beam's tension,
  its bath and its place in the shift; moving the tension slider or changing
  the bath writes straight back into the row you are reading, and the picks
  chart is drawn from the same array. Each beam keeps its own progression, so
  switching away and back does not lose where you were.
- **Cut a beam, then cut the rest.** Cutting strikes the beam from the register
  for good and the loom takes up whatever is still dressed. Take it all the way
  to empty: the controls disable, the sett falls back to stock, and *Dress a new
  beam* puts something back on. An app whose last row can be removed has an
  empty state whether or not anyone designed one.
- **Press the five dye squares in the vat.** This is the part of Tantu nothing
  else in the system does, and it is not a metaphor in the code: the dye front
  follows the Lucas–Washburn wicking law, `L ∝ √t`, which is a genuinely
  different shape from the saturation curve `1 − e^(−kt)` that usually stands
  in for "ink spreading", and different again from any cubic bezier. Half the
  travel is over in the first third of the duration; the rest is a long crawl.
  It stretches along the warp, because cotton does not draw dye equally in
  both axes.
- **Change the bath in Setup → Dye.** The long cloth below the squares takes
  that dye. None of the five colours is written in this app — each names a
  custom property that the shader reads off the live element, so re-dyeing the
  system through CSS moves the bleed and the swatch together.
- **Press the button inside the long cloth, then press beside it.** One press
  is one dye front. The innermost thing that answers the gesture owns it and
  the cloth beneath stays dry; that arbitration is a shared bus, not a
  per-component guess. The button also does what a vat does — everything in it
  comes out the same colour, so every row in the register takes the new dye at
  once.
- **Press the page margin, outside every card.** The ground is cloth too. It
  bleeds only where nothing above it has claimed the gesture.
- **Six live surfaces, one WebGL context.** Safari caps live contexts and
  drops the oldest past the cap, so a context per surface blanks surfaces
  mid-scroll. Every surface here draws from one offscreen vat.
- **The direction switch, top right.** Nothing in this app is written twice.
  Every inline-axis rule in the stylesheet is logical, so the browser mirrors
  the layout, and the tabs' arrow keys reverse on their own because each widget
  resolves direction from its own computed style.
- **Tab through it.** A gold weft thread draws along the path focus travels,
  snapped to the loom's own column threads.
- **Open "Cut the cloth" and hold Tab.** Focus stays inside the panel — the
  page behind the scrim is unreachable, which is what `aria-modal` promises and
  what the browser does not enforce. Escape hands focus back to the button that
  opened it. Cancel and Cut lead somewhere different — a confirmation whose two
  answers do the same thing is a screenshot of the pattern rather than the
  pattern — and the outcome is announced through a live region, not only drawn.
- **Press the "Today" card.** The reverse wicks through as dye spreading into
  cloth, on the Lucas–Washburn law. Half the travel happens in the first third
  of the duration.
- **Drag the tension slider past 85.** A caution notice appears — and switch to
  dark mode with it showing, because the caution colour is one the dark theme
  had to define separately.

## How it consumes Tantu

Through the package name and the published entry points, not a relative path
into the repo:

```tsx
import { TantuLoom, TantuCard } from "@aiweave/tantu";
import "@aiweave/tantu/styles.css";
import "@aiweave/tantu/fonts.css";   // optional
```

That second line is the only thing tying this app to the Tantu typefaces.
Delete it and everything still works — the type roles resolve to stacks the
reader's machine already has, and the layout, colour and motion are unchanged.
Worth trying: it is the clearest demonstration of what the system is versus
what its skin is.

`vite.config.ts` aliases those two specifiers at the source tree, which is what
a consumer's `node_modules` would provide — so the playground exercises the real
export surface while still hot-reloading when a component changes.

Two things in that config are worth reading before copying it:

- **`resolve.dedupe`.** The playground is a nested npm project, so `react`
  resolves from its own `node_modules` for app code and from the repo root for
  the aliased Tantu source. Two copies means two dispatchers and every hook
  throws. A real consumer gets this for free from the peer dependency; here it
  has to be said out loud, because the alias sidesteps package resolution.
- **`publicDir`** points at the repo's `fonts/`, which is build output. It is
  no longer needed for the typefaces — those come from the package now — but it
  keeps the directory available for anything else the app wants to serve.

## Opening it in StackBlitz

The playground depends on the source tree next to it, so it is not
self-contained. To open it in a browser IDE, point StackBlitz at the whole
repository rather than this directory:

```
https://stackblitz.com/github/rajatarun/aiweave
```

then run `npm install && npm run playground` in its terminal. Once
`@aiweave/tantu` is published to npm this directory becomes standalone — swap
the two aliases in `vite.config.ts` for a real dependency and it will boot on
its own.
