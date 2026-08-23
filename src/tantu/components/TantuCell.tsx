import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

export type TantuCellSpan = 1 | 2 | 3 | 4 | 6 | 12;

export interface TantuCellProps extends HTMLAttributes<HTMLDivElement> {
  /** The content woven into this cell. */
  children: ReactNode;

  /**
   * Warp Allocation (Columns)
   * Defines how many of the 12 vertical threads this cell spans.
   * Locked to divisors of the 12-column loom (1, 2, 3, 4, 6, 12).
   */
  warpSpan?: TantuCellSpan;

  /**
   * Weft Allocation (Rows)
   * Defines the horizontal thread span.
   */
  weftSpan?: "auto" | 2 | 4 | 6;
}

/**
 * Loom Cell — a non-card grid item that lives inside TantuLoom.
 *
 * Structural rules:
 * - warpSpan is locked to divisors of the 12-column warp (1, 2, 3, 4, 6, 12).
 * - Below 768px the loom drops threads to 6 columns; the cell keeps its
 *   proportional span rather than force-filling the weft.
 */
export const TantuCell = forwardRef<HTMLDivElement, TantuCellProps>(function TantuCell(
  { children, warpSpan = 12, weftSpan = "auto", className, style, ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      className={["tantu-cell", `tantu-cell-warp-${warpSpan}`, className].filter(Boolean).join(" ")}
      style={{
        gridRow: weftSpan === "auto" ? "auto" : `span ${weftSpan}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
});
