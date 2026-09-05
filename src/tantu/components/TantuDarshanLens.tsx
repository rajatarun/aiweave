import {
  useEffect,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useDarshanLens } from "../hooks/useDarshanLens.js";
import { TalimThread } from "./TalimThread.js";

/**
 * Accessible names for the lens controls. They are the only text Tantu writes
 * into this component, and a product that is not in English needs to replace
 * them — a control whose alternative to a gesture is unreadable is not an
 * alternative.
 */
export interface DarshanLensLabels {
  group: string;
  up: string;
  down: string;
  left: string;
  right: string;
  zoomIn: string;
  zoomOut: string;
  fit: string;
}

const DEFAULT_LABELS: DarshanLensLabels = {
  group: "Move the lens over the cloth",
  up: "Pan up",
  down: "Pan down",
  left: "Pan left",
  right: "Pan right",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fit: "Fit the whole cloth",
};

export interface TantuDarshanLensProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /**
   * Width of the cloth held beneath the glass, in base-6 pixels. The lattice
   * is physically unyielding: this never adapts to the viewport.
   */
  weaveWidth?: number;
  /** Minimum height of the cloth; it may grow with content, never shrink. */
  weaveHeight?: number;
  /** Deepest optical magnification of the base-6 grid. */
  maxZoom?: number;
  /** Only take over below this width; wider viewports see the bare loom. */
  breakpoint?: number;
  /** Suppress the friction hiss and the distant loom rumble. */
  silent?: boolean;
  /** Instruction code stitched into the brass bezel. */
  talimCode?: string;
  /** Accessible names for the pan and magnification controls. */
  labels?: Partial<DarshanLensLabels>;
  children: ReactNode;
}

/**
 * The Darshan Lens — the mobile window onto the weave.
 *
 * Responsive stacking is refused outright: breaking a tapestry's threads to
 * pour them into one column destroys the artifact. Instead the small viewport
 * becomes a heavy brass magnifying glass gliding over an immense, fixed cloth.
 * The user presses into the textile and pulls the warp and weft across the
 * aperture; releasing lets the fabric glide and mechanically seat the nearest
 * Jamdani block dead-centre. Pinching does not scale a picture — it expands
 * the base-6 calculation itself, thickening 1px filaments into visible ropes
 * and exposing the cellulose noise inside the dye.
 *
 * Any descendant carrying `data-darshan-node` is an anchorage point for the
 * magnetic snap and a target for the double-tap Macro Snap.
 *
 * The drag and the pinch are how the cloth *wants* to be handled, but neither
 * may be the only way to handle it: WCAG 2.5.7 and 2.5.1 require that anything
 * reachable by dragging a path also be reachable with one pointer that traces
 * nothing. The brass keypad in the corner is that alternative — every position
 * and every magnification the hand can reach, reachable by pressing a button,
 * and by the arrow keys once one of those buttons has focus.
 */
export function TantuDarshanLens({
  weaveWidth = 1296,
  weaveHeight = 1080,
  maxZoom = 4,
  breakpoint = 768,
  silent = false,
  talimCode = "DARSHAN-LENS",
  labels,
  children,
  className,
  ...rest
}: TantuDarshanLensProps) {
  const [engaged, setEngaged] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const sync = () => setEngaged(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [breakpoint]);

  const { frameRef, planeRef, transform, dragging, gliding, seated, panStep, zoomStep, reset } =
    useDarshanLens({
      maxZoom,
      acoustic: !silent,
    });

  // Wide viewports hold the whole cloth already: no glass is needed.
  if (!engaged) return <>{children}</>;

  const magnified = transform.zoom > 1.35;
  const name = { ...DEFAULT_LABELS, ...labels };

  /**
   * Arrow keys drive the same steps once the keypad has focus.
   *
   * Deliberately physical in both writing directions, unlike every other
   * arrow-key handler in Tantu. The WAI-ARIA reversal of Left and Right
   * applies to a composite widget walking a collection along the inline axis;
   * this is a viewport over a plane, where ArrowRight means "show me what is
   * further right" no matter which way the text runs.
   */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, () => void> = {
      ArrowUp: () => panStep(0, -1),
      ArrowDown: () => panStep(0, 1),
      ArrowLeft: () => panStep(-1, 0),
      ArrowRight: () => panStep(1, 0),
      "+": () => zoomStep(1),
      "=": () => zoomStep(1),
      "-": () => zoomStep(-1),
      _: () => zoomStep(-1),
      Home: reset,
    };
    const run = steps[event.key];
    if (!run) return;
    event.preventDefault();
    run();
  };

  return (
    <div
      {...rest}
      className={["tantu-darshan", className].filter(Boolean).join(" ")}
      data-dragging={dragging || undefined}
      data-gliding={gliding || undefined}
      data-magnified={magnified || undefined}
      style={{ ["--tantu-lens-zoom" as string]: transform.zoom.toFixed(3) }}
    >
      <DarshanOptics />

      <div ref={frameRef} className="tantu-darshan-aperture">
        <div
          ref={planeRef}
          className="tantu-darshan-cloth"
          style={{
            width: weaveWidth,
            minHeight: weaveHeight,
            transform: `translate3d(${transform.x.toFixed(2)}px, ${transform.y.toFixed(2)}px, 0) scale(${transform.zoom})`,
          }}
        >
          {children}
        </div>

        {/* Ground glass: the edge of the lens blurs and bows the threads. */}
        <div className="tantu-darshan-vignette" aria-hidden="true" />
        <div className="tantu-darshan-bezel" aria-hidden="true" />
      </div>

      {/* The keypad: the single-pointer, no-path route to everything the
          drag and the pinch reach. Machined into the bezel rather than
          floated over the cloth, because it is part of the instrument. */}
      <div
        className="tantu-darshan-keypad"
        role="group"
        aria-label={name.group}
        onKeyDown={onKeyDown}
      >
        <button type="button" data-key="out" aria-label={name.zoomOut} onClick={() => zoomStep(-1)}>
          <GlyphZoom sign={-1} />
        </button>
        <button type="button" data-key="up" aria-label={name.up} onClick={() => panStep(0, -1)}>
          <GlyphArrow rotate={0} />
        </button>
        <button type="button" data-key="in" aria-label={name.zoomIn} onClick={() => zoomStep(1)}>
          <GlyphZoom sign={1} />
        </button>
        <button type="button" data-key="left" aria-label={name.left} onClick={() => panStep(-1, 0)}>
          <GlyphArrow rotate={270} />
        </button>
        <button type="button" data-key="fit" aria-label={name.fit} onClick={reset}>
          <GlyphFit />
        </button>
        <button type="button" data-key="right" aria-label={name.right} onClick={() => panStep(1, 0)}>
          <GlyphArrow rotate={90} />
        </button>
        <button type="button" data-key="down" aria-label={name.down} onClick={() => panStep(0, 1)}>
          <GlyphArrow rotate={180} />
        </button>
      </div>

      <div className="tantu-darshan-readout" aria-live="polite">
        <TalimThread code={talimCode} />
        <span className="tantu-darshan-coord">
          [Z:{transform.zoom.toFixed(2)}
          {seated ? ` \u00b7 ${seated}` : ""}]
        </span>
      </div>
    </div>
  );
}

/**
 * Keypad glyphs. Each is a bare stroke in `currentColor` so the key's own
 * state — rest, hover, focus, forced colours — carries straight through.
 */
function GlyphArrow({ rotate }: { rotate: number }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">
      <g
        transform={`rotate(${rotate} 12 12)`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="square"
      >
        <path d="M12 19V6" />
        <path d="M6 12l6-6 6 6" />
      </g>
    </svg>
  );
}

function GlyphZoom({ sign }: { sign: 1 | -1 }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
        <path d="M5 12h14" />
        {sign > 0 ? <path d="M12 5v14" /> : null}
      </g>
    </svg>
  );
}

function GlyphFit() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
        <path d="M4 9V4h5" />
        <path d="M20 9V4h-5" />
        <path d="M4 15v5h5" />
        <path d="M20 15v5h-5" />
      </g>
    </svg>
  );
}

/**
 * The ground optics of the lens: a fibrous turbulence field that displaces
 * the threads outward as they approach the thick brass rim, and the cellulose
 * grain that only becomes visible under deep magnification.
 */
function DarshanOptics() {
  return (
    <svg className="tantu-visually-hidden" aria-hidden="true" focusable="false">
      <defs>
        <filter id="tantu-darshan-curve" x="-8%" y="-8%" width="116%" height="116%">
          {/* Coarse, near-static noise: ground glass, not water. */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.014"
            numOctaves={2}
            seed={17}
            result="grind"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="grind"
            scale={9}
            xChannelSelector="R"
            yChannelSelector="G"
            result="bowed"
          />
          <feGaussianBlur in="bowed" stdDeviation="0.4" />
        </filter>

        <filter id="tantu-darshan-cellulose" x="0%" y="0%" width="100%" height="100%">
          {/* Microscopic fibre noise inside the dye, revealed on expansion. */}
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} seed={5} />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.42
                    0 0 0 0 0.29
                    0 0 0 0 0.21
                    0 0 0 0.5 0"
          />
        </filter>
      </defs>
    </svg>
  );
}
