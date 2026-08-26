import { describe, expect, it } from "vitest";
import {
  inlineArrowStep,
  inlineFlip,
  inlineStartPadding,
  isRtl,
} from "../src/tantu/lib/direction";

/** Attach a div with a resolved direction, so getComputedStyle has something real to read. */
function node(dir?: "ltr" | "rtl"): HTMLElement {
  const el = document.createElement("div");
  if (dir) el.setAttribute("dir", dir);
  document.body.appendChild(el);
  return el;
}

describe("inlineFlip", () => {
  it("is +1 in a left-to-right container", () => {
    expect(inlineFlip(node("ltr"))).toBe(1);
  });

  it("is -1 in a right-to-left container", () => {
    expect(inlineFlip(node("rtl"))).toBe(-1);
  });

  it("inherits direction from an ancestor rather than reading the element's own attribute", () => {
    const outer = node("rtl");
    const inner = document.createElement("div");
    outer.appendChild(inner);
    // `dir` is inherited; a widget nested in an RTL document is RTL even
    // though it carries no attribute of its own. Reading the attribute
    // instead of the computed style would miss this.
    expect(inlineFlip(inner)).toBe(-1);
    expect(isRtl(inner)).toBe(true);
  });

  it("honours an LTR island inside an RTL document", () => {
    const outer = node("rtl");
    const island = document.createElement("div");
    island.setAttribute("dir", "ltr");
    outer.appendChild(island);
    expect(inlineFlip(island)).toBe(1);
  });

  it("defaults to +1 for a null or detached target", () => {
    expect(inlineFlip(null)).toBe(1);
    expect(inlineFlip(document.createElement("div"))).toBe(1);
  });
});

describe("inlineArrowStep", () => {
  it("moves forward on ArrowRight and back on ArrowLeft in LTR", () => {
    const el = node("ltr");
    expect(inlineArrowStep("ArrowRight", el)).toBe(1);
    expect(inlineArrowStep("ArrowLeft", el)).toBe(-1);
  });

  it("reverses both in RTL, per WAI-ARIA Authoring Practices", () => {
    const el = node("rtl");
    expect(inlineArrowStep("ArrowRight", el)).toBe(-1);
    expect(inlineArrowStep("ArrowLeft", el)).toBe(1);
  });

  it("never claims the block-axis arrows or any other key", () => {
    for (const dir of ["ltr", "rtl"] as const) {
      const el = node(dir);
      for (const key of ["ArrowUp", "ArrowDown", "Home", "End", "Enter", " ", "a"]) {
        expect(inlineArrowStep(key, el)).toBe(0);
      }
    }
  });
});

describe("inlineStartPadding", () => {
  it("falls back to the physical side matching the resolved direction", () => {
    // jsdom does not resolve `padding-inline-start`, which is precisely the
    // engine gap the fallback exists for.
    const ltr = {
      paddingInlineStart: "",
      direction: "ltr",
      paddingLeft: "11px",
      paddingRight: "3px",
    } as CSSStyleDeclaration;
    const rtl = {
      paddingInlineStart: "",
      direction: "rtl",
      paddingLeft: "11px",
      paddingRight: "3px",
    } as CSSStyleDeclaration;

    expect(inlineStartPadding(ltr)).toBe(11);
    expect(inlineStartPadding(rtl)).toBe(3);
  });

  it("prefers the logical longhand where the engine resolves it", () => {
    const style = {
      paddingInlineStart: "7px",
      direction: "rtl",
      paddingLeft: "11px",
      paddingRight: "3px",
    } as CSSStyleDeclaration;
    expect(inlineStartPadding(style)).toBe(7);
  });

  it("reports 0 rather than NaN when nothing is set", () => {
    const style = {
      paddingInlineStart: "",
      direction: "ltr",
      paddingLeft: "",
      paddingRight: "",
    } as CSSStyleDeclaration;
    expect(inlineStartPadding(style)).toBe(0);
  });
});
