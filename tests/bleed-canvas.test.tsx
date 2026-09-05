/**
 * The loom substrate's programmatic handle.
 *
 * `TantuBleedCanvas` drove `useCapillaryBleed` internally and returned
 * nothing, so the substrate could only ever answer a pointer even though the
 * engine underneath has always taken coordinates. These tests hold the two
 * things that fix has to be true about: the ref reaches the engine, and the
 * reduced-motion gate sits *inside* the handle rather than at the call site.
 *
 * jsdom has no WebGL, so `createCapillaryBleed` hands back its no-op handle
 * and no droplet is observable. What is observable is the coordinate
 * conversion on the way there: `bleedAt` reads the canvas' box before it
 * reaches the engine, so a spy on `getBoundingClientRect` says whether the
 * call got past the gate. That is the negative control for the whole file —
 * remove the gate and the reduced-motion case below fails.
 */
import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { render } from "@testing-library/react";

import {
  TantuBleedCanvas,
  type TantuBleedCanvasHandle,
} from "../src/tantu/components/TantuBleedCanvas";

/** Answer every media query, with reduced motion set either way. */
function setReducedMotion(reduce: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    ((query: string) => ({
      matches: reduce && /prefers-reduced-motion/.test(query),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    })) as never,
  );
}

/** Watch the coordinate conversion that stands between the handle and the engine. */
function watchConversion() {
  const spy = vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect");
  spy.mockClear();
  return spy;
}

describe("TantuBleedCanvas — the substrate with no ref attached", () => {
  it("renders the substrate unchanged", () => {
    const { container } = render(<TantuBleedCanvas />);
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(canvas).toHaveClass("tantu-loom-substrate");
    expect(canvas).toHaveAttribute("aria-hidden", "true");
  });

  it("still takes a className alongside its own", () => {
    const { container } = render(<TantuBleedCanvas className="page-ground" />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveClass("tantu-loom-substrate");
    expect(canvas).toHaveClass("page-ground");
  });
});

describe("TantuBleedCanvas — the forwarded capillary handle", () => {
  it("exposes { bleed, bleedAt }, the shape CapillaryBleedSurface publishes", () => {
    const ref = createRef<TantuBleedCanvasHandle>();
    render(<TantuBleedCanvas ref={ref} />);
    expect(ref.current).not.toBeNull();
    expect(typeof ref.current?.bleed).toBe("function");
    expect(typeof ref.current?.bleedAt).toBe("function");
  });

  it("reaches the engine without a gesture to arbitrate", () => {
    setReducedMotion(false);
    const ref = createRef<TantuBleedCanvasHandle>();
    render(<TantuBleedCanvas ref={ref} />);
    const conversion = watchConversion();

    ref.current?.bleedAt({ clientX: 120, clientY: 48 });

    expect(conversion).toHaveBeenCalled();
  });

  it("honours reduced motion inside the handle, so consumers need not", () => {
    setReducedMotion(true);
    const ref = createRef<TantuBleedCanvasHandle>();
    render(<TantuBleedCanvas ref={ref} />);
    const conversion = watchConversion();

    ref.current?.bleedAt({ clientX: 120, clientY: 48 });
    expect(() => ref.current?.bleed(10, 10)).not.toThrow();

    expect(conversion).not.toHaveBeenCalled();
  });

  it("is a silent no-op where the engine never opened — inert, or no WebGL", () => {
    setReducedMotion(false);
    const ref = createRef<TantuBleedCanvasHandle>();
    render(<TantuBleedCanvas ref={ref} inert />);

    expect(() => ref.current?.bleed(4, 4)).not.toThrow();
    expect(() => ref.current?.bleedAt({ clientX: 4, clientY: 4 })).not.toThrow();
  });
});
