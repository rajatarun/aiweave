/**
 * jsdom is a DOM, not a browser: it has no layout engine, no canvas, no audio
 * and no animation clock. Tantu's components are built to degrade when those
 * are missing — the dye engines return a no-op handle, the loom audio never
 * opens a context — so the point of this file is NOT to fake a browser. It is
 * to supply the few APIs whose *absence throws* rather than returning null,
 * so a component under test fails on its own behaviour instead of on the
 * environment.
 *
 * Anything that genuinely needs pixels (the capillary shader, the frayed-edge
 * filter, the wick timing) is verified in Chromium instead — see
 * scripts/keyboard-harness.html and the browser pass in `npm run verify`.
 */
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// jsdom throws "not implemented" from getContext rather than returning null,
// which is the contract the engines are written against.
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
}

// matchMedia is absent entirely; every consumer in Tantu asks it about a
// preference and treats "no match" as the default.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as never;
}

// jsdom ships no rAF in some configurations, and the bleed loop drives itself
// off it. A macrotask is close enough for logic that only cares about ordering.
if (typeof window !== "undefined" && !window.requestAnimationFrame) {
  window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number) as never;
  window.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as never;
}

// jsdom implements no SVG geometry and no Web Animations API. Both are real
// in every browser Tantu supports; stubbing them here keeps a logic test from
// failing on a missing method rather than on the behaviour under test.
if (typeof SVGElement !== "undefined") {
  const proto = SVGElement.prototype as unknown as Record<string, unknown>;
  if (!proto.getTotalLength) proto.getTotalLength = () => 0;
}
if (typeof Element !== "undefined" && !Element.prototype.animate) {
  Element.prototype.animate = function animate() {
    const anim = {
      onfinish: null as (() => void) | null,
      oncancel: null as (() => void) | null,
      cancel() {},
      finish() {},
    };
    return anim as unknown as Animation;
  };
}

// jsdom has no IntersectionObserver; several components use it to defer an
// entrance animation until the element scrolls in. Reporting "always visible"
// exercises the path that actually renders content.
if (typeof window !== "undefined" && !("IntersectionObserver" in window)) {
  class StubIntersectionObserver {
    constructor(private cb: IntersectionObserverCallback) {}
    observe(target: Element) {
      this.cb(
        [{ isIntersecting: true, target } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    }
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds: number[] = [];
  }
  (globalThis as Record<string, unknown>).IntersectionObserver = StubIntersectionObserver;
}

// Same story for ResizeObserver.
if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
  class StubResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as Record<string, unknown>).ResizeObserver = StubResizeObserver;
}
