import { forwardRef, useImperativeHandle } from "react";

import { useCapillaryBleed } from "../hooks/useCapillaryBleed.js";
import { bleedMotionAllowed } from "../lib/bleed-bus.js";

export interface TantuBleedCanvasProps {
  /** Dye colour as #rrggbb. Defaults to indigo. */
  dye?: string;
  /** Milliseconds between trail droplets while the pointer travels. 0 disables the trail. */
  trailInterval?: number;
  /** Lifetime of a single droplet in ms. */
  duration?: number;
  /** Maximum spread radius in CSS px. */
  maxRadius?: number;
  /** Fibre-tear amplitude of the wet edge (0 = clean circle, 1 = shredded). */
  fray?: number;
  /** Peak opacity of the saturated substrate. */
  saturation?: number;
  /** Suspend the fly-shuttle without unmounting the substrate. */
  inert?: boolean;
  className?: string;
}

export interface TantuBleedCanvasHandle {
  /** Inject a droplet programmatically, in canvas-local px. */
  bleed(x: number, y: number): void;
  /**
   * Inject a droplet from anything carrying viewport coordinates — a pointer
   * or mouse event, or a `getBoundingClientRect()` centre — converting to
   * canvas-local px. The substrate is fixed and full-viewport, so this is the
   * form a caller almost always has: "bleed from where that element is".
   */
  bleedAt(event: { clientX: number; clientY: number }): void;
}

/**
 * The foundational substrate of the Tantu interface: a fixed, full-viewport
 * WebGL canvas resting behind every surface like raw cotton beneath the loom.
 *
 * Pointer contact anywhere in the document wicks dye through the weave. The
 * canvas is `pointer-events: none`, so it never intercepts interaction — the
 * hook listens on `window`, coordinates are mutated through refs (never state),
 * and the GPU carries the animation off the main thread.
 *
 * Mount once, at the root layout.
 *
 * ## Driving the substrate by hand
 *
 * A ref exposes `{ bleed, bleedAt }`, the same handle shape
 * `CapillaryBleedSurface` publishes, so a consumer can answer something that
 * is not a pointer gesture at all — an arriving message, a completed step, a
 * value crossing a threshold — in the substrate's own language:
 *
 * ```tsx
 * const loom = useRef<TantuBleedCanvasHandle>(null);
 * <TantuBleedCanvas ref={loom} />;
 * // later, from anywhere — bleed from where an element sits on screen:
 * const r = anchor.getBoundingClientRect();
 * loom.current?.bleedAt({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
 * ```
 *
 * Both methods are no-ops before mount, while `inert`, and where WebGL is
 * unavailable — the substrate degrades silently rather than throwing at a
 * caller who cannot know which of those is true.
 *
 * ### Where the gates are, and why
 *
 * A gesture-driven bleed passes `shouldBleed()` — the bus arbitrates which of
 * the stacked responders owns the press, and refuses a second answer to the
 * same event. A programmatic pulse has no gesture to arbitrate: no event to
 * claim, no target whose innermost owner could outrank the substrate. So the
 * arbitration is skipped, deliberately. A caller reaching for this handle is
 * asserting that the moment is theirs; if they want to defer to a narrative
 * bleed still spreading, `isAmbientHeld()` is exported and answers that.
 *
 * `bleedMotionAllowed()` is a different kind of question — a standing user
 * preference, not a contest between responders — and it is enforced *here*,
 * inside the handle, rather than left to the caller. Reduced motion should
 * not be something every consumer has to remember; a substrate is ambient
 * motion filling the whole viewport behind the interface, which is precisely
 * what the preference exists to suppress, and it carries no meaning a reader
 * loses when it stays still (the canvas is `aria-hidden` and decorative).
 *
 * This is a considered divergence from `CapillaryBleedSurface`, whose handle
 * passes straight through: that surface dyes a bounded region the consumer
 * deliberately wrapped around specific content, where the bleed can be the
 * response itself. The substrate is the one layer nobody opted into locally,
 * so it takes the stricter gate. The bus already ranks it lowest for the same
 * reason.
 */
export const TantuBleedCanvas = forwardRef<TantuBleedCanvasHandle, TantuBleedCanvasProps>(
  function TantuBleedCanvas(
    {
      dye = "#2E4B6B",
      trailInterval = 90,
      duration = 2600,
      maxRadius = 420,
      fray = 1,
      saturation = 0.5,
      inert = false,
      className,
    },
    ref,
  ) {
    const { canvasRef, bleed, bleedAt } = useCapillaryBleed({
      global: true,
      onContact: true,
      trailInterval,
      dye,
      duration,
      maxRadius,
      fray,
      saturation,
      inert,
    });

    useImperativeHandle(ref, () => ({
      bleed: (x: number, y: number) => {
        if (!bleedMotionAllowed()) return;
        bleed(x, y);
      },
      bleedAt: (event: { clientX: number; clientY: number }) => {
        if (!bleedMotionAllowed()) return;
        bleedAt(event);
      },
    }));

    return (
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={["tantu-loom-substrate", className].filter(Boolean).join(" ")}
      />
    );
  },
);
