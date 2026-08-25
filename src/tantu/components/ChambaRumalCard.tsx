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
      <div className="tantu-rumal-obverse">
        {/* The wet rim. CSS applies `filter` to an element BEFORE its own
            `clip-path` — a solid-colour box clipped and filtered on the
            SAME element just gets its uniform interior perturbed (nothing
            for the displacement to grab onto) and then cropped by a
            perfectly clean clip-path afterwards regardless, so the edge
            never actually frays. Splitting it across two elements fixes
            that: the inner div is clipped to a hard-edged circle first,
            then the outer wrapper's filter distorts that already-rendered
            edge, which is the only way to get a torn boundary instead of
            a clean geometric one. */}
        <div className="tantu-rumal-rim-filter" aria-hidden="true">
          <div className="tantu-rumal-rim-fill" />
        </div>
        {obverse}
      </div>
      <div className="tantu-rumal-reverse">
        <div className="tantu-rumal-rim-filter" aria-hidden="true">
          <div className="tantu-rumal-rim-fill" />
        </div>
        {reverse}
      </div>
    </article>
  );
});
