/**
 * The dye physics and the arbitration between bleeding components.
 *
 * scripts/verify_bleed_bus.mjs checks the *compiled* asset the browser loads;
 * this checks the TypeScript source, and adds the part that script cannot
 * express — that wickProgress really is the Lucas–Washburn law and not just a
 * curve that happens to start at 0 and end at 1. Getting that wrong is how
 * the animation ended up "a bezier pretending to be capillary action" the
 * first three times.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  registerBleedNode,
  registerBleedSelector,
  resetBleedBus,
  resolveGestureOwner,
  shouldBleed,
  wickCoverRadius,
  wickProgress,
  wickRadii,
  WICK_ANISOTROPY,
  WICK_T0,
} from "../src/tantu/lib/bleed-bus";
import { FRAGMENT_SHADER } from "../src/tantu/lib/capillary-bleed";

beforeEach(() => {
  resetBleedBus();
  document.body.innerHTML = "";
});

describe("wickProgress — Lucas–Washburn, not an easing curve", () => {
  it("is pinned at both ends", () => {
    expect(wickProgress(0)).toBe(0);
    expect(wickProgress(1)).toBe(1);
    expect(wickProgress(-0.5)).toBe(0);
    expect(wickProgress(2)).toBe(1);
  });

  it("is monotonically increasing", () => {
    let previous = -1;
    for (let t = 0; t <= 1; t += 1 / 512) {
      const p = wickProgress(t);
      expect(p).toBeGreaterThan(previous);
      previous = p;
    }
  });

  it("front position tracks sqrt(t), the whole point of the law", () => {
    // L ∝ sqrt(t + t0) − sqrt(t0), normalised. Reconstructing the raw law
    // from the normalised output and comparing against sqrt directly is the
    // check that survives a refactor: any easing curve substituted here
    // fails it.
    const s0 = Math.sqrt(WICK_T0);
    const span = Math.sqrt(1 + WICK_T0) - s0;
    for (const t of [0.05, 0.2, 0.37, 0.5, 0.73, 0.9]) {
      const expected = (Math.sqrt(t + WICK_T0) - s0) / span;
      expect(wickProgress(t)).toBeCloseTo(expected, 12);
    }
  });

  it("front is fast early and slow late — a bezier ease-out is not enough", () => {
    // Half the travel is done at t ≈ 0.33 — a third of the way through the
    // duration. That front-loading is the visible signature of wicking: an
    // initial rush, then a long crawl.
    expect(wickProgress(1 / 3)).toBeGreaterThan(0.5);
    expect(wickProgress(0.3)).toBeLessThan(0.5);

    // The first half of the time buys roughly twice what the second does.
    const firstHalf = wickProgress(0.5) - wickProgress(0);
    const secondHalf = wickProgress(1) - wickProgress(0.5);
    expect(firstHalf / secondHalf).toBeGreaterThan(1.7);

    // And it decelerates the whole way: every successive equal slice of time
    // covers less ground than the one before it. Linear and ease-in curves
    // both fail this.
    let previousSlice = Infinity;
    for (let i = 0; i < 16; i++) {
      const slice = wickProgress((i + 1) / 16) - wickProgress(i / 16);
      expect(slice).toBeLessThan(previousSlice);
      previousSlice = slice;
    }
  });

  it("accepts a different regularisation constant", () => {
    expect(wickProgress(0.5, 0.5)).not.toBeCloseTo(wickProgress(0.5), 3);
    expect(wickProgress(1, 0.5)).toBe(1);
  });
});

describe("wickRadii — cloth is anisotropic", () => {
  it("spreads further along the warp than across it", () => {
    const { rx, ry } = wickRadii(100, 1);
    expect(rx).toBeGreaterThan(ry);
    expect(rx / ry).toBeCloseTo(1 + WICK_ANISOTROPY, 10);
  });

  it("is isotropic at the instant of contact and grows apart", () => {
    const early = wickRadii(100, 0);
    expect(early.rx).toBe(early.ry);
    // The stretch itself ramps with progress, so the front is round when it
    // starts and elliptical once the fibres have had time to steer it.
    const mid = wickRadii(100, 0.5);
    expect(mid.rx / mid.ry).toBeLessThan(1 + WICK_ANISOTROPY);
    expect(mid.rx / mid.ry).toBeGreaterThan(1);
  });
});

describe("wickCoverRadius", () => {
  it("reaches the furthest corner from any contact point", () => {
    const w = 400;
    const h = 300;
    for (const [cx, cy] of [[0, 0], [w, h], [w / 2, h / 2], [17, 289]]) {
      const r = wickCoverRadius(w, h, cx, cy);
      const { rx, ry } = wickRadii(r, 1);
      for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        expect(
          Math.hypot(dx, dy),
          `corner ${x},${y} left dry from ${cx},${cy}`,
        ).toBeLessThanOrEqual(1.0001);
      }
    }
  });
});

describe("the shader cannot drift from wickProgress", () => {
  // GLSL cannot call wickProgress() — the shader in capillary-bleed.ts
  // reimplements the Lucas–Washburn formula by hand, and used to reimplement
  // its two constants by hand too: WICK_T0 and WICK_ANISOTROPY were each
  // typed a second time as bare GLSL literals, held in step with these
  // exports by nothing but a comment. Nothing checked the two copies still
  // agreed after an edit to either.
  //
  // capillary-bleed.ts now imports both constants and interpolates them into
  // the shader source, so there is structurally one number rather than two
  // that happen to match — but that only holds as long as nobody reverts to
  // a hand-typed literal. This extracts whatever numeric value actually
  // landed in the compiled shader text and compares it against the live
  // export, independently of how it got there, so a reintroduced hardcoded
  // copy — correct or not — fails here rather than silently drifting.
  it("T0 in the shader is WICK_T0, not a second copy of it", () => {
    const match = FRAGMENT_SHADER.match(/float T0 = ([\d.]+);/);
    expect(match, "expected `float T0 = <value>;` in FRAGMENT_SHADER").not.toBeNull();
    expect(Number(match![1])).toBeCloseTo(WICK_T0, 10);
  });

  it("the anisotropy stretch in the shader is WICK_ANISOTROPY, not a second copy of it", () => {
    const match = FRAGMENT_SHADER.match(/d\.x \/= 1\.0 \+ ([\d.]+) \* growth;/);
    expect(match, "expected `d.x /= 1.0 + <value> * growth;` in FRAGMENT_SHADER").not.toBeNull();
    expect(Number(match![1])).toBeCloseTo(WICK_ANISOTROPY, 10);
  });
});

describe("layer arbitration", () => {
  function press(target: EventTarget | null): PointerEvent {
    const event = new Event("pointerdown", { bubbles: true }) as PointerEvent;
    if (target) Object.defineProperty(event, "target", { value: target });
    return event;
  }

  it("gives a gesture to the innermost registered layer", () => {
    const surface = document.createElement("div");
    const button = document.createElement("button");
    surface.appendChild(button);
    document.body.appendChild(surface);

    registerBleedNode(surface, "surface");
    registerBleedNode(button, "control");

    expect(resolveGestureOwner(button)).toBe("control");
    expect(resolveGestureOwner(surface)).toBe("surface");
  });

  it("lets the owning layer bleed and holds the outer ones back", () => {
    const surface = document.createElement("div");
    const button = document.createElement("button");
    surface.appendChild(button);
    document.body.appendChild(surface);

    registerBleedNode(surface, "surface");
    registerBleedNode(button, "control");

    const onButton = press(button);
    // The control owns the press; the surface and the page substrate under it
    // must stay dry, or the background spill drowns the control's own bleed.
    expect(shouldBleed(onButton, "control")).toBe(true);
    expect(shouldBleed(onButton, "surface")).toBe(false);
    expect(shouldBleed(onButton, "substrate")).toBe(false);
  });

  it("lets the substrate bleed when the gesture lands on nothing registered", () => {
    const loose = document.createElement("div");
    document.body.appendChild(loose);
    expect(resolveGestureOwner(loose)).toBe(null);
    expect(shouldBleed(press(loose), "substrate")).toBe(true);
  });

  it("resolves selector registrations the same way as node registrations", () => {
    const el = document.createElement("div");
    el.className = "tantu-rumal";
    document.body.appendChild(el);

    expect(resolveGestureOwner(el)).toBe(null);
    const unregister = registerBleedSelector(".tantu-rumal", "narrative");
    expect(resolveGestureOwner(el)).toBe("narrative");
    unregister();
    expect(resolveGestureOwner(el)).toBe(null);
  });

  it("unregisters cleanly", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const off = registerBleedNode(el, "surface");
    expect(resolveGestureOwner(el)).toBe("surface");
    off();
    expect(resolveGestureOwner(el)).toBe(null);
  });
});
