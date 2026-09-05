import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { createCapillaryBleed, type CapillaryBleedHandle } from "../lib/capillary-bleed.js";
import { registerBleedNode, shouldBleed } from "../lib/bleed-bus.js";
import { resolveDye, type TantuDye } from "../lib/dye.js";
import { InkBleedFilter } from "./InkBleedFilter.js";

/**
 * Dye primitives available to a bleed surface, drawn live from the vat.
 *
 * An alias for TantuDye (lib/dye.ts), not a second, narrower list. It used
 * to be its own five-member union — madder, indigo, copper, marigold, iron —
 * while the registry it actually resolved against already named ten,
 * missing madderFlame, indigoSky, katha, zari and zariTarnish for no reason
 * the shader or the engine required: `u_dye` is one arbitrary vec3 uniform
 * per draw call, with no concept of a fixed palette at all. The restriction
 * lived entirely in this type alias. Widening it is additive — every value
 * that satisfied the old union still satisfies this one.
 */
export type BleedDye = TantuDye;

export interface CapillaryBleedSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  /** Natural dye drawn into the substrate on contact. */
  dye?: BleedDye;
  /** Droplet lifetime in ms. */
  duration?: number;
  /** Maximum spread radius in px. */
  maxRadius?: number;
  /** Fibre-tear amplitude of the wet edge, 0 to 1. */
  fray?: number;
  /** Peak substrate saturation, 0 to 1. */
  saturation?: number;
  /** Disable the shader without unmounting the surface. */
  inert?: boolean;
}

export interface CapillaryBleedSurfaceHandle {
  /** Inject a droplet programmatically, in element-local px. */
  bleed(x: number, y: number): void;
}

/**
 * T2 — MORDANT CAPILLARY BLEED.
 *
 * Wraps any content in a live dye substrate. Pointer contact (mouse, pen or
 * touch) injects mordant at the contact coordinate; a WebGL fragment shader
 * wicks it outward along the warp/weft axes with a turbulence-torn front.
 * Falls back silently to the untouched substrate where WebGL is unavailable.
 */
export const CapillaryBleedSurface = forwardRef<CapillaryBleedSurfaceHandle, CapillaryBleedSurfaceProps>(
  function CapillaryBleedSurface(
    {
      dye = "madder",
      duration = 1400,
      maxRadius = 220,
      fray = 0.65,
      saturation = 0.85,
      inert = false,
      className,
      children,
      onPointerDown,
      ...rest
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const engineRef = useRef<CapillaryBleedHandle | null>(null);
    const hostRef = useRef<HTMLDivElement | null>(null);

    // Declare this region as the "surface" owner of gestures inside it, so the
    // loom substrate underneath stands down rather than blooming through the
    // same press — and so a control nested in here (which outranks a surface)
    // can in turn take the gesture from this surface. See lib/bleed-bus.
    useEffect(() => registerBleedNode(hostRef.current, "surface"), []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || inert) return;
      const engine = createCapillaryBleed(canvas, {
        dye: resolveDye(dye, canvas),
        duration,
        maxRadius,
        fray,
        saturation,
      });
      engineRef.current = engine;
      const onResize = () => engine.resize();
      window.addEventListener("resize", onResize);
      return () => {
        window.removeEventListener("resize", onResize);
        engine.dispose();
        engineRef.current = null;
      };
    }, [dye, duration, maxRadius, fray, saturation, inert]);

    useImperativeHandle(ref, () => ({
      bleed: (x: number, y: number) => engineRef.current?.bleed(x, y),
    }));

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerDown?.(event);
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (!shouldBleed(event.nativeEvent, "surface")) return;
        const rect = canvas.getBoundingClientRect();
        engineRef.current?.bleed(event.clientX - rect.left, event.clientY - rect.top);
      },
      [onPointerDown],
    );

    return (
      <div
        {...rest}
        ref={hostRef}
        className={["tantu-bleed-host", className].filter(Boolean).join(" ")}
        onPointerDown={handlePointerDown}
      >
        <canvas ref={canvasRef} className="tantu-bleed-canvas" aria-hidden="true" />
        <InkBleedFilter id={`tantu-bleed-${dye}`} />
        {children}
      </div>
    );
  },
);
