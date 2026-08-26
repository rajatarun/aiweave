# Tantu playground

A working application built with Tantu — a loom's shift record — rather than a
gallery of components. A gallery answers "what is in the box"; this answers the
question that actually decides adoption, which is what it feels like to *build*
something with the system.

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

- **The direction switch, top right.** Nothing in this app is written twice.
  Every inline-axis rule in the stylesheet is logical, so the browser mirrors
  the layout, and the tabs' arrow keys reverse on their own because each widget
  resolves direction from its own computed style.
- **Tab through it.** A gold weft thread draws along the path focus travels,
  snapped to the loom's own column threads.
- **Open "Cut the cloth" and hold Tab.** Focus stays inside the panel — the
  page behind the scrim is unreachable, which is what `aria-modal` promises and
  what the browser does not enforce. Escape hands focus back to the button that
  opened it.
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
