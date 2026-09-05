import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { TalimThread } from "./TalimThread.js";


export type TantuCardWarpSpan = 1 | 2 | 3 | 4 | 6 | 12;
export type TantuCardWeftSpan = "auto" | 2 | 4 | 6;
export type TantuCardReliefLevel = "flat" | "kanthi" | "zardozi";

export interface TantuCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** The content woven into the card. */
  children: ReactNode;

  /**
   * Warp Allocation (Columns)
   * Defines how many of the 12 vertical threads this card spans.
   * Locked to divisors of the 12-column loom (1, 2, 3, 4, 6, 12).
   */
  warpSpan?: TantuCardWarpSpan;

  /**
   * Weft Allocation (Rows)
   * Defines the horizontal thread span.
   */
  weftSpan?: TantuCardWeftSpan;

  /**
   * Embroidery Relief (Elevation)
   * 'flat': Standard kora substrate (no border).
   * 'kanthi': Dashed running stitch boundary.
   * 'zardozi': Thick, prominent structural border.
   */
  reliefLevel?: TantuCardReliefLevel;

  /**
   * Talim Metadata
   * Cryptographic string (e.g., "T-44-A") displayed in the top-right
   * selvedge margin of the card, simulating weaver instructions.
   */
  talimCode?: string;

  /**
   * Dictates if the card allows the capillary ink bleed
   * to pass through it from underlying grid interactions.
   */
  absorbent?: boolean;
}

/**
 * Jamdani supplementary-weft card: motifs float above the ground threads.
 *
 * Structural rules:
 * - warpSpan is locked to divisors of the 12-column warp (1, 2, 3, 4, 6, 12).
 * - reliefLevel replaces elevation via thread-gauge, not z-index or shadow.
 * - talimCode renders as mono-spaced coded typography in the selvedge margin.
 */
export const TantuCard = forwardRef<HTMLElement, TantuCardProps>(function TantuCard(
  {
    children,
    warpSpan = 6,
    weftSpan = "auto",
    reliefLevel = "kanthi",
    talimCode,
    absorbent = false,
    className,
    style,
    ...rest
  },
  ref,
) {
  const reliefClass = `tantu-relief-${reliefLevel}`;
  const absorbClass = absorbent ? "tantu-substrate-porous" : "tantu-substrate-resist";

  return (
    <article
      /* Anchorage point for the Darshan Lens: the glass seats onto cards. */
      data-darshan-node={talimCode ?? "JAMDANI"}
      /* Bindable pick for the Trace Thread search. */
      data-trace-node=""
      data-trace-label={talimCode ?? undefined}
      {...rest}
      ref={ref}
      /* The warp span is carried as a class, never inline: the travel loom
         must be able to re-thread it at the Loom Drop. */
      className={["tantu-card", `tantu-cell-warp-${warpSpan}`, reliefClass, absorbClass, className]
        .filter(Boolean)
        .join(" ")}
      style={{
        gridRow: weftSpan === "auto" ? "auto" : `span ${weftSpan}`,
        ...style,
      }}
    >
      {talimCode && (
        <span className="tantu-card-talim" aria-hidden="true">
          [<TalimThread code={talimCode} />]
        </span>
      )}
      <div className="tantu-card-payload">{children}</div>
    </article>

  );
});
