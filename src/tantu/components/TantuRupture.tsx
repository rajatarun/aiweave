import * as React from "react";
import { getLoomAudio } from "../lib/loom-audio";

export interface TantuRuptureProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onError"> {
  /** Talim error code, rendered as detached glyphs. e.g. "404-WARP-SEVERED" */
  code?: string;
  /** Plain-language account of the mechanical failure. */
  message?: string;
  /** Label on the recovery node. */
  recoveryLabel?: string;
  /** Fires after the loom has visibly pulled taut again. */
  onRepair?: () => void;
  /** Voice the acoustic rupture and the ratchet. Default true. */
  audio?: boolean;
}

const REPAIR_MS = 420;

/**
 * A Structural Rupture: the Tantu error and 404 state. The base-6 lattice
 * severs at the coordinate of failure, the broken warp sags and frays under
 * SVG turbulence, the Talim ligatures detach into isolated glyphs, and the
 * weaver must physically re-tension the loom to recover.
 */
export const TantuRupture = React.forwardRef<HTMLDivElement, TantuRuptureProps>(
  function TantuRupture(
    {
      code = "404-WARP-SEVERED",
      message = "The warp thread snapped at this coordinate. Tension is lost and the weave cannot continue until the lattice is repaired.",
      recoveryLabel = "Tie the weaver's knot",
      onRepair,
      audio = true,
      className,
      ...rest
    },
    ref,
  ) {
    const [phase, setPhase] = React.useState<"ruptured" | "repairing">("ruptured");
    const filterId = React.useId().replace(/:/g, "");

    React.useEffect(() => {
      if (!audio) return;
      getLoomAudio().rupture({ pan: 0 });
    }, [audio]);

    const repair = React.useCallback(() => {
      if (phase === "repairing") return;
      setPhase("repairing");
      if (audio) getLoomAudio().repair({ pan: 0 });
      window.setTimeout(() => onRepair?.(), REPAIR_MS);
    }, [phase, audio, onRepair]);

    return (
      <div
        ref={ref}
        role="alert"
        data-phase={phase}
        className={["tantu-rupture", className].filter(Boolean).join(" ")}
        {...rest}
      >
        <svg
          className="tantu-rupture-lattice"
          viewBox="0 0 600 260"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            {/* SVG fraying: the severed ends drift as individual filaments. */}
            <filter id={`fray-${filterId}`} x="-25%" y="-60%" width="150%" height="220%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.012 0.06"
                numOctaves={3}
                seed={7}
                result="fibre"
              >
                <animate
                  attributeName="baseFrequency"
                  dur="9s"
                  values="0.012 0.06;0.02 0.09;0.012 0.06"
                  repeatCount="indefinite"
                />
              </feTurbulence>
              <feDisplacementMap
                in="SourceGraphic"
                in2="fibre"
                scale={14}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>

          {/* Intact warp above the failure. */}
          <g className="tantu-rupture-taut">
            <line x1="0" y1="24" x2="600" y2="24" />
            <line x1="0" y1="48" x2="600" y2="48" />
          </g>

          {/* Severed ends: sagging, frayed, drifting out of orthogonal. */}
          <g className="tantu-rupture-severed" filter={`url(#fray-${filterId})`}>
            <path d="M 0 120 C 90 122 150 150 214 178" />
            <path d="M 600 120 C 510 122 450 150 386 178" />
            <path d="M 0 144 C 100 148 160 182 226 214" />
            <path d="M 600 144 C 500 148 440 182 374 214" />
          </g>

          {/* The repaired lattice: rigid, unbroken, snapped back taut. */}
          <g className="tantu-rupture-mended">
            <line x1="0" y1="120" x2="600" y2="120" />
            <line x1="0" y1="144" x2="600" y2="144" />
          </g>
        </svg>

        <div className="tantu-rupture-core">
          {/* Typographic detachment: Talim ligatures break, glyphs isolate. */}
          {/* The glyphs are individually hidden so the detachment animation
              does not read as letter-by-letter noise, and the intact code is
              restated for assistive technology. That restatement used to be
              an `aria-label` on the <p>, which ARIA prohibits on an element
              with no role — user agents are free to ignore it, and some do,
              leaving the error code inaudible. A visually-hidden span always
              reads. */}
          <p className="tantu-rupture-code">
            <span className="tantu-visually-hidden">{code}</span>
            <span aria-hidden="true">[</span>
            {code.split("").map((glyph, index) => (
              <span
                key={`${glyph}-${index}`}
                className="tantu-rupture-glyph"
                style={{ animationDelay: `${(index % 7) * 210}ms` }}
                aria-hidden="true"
              >
                {glyph}
              </span>
            ))}
            <span aria-hidden="true">]</span>
          </p>
          <p className="tantu-rupture-message">{message}</p>
          <button type="button" className="tantu-rupture-knot" onClick={repair}>
            {recoveryLabel}
          </button>
        </div>
      </div>
    );
  },
);
