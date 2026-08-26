# Tantu tokens for design tools

> **What this is, and what it isn't.** These are the design tokens in the two
> formats Figma's import paths consume, generated from the stylesheet. They are
> not a `.fig` file. Assembling the library — the frames, the component
> variants, the descriptions — is a designer's work in Figma, and it should be:
> the components in a Figma library are *drawings*, and drawings made by a tool
> from CSS tend to look like it. What this does guarantee is that the values
> those drawings are built on are the real ones, and stay the real ones.

`styles/tantu.css` is the single source of truth. These files are generated
from it by `npm run tokens`, and CI fails if the committed output is stale — so
the library and the code cannot drift apart without someone noticing.

```
npm run tokens
```

| File | Format | Consumed by |
|---|---|---|
| `tantu.tokens.json` | [W3C Design Tokens Community Group](https://tr.designtokens.org/format/) draft | Figma Variables importers, Style Dictionary 4, Terrazzo, most modern build tooling |
| `tokens-studio.json` | [Tokens Studio for Figma](https://tokens.studio) | The Tokens Studio plugin, which is still how most teams actually get tokens into a Figma library |

56 tokens per theme; the dark theme redefines 18 of them.

## Getting them into Figma

**With Tokens Studio** (the shorter path):

1. Install the Tokens Studio plugin in Figma.
2. Plugin → Settings → **Import** → *Load from file* → `tokens-studio.json`.
3. The file declares two sets, `tantu/light` and `tantu/dark`, and two themes
   pointing at them. Apply a theme and every bound layer re-resolves.
4. **Create Variables** in the plugin pushes the sets into Figma Variables with
   a mode per theme, which is what lets a designer flip a frame between light
   and dark the same way the code does.

**With Figma Variables directly:** use any DTCG importer plugin on
`tantu.tokens.json`. It carries two top-level collections, `light` and `dark`,
so import each into its own mode of one collection rather than as two separate
collections — otherwise a component bound to a light variable will not follow
the theme switch.

## Two decisions worth knowing about

**Aliases are resolved, not preserved.** `--tantu-accent-primary` is
`var(--tantu-madder-root)` in CSS, and it would be tempting to import that as a
token alias. Design tools only resolve aliases *within a collection*, so a
dark-theme alias pointing at a value that exists only in the light set imports
as a dangling reference and the swatch comes through empty. Every value is
therefore flattened to a literal. The structure is not lost: each token carries
`$extensions.tantu.aliasOf` naming the primitive it was built from, so a
designer can still see that the accent is madder root.

**The dye primitives are in there, and should not be used directly.** They are
theme-invariant — that is what makes them primitives — so a layer bound to
`tantu/kora/raw` will be cream in dark mode too. Every contrast defect this
system has had came from exactly that mistake: a table's zebra striping bound to
a primitive, a seal's label bound to a primitive, a search field's text bound to
a primitive. Bind to the semantic tokens (`tantu/ink/*`, `tantu/bg/*`,
`tantu/accent/*`, `tantu/state/*`, `tantu/border/*`) and the theme takes care of
itself.

## Building the library on top

The token import is the part that must be exact. The rest is design work, and
these are the pieces a Tantu library needs in roughly this order:

1. **Variable collection with two modes**, light and dark, from the import
   above. Nothing else works until this does.
2. **Text styles** for the four typographic roles — Kalam for display, Talim
   for machine voice, Kasuti for counted-thread metadata, and the body stack for
   prose. Install the three `.woff2` files from `fonts/` locally, or the styles
   will silently fall back and the library will look nothing like the product.
3. **A spacing grid on the base-6 lattice** — 6, 12, 18, 24, 36, 48, 72. The
   gaps at 5 and 7 are deliberate; do not add them.
4. **The twelve-thread loom as a layout grid**, dropping to four below 768px.
5. **Components with variants matching the props**, and each component's
   description linking its Storybook page — so a designer handing off a frame
   hands off the keyboard behaviour too, not just the picture.

Two things the code enforces that a Figma library cannot, and that are worth
writing into the component descriptions rather than hoping they carry: **square
corners everywhere** (a woven structure has no curves), and **the focus ring is
zari gold with a contrast halo** — not a blue outline, and not omitted from the
frames because it is "a code thing".
