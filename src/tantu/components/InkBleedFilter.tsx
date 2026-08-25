import type { ReactElement } from "react";

export interface InkBleedFilterProps {
  /** Unique filter id referenced by `filter: url(#id)`. */
  id: string;
  /** Base frequency of the cellulose turbulence field. Lower = coarser fibre tear. */
  frequency?: number;
  /** Displacement scale in px — how far the dye front is dragged off-circle. */
  scale?: number;
  /** Octaves of fractal Brownian motion. */
  octaves?: number;
  /** Deterministic seed so the weave never re-randomises between renders. */
  seed?: number;
  /** Soak radius — Gaussian blur applied after displacement. */
  soak?: number;
  /**
   * Alpha contrast of the fibre map (the `0 0 0 A -1` row of the colour
   * matrix). Higher values thin the wet edge into discrete fibre channels.
   */
  fibreContrast?: number;
  /**
   * Skip the final `feComposite ... operator="atop"` re-clip. That step
   * exists so displacement reads as *interior* fibre texture while the
   * element's outer silhouette stays exactly what it was — right for
   * texturing a shape that must keep its original boundary (the default,
   * and what every other consumer of this filter wants), but it means the
   * boundary itself can never actually move: "atop" masks the frayed,
   * displaced result back to the pre-displacement source's exact alpha,
   * cancelling any edge distortion by construction. Set true when the
   * torn boundary IS the point (e.g. an expanding dye front) rather than
   * a texture confined within a fixed shape.
   */
  edgeFray?: boolean;
}

/**
 * SVG turbulence displacement filter — the DOM half of T2 Mordant Capillary
 * Bleed, for elements that cannot carry a WebGL canvas.
 *
 * Chain: fractalNoise generates the cotton substrate; a colour matrix pushes
 * that noise into a high-contrast alpha fibre map; feDisplacementMap drags the
 * source graphic along those fibres; a short blur soaks the edge; feComposite
 * atop clips the bleed back to the source silhouette.
 *
 * Mount once per surface, then apply with `filter: url(#id)`.
 */
export function InkBleedFilter({
  id,
  frequency = 0.04,
  scale = 15,
  octaves = 3,
  seed = 6,
  soak = 1.5,
  fibreContrast = 4,
  edgeFray = false,
}: InkBleedFilterProps): ReactElement {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <filter id={id} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          {/* Cellulose fibre noise — the uneven cotton substrate. */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency={`${frequency} ${frequency * 1.35}`}
            numOctaves={octaves}
            seed={seed}
            result="noise"
          />
          {/* Map the noise into a high-contrast alpha fibre channel. */}
          <feColorMatrix
            type="matrix"
            in="noise"
            values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${fibreContrast} -1`}
            result="coloredNoise"
          />
          {/* Displace the source along the fibre directions. */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="coloredNoise"
            scale={scale}
            xChannelSelector="R"
            yChannelSelector="G"
            result="bleed"
          />
          {/* Soak: soften the wet edge as ink wicks into the weave. */}
          <feGaussianBlur in="bleed" stdDeviation={soak} result={edgeFray ? undefined : "softBleed"} />
          {/* Re-clip to the pre-displacement silhouette — deliberately
              skipped when edgeFray is set, since that's exactly what
              would cancel the fray (see the prop doc above). */}
          {edgeFray ? null : <feComposite in="softBleed" in2="SourceGraphic" operator="atop" />}
        </filter>
      </defs>
    </svg>
  );
}
