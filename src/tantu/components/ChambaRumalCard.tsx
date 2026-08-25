import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

export type ChambaRumalCardWarpSpan = 1 | 2 | 3 | 4 | 6 | 12;

export interface ChambaRumalCardProps extends HTMLAttributes<HTMLElement> {
  /** The front face of the double-sided card. */
  obverse: ReactNode;
  /** The back face, revealed through a flat 2D scale inversion. */
  reverse: ReactNode;
  /** Whether the card is currently showing the reverse face. */
  isFlipped?: boolean;
  /** Grid-column span across the 12-thread main weave. Defaults to 6 (the standard Dorukha footprint). */
  warpSpan?: ChambaRumalCardWarpSpan;
}

/**
 * Chamba Rumal Dorukha card.
 *
 * Inspired by the double-sided satin stitch of Himachal Pradesh, this card
 * achieves an isomorphic front/back transition without leaving the 2D plane.
 * The front and back layers are stacked using an internal sub-grid, then the
 * whole element is inverted across the X-axis with `scaleX(-1)` while the
 * visible layer counters the inversion so its text remains legible.
 */
export const ChambaRumalCard = forwardRef<HTMLElement, ChambaRumalCardProps>(function ChambaRumalCard(
  { obverse, reverse, isFlipped = false, warpSpan = 6, className, style, ...rest },
  ref,
) {
  return (
    <article
      ref={ref}
      {...rest}
      className={["tantu-card", `tantu-cell-warp-${warpSpan}`, "tantu-card-rumal", className].filter(Boolean).join(" ")}
      data-state={isFlipped ? "reverse" : "obverse"}
      style={style}
    >
      {/* Each face is two layers: the dye pool (a solid fill clipped to the
          spreading circle, whose edge the ink-bleed filter tears) and the
          content above it (clipped to the same circle but unfiltered, so
          text stays sharp). The filter has to sit on a wrapper *around*
          the clipped fill rather than on the fill itself — CSS applies
          `filter` before that same element's own `clip-path`, so a box
          that is both clipped and filtered gets its uniform interior
          perturbed and is then cropped by an unaffected clean clip-path.
          Neither the face nor the filter wrapper may carry a background
          or a clip-path of its own: either one re-covers or re-crops the
          torn edge back to a perfect circle. */}
      <div className="tantu-rumal-obverse">
        <div className="tantu-rumal-rim-filter" aria-hidden="true">
          <div className="tantu-rumal-rim-fill" />
        </div>
        <div className="tantu-rumal-content">{obverse}</div>
      </div>
      <div className="tantu-rumal-reverse">
        <div className="tantu-rumal-rim-filter" aria-hidden="true">
          <div className="tantu-rumal-rim-fill" />
        </div>
        <div className="tantu-rumal-content">{reverse}</div>
      </div>
    </article>
  );
});
