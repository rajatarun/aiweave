# Changelog

All notable changes to `@aiweave/tantu`.

The format is [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
under the contract described in [VERSIONING.md](./VERSIONING.md).

## [Unreleased]

### Changed — BREAKING in spirit, not in API

- **Fonts are decoupled from the design system.** The stylesheet named three
  typefaces; now it names four *roles* — `--tantu-font-display`,
  `--tantu-font-mono`, `--tantu-font-meta`, `--tantu-font-body` — that resolve
  to stacks every machine already has. `@aiweave/tantu/styles.css` is a
  complete, working design system with **zero font files and zero network
  requests**.

  This is not tidiness. The Tantu faces are unicase, cover 88 codepoints, and
  are still being corrected; a system that could not ship without them was a
  system blocked on them. Nothing about the structure, colour, motion or
  writing-direction handling depends on which typeface arrives.

  Rebinding one role now swaps a voice system-wide:

  ```css
  :root { --tantu-font-display: "Playfair Display", serif; }
  ```

  No public name was removed — `--font-kalam`, `--font-talim`, `--font-kasuti`
  and `--font-body` still resolve, as deprecated aliases — so this ships as a
  minor. Nothing inside the system binds to them any more, which a test
  enforces.

### Added

- **The loom separated from the cloth.** Tantu is one tradition expressed on a
  general structure, and until now the two were the same names and the same
  numbers. The structural lattice now carries a `--weave-` prefix — `sett`,
  `thread`, `knot-N`, `gauge-*`, `target-min` — and every `--tantu-` token is
  an alias onto it rather than a copy. Nothing existing moves: all 60
  previously exported tokens resolve to exactly the values they always did,
  which `scripts/verify_core.mjs` asserts against the historic scale.

  `--tantu-tension` remains the documented input and keeps its default, so
  every consumer that sets it works untouched. `--weave-sett` reads from it
  and can itself be set on any subtree to re-sett a region.

- **`--weave-fibre` — the wicking law's constants are a material, not a law.**
  Lucas–Washburn describes liquid in any porous medium, which is why it is in
  the core. The two numbers parametrising it are not universal at all: `0.18`
  and `0.04` describe *cotton*, and they were compiled into the fragment
  shader as literals. That did not merely duplicate them, it froze them —
  every surface on every page wicked like cotton because cotton was the only
  cloth the engine could express.

  Both are `uniform float`s now, fed from a `FIBRES` table in `lib/bleed-bus`:
  cotton, linen, silk, wool and felt. `createCapillaryBleed` takes a `fibre`
  option; `wickRadii` and `wickCoverRadius` take a fibre or a spec; and
  `fibreFrom(element)` reads `--weave-anisotropy` / `--weave-wick-t0` off the
  live cascade exactly as `resolveDye` already reads pigment, so re-fibring a
  region in CSS moves the DOM wick fronts inside it. `ChambaRumalCard` uses
  it, which is what makes the CSS tokens consequential rather than
  declarative.

  Felt is the row that proves the axis is real rather than cosmetic: matted
  fibre was never woven, so it has no thread axes to conduct along and its
  front stays a perfect circle. The audit measures `rx/ry` mid-flight and
  requires exactly 1.0 for felt against 1.24 for a woven cloth.

  These are calibrated design values, not published measurements — as `0.18`
  always was. What is claimed is the ordering and relative spacing, which
  follow from fibre morphology. Cotton's row is fixed by a test, because
  every existing consumer renders against it.

  Nothing is deprecated and no public name changed meaning, so this ships as
  a minor.

- **`--tantu-tension` — density as a physical parameter rather than a set of
  presets.** A weaver sets warp tension before anything else, and it decides
  the sett: how close the threads sit. Slack warp, open cloth; taut warp,
  dense cloth. `--tantu-tension` (0 slack, 1 taut) resolves to
  `--tantu-thread`, and every knot on the base-6 lattice is a multiple of
  that one thread, so the whole scale moves together because it shares a
  cause. The counted-thread voice tracks with it too — alone among the four
  type roles, because Kasuti letterforms are built on the thread grid, so
  there the letters really are the threads.

  The thread is quantised to whole pixels: a fractional thread does not
  exist, which is the same rule `JamdaniBlock` already applies when it rounds
  a column to whole picks.

  **The default changes nothing.** At `0.5` the scale is 6/12/18/24/36/48/72
  — exactly what it has always been — and a check asserts those twelve values
  rather than trusting the arithmetic.

  This is the need other systems ship as "density": two or three presets,
  each value chosen by taste and tuned independently of its neighbours. One
  cause instead of an enumeration means the values cannot drift apart.

  Not everything answers the dial, deliberately. `--tantu-gauge-filament`
  holds at 1px because below that a hairline renders blurry or vanishes, and
  `--tantu-gauge-ply` holds because it is the focus ring's weight — a focus
  ring that thins under a density setting is an accessibility regression
  wearing a metaphor.
- **The wicking constants are one number each, not two that happened to
  agree.** `WICK_T0` and `WICK_ANISOTROPY` were exported from `lib/bleed-bus`
  for the CSS-driven fronts, and separately hand-typed as bare GLSL literals
  inside the WebGL shader in `lib/capillary-bleed` — held in step by nothing
  but a comment asking that they be. Nothing checked the two copies still
  agreed after an edit to either. `lib/capillary-bleed` now imports both
  constants and interpolates them into the shader source at load, so there
  is structurally one number rather than two hand-synchronised ones.
  `tests/bleed.test.ts` extracts the literal that actually lands in the
  compiled shader text and compares it against the live export, independent
  of how it got there, so a reverted-to-hardcoded copy fails loudly instead
  of drifting silently.
- **`BleedDye` covers the full dye registry.** It was its own five-member
  union — `madder | indigo | copper | marigold | iron` — narrower than the
  ten names `lib/dye`'s `TANTU_DYES` registry already had, for no reason the
  engine required: the shader takes one arbitrary colour uniform per draw
  call with no concept of a fixed palette. `BleedDye` is now an alias for
  `TantuDye`; every value that satisfied the old union still satisfies this
  one.
- **`lib/dye` is public.** `TANTU_DYES` and `resolveDye` were internal, which
  left a consumer wanting to put a swatch of madder beside a madder bleed with
  no option but to copy the hex — and a copied hex does not move when the
  system is re-dyed through CSS. Every dye names the custom property it
  mirrors, and `resolveDye` reads that property off the live element, so the
  shader and the stylesheet stay in agreement even in a locally re-dyed
  subtree.
- **The Darshan lens has a keypad**, and with it the conformance report has no
  *Does Not Support* left. The lens panned by dragging and zoomed by pinching,
  and neither had an equivalent a single pointer could reach — WCAG 2.5.7 and
  2.5.1 both refuse that, and 2.5.7 was the one criterion in the whole report
  marked *Does Not Support*. Seven brass keys now sit in the bezel: four
  directions, in, out, and fit. Each is one discrete press, each is 40×40 CSS
  px, and the arrow keys drive the same steps once a key has focus.

  Two details are deliberate. The keys do not seat on the nearest node the way
  a released flick does — anchorage is the right ending for a hand that
  stopped somewhere approximate and the wrong one for a press that was aimed.
  And the arrows stay *physical* in both writing directions, alone among
  Tantu's arrow-key handlers: the WAI-ARIA reversal describes walking a
  collection along the inline axis, and this is a viewport over a plane, where
  ArrowRight means "show me what is further right" whichever way the text runs.

  `labels` names all seven for a product that is not in English, because a
  control whose alternative to a gesture is unreadable is not an alternative.
- **The lens is measured at the width where it exists.** The story sweep runs
  at 1024px, where the lens hands its children straight through and renders no
  glass at all — so none of its chrome had ever been measured, by this or by
  anything else, which is precisely where the *Does Not Support* was living. A
  second pass loads it at 390px, clicks every control, reads the cloth's
  transform back to confirm it moved, measures each key against SC 2.5.8, and
  runs axe with contrast enabled over the engaged lens.
- **`@aiweave/tantu/fonts.css`** — an optional import that ships the three
  Tantu typefaces and rebinds the display roles to them. Generated by
  `npm run build:fonts` rather than hand-written, because one declaration must
  be derived: a `unicode-range` computed from each font's real cmap. Without
  it the browser tries a Tantu face for every codepoint and falls back per
  glyph, so a line of Devanagari with a Latin word in it renders in two
  typefaces at two optical sizes. Verified by measuring rendered width for
  Devanagari, Arabic and CJK — no Tantu face is selected for any of them.
- The typefaces now ship **inside the package** (`src/tantu/fonts/`, 14 KB for
  all three as woff2), so opting in is one import rather than hosting three
  files and hand-writing `@font-face`.
- **Browser checks that block every font request** and confirm the page still
  renders: no script errors, no horizontal overflow, every role falling
  through to a real generic family.
- **`tests/typography.test.ts`** — 15 tests holding the split: the stylesheet
  names no typeface, declares no `@font-face`, every role resolves to a stack
  ending in a generic family, no component hardcodes a family name, no rule
  sets `font-family` to a literal, and the brand layer stays a separate
  export.
- **Storybook**, with a story for every component, an axe check on each, and
  theme and writing-direction switches in the toolbar so any story can be seen
  in all four combinations. `npm run storybook`.
- **A playground** — a working application rather than a component gallery,
  consuming Tantu through its published entry points. `npm run playground`.
- **Design tokens for Figma**, generated from the stylesheet in both the W3C
  DTCG format and Tokens Studio's, with the import procedure documented.
  `npm run tokens`; CI fails if the committed output is stale.
- **A draft Accessibility Conformance Report** on the VPAT 2.5Rev INT
  structure, filled from measurements, with every criterion that could not be
  verified marked *Not Evaluated* rather than assumed. It is explicitly a
  self-assessment: no third-party audit and no assistive-technology testing
  have been done, and the report says so at the top.
- **A rendered-contrast sweep** (`npm run audit:stories`) that runs axe over
  every story in a real browser. The token audit computes pairings, but only
  pairings someone thought to write down; jsdom has no cascade, so the unit
  sweep cannot see a resolved colour at all. Eight contrast defects had passed
  both.
- **Target-size measurement** against WCAG 2.2 SC 2.5.8, in the same sweep.
- **Reflow, text-spacing and resize-text measurements** in the browser checks,
  at the criteria's actual thresholds — 320 CSS px for reflow, not a phone
  width.
- **Right-to-left support.** Every inline-axis rule is written with logical
  properties, so a host that sets `dir="rtl"` gets a correct mirror with no
  Tantu-specific work. The three things CSS cannot express logically —
  transform functions, a `background-position` measured from a physical edge,
  and `clip-path: inset()` — are handled by a `--tantu-flip` sign token and a
  small `[dir="rtl"]` block.
- **`lib/direction`**, a public module (`inlineFlip`, `isRtl`,
  `inlineArrowStep`, `inlineStartPadding`) so a consumer building its own
  composite widget can follow the same inline-axis rules the built-in ones do.
  It resolves direction from `getComputedStyle`, which is the only source that
  accounts for inheritance, `dir="auto"`, and an LTR island inside an RTL
  document.
- **`--font-body`**, a prose voice. Talim is machine voice and Kalam is
  display; neither is meant to carry a paragraph, so the system now names a
  platform stack instead of leaving every consuming application to invent one.
- **`prefers-contrast: more`** support, answered at the token layer so every
  component responds without a per-component branch.
- **`forced-colors: active`** support. Fills that carry state — a filled
  button, a solid tag, meter and slider travel, the treadle knob, disabled
  controls, the focus ring whose halo is a `box-shadow` — are restated in
  system colours. Decorative dye layers are withdrawn; the ikat swatches opt
  out with `forced-color-adjust: none`, because there the colour *is* the
  content.
- **A reduced-motion floor.** Components each carried their own
  `prefers-reduced-motion` rule, but a browser audit found several still
  animating. There is now one scoped floor beneath the considered
  per-component reductions.
- **Keyboard.** `Home` and `End` on `TantuTabs`.
- **Tests.** 237 of them, from none: axe-core over all 47 exported components
  in both themes and both directions, server rendering with the browser
  globals genuinely removed, the composite-widget keyboard contract, the modal
  contract, the dye physics, and lint-style guards on the stylesheet.
- **CI.** `npm run verify` — typecheck, tests, contrast audit, bleed
  arbitration, site build, and 20 browser checks — runs on every push and pull
  request, alongside a job that rebuilds the typefaces and fails if the
  committed files are stale.

### Fixed

- **`ChambaRumalCard` could not be turned over.** The component took an
  `isFlipped` prop and nothing else — no trigger, no state, no animation — so
  the dye-wick reveal that is the entire point of a Dorukha card was
  unreachable from React. It existed only as a hand-written script on one
  static page. Consumers rendered the card, wrote "press the card" underneath
  it, and shipped a promise the component could not keep; nothing caught it,
  because a card that never turns still renders, still passes axe, and still
  looks right in a screenshot.

  The flip is now the component's own, and the growth law is imported rather
  than retyped: `wickProgress` and `wickRadii` from `lib/bleed-bus` are the
  same Lucas–Washburn functions the WebGL shader uses, so the DOM front and the
  GLSL front cannot drift into different physics. The card mounts its own
  `InkBleedFilter` under a generated id, so the frayed edge works standalone
  instead of depending on the consumer having rendered a filter with the right
  name somewhere on the page.

  New props, all optional and all additive: `defaultFlipped`, `onFlipChange`,
  `flipLabel`, `backLabel`, `trigger`. `isFlipped` keeps its meaning — passing
  it still makes the card controlled. Passing it *without* `onFlipChange`
  renders no trigger at all, which is deliberate: a control wired to nothing is
  worse than no control, and that is precisely the defect being fixed here.

  Two accessibility details came with it. The face not showing is
  `aria-hidden`, and its trigger is held out of the tab order — so activating
  the flip moves focus onto the equivalent control on the face now showing,
  rather than stranding a keyboard reader inside a subtree screen readers have
  been told to ignore. And `.tantu-rumal-flip` draws its focus ring in
  `--tantu-rumal-ink`, the face's own text colour, instead of the system's
  `--tantu-accent-structural` — which is exactly the reverse face's dye, and
  would have been an invisible ring on the dyed side.

- **Two WCAG 2.5.8 fixes were expressed in a token that could shrink.** The
  stepper step and the slider track each satisfied the 24×24 minimum with
  `min-height: var(--tantu-knot-4)` — correct at the time, because knot-4 was
  24px. It was 24px only because the default sett made it so. The first run
  of the tension dial at full tension took both to 16px tall and silently
  re-broke two criteria that had already been fixed, and none of the six
  existing sweeps could see it, because all of them run at the default.
  There is now a `--tantu-target-min` held outside the sett, and
  `npm run audit:tension` exercises both extremes so the next density-shaped
  idea cannot do the same thing quietly.
- **The WebGL pooling check had never checked anything.** Tantu's claim is
  that a page shares exactly one WebGL context however many bleed surfaces sit
  on it. The check walked `document.querySelectorAll("canvas")` and asked each
  one for a `webgl` context — but the pooling *is* a single offscreen 1×1
  canvas that is never appended to the document, and every visible surface
  holds a plain 2D context that `drawImage`s from it. So the loop only ever
  saw 2D canvases, counted zero, and passed its `<= 1` assertion for exactly
  the wrong reason. It would have gone on passing with the pooling removed
  entirely. Both browser sweeps now instrument `getContext` before the page's
  scripts run and count acquisitions, which measures the claim rather than a
  proxy for it: twelve canvases on the playground, one context.
- **Text on a dyed card face sat flush against the dye's edge**, and the dye
  filled an inset rectangle rather than the card. Both faces of
  `ChambaRumalCard` began at the card's padding edge, so the first glyph
  started at exactly the same x as the coloured box. Invisible while the
  resting dye matched the card's own colour, and obvious the moment a
  different dye arrived — an undyed frame, and words touching the colour's
  boundary on every side with long lines running out past it. The padding
  moved down one level: the dye now fills the card edge to edge and the text
  floats inside it.
- **The reverse face's text measured 1.19:1 against its own dye** — near-black
  ink on near-black indigo, effectively invisible. Every dye now declares the
  ink that reads on it (14.88 light, 5.04 dark). It went unmeasured because
  every sweep rendered that card at rest showing only its obverse; there is
  now a story for the dyed face, and the pairing is in the token audit.
- **`isFlipped` rendered a blank card without the page-level flip script.**
  The prop flipped `data-state` and raised the reverse face, but its radii
  stayed at 0. Each state now has a static resting shape in CSS, so the
  component is correct on its own and the script still owns the motion.
- **The basted ring is drawn per face rather than as the card's outline**, so
  it takes the face's ink and reads on either dye instead of being a brown
  dashed line that only shows on cream. It carries the same clip as the dye,
  so the stitch arrives with the cloth.
- **Two rules referenced `--tantu-font-talim`, a token that has never
  existed**, so they had always silently rendered in their inline fallback
  rather than the intended face. Folded into the rename.
- The three hand-written copies of the `@font-face` block — in the site
  generator, Storybook and the playground — are gone. Each was a chance for
  the generated `unicode-range` to go missing, and the playground's copy
  already had.
- **Table zebra striping was a theme-invariant cream**, so in dark mode every
  even row carried near-white text on a cream slab. Effectively invisible, and
  it passed every check the system had.
- **Seven more contrast failures** found by the rendered sweep: the seal's
  label (3.52:1), the caution tag in light (3.07) and in dark (3.19), the
  success tag in dark (1.99), the zari tag (3.33), the trace search's label
  and readout (2.43), the calendar's weekday strip (1.75), and the acoustic
  toggle's muted label (3.46). Each had the same root cause — a dye primitive
  or a fixed colour used where a semantic, theme-aware token belongs — except
  the last, which used `opacity` to say "muted".
- **The dark theme never redefined `--tantu-state-success` or
  `--tantu-state-caution`**, so both rendered their light-theme values on a
  dark ground.
- **The solid tag's label was a hardcoded white**, which works on every
  light-theme tone and none of the dark ones.
- **Four interactive targets were under 24×24 CSS px** (WCAG 2.2 SC 2.5.8):
  masthead links, stepper steps, the slider's hit area and breadcrumb links.
- **`TantuTooltip` failed two of WCAG 1.4.13's three requirements** — it could
  not be dismissed with Escape, and `pointer-events: none` plus a 6px gap made
  it impossible to move the pointer onto.
- **`TantuDialog` did not honour `aria-modal`.** Tab walked out of the panel
  into the page behind the scrim, where a keyboard user could operate controls
  they could not see. The focus ring is now contained, the dialog takes its
  accessible name from its heading (it was announced as just "dialog"), and
  focus returns to whatever opened it.
- **`TantuPanchang` was a `role="grid"` with no rows**, which is the shape a
  screen reader cannot navigate — no week boundaries, no vertical arrow
  movement. Days now announce their weekday, month and any bound event rather
  than a bare numeral.
- **`TantuLoom`'s selvedges claimed to be landmarks.** Three regions holding
  nothing to act on, two of them colliding on `landmark-unique`. They are
  decorative margins and no longer announce themselves as regions.
- **`TantuPagination` put buttons directly inside `role="list"`**, so the list
  was opaque — no "list of 7", no "item 3 of 7" — and a page button announced
  "3", which is not a destination.
- **`TantuRupture` put `aria-label` on a `<p>`**, which ARIA prohibits and
  user agents may ignore, leaving the error code potentially inaudible.
- **`TantuTabs` moved selection without moving focus**, stranding the keyboard
  on an element that had just become `tabindex="-1"`.
- **`TantuTabs` and `TantuAcousticPalette` hard-coded arrow direction.** In a
  right-to-left context the WAI-ARIA Authoring Practices reverse the roles of
  ArrowLeft and ArrowRight; both now resolve it from the widget's own
  direction.
- **The Maku caret and the loom's column metrics measured from the physical
  left**, putting the caret and every snap thread on the wrong side of the
  cloth under RTL.
- **`html, body` set the machine voice under every paragraph.**

### Changed

- **Eleven of thirteen `!important` declarations removed**, replaced by
  specificity. A shouted declaration in a library is answerable by nobody; a
  doubled class is answerable by any host rule with two classes or an id. The
  five that remain are the reduced-motion floor, where being unanswerable is
  the point.

## [0.1.0]

Initial packaging. 47 components, three custom typefaces built from stroke
skeletons, a capillary bleed engine on the Lucas–Washburn wicking law, a
cross-component bleed arbitration bus, and a token set verified against WCAG
1.4.3 and 1.4.11 in both themes.

### Fixed in 0.1.0

- The Maku shuttle bound `keydown` in the capture phase and called
  `preventDefault()`, stealing the arrow keys from every ARIA composite widget
  on the page — including Tantu's own tablist.
- `* { border-radius: 0 !important }` reached every node in the host document.
- The focus ring measured 1.89:1; it is now two-tone and measures 14.57 / 16.68.
- `--tantu-grid-thread` did two jobs with different contrast requirements; the
  component boundary is now `--tantu-border-hairline` at 3.78 / 3.51.
- `--tantu-border-embroidery` (2.12 → 4.24) and dark `--tantu-accent-structural`
  (4.24 → 5.04) missed AA.
