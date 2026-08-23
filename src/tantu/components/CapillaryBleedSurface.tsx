import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { createCapillaryBleed, type CapillaryBleedHandle } from "../lib/capillary-bleed";
import { resolveDye } from "../lib/dye";
import { InkBleedFilter } from "./InkBleedFilter";

/** Dye primitives available to a bleed surface, drawn live from the vat. */
export type BleedDye = "madder" | "indigo" | "copper" | "marigold" | "iron";

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
        const rect = canvas.getBoundingClientRect();
        engineRef.current?.bleed(event.clientX - rect.left, event.clientY - rect.top);
      },
      [onPointerDown],
    );

    return (
      <div
        {...rest}
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
