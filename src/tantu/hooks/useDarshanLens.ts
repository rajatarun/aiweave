import { useCallback, useEffect, useRef, useState } from "react";
import { getLoomAudio, panForX } from "../lib/loom-audio.js";

export interface DarshanTransform {
  /** Lens offset over the cloth, in device pixels. */
  x: number;
  y: number;
  /** Optical magnification of the base-6 lattice. */
  zoom: number;
}

export interface UseDarshanLensOptions {
  /** Smallest the lattice may ever be drawn. The weave never shrinks past 1. */
  minZoom?: number;
  maxZoom?: number;
  /** Selector for the data nodes the lens magnetically seats onto. */
  nodeSelector?: string;
  /** Emit glass-on-cotton friction and the distant loom rumble while dragging. */
  acoustic?: boolean;
}

interface Pointer {
  x: number;
  y: number;
}

// The cloth is heavy, but it must still glide: momentum decays slowly enough
// that a single flick carries the lens across the weave.
const FRICTION = 0.95;
const MIN_FLICK = 0.12;
// Magnetic anchorage only bites when a node is already close to centre;
// beyond this the cloth is left exactly where the hand released it.
const SNAP_RADIUS = 160;

// One press of a pan control moves the glass by a little over a quarter of the
// aperture: far enough to be worth the press, short enough that the reader
// keeps their place in the weave. The floor covers a very short aperture,
// where a proportional step would be a few pixels.
const PAN_STEP_RATIO = 0.28;
const PAN_STEP_MIN = 48;
// One press of a magnification control. Four presses cross the whole 1–4
// range, so the buttons reach every zoom a pinch can.
const ZOOM_STEP = 1.45;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * The Darshan Lens.
 *
 * The mobile screen is not a smaller loom — it is a heavy brass magnifying
 * glass held over an immense, physically unyielding textile. Nothing reflows,
 * nothing stacks, nothing breaks: the cloth is dragged bodily beneath the
 * glass, and the base-6 lattice is optically expanded rather than rescaled.
 *
 * Returns the live transform plus the handlers to bind to the lens frame.
 */
export function useDarshanLens(options: UseDarshanLensOptions = {}) {
  const {
    minZoom = 1,
    maxZoom = 4,
    nodeSelector = "[data-darshan-node]",
    acoustic = true,
  } = options;

  const frameRef = useRef<HTMLDivElement | null>(null);
  const planeRef = useRef<HTMLDivElement | null>(null);
  // The lens frame mounts only once the glass is engaged, so binding waits on
  // the node itself rather than on first render.
  const [frameNode, setFrameNode] = useState<HTMLDivElement | null>(null);
  const attachFrame = useCallback((node: HTMLDivElement | null) => {
    frameRef.current = node;
    setFrameNode(node);
  }, []);

  const [transform, setTransform] = useState<DarshanTransform>({ x: 0, y: 0, zoom: 1 });
  const [dragging, setDragging] = useState(false);
  const [gliding, setGliding] = useState(false);
  const [seated, setSeated] = useState<string | null>(null);

  // Every mutable value the native listeners read lives in refs: the pointer
  // handlers are bound once and must never see a stale closure.
  const tRef = useRef(transform);
  tRef.current = transform;

  const pointers = useRef(new Map<number, Pointer>());
  const last = useRef<{ x: number; y: number; t: number } | null>(null);
  const velocity = useRef({ x: 0, y: 0 });
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const raf = useRef<number | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

  const apply = useCallback(
    (next: DarshanTransform) => {
      tRef.current = next;
      setTransform(next);
    },
    [],
  );

  /** Clamp the lens so the cloth always covers the aperture edge to edge. */
  const bound = useCallback((next: DarshanTransform): DarshanTransform => {
    const frame = frameRef.current;
    const plane = planeRef.current;
    if (!frame || !plane) return next;
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    const cw = plane.offsetWidth * next.zoom;
    const ch = plane.offsetHeight * next.zoom;
    // Slack of one full aperture: the weave may be pulled past its selvedge,
    // but never so far that the lens looks at nothing.
    return {
      zoom: next.zoom,
      x: clamp(next.x, Math.min(0, fw - cw), 0),
      y: clamp(next.y, Math.min(0, fh - ch), 0),
    };
  }, []);

  /** Magnetic anchorage: seat the nearest woven node dead-centre. */
  const snap = useCallback(
    (from: DarshanTransform, silent = false) => {
      const frame = frameRef.current;
      const plane = planeRef.current;
      if (!frame || !plane) return;
      const nodes = Array.from(plane.querySelectorAll<HTMLElement>(nodeSelector));
      if (nodes.length === 0) {
        apply(bound(from));
        return;
      }
      const cx = frame.clientWidth / 2;
      const cy = frame.clientHeight / 2;
      let best: { node: HTMLElement; x: number; y: number; d: number } | null = null;
      for (const node of nodes) {
        // Untransformed geometry of the node within the cloth.
        const nx = node.offsetLeft + node.offsetWidth / 2;
        const ny = node.offsetTop + node.offsetHeight / 2;
        const x = cx - nx * from.zoom;
        const y = cy - ny * from.zoom;
        const d = (x - from.x) ** 2 + (y - from.y) ** 2;
        if (!best || d < best.d) best = { node, x, y, d };
      }
      if (!best) return;
      // Too far from any node: the weave rests where it was let go.
      if (Math.sqrt(best.d) > SNAP_RADIUS) {
        apply(bound(from));
        return;
      }
      apply(bound({ zoom: from.zoom, x: best.x, y: best.y }));
      setSeated(best.node.dataset["darshanNode"] ?? null);
      if (!silent && acoustic) {
        getLoomAudio().lockDate(panForX(cx, window.innerWidth));
      }
    },
    [acoustic, apply, bound, nodeSelector],
  );

  /** Kinetic glide after release, terminating in mechanical anchorage. */
  const glide = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    // Reduced motion: the cloth stops dead and seats immediately.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      velocity.current = { x: 0, y: 0 };
      snap(tRef.current);
      return;
    }
    setGliding(true);
    const step = () => {
      const v = velocity.current;
      if (Math.abs(v.x) < MIN_FLICK && Math.abs(v.y) < MIN_FLICK) {
        raf.current = null;
        setGliding(false);
        snap(tRef.current);
        return;
      }
      v.x *= FRICTION;
      v.y *= FRICTION;
      apply(bound({ ...tRef.current, x: tRef.current.x + v.x, y: tRef.current.y + v.y }));
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, [apply, bound, snap]);

  /**
   * The Macro Snap: drop the glass flat onto one block so it fills the
   * aperture exactly, and lock it there.
   */
  const macroSnap = useCallback(
    (node: HTMLElement) => {
      const frame = frameRef.current;
      if (!frame) return;
      const fw = frame.clientWidth;
      const fh = frame.clientHeight;
      const fit = Math.min(fw / node.offsetWidth, fh / node.offsetHeight);
      const zoom = clamp(fit, minZoom, maxZoom);
      let x: number;
      let y: number;
      if (fit < minZoom) {
        // The block is already wider than the aperture: the lattice will not
        // shrink to accommodate it, so the glass seats on its leading corner
        // and the bezel is filled from that edge outward.
        x = -node.offsetLeft * zoom;
        y = -node.offsetTop * zoom;
      } else {
        x = fw / 2 - (node.offsetLeft + node.offsetWidth / 2) * zoom;
        y = fh / 2 - (node.offsetTop + node.offsetHeight / 2) * zoom;
      }
      apply(bound({ x, y, zoom }));
      setSeated(node.dataset["darshanNode"] ?? null);
      if (acoustic) getLoomAudio().lensLock(0);
    },
    [acoustic, apply, bound, maxZoom, minZoom],
  );

  /** Thread Expansion by wheel or trackpad pinch, anchored under the cursor. */
  const zoomAt = useCallback(
    (px: number, py: number, factor: number) => {
      const current = tRef.current;
      const zoom = clamp(current.zoom * factor, minZoom, maxZoom);
      const k = zoom / current.zoom;
      apply(
        bound({
          zoom,
          x: px - (px - current.x) * k,
          y: py - (py - current.y) * k,
        }),
      );
    },
    [apply, bound, maxZoom, minZoom],
  );

  /** Kill any glide in flight so a discrete command lands where it was aimed. */
  const halt = useCallback(() => {
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    velocity.current = { x: 0, y: 0 };
    setGliding(false);
  }, []);

  /**
   * Move the glass one step. Each argument is -1, 0 or +1 and says where the
   * *lens* travels over the cloth, so +1 on x reveals what lies to the right.
   *
   * This is the non-path, single-pointer alternative to the drag (WCAG 2.5.7,
   * 2.5.1): every position reachable by dragging the cloth is reachable by
   * repeated presses, with no path to trace and no second pointer. It is also
   * what the arrow keys drive, which is 2.1.1 for the same code.
   *
   * There is no snap afterwards. Anchorage is the right ending for a released
   * flick, where the hand has stopped somewhere approximate; it is the wrong
   * ending for a deliberate press, which would then not go where it was aimed.
   */
  const panStep = useCallback(
    (ix: number, iy: number) => {
      const frame = frameRef.current;
      const stepX = Math.max(PAN_STEP_MIN, (frame?.clientWidth ?? 0) * PAN_STEP_RATIO);
      const stepY = Math.max(PAN_STEP_MIN, (frame?.clientHeight ?? 0) * PAN_STEP_RATIO);
      halt();
      apply(
        bound({
          ...tRef.current,
          x: tRef.current.x - ix * stepX,
          y: tRef.current.y - iy * stepY,
        }),
      );
    },
    [apply, bound, halt],
  );

  /** Thread Expansion by a discrete step, anchored on the centre of the glass. */
  const zoomStep = useCallback(
    (direction: 1 | -1) => {
      const frame = frameRef.current;
      halt();
      zoomAt(
        (frame?.clientWidth ?? 0) / 2,
        (frame?.clientHeight ?? 0) / 2,
        direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP,
      );
    },
    [halt, zoomAt],
  );

  /** Lift the glass: the whole cloth, unmagnified, from its leading corner. */
  const reset = useCallback(() => {
    halt();
    setSeated(null);
    apply(bound({ x: 0, y: 0, zoom: minZoom }));
  }, [apply, bound, halt, minZoom]);

  useEffect(() => {
    const frame = frameNode;
    if (!frame) return;

    const localPoint = (e: PointerEvent | WheelEvent) => {
      const rect = frame.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (raf.current !== null) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
      frame.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      last.current = { x: e.clientX, y: e.clientY, t: performance.now() };
      velocity.current = { x: 0, y: 0 };
      setDragging(true);

      if (pointers.current.size === 2) {
        const [a, b] = Array.from(pointers.current.values());
        pinch.current = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          zoom: tRef.current.zoom,
        };
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Two fingers: Thread Expansion about the midpoint of the grip.
      if (pointers.current.size === 2 && pinch.current) {
        const [a, b] = Array.from(pointers.current.values());
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch.current.dist > 0) {
          const rect = frame.getBoundingClientRect();
          const mx = (a.x + b.x) / 2 - rect.left;
          const my = (a.y + b.y) / 2 - rect.top;
          const target = clamp(
            (pinch.current.zoom * dist) / pinch.current.dist,
            minZoom,
            maxZoom,
          );
          zoomAt(mx, my, target / tRef.current.zoom);
        }
        return;
      }

      const prev = last.current;
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      const dt = Math.max(1, performance.now() - prev.t);
      last.current = { x: e.clientX, y: e.clientY, t: performance.now() };
      // Smooth the hand's jitter and normalise to a 60fps frame step so a
      // fast flick actually carries.
      const frames = Math.min(4, dt / 16.67);
      const vx = dx / Math.max(0.5, frames);
      const vy = dy / Math.max(0.5, frames);
      velocity.current = {
        x: velocity.current.x * 0.25 + vx * 0.75,
        y: velocity.current.y * 0.25 + vy * 0.75,
      };

      apply(bound({ ...tRef.current, x: tRef.current.x + dx, y: tRef.current.y + dy }));

      if (acoustic) {
        // Speed in px/ms, normalised against a brisk sweep of the cloth.
        const speed = Math.hypot(dx, dy) / dt;
        getLoomAudio().lensDrag(clamp(speed / 2.2, 0, 1), panForX(e.clientX, window.innerWidth));
      }
    };

    const endPointer = (e: PointerEvent) => {
      if (!pointers.current.delete(e.pointerId)) return;
      if (pointers.current.size < 2) pinch.current = null;
      if (pointers.current.size > 0) {
        const remaining = Array.from(pointers.current.values())[0];
        last.current = { x: remaining.x, y: remaining.y, t: performance.now() };
        return;
      }
      setDragging(false);
      last.current = null;
      glide();
    };

    const onPointerUp = (e: PointerEvent) => {
      // The Macro Snap: two taps in quick succession on one block.
      const now = performance.now();
      const tap = lastTap.current;
      const moved = Math.hypot(velocity.current.x, velocity.current.y) > 6;
      if (
        !moved &&
        tap &&
        now - tap.t < 320 &&
        Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 32
      ) {
        lastTap.current = null;
        if (frame.hasPointerCapture(e.pointerId)) frame.releasePointerCapture(e.pointerId);
        // Pointer capture retargets events to the frame, so the block under
        // the finger has to be hit-tested against the cloth directly.
        const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const node = under?.closest<HTMLElement>(nodeSelector) ?? null;
        pointers.current.delete(e.pointerId);
        setDragging(false);
        last.current = null;
        if (node) {
          macroSnap(node);
          return;
        }
      } else if (!moved) {
        lastTap.current = { t: now, x: e.clientX, y: e.clientY };
      }
      endPointer(e);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y } = localPoint(e);
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      if (e.ctrlKey) {
        zoomAt(x, y, Math.exp(-dy * 0.006));
        return;
      }
      // A wheel is a hand on the cloth: it drags, it does not scroll a page.
      const dx = e.deltaX * (e.deltaMode === 1 ? 16 : 1);
      apply(bound({ ...tRef.current, x: tRef.current.x - dx, y: tRef.current.y - dy }));
      if (acoustic) {
        getLoomAudio().lensDrag(clamp(Math.hypot(dx, dy) / 90, 0, 1), 0);
      }
    };

    frame.addEventListener("pointerdown", onPointerDown);
    frame.addEventListener("pointermove", onPointerMove);
    frame.addEventListener("pointerup", onPointerUp);
    frame.addEventListener("pointercancel", endPointer);
    frame.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      frame.removeEventListener("pointerdown", onPointerDown);
      frame.removeEventListener("pointermove", onPointerMove);
      frame.removeEventListener("pointerup", onPointerUp);
      frame.removeEventListener("pointercancel", endPointer);
      frame.removeEventListener("wheel", onWheel);
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      getLoomAudio().stopFriction();
    };
  }, [acoustic, apply, bound, frameNode, glide, macroSnap, maxZoom, minZoom, nodeSelector, zoomAt]);

  return {
    frameRef: attachFrame,
    planeRef,
    transform,
    dragging,
    gliding,
    seated,
    macroSnap,
    snap,
    zoomAt,
    panStep,
    zoomStep,
    reset,
  };
}
