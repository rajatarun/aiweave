import { useEffect, useState, type HTMLAttributes, type ReactNode } from "react";
import { useDarshanLens } from "../hooks/useDarshanLens";
import { TalimThread } from "./TalimThread";

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
 */
export function TantuDarshanLens({
  weaveWidth = 1296,
  weaveHeight = 1080,
  maxZoom = 4,
  breakpoint = 768,
  silent = false,
  talimCode = "DARSHAN-LENS",
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

  const { frameRef, planeRef, transform, dragging, gliding, seated } = useDarshanLens({
    maxZoom,
    acoustic: !silent,
  });

  // Wide viewports hold the whole cloth already: no glass is needed.
  if (!engaged) return <>{children}</>;

  const magnified = transform.zoom > 1.35;

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
