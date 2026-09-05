/**
 * Fonts are decoupled from the design system.
 *
 * The rule these tests hold: **the stylesheet names no typeface.** Components
 * bind to roles — display, mono, meta, body — that resolve to stacks every
 * machine already has, so `@weaveaijs/tantu/styles.css` is a complete, working
 * design system with zero font files and zero network requests. The three
 * Tantu faces are an opt-in layer that rebinds those roles.
 *
 * This matters beyond tidiness. The faces are unicase, cover 88 codepoints,
 * and are still being corrected. A system that cannot be shipped without them
 * is a system blocked on them.
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";

const CSS_PATH = "src/tantu/styles/tantu.css";
const FONTS_PATH = "src/tantu/styles/fonts.css";

const RAW = fs.readFileSync(CSS_PATH, "utf8");
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, "");

const BRAND_FACES = ["Kalam-Rupa", "Talim-Mono", "Kasuti-Gauze"];
const ROLES = [
  "--tantu-font-display",
  "--tantu-font-mono",
  "--tantu-font-meta",
  "--tantu-font-body",
];

/** The value of a custom property declared in the sheet. */
function declared(token: string): string | null {
  const m = new RegExp(`${token}:\\s*([^;]+);`).exec(CSS);
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}

describe("the stylesheet stands alone", () => {
  it("names no Tantu typeface anywhere", () => {
    const found = BRAND_FACES.filter((face) => CSS.includes(face));
    expect(
      found,
      "the base stylesheet must work with no font files; brand faces belong in fonts.css",
    ).toEqual([]);
  });

  it("declares no @font-face", () => {
    // Loading font files is a consumer's decision — where they are hosted is
    // not something a library can know, and a system that fetches three fonts
    // on import has made that decision for them.
    expect(CSS).not.toContain("@font-face");
  });

  it("declares every type role", () => {
    for (const role of ROLES) {
      expect(declared(role), `${role} is not declared`).toBeTruthy();
    }
  });

  it("does not set the machine voice under every paragraph", () => {
    // `html, body` bound to the mono role once, which put codes-and-counts
    // typography under every paragraph on the page — the opposite of what
    // that role is for, and unreadable at length in a unicase face.
    const at = CSS.indexOf("html,\nbody {");
    expect(at).toBeGreaterThan(-1);
    const rule = CSS.slice(at, CSS.indexOf("}", at));
    expect(rule).toContain("var(--tantu-font-body)");
    expect(rule).not.toContain("var(--tantu-font-mono)");
  });

  it("resolves every role to a stack ending in a generic family", () => {
    // A generic keyword is the guarantee that something renders. Without it a
    // reader whose machine has none of the named faces gets whatever the
    // browser picks, which is not a decision the system has made.
    for (const role of ROLES) {
      let fallback = declared(`${role}-fallback`);
      expect(fallback, `${role}-fallback is not declared`).toBeTruthy();
      // One fallback aliases another (meta borrows mono's stack), so resolve
      // before looking at the tail.
      for (let depth = 0; depth < 4; depth += 1) {
        const alias = /^var\((--[\w-]+)\)$/.exec(fallback!.trim());
        if (!alias) break;
        fallback = declared(alias[1]);
        expect(fallback, `${alias[1]} is not declared`).toBeTruthy();
      }
      const last = fallback!.split(",").pop()!.trim();
      expect(
        last,
        `${role} falls back to "${last}", which is not a generic family`,
      ).toMatch(/^(serif|sans-serif|monospace|system-ui|ui-serif|ui-monospace|ui-sans-serif|cursive|fantasy)$/);
    }
  });
});

describe("components bind to roles, never to a typeface", () => {
  const sources = [
    ...fs.readdirSync("src/tantu/components").filter((f) => f.endsWith(".tsx")),
  ].map((f) => `src/tantu/components/${f}`);

  it("no component hardcodes a font family name", () => {
    const offenders: string[] = [];
    for (const path of sources) {
      const text = fs
        .readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      for (const face of BRAND_FACES) {
        if (text.includes(face)) offenders.push(`${path} names ${face}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no rule sets font-family to a literal instead of a role token", () => {
    const literals: string[] = [];
    CSS.split("\n").forEach((line, i) => {
      const m = /font-family:\s*(.+);/.exec(line);
      if (!m) return;
      // A `var(--tantu-font-*)` reference, or `inherit`, is what we want to
      // see. Anything else is a rule that has picked a typeface itself.
      if (/^var\(--tantu-font-[\w-]+\)$/.test(m[1].trim())) return;
      if (/^(inherit|initial|unset)$/.test(m[1].trim())) return;
      literals.push(`${CSS_PATH}:${i + 1} font-family: ${m[1]}`);
    });
    expect(literals, "bind to a role token so the whole system follows one swap").toEqual([]);
  });
});

describe("the deprecated typeface-named aliases still resolve", () => {
  // Token names are public API (VERSIONING.md), so removing these outright
  // would be a major. They alias the roles until then.
  it.each([
    ["--font-kalam", "--tantu-font-display"],
    ["--font-talim", "--tantu-font-mono"],
    ["--font-kasuti", "--tantu-font-meta"],
    ["--font-body", "--tantu-font-body"],
  ])("%s aliases %s", (alias, role) => {
    expect(declared(alias)).toBe(`var(${role})`);
  });

  it("is not used by anything inside the system", () => {
    // Deprecated means nothing internal depends on it, or the deprecation
    // cannot proceed.
    for (const alias of ["--font-kalam", "--font-talim", "--font-kasuti", "--font-body"]) {
      const uses = CSS.split(`var(${alias})`).length - 1;
      expect(uses, `${alias} is still bound by ${uses} rule(s)`).toBe(0);
    }
  });
});

describe("the opt-in brand layer", () => {
  const exists = fs.existsSync(FONTS_PATH);

  it("is generated, not hand-written", () => {
    if (!exists) return; // built by `npm run build:fonts`; see below.
    expect(fs.readFileSync(FONTS_PATH, "utf8")).toContain("GENERATED by build.py");
  });

  it("restricts every face to the codepoints it actually has", () => {
    if (!exists) return;
    const text = fs.readFileSync(FONTS_PATH, "utf8");
    const faces = text.split("@font-face").length - 1;
    const ranges = text.split("unicode-range:").length - 1;
    expect(faces, "no @font-face rules found").toBeGreaterThan(0);
    // Without this the browser tries a Tantu face for every codepoint and
    // falls back per glyph, so a line of Devanagari with a Latin word in it
    // renders in two typefaces at two optical sizes.
    expect(ranges, "every @font-face needs a unicode-range").toBe(faces);
  });

  it("rebinds roles rather than restating component rules", () => {
    if (!exists) return;
    const text = fs.readFileSync(FONTS_PATH, "utf8");
    for (const role of ["--tantu-font-display", "--tantu-font-mono", "--tantu-font-meta"]) {
      expect(text).toContain(role);
    }
    // It must not contain component selectors — its whole job is the token
    // rebind, so that opting out is one import away.
    expect(text).not.toMatch(/\.tantu-[\w-]+\s*\{/);
  });

  it("is a separate export from the stylesheet", () => {
    const pkg = JSON.parse(fs.readFileSync("src/tantu/package.json", "utf8"));
    expect(pkg.exports["./styles.css"]).toBe("./styles/tantu.css");
    expect(pkg.exports["./fonts.css"]).toBe("./styles/fonts.css");
    // Importing the design system must not pull font files with it.
    expect(pkg.exports["./styles.css"]).not.toBe(pkg.exports["./fonts.css"]);
  });
});
