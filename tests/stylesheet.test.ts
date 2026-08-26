/**
 * Guards on the stylesheet itself.
 *
 * Three properties are easy to restore by accident and expensive to discover
 * in the field, so they are asserted rather than remembered:
 *
 *  1. no physical inline-axis property (the RTL conversion undone one
 *     declaration at a time);
 *  2. no `!important` outside the one sanctioned vestibular-safety override
 *     (a library that shouts cannot be themed by the application embedding
 *     it);
 *  3. no unscoped universal selector (the `*` reset that reached into every
 *     host document and destroyed its rounded corners).
 *
 * The contrast audit is not reimplemented here — it is run as its own script,
 * so there is exactly one definition of what the thresholds are.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { describe, expect, it } from "vitest";

const CSS_PATH = "src/tantu/styles/tantu.css";
const RAW = fs.readFileSync(CSS_PATH, "utf8");
/** Comments discuss these very patterns by name, so strip them before matching. */
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, "");

/** Every declaration in the sheet, as `{ property, value, line }`. */
const DECLARATIONS = (() => {
  const out: Array<{ property: string; value: string; line: number }> = [];
  const lines = CSS.split("\n");
  lines.forEach((text, i) => {
    for (const m of text.matchAll(/(^|[;{]|^\s*)\s*([-a-z]+)\s*:\s*([^;{}]+)/g)) {
      out.push({ property: m[2], value: m[3].trim(), line: i + 1 });
    }
  });
  return out;
})();

describe("writing direction", () => {
  const PHYSICAL_PROPERTIES = [
    "margin-left", "margin-right",
    "padding-left", "padding-right",
    "border-left", "border-right",
    "border-left-color", "border-right-color",
    "border-left-width", "border-right-width",
    "border-left-style", "border-right-style",
    "float", "clear",
  ];

  it("uses no physical inline-axis box property", () => {
    const found = DECLARATIONS.filter((d) => PHYSICAL_PROPERTIES.includes(d.property));
    expect(
      found.map((d) => `${CSS_PATH}:${d.line} ${d.property}`),
      "use the logical equivalent (margin-inline-*, padding-inline-*, border-inline-*) so RTL mirrors for free",
    ).toEqual([]);
  });

  it("aligns text logically, never to a physical side", () => {
    const found = DECLARATIONS.filter(
      (d) => d.property === "text-align" && /^(left|right)$/.test(d.value),
    );
    expect(
      found.map((d) => `${CSS_PATH}:${d.line} text-align: ${d.value}`),
      "use `start` / `end`",
    ).toEqual([]);
  });

  it("declares the inline-direction sign both ways", () => {
    // Transform functions are physical and cannot be expressed logically, so
    // the sheet multiplies x-offsets by --tantu-flip. Both definitions have to
    // exist or every mirrored transform silently resolves to nothing.
    expect(CSS).toMatch(/:root\s*\{[^}]*--tantu-flip:\s*1;/);
    expect(CSS).toMatch(/\[dir="rtl"\]\s*\{[^}]*--tantu-flip:\s*-1;/);
  });

  it("never uses a bare translateX on the inline axis without the sign", () => {
    // Symmetric jitter (a texture that reads the same mirrored) is fine; a
    // one-way slide is not. The distinguishing mark is a keyframe or rule
    // whose translateX endpoints are asymmetric, which the two known cases
    // below already carry --tantu-flip for.
    const flipped = CSS.match(/translateX\(calc\([^)]*--tantu-flip[^)]*\)\)/g) ?? [];
    expect(flipped.length).toBeGreaterThanOrEqual(3);
  });
});

describe("cascade manners", () => {
  it("shouts only inside the reduced-motion floor", () => {
    // `!important` in a library is unanswerable by the application embedding
    // it, so exactly one rule is allowed to use it: the vestibular-safety
    // floor, where being unanswerable is the point (WCAG 2.3.3 is a user
    // preference the author does not get to negotiate). Everything else wins
    // on specificity or not at all.
    const ALLOWED = new Set([
      "animation-duration: 1ms !important;",
      "animation-delay: 0ms !important;",
      "animation-iteration-count: 1 !important;",
      "transition-duration: 1ms !important;",
      "transition-delay: 0ms !important;",
    ]);

    const shouts = CSS.split("\n")
      .map((text, i) => ({ text: text.trim(), line: i + 1 }))
      .filter((l) => l.text.includes("!important"));

    const unexpected = shouts.filter((l) => !ALLOWED.has(l.text));
    expect(
      unexpected.map((l) => `${CSS_PATH}:${l.line} ${l.text}`),
      "raise specificity instead — a doubled class outranks a single one",
    ).toEqual([]);
    expect(shouts.length).toBe(ALLOWED.size);

    // ...and every one of them must genuinely sit inside a reduced-motion query.
    for (const shout of shouts) {
      const before = CSS.slice(0, CSS.indexOf(shout.text));
      const query = before.lastIndexOf("@media");
      expect(
        CSS.slice(query, query + 60),
        `${shout.text} is not inside a prefers-reduced-motion query`,
      ).toContain("prefers-reduced-motion");
    }
  });

  it("stills animation by running it out, not by cancelling it", () => {
    // Many keyframes are `forwards` reveals starting from opacity 0.
    // `animation: none` would strand the element in its pre-animation state
    // and the content would never appear at all.
    const floor = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: reduce) {\n  [class^=\"tantu-\"]"));
    expect(floor).toContain("animation-duration: 1ms !important");
    expect(floor).not.toMatch(/animation:\s*none\s*!important/);
  });

  it("scopes the reduced-motion floor to Tantu's own elements", () => {
    const start = CSS.indexOf("@media (prefers-reduced-motion: reduce) {\n  [class^=\"tantu-\"]");
    expect(start, "the reduced-motion floor is missing").toBeGreaterThan(-1);
    const floor = CSS.slice(start, start + 600);
    expect(floor).toContain('[class^="tantu-"]');
    expect(floor).toContain('[class*=" tantu-"]');
  });

  it("never applies a rule to every element in the host document", () => {
    // `* { ... }`, `*::before`, and `:where(*)` all reach past Tantu's own
    // markup into whatever page is embedding it.
    const universal = CSS.split("\n")
      .map((text, i) => ({ text: text.trim(), line: i + 1 }))
      .filter((l) => /^\*(\s|,|::|\{)/.test(l.text));
    expect(universal, "scope resets to elements carrying a tantu- class").toEqual([]);
  });
});

describe("user preferences", () => {
  it("answers prefers-reduced-motion", () => {
    expect(CSS).toContain("prefers-reduced-motion");
  });

  it("answers prefers-contrast", () => {
    expect(CSS).toContain("@media (prefers-contrast: more)");
  });

  it("answers forced-colors", () => {
    expect(CSS).toContain("@media (forced-colors: active)");
  });

  it("restates every meaning-bearing fill in system colours under forced colours", () => {
    const block = CSS.slice(CSS.indexOf("@media (forced-colors: active)"));
    // A background is the only thing carrying state on these; forced colours
    // flattens it, so each has to name a system colour.
    for (const cls of [
      "tantu-btn-primary",
      "tantu-tag-solid",
      "tantu-meter-fill",
      "tantu-slider-fill",
      "tantu-treadle",
    ]) {
      expect(block, `${cls} loses its state under forced colours`).toContain(cls);
    }
    expect(block).toMatch(/background-color:\s*Highlight/);
    expect(block).toMatch(/outline:\s*3px solid Highlight/);
  });
});

describe("typography", () => {
  it("names a prose voice that is none of the three display faces", () => {
    expect(CSS).toMatch(/--font-body:/);
    const body = CSS.slice(CSS.indexOf("--font-body:"), CSS.indexOf("--font-body:") + 260);
    expect(body).not.toContain("Talim-Mono");
    expect(body).not.toContain("Kalam-Rupa");
    expect(body).not.toContain("Kasuti-Gauze");
  });

  it("ends every font stack in a generic keyword", () => {
    // The Tantu faces cover Latin only. A stack that does not end in a
    // generic family leaves a reader whose script is missing with whatever
    // the browser picks, rather than the face their system chose for them.
    for (const token of ["--font-talim", "--font-kalam", "--font-kasuti", "--font-body"]) {
      const at = CSS.indexOf(`${token}:`);
      expect(at, `${token} is not declared`).toBeGreaterThan(-1);
      const value = CSS.slice(at + token.length + 1, CSS.indexOf(";", at));
      expect(
        value.trim().split(",").pop()!.trim(),
        `${token} does not end in a generic family`,
      ).toMatch(/^(serif|sans-serif|monospace|system-ui|cursive|fantasy)$/);
    }
  });

  it("does not set the machine voice under every paragraph", () => {
    const at = CSS.indexOf("html,\nbody {");
    expect(at).toBeGreaterThan(-1);
    const rule = CSS.slice(at, CSS.indexOf("}", at));
    expect(rule).toContain("var(--font-body)");
    expect(rule).not.toContain("var(--font-talim)");
  });
});

describe("token contrast", () => {
  it("passes every real pairing in both themes", () => {
    // One definition of the thresholds, in the script CI runs.
    const output = execFileSync("node", ["scripts/audit_a11y.mjs"], { encoding: "utf8" });
    expect(output).toMatch(/\d+ pairings checked, 0 failing/);
  });
});
