import { forwardRef, useCallback, useRef, type ButtonHTMLAttributes, type PointerEvent as ReactPointerEvent } from "react";

import { createCapillaryBleed, type CapillaryBleedHandle } from "../lib/capillary-bleed.js";
import { registerBleedNode, shouldBleed } from "../lib/bleed-bus.js";
import { resolveDye, type TantuDye } from "../lib/dye.js";
import { useEffect } from "react";

export type TantuButtonVariant = "primary" | "secondary" | "ghost";

export interface TantuButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: TantuButtonVariant;
  /** Emit a mordant capillary bleed from the contact point on press. */
  bleed?: boolean;
}

/**
 * The WebGL dye simulation samples raw pigment, not CSS, so each variant names
 * a dye in the shared vat and the pigment itself is read off the live cascade
 * at mount — a consumer re-dyeing the tokens moves the bleed front with them.
 */
const DYE_BY_VARIANT: Record<TantuButtonVariant, TantuDye> = {
  primary: "zari",
  secondary: "indigo",
  ghost: "katha",
};

/**
 * Zardozi-relief action control. Presses commit with a T3 Batten Strike and,
 * when `bleed` is on, a T2 capillary dye front from the contact coordinate.
 */
export const TantuButton = forwardRef<HTMLButtonElement, TantuButtonProps>(function TantuButton(
  { variant = "primary", bleed = true, className, children, onPointerDown, ...rest },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CapillaryBleedHandle | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Keep the forwarded ref working while still holding our own handle.
  const attachButton = useCallback(
    (node: HTMLButtonElement | null) => {
      buttonRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: HTMLButtonElement | null }).current = node;
    },
    [ref],
  );

  // A control outranks the surface and substrate beneath it: pressing a button
  // should read as the button answering, not as three dye fronts at once. The
  // registration is what makes that true even for responders that listen to a
  // different event than this one. See lib/bleed-bus.
  useEffect(() => {
    if (!bleed) return;
    return registerBleedNode(buttonRef.current, "control");
  }, [bleed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bleed) return;
    const engine = createCapillaryBleed(canvas, {
      dye: resolveDye(DYE_BY_VARIANT[variant], canvas),
      duration: 900,
      maxRadius: 120,
      fray: 0.8,
      saturation: 0.55,
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [variant, bleed]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      onPointerDown?.(event);
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (!shouldBleed(event.nativeEvent, "control")) return;
      const rect = canvas.getBoundingClientRect();
      engineRef.current?.bleed(event.clientX - rect.left, event.clientY - rect.top);
    },
    [onPointerDown],
  );

  return (
    <button
      {...rest}
      ref={attachButton}
      onPointerDown={handlePointerDown}
      className={["tantu-btn", `tantu-btn-${variant}`, "tantu-btn-strike", className].filter(Boolean).join(" ")}
    >
      {bleed ? <canvas ref={canvasRef} className="tantu-bleed-canvas" aria-hidden="true" /> : null}
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </button>
  );
});
