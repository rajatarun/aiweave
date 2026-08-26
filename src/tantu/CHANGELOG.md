# Changelog

All notable changes to `@aiweave/tantu`.

The format is [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
under the contract described in [VERSIONING.md](./VERSIONING.md).

## [Unreleased]

### Added

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
- **Tests.** 213 of them, from none: axe-core over all 47 exported components
  in both themes and both directions, server rendering with the browser
  globals genuinely removed, the composite-widget keyboard contract, the modal
  contract, the dye physics, and lint-style guards on the stylesheet.
- **CI.** `npm run verify` — typecheck, tests, contrast audit, bleed
  arbitration, site build, and 20 browser checks — runs on every push and pull
  request, alongside a job that rebuilds the typefaces and fails if the
  committed files are stale.

### Fixed

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
