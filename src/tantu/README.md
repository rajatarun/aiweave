# Tantu

A React design system that treats the interface as handloom cloth.

Tantu is not a theme layered over a component library. Its structure comes
from the loom: a twelve-thread warp that drops to four on small frames, a
base-6 spacing lattice with deliberate gaps, square corners because a woven
structure has no curves, and three typefaces built from stroke skeletons
rather than licensed from a foundry. State changes wick through it the way
dye wicks through cotton — on the Lucas–Washburn law, not an easing curve.

47 components. Every one of them verified against WCAG 2.1 AA in both themes
and both writing directions, on every commit.

```
npm install @aiweave/tantu
```

```tsx
import { TantuLoom, TantuCard, TantuButton } from "@aiweave/tantu";
import "@aiweave/tantu/styles.css";

export function Page() {
  return (
    <TantuLoom viewTalimCode="HOME-01">
      <TantuCard talimCode="W-01">
        <h3>Warp tension</h3>
        <p>Forty-eight picks to the inch, held at nine newtons.</p>
        <TantuButton variant="primary">Beat the weft</TantuButton>
      </TantuCard>
    </TantuLoom>
  );
}
```

React 18 or 19, as a peer dependency. `react-dom` is optional — the components
render under `renderToStaticMarkup` with no DOM at all, which is verified on
every commit.

## Theming

Everything is a custom property. Set `data-theme="light"` or `"dark"` on any
ancestor, or leave it unset and the system follows `prefers-color-scheme`.

```css
:root {
  --tantu-accent-primary: #82231d;
  --tantu-bg-substrate: #f3eee2;
}
```

Token names are part of the public API — see [VERSIONING.md](./VERSIONING.md)
for what that commits us to.

## Right to left

Set `dir="rtl"` on the document, a section, or a single component. Nothing
else is required: every inline-axis rule in the stylesheet is logical, so the
browser mirrors it, and the components resolve arrow-key direction from their
own computed direction rather than assuming.

```tsx
<div dir="rtl">
  <TantuTabs items={items} />
</div>
```

Building your own composite widget on top of Tantu? The same helpers the
built-in ones use are exported:

```ts
import { inlineArrowStep, isRtl } from "@aiweave/tantu";

// +1 towards the end of the collection, -1 towards its start, 0 for any
// other key — reversed under RTL, per the WAI-ARIA Authoring Practices.
const step = inlineArrowStep(event.key, event.currentTarget);
```

**One thing the system cannot do for you.** The three Tantu typefaces cover
Latin, digits and punctuation — 88 codepoints. Arabic, Hebrew, Devanagari,
Thai and CJK fall through to the next family in each stack, which is why every
stack ends in a generic keyword: the fallback has to be a face the reader's own
system chose, because it is the only one guaranteed to have their script. A
product in those scripts gets Tantu's structure, spacing, colour and motion;
it does not get Tantu's letterforms.

Mixing scripts in one paragraph is the Unicode Bidirectional Algorithm's job,
not the stylesheet's. Mark a Latin run inside RTL prose with `dir="ltr"` (and
the reverse) so punctuation lands where the reader expects.

## Accessibility

What is verified, on every commit, and how:

| | |
|---|---|
| Colour contrast | 36 real component pairings computed from the resolved tokens in both themes, against 4.5 (body), 3.0 (large and non-text). Alpha is flattened onto the actual backdrop first. `scripts/audit_a11y.mjs`. |
| Markup | axe-core over all 47 components × 2 themes × 2 directions. |
| Keyboard | The WAI-ARIA composite-widget patterns, including the RTL arrow reversal, and a regression guard that the page-level shuttle never takes a key a component wanted. |
| Modals | Focus containment, accessible name, and focus restoration. |
| Reduced motion | Chromium reports zero animating elements under `prefers-reduced-motion: reduce`. |
| Forced colours | Every fill that carries state is restated in system colours; decorative dye layers withdraw. |
| High contrast | `prefers-contrast: more` resolves harder tokens system-wide. |

What is **not** claimed: no screen-reader testing with JAWS, NVDA or VoiceOver
has been done, and no third-party audit. Automated checks catch roughly a third
of WCAG failures. Treat the table above as evidence, not as a conformance
statement.

## Motion

Tantu's state changes are dye spreading through cloth. The front position
follows the Lucas–Washburn wicking law — `L ∝ √t`, regularised at zero — which
is a genuinely different shape from the saturation curve `1 − e^(−kt)` that
usually stands in for "ink spreading", and different again from any cubic
bezier. Half the travel is done in the first third of the duration; the rest
is a long crawl. That asymmetry is the visible signature, and it is asserted
in the test suite so it cannot quietly become an ease-out.

Components that emit dye coordinate through a bleed bus, so a press on a button
inside a card inside a page does not fire three overlapping bleeds — the
innermost registered layer owns the gesture and the outer ones stay dry.

One WebGL context serves the entire page regardless of how many surfaces are
on it. Safari caps live contexts and drops the oldest past the cap; a
per-surface context would blank surfaces mid-scroll.

## Contributing

```
npm install
npm run verify      # typecheck, tests, contrast, bleed bus, build, browser checks
npm run test:watch
```

`npm run verify` is exactly what CI runs. A change is ready when it passes.

The typefaces are generated, not committed by hand:

```
pip install -r requirements-fonts.txt
npm run build:fonts
npm run audit:fonts
```

Every glyph is authored once as an abstract stroke skeleton — a line or an
elliptical arc — and each of the three families renders that same skeleton its
own way. Edit the skeleton, not the outlines.

Adding a component? `tests/fixtures.tsx` holds one realistic specimen of every
export, and a test fails if the two lists diverge, so a new component cannot
escape the sweeps.

## Licence

Apache-2.0.
