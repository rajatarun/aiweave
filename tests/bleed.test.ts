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
  FIBRES,
  fibreSpec,
  type TantuFibre,
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

describe("the shader takes its fibre as a parameter, not a constant", () => {
  // History: WICK_T0 and WICK_ANISOTROPY were each typed a second time as
  // bare GLSL literals, held in step with these exports by nothing but a
  // comment. That was fixed by interpolating the exports into the shader
  // source, and this block used to extract those interpolated numbers and
  // compare them.
  //
  // Both are uniforms now, which retires the drift question entirely — you
  // cannot desynchronise one number — and answers a larger one. Compiled in,
  // the constants were not merely duplicated, they were *frozen*: every
  // surface on every page wicked like cotton because cotton is what those
  // figures describe. So what needs guarding is no longer "do the copies
  // agree" but "is it still a parameter at all".
  it("declares both fibre values as uniforms", () => {
    expect(FRAGMENT_SHADER).toMatch(/uniform\s+float\s+u_wickT0\s*;/);
    expect(FRAGMENT_SHADER).toMatch(/uniform\s+float\s+u_anisotropy\s*;/);
  });

  it("reads them, rather than a literal baked into the source", () => {
    expect(FRAGMENT_SHADER).toMatch(/float\s+T0\s*=\s*u_wickT0\s*;/);
    expect(FRAGMENT_SHADER).toMatch(/d\.x\s*\/=\s*1\.0\s*\+\s*u_anisotropy\s*\*\s*growth\s*;/);
  });

  it("has no hardcoded copy of either value left in it", () => {
    // The regression this exists to catch: someone re-inlines a literal for
    // convenience and the axis silently stops being an axis again.
    expect(FRAGMENT_SHADER).not.toMatch(/float\s+T0\s*=\s*[\d.]+\s*;/);
    expect(FRAGMENT_SHADER).not.toMatch(/1\.0\s*\+\s*[\d.]+\s*\*\s*growth/);
  });
});

describe("fibre — the wicking law's constants are a material, not a law", () => {
  it("cotton is exactly what the system rendered before the axis existed", () => {
    // The non-breaking guarantee. Every consumer that has ever drawn a bleed
    // drew it with these two numbers; if they move, existing pages change.
    expect(FIBRES.cotton.anisotropy).toBe(0.18);
    expect(FIBRES.cotton.t0).toBe(0.04);
    expect(WICK_ANISOTROPY).toBe(FIBRES.cotton.anisotropy);
    expect(WICK_T0).toBe(FIBRES.cotton.t0);
  });

  it("defaults to cotton when asked for nothing, or for something unknown", () => {
    expect(fibreSpec()).toEqual(FIBRES.cotton);
    expect(fibreSpec(null)).toEqual(FIBRES.cotton);
    expect(fibreSpec("hemp" as never)).toEqual(FIBRES.cotton);
  });

  it("changes the shape of the front, not just its size", () => {
    // The consequence check. An axis that only renamed something would pass
    // every other test in this file.
    const cotton = wickRadii(100, 1, "cotton");
    const silk = wickRadii(100, 1, "silk");
    const felt = wickRadii(100, 1, "felt");

    // Same weft reach, different warp reach: that is anisotropy.
    expect(silk.ry).toBe(cotton.ry);
    expect(silk.rx).toBeGreaterThan(cotton.rx);

    // Felt was never woven, so it has no axis to run along: a circle.
    expect(felt.rx).toBe(felt.ry);
    expect(cotton.rx).toBeGreaterThan(cotton.ry);
  });

  it("orders the fibres the way their morphology does", () => {
    // Continuous filament conducts furthest; crimped staple least; matted
    // fibre not at all. These are calibrated design values rather than
    // measurements, but the ordering is the part that carries meaning.
    const axial = (f: TantuFibre) => FIBRES[f].anisotropy;
    expect(axial("silk")).toBeGreaterThan(axial("linen"));
    expect(axial("linen")).toBeGreaterThan(axial("cotton"));
    expect(axial("cotton")).toBeGreaterThan(axial("wool"));
    expect(axial("wool")).toBeGreaterThan(axial("felt"));
    expect(axial("felt")).toBe(0);
  });

  it("a slower fibre takes longer to get going", () => {
    // t0 is the inertial crossover: bigger means a later, gentler start.
    const early = wickProgress(0.05, FIBRES.silk.t0);
    const late = wickProgress(0.05, FIBRES.wool.t0);
    expect(early).toBeGreaterThan(late);
  });

  it("covers the box whatever the fibre, which is what coverRadius promises", () => {
    for (const fibre of Object.keys(FIBRES) as TantuFibre[]) {
      const cover = wickCoverRadius(300, 200, 150, 100, fibre);
      const { rx, ry } = wickRadii(cover, 1, fibre);
      // The corner must be inside the ellipse the front has reached.
      expect((150 / rx) ** 2 + (100 / ry) ** 2).toBeLessThanOrEqual(1.0001);
    }
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
