# Versioning

`@aiweave/tantu` follows [Semantic Versioning 2.0.0](https://semver.org/).
Semver is a contract about what breaks, and a design system's surface is wider
than its TypeScript signatures — a token rename or a changed DOM structure can
break a consumer just as thoroughly as a removed prop. This document says what
counts.

## What is public

Four things, and a change to any of them is a change to the API:

1. **The exported module surface** — every component, hook, type and function
   reachable from `@aiweave/tantu`.
2. **The token names** — every `--tantu-*` and `--font-*` custom property
   declared in `styles/tantu.css`. Consumers override these to theme the
   system; renaming one silently reverts their theme to the default.
3. **The class names** — every `tantu-*` class a component puts on an element.
   Consumers write CSS against them and query them in tests.
4. **The DOM structure and ARIA semantics** each component emits, to the
   extent a reasonable selector or an assistive technology would depend on it.

The token *values* are not part of the contract in the same way — see below.

## Major

- Removing or renaming an export, a token, or a class name.
- Removing a prop, or making an optional prop required.
- Restructuring a component's DOM such that a plausible descendant selector
  stops matching.
- Raising the minimum React version, or the browser baseline.
- Changing a component's default behaviour in a way a consumer cannot opt out
  of.

## Minor

- A new component, hook, prop, token or class.
- A new optional prop with a default that preserves current behaviour.
- Widening an accepted type.
- **An accessibility fix that changes markup.** This is a deliberate policy
  choice and the reason it is written down: several fixes in this system's
  history changed the DOM — a `role="listitem"` wrapper, a row inside a grid,
  a landmark that stopped being one. Each is a bug fix by intent and a
  structural change by effect. They ship as minor, and the changelog names
  every one under *Fixed*, so a consumer with a brittle selector has something
  to read before upgrading. They will not ship in a patch.

## Patch

- A fix that changes no markup and no public name.
- **A token value change that corrects a measured contrast failure.** Colour
  values move to meet WCAG; a consumer who pinned a specific hex has overridden
  the token and is unaffected. A token value change for *aesthetic* reasons is
  minor, not patch.
- Documentation, comments, and internals with no observable effect.

## Deprecation

Anything slated for removal is marked `@deprecated` in its JSDoc with the
replacement named, kept working for at least one minor release, and listed
under *Deprecated* in the changelog. It is removed only in a major.

## Pre-1.0

While the version is `0.x`, the minor position carries breaking changes, per
the semver spec's allowance for initial development. The rules above still
describe *what* is breaking; only the position moves. `1.0.0` will be cut once
the system has run in more than one production application, and from that point
the majors are real.

## The green commit

Every release is cut from a commit where `npm run verify` passes: typecheck,
the full test suite, 36/36 contrast pairings across both themes, the bleed
arbitration matrix, the site build, and the browser checks. CI runs the same
command, so "which commit was green" is always answerable.
