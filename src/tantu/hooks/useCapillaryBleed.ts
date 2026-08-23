import { useCallback, useEffect, useRef, type RefObject } from "react";

import {
  createCapillaryBleed,
  type CapillaryBleedHandle,
  type CapillaryBleedOptions,
} from "../lib/capillary-bleed";

export interface UseCapillaryBleedOptions extends CapillaryBleedOptions {
  /**
   * Element whose pointer contacts inject dye. Defaults to the canvas'
   * offset parent, so a canvas laid over a card bleeds from the whole card.
   */
  target?: RefObject<HTMLElement | null>;
  /** Bleed on pointer contact. Turn off to drive the surface only via `bleed()`. */
  onContact?: boolean;
  /**
   * Also bleed while the pointer travels across the surface, throttled to
   * this many ms. `0` disables trailing.
   */
  trailInterval?: number;
  /** Suspend the engine without unmounting the canvas. */
  inert?: boolean;
  /**
   * Listen on `window` instead of the host element, so contacts anywhere in
   * the document reach the substrate. Required for a fixed, pointer-events:
   * none canvas sitting behind the whole UI.
   */
  global?: boolean;
}

export interface UseCapillaryBleedResult {
  /** Attach to the `<canvas>` that renders the dye field. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Inject a droplet at coordinates local to the canvas, in CSS px. */
  bleed: (x: number, y: number) => void;
  /** Inject a droplet from any pointer/mouse event, converting page coords. */
  bleedAt: (event: { clientX: number; clientY: number }) => void;
}

/**
 * Track pointer coordinates anywhere in the UI and feed them to the T2
 * capillary shader.
 *
 * The engine keeps a ring buffer of live droplets; each contact writes
 * (x, y, t0, seed) into a uniform array that the fragment shader evaluates as
 * D(x, y, t) — a fBm-perturbed distance field with radius R(t) = R(1 − e^−kt).
 * The render loop parks itself when no droplet is in flight, so an idle
 * surface costs nothing.
 *
 * ```tsx
 * const { canvasRef } = useCapillaryBleed({ dye: "#82231D", trailInterval: 90 });
 * return (
 *   <section className="tantu-bleed-host">
 *     <canvas ref={canvasRef} className="tantu-bleed-canvas" aria-hidden="true" />
 *     <h2 className="tantu-heading-kalam">Strike the weft.</h2>
 *   </section>
 * );
 * ```
 */
export function useCapillaryBleed(options: UseCapillaryBleedOptions = {}): UseCapillaryBleedResult {
  const {
    target,
    onContact = true,
    trailInterval = 0,
    inert = false,
    global: listenGlobally = false,
    dye,
    duration,
    maxRadius,
    fray,
    saturation,
  } = options;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CapillaryBleedHandle | null>(null);
  const lastTrail = useRef(0);

  const bleed = useCallback((x: number, y: number) => {
    engineRef.current?.bleed(x, y);
  }, []);

  const bleedAt = useCallback((event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    engineRef.current?.bleed(event.clientX - rect.left, event.clientY - rect.top);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || inert) return;

    const engine = createCapillaryBleed(canvas, { dye, duration, maxRadius, fray, saturation });
    engineRef.current = engine;

    const host: (HTMLElement | Window) | null = listenGlobally
      ? window
      : (target?.current ?? (canvas.parentElement as HTMLElement | null));
    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);

    const emit = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      engine.bleed(event.clientX - rect.left, event.clientY - rect.top);
    };
    const onDown = (event: PointerEvent) => emit(event);
    const onMove = (event: PointerEvent) => {
      const now = performance.now();
      if (now - lastTrail.current < trailInterval) return;
      lastTrail.current = now;
      emit(event);
    };

    if (host && onContact) host.addEventListener("pointerdown", onDown as EventListener);
    if (host && trailInterval > 0) host.addEventListener("pointermove", onMove as EventListener);

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => engine.resize());
      observer.observe(canvas);
    }

    return () => {
      window.removeEventListener("resize", onResize);
      host?.removeEventListener("pointerdown", onDown as EventListener);
      host?.removeEventListener("pointermove", onMove as EventListener);
      observer?.disconnect();
      engine.dispose();
      engineRef.current = null;
    };
  }, [target, onContact, trailInterval, inert, listenGlobally, dye, duration, maxRadius, fray, saturation]);

  return { canvasRef, bleed, bleedAt };
}
