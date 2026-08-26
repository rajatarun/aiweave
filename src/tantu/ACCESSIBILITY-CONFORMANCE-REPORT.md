# Accessibility Conformance Report — Tantu

### International Edition (VPAT® 2.5Rev INT)

> ## ⚠ This is a self-assessment, not an audit
>
> **No third party has evaluated this product, and no testing with assistive
> technology has been performed.** Every "Supports" below is backed by an
> automated measurement whose script is named in the row; every criterion that
> could not be verified that way is marked **Not Evaluated** rather than
> assumed.
>
> Automated testing detects roughly a third of WCAG failures. A conformance
> claim requires manual evaluation with the assistive technologies real people
> use — JAWS, NVDA, VoiceOver, Dragon, ZoomText — and that has not happened.
>
> **This document exists to be handed to an auditor as a starting point, and to
> let an evaluating team see exactly what has and has not been checked. It is
> not a conformance claim and must not be presented as one.**

---

**Name of Product/Version:** Tantu Design System, `@aiweave/tantu` 0.1.0
**Report Date:** 2026-08-26
**Product Description:** A React component library and design-token set. 47
components, three custom typefaces, a token-driven theme system with light and
dark modes, and full right-to-left support.
**Contact Information:** https://github.com/rajatarun/aiweave/issues
**Notes:** See *Scope and division of responsibility* below — this is a
component library, not an application, and roughly a third of the WCAG success
criteria are the consuming application's to meet.
**Evaluation Methods Used:** See *How each result was obtained*.

---

## Scope and division of responsibility

A component library cannot conform to WCAG on its own. It can make conformance
achievable or impossible, and the honest way to report that is to say, for each
criterion, who determines the outcome:

| | |
|---|---|
| **Library** | The outcome is determined by Tantu's markup, styles or behaviour. A consumer using the component as documented gets the result stated. |
| **Shared** | Tantu provides the mechanism; the consumer must use it. A form control has a `label` prop — passing something meaningful is the consumer's job. |
| **Consumer** | Nothing Tantu does affects the outcome. Page titles, language attributes, media captions, and the content authors write. |

Rows marked **Consumer** are reported as *Not Applicable* to the library and
listed anyway, because a reviewer needs to see that they were considered rather
than omitted.

## How each result was obtained

| Method | What it covers | Command |
|---|---|---|
| Token contrast audit | 58 foreground/background pairings taken from real component rules, computed from the resolved `[data-theme]` blocks in both themes, with alpha flattened onto the actual backdrop | `npm run audit:a11y` |
| Rendered contrast sweep | axe-core `color-contrast` over all 54 stories × 2 themes in Chromium, against real computed pixels | `npm run audit:stories` |
| Markup sweep | axe-core over all 47 components × 2 themes × 2 writing directions | `npm run test` |
| Unit and behaviour tests | 213 tests: composite-widget keyboard patterns, modal focus containment, tooltip persistence, server rendering, dye physics | `npm run test` |
| Browser measurements | Reflow at 320px, text spacing overrides, 200% zoom, forced colours, reduced motion, focus rendering, writing-direction mirroring | `npm run audit:browser` |
| Target size measurement | Every interactive element in every story measured against 24×24 CSS px | `npm run audit:stories` |

Everything above runs in CI on every commit.

**Not used, and therefore not claimed:** screen readers, screen magnifiers,
voice control, switch access, braille displays, or any evaluation by a person
with a disability.

## Conformance terms

| Term | Meaning |
|---|---|
| **Supports** | The functionality meets the criterion without known defects. |
| **Partially Supports** | Some functionality does not meet the criterion. |
| **Does Not Support** | The majority of the functionality does not meet the criterion. |
| **Not Applicable** | The criterion is not relevant to the product. |
| **Not Evaluated** | The criterion has not been evaluated. Used here wherever verification would require assistive technology or manual review. |

---

## Table 1: Success Criteria, Level A

| Criterion | Responsibility | Conformance | Remarks |
|---|---|---|---|
| **1.1.1** Non-text Content | Shared | Partially Supports | Decorative graphics — the dye canvases, the SVG filters, the loom's thread overlay, the detached error glyphs — all carry `aria-hidden`. Components that render an image (`TantuSeal` with `src`) or a chart take a text alternative by prop. Whether consumers pass a meaningful one is not something the library can enforce. |
| **1.2.1–1.2.3** Prerecorded media | Consumer | Not Applicable | Tantu ships no audio or video content. The optional loom sound effects are non-speech feedback with no information of their own; see 1.4.2. |
| **1.3.1** Info and Relationships | Library | Supports | Verified by axe across 47 components × 2 themes × 2 directions, 0 violations. Every form control is a native element with a programmatic label; tables use `<caption>`, `<th>` and scope; the calendar is a `grid` of `row`s of `gridcell`s; lists are lists. Four defects in this criterion were found and fixed during the September audit — see the changelog. |
| **1.3.2** Meaningful Sequence | Library | Supports | DOM order matches reading order throughout; no component reorders content visually with `order` or absolute positioning in a way that diverges from the source. |
| **1.3.3** Sensory Characteristics | Library | Supports | No instruction in any component refers to shape, size, or position alone. |
| **1.4.1** Use of Color | Library | Supports | Every state is carried by at least one non-colour channel: notices and tags carry a text label, the toggle carries knob position, the stepper carries a completion mark, the meter carries a numeric value. This is what made the forced-colors restatement possible rather than a rewrite. |
| **1.4.2** Audio Control | Library | Supports | All sound is off until the reader turns it on, the choice persists, `TantuAcousticToggle` stops it globally, and every component that makes a sound takes an `audio` prop to silence it individually. Nothing autoplays. |
| **2.1.1** Keyboard | Library | Supports | Every interactive component is operable from the keyboard, verified by test. Tab, arrows, Home/End, Enter, Space and Escape follow the WAI-ARIA Authoring Practices, including the RTL arrow reversal. A page-level focus effect that stole the arrow keys from every ARIA composite widget was found and fixed; a regression test guards it. |
| **2.1.2** No Keyboard Trap | Library | Supports | The one deliberate focus containment is the modal dialog, which is required by `aria-modal` and exits on Escape — verified by test, including that focus returns to the opener. |
| **2.1.4** Character Key Shortcuts | Library | Not Applicable | No single-character shortcuts. The Maku shuttle's arrow-key routing only engages when no component and no native control has claimed the key. |
| **2.2.1** Timing Adjustable | Library | Not Applicable | No time limits. |
| **2.2.2** Pause, Stop, Hide | Library | Partially Supports | Several components animate indefinitely — the loader's thread, the ikat drift, the dye simulation. All stop under `prefers-reduced-motion: reduce`, verified in Chromium at zero animating elements, and the OS-level preference is the mechanism WCAG accepts. There is **no in-page control** to pause them for a reader who has not set that preference, which is what this criterion strictly asks for. |
| **2.3.1** Three Flashes | Library | Supports | Nothing flashes. The fastest animation is a 60ms step transition; no component produces more than three luminance changes per second. |
| **2.4.1** Bypass Blocks | Consumer | Not Applicable | Tantu provides no page-level chrome to bypass. `TantuMasthead` is a component the consumer places; a skip link is theirs to add. |
| **2.4.2** Page Titled | Consumer | Not Applicable | |
| **2.4.3** Focus Order | Library | Supports | Verified for the modal and for every composite widget. Roving tabindex moves focus with selection — a tablist that moved only selection, stranding focus on a `tabindex="-1"` element, was found and fixed. |
| **2.4.4** Link Purpose (In Context) | Shared | Supports | Every link component takes its text from the consumer. Pagination — where the library generates the text — now names each control "Page 3 of 7" rather than "3". |
| **2.5.1** Pointer Gestures | Library | Partially Supports | `TantuDarshanLens` pans by drag and zooms by pinch. Double-tap zooms as a single-pointer alternative to pinch, but **there is no non-path alternative for the pan** — no arrow-key or button equivalent. This is the clearest remaining defect in the system. |
| **2.5.2** Pointer Cancellation | Library | Supports | No component completes an action on `pointerdown`. The dye bleed fires on press, but it is a visual effect with no action attached; every action fires on `click` or `pointerup`. |
| **2.5.3** Label in Name | Library | Supports | Where a control has visible text, its accessible name contains that text. The two components that add to the visible text — pagination ("Page 3 of 7" containing "3") and the calendar ("Friday 14 March 2026" containing "14") — contain it rather than replacing it. |
| **2.5.4** Motion Actuation | Library | Not Applicable | No component responds to device motion. |
| **3.1.1** Language of Page | Consumer | Not Applicable | |
| **3.2.1** On Focus | Library | Supports | Nothing changes context on focus. Tooltips and focus effects are presentational. |
| **3.2.2** On Input | Library | Supports | No component submits, navigates, or changes context on input. |
| **3.3.1** Error Identification | Shared | Not Evaluated | Form controls accept and render an error message and wire `aria-describedby`. Whether that is sufficient in practice has not been evaluated with assistive technology. |
| **3.3.2** Labels or Instructions | Library | Supports | Every form control requires a label and renders it programmatically associated. Verified by axe. |
| **4.1.1** Parsing | — | Not Applicable | Removed from WCAG 2.2 and obsolete in 2.1. |
| **4.1.2** Name, Role, Value | Library | Supports | Verified by axe across all 47 components in both themes and both directions, 0 violations. Five defects in this criterion were found and fixed during the audit, including a modal with no accessible name and an `aria-label` on a `<p>`, which ARIA prohibits. |

## Table 2: Success Criteria, Level AA

| Criterion | Responsibility | Conformance | Remarks |
|---|---|---|---|
| **1.2.4–1.2.5** Live media, audio description | Consumer | Not Applicable | |
| **1.3.4** Orientation | Library | Supports | Nothing is locked to an orientation. |
| **1.3.5** Identify Input Purpose | Shared | Supports | `TantuInput` passes `autocomplete` through to the native input. Setting it is the consumer's call, since only they know what a field collects. |
| **1.4.3** Contrast (Minimum) | Library | Supports | 58 token pairings computed in both themes: **0 failing**, most at AAA. Independently, axe measures real rendered pixels across 110 story renders: **0 failing**. Eight defects were found and fixed by these two checks between them, including zebra striping set to a theme-invariant cream — near-white text on a cream row in dark mode. |
| **1.4.4** Resize Text | Library | Partially Supports | At 200% browser page zoom there is no loss of content or functionality and no horizontal scrolling — measured. Under *text-only* enlargement the picture is worse and is reported rather than rounded up: prose scales 2.29×, but Tantu's own chrome does not move at all (buttons, tags and metadata all measure 1.00×) because the component type scale is pinned in absolute pixels. Those are the smallest text in the system. Page zoom is the interpretation auditors apply, hence Partially rather than Does Not; the fix is a conversion of the type scale to relative units. |
| **1.4.5** Images of Text | Library | Supports | No text is rendered as an image. The three typefaces are real fonts with real glyph outlines and a real `cmap`. |
| **1.4.10** Reflow | Library | Supports | Measured at **320 CSS px** — the criterion's actual threshold, not a phone width — in both writing directions: 0px of two-axis scrolling. The twelve-thread grid drops to four below 768px and clamps every child to it. |
| **1.4.11** Non-text Contrast | Library | Supports | Focus indicator 14.57:1 light / 16.68:1 dark; component boundaries 5.88 / 5.67; card borders 4.93 / 4.63. All well over the 3.0 required. The focus ring measured 1.89:1 before the audit. |
| **1.4.12** Text Spacing | Library | Supports | The four prescribed overrides applied in Chromium: no content clipped, no overlap, no horizontal scrolling. |
| **1.4.13** Content on Hover or Focus | Library | Supports | `TantuTooltip` is the only component in scope. It is dismissible (Escape, without moving pointer or focus, and it stays dismissed until the trigger is genuinely left), hoverable (the tooltip is pointer-reachable and the gap to it is bridged), and persistent (nothing is on a timer). Two of the three failed before this audit; six tests now hold each requirement. |
| **2.4.5** Multiple Ways | Consumer | Not Applicable | |
| **2.4.6** Headings and Labels | Shared | Supports | Every labelled component requires its label. Heading text is the consumer's. |
| **2.4.7** Focus Visible | Library | Supports | A two-tone indicator — the brand's zari gold with a theme-aware contrast halo riding outside it — measured visible in both themes, and separately restated in `Highlight` under forced colours, where `box-shadow` is dropped and the halo would otherwise vanish. |
| **3.1.2** Language of Parts | Consumer | Not Applicable | Tantu renders no text of its own beyond machine codes. See the note on script coverage below. |
| **3.2.3** Consistent Navigation | Consumer | Not Applicable | |
| **3.2.4** Consistent Identification | Library | Supports | Components with the same function are identified identically throughout. |
| **3.3.3** Error Suggestion | Shared | Not Evaluated | The mechanism exists; the content is the consumer's, and no manual evaluation has been done. |
| **3.3.4** Error Prevention | Consumer | Not Applicable | `TantuDialog` provides a confirmation pattern; using it is the consumer's decision. |
| **4.1.3** Status Messages | Library | Partially Supports | `TantuNotice` and `TantuBanner` take a `role` for live regions, and the loader exposes its state. Not every component that changes state announces it — the trace search's readout and the toggle's state change are visual only. Not verified with a screen reader. |

## Table 3: WCAG 2.2 additions, Level AA

| Criterion | Responsibility | Conformance | Remarks |
|---|---|---|---|
| **2.4.11** Focus Not Obscured (Minimum) | Library | Not Evaluated | Requires testing focus against sticky headers and scroll containers in a real layout. Tantu ships no sticky chrome of its own, so the risk sits mostly with the consumer, but this has not been verified. |
| **2.5.7** Dragging Movements | Library | Does Not Support | `TantuDarshanLens` pans by dragging with no single-pointer alternative. Same root cause as 2.5.1. |
| **2.5.8** Target Size (Minimum) | Library | Supports | Every interactive element in every story measured against 24×24 CSS px. Four undersized targets were found — masthead links at 21px, stepper steps at 18px, the slider's hit area at 12px, breadcrumb links at 15px — and all four enlarged. The measurement now runs in CI, so a regression fails the build. |
| **3.2.6** Consistent Help | Consumer | Not Applicable | |
| **3.3.7** Redundant Entry | Consumer | Not Applicable | |
| **3.3.8** Accessible Authentication (Minimum) | Library | Not Applicable | `TantuGuptBandhan` gates content behind a key, but it is a presentational device, not an authentication mechanism, and is documented as such. |

---

## Revised Section 508 Report

**Chapter 3 — Functional Performance Criteria:** Not evaluated. These criteria
(302.1 Without Vision, 302.2 With Limited Vision, and the rest) describe whether
a person with a given disability can use the product, and answering them
requires evaluation with assistive technology and with users. That has not been
done.

**Chapter 4 — Hardware:** Not Applicable. Tantu is software.

**Chapter 5 — Software:** 502 and 503 concern interoperability with assistive
technology and user preferences. Tantu honours `prefers-reduced-motion`,
`prefers-contrast`, `forced-colors` and `prefers-color-scheme`, and exposes
name, role and value through native elements and ARIA — but interoperability
itself is unverified, for the reason above.

**Chapter 6 — Support Documentation and Services:** Not Applicable to the
library; the consuming organisation's obligation.

## EN 301 549 Report

Clause 9 (Web) maps to the WCAG tables above. Clause 11 (Non-web software) is
not applicable. Clause 12 (Documentation) is the consumer's. Clause 5 (Generic
requirements) — in particular 5.2 Activation of accessibility features — is not
applicable to a component library that ships no accessibility features requiring
activation.

---

## Known defects, stated plainly

Four things in this report are worse than "Supports", and a reviewer should
weigh them rather than hunt for them:

1. **Dragging has no alternative (2.5.7, 2.5.1).** The Darshan lens pans by
   drag only. This is the one *Does Not Support* in the report.
2. **Component text does not scale with a text-only enlargement (1.4.4).** The
   type scale is in absolute pixels. Page zoom works; a raised browser default
   font size does nothing for buttons, tags or metadata.
3. **No in-page control to stop animation (2.2.2).** The OS preference is
   honoured completely; there is no button.
4. **Status changes are not consistently announced (4.1.3).** Some components
   change state visually only.

## A limitation that is not a WCAG defect

The three Tantu typefaces cover Latin, digits and punctuation — 88 codepoints —
and are unicase by design. Arabic, Hebrew, Devanagari, Thai and CJK fall through
to the next family in each stack, which is why every stack ends in a generic
keyword: the fallback must be a face the reader's own system chose, because it
is the only one guaranteed to have their script. A product in those scripts gets
Tantu's structure, spacing, colour, motion and full RTL mirroring — it does not
get Tantu's letterforms. This is a scope limitation, disclosed so nobody
discovers it after adopting.

---

*VPAT® is a registered service mark of the Information Technology Industry
Council (ITI). This document follows the VPAT 2.5Rev INT structure. It has not
been produced or reviewed by an accredited evaluator.*
