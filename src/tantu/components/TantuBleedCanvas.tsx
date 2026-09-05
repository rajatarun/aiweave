import { useCapillaryBleed } from "../hooks/useCapillaryBleed.js";

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
 */
export function TantuBleedCanvas({
  dye = "#2E4B6B",
  trailInterval = 90,
  duration = 2600,
  maxRadius = 420,
  fray = 1,
  saturation = 0.5,
  inert = false,
  className,
}: TantuBleedCanvasProps) {
  const { canvasRef } = useCapillaryBleed({
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

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={["tantu-loom-substrate", className].filter(Boolean).join(" ")}
    />
  );
}
