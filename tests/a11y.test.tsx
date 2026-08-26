/**
 * The whole-surface accessibility sweep.
 *
 * Every exported component is rendered with realistic props and put through
 * axe-core, in both themes and both writing directions. This is the check the
 * system had none of: contrast was audited at the token level by
 * scripts/audit_a11y.mjs, but nothing verified that the *markup* each
 * component emits is sound — labels, roles, name/role/value, duplicate ids,
 * ARIA attributes that belong to the role they are on.
 *
 * axe rules that measure a *page* rather than a component (region, landmark,
 * page-has-heading-one, html-has-lang) are disabled, because the harness is
 * not a page and flagging it would say nothing about the component. Colour
 * contrast is disabled here for a different reason: jsdom has no layout or
 * cascade, so axe cannot see a real computed colour — that check lives in
 * scripts/audit_a11y.mjs, where the tokens are resolved for real.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import axe from "axe-core";
import { SPECIMENS } from "./fixtures";

/** Rules that judge the document, not the component under test. */
const PAGE_LEVEL_RULES = [
  "region",
  "landmark-one-main",
  "page-has-heading-one",
  "html-has-lang",
  "html-lang-valid",
  "bypass",
  "document-title",
  // Requires real layout and a real cascade; audited properly against the
  // resolved token values in scripts/audit_a11y.mjs.
  "color-contrast",
];

const AXE_OPTIONS: axe.RunOptions = {
  rules: Object.fromEntries(PAGE_LEVEL_RULES.map((id) => [id, { enabled: false }])),
  resultTypes: ["violations"],
};

async function violationsIn(root: HTMLElement) {
  const results = await axe.run(root, AXE_OPTIONS);
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.html.slice(0, 160)),
  }));
}

describe.each([
  ["light", "ltr"],
  ["dark", "rtl"],
] as const)("axe sweep — %s theme, dir=%s", (theme, dir) => {
  for (const specimen of SPECIMENS) {
    it(`${specimen.name} has no accessibility violations`, async () => {
      document.documentElement.setAttribute("data-theme", theme);
      document.documentElement.setAttribute("dir", dir);
      try {
        const { container } = render(specimen.element);
        const violations = await violationsIn(container);
        expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
      } finally {
        document.documentElement.removeAttribute("data-theme");
        document.documentElement.removeAttribute("dir");
      }
    });
  }
});

describe("the sweep is honest about what it skips", () => {
  it("records a reason for every specimen exempted from a rule", () => {
    for (const s of SPECIMENS) {
      if (s.axeNote !== undefined) {
        expect(s.axeNote.length, `${s.name} carries an empty exemption note`).toBeGreaterThan(20);
      }
    }
  });

  it("renders every specimen — an empty container is not a pass", () => {
    for (const s of SPECIMENS) {
      const { container, unmount } = render(s.element);
      // A component that renders nothing would sail through axe. Two of them
      // legitimately emit only an <svg> definition or a decorative canvas, so
      // the assertion is on *some* output, not on text.
      expect(container.innerHTML.trim(), `${s.name} rendered nothing`).not.toBe("");
      unmount();
    }
  });
});
