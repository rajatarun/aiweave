import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { TalimThread } from "./TalimThread";
import { TantuMakuShuttle } from "./TantuMakuShuttle";
import { TantuDarshanLens } from "./TantuDarshanLens";

export interface TantuLoomProps extends HTMLAttributes<HTMLDivElement> {
  /** The root instruction code for this specific view (e.g., "SYS-01-INIT"). */
  viewTalimCode: string;
  /** Mount the Weaver's Shuttle (gold weft focus thread + spatial routing). */
  shuttle?: boolean;
  /**
   * Hold the weave under the Darshan Lens on small viewports instead of
   * dropping to the 4-thread travel loom. Opt-in: the travel loom is the
   * default because a handheld reader must be able to read the cloth.
   */
  darshan?: boolean;
  children: ReactNode;
}

/**
 * Master Loom — the global substrate that replaces <main> or Container wrappers.
 *
 * The viewport is divided into three zones:
 * - Left Selvedge: fixed vertical margin carrying the root TalimThread metadata.
 * - Main Weave: a dynamic 12-column base-6 grid where TantuCards are anchored.
 * - Right Selvedge: mirroring vertical margin for contextual anchors.
 *
 * The grid is drawn by the 1px gap of the Main Weave, which exposes the dark
 * structural thread background of the loom. Below 768px the loom does not wrap
 * its children; instead it drops threads, switching the 12-column warp to a
 * 6-column travel loom via a single structural media query.
 */
export const TantuLoom = forwardRef<HTMLDivElement, TantuLoomProps>(function TantuLoom(
  { viewTalimCode, shuttle = true, darshan = false, children, className, ...rest },
  ref,
) {
  return (
    <div {...rest} ref={ref} className={["tantu-loom", className].filter(Boolean).join(" ")}>
      <aside className="tantu-selvedge-left">
        <nav aria-label="Primary Loom Navigation">
          <TalimThread code={viewTalimCode} />
        </nav>
      </aside>

      {darshan ? (
        <TantuDarshanLens talimCode={viewTalimCode}>
          <main className="tantu-loom-content">{children}</main>
        </TantuDarshanLens>
      ) : (
        <main className="tantu-loom-content">{children}</main>
      )}

      <aside className="tantu-selvedge-right">
        <TalimThread code="END-OF-WEAVE" />
      </aside>

      {shuttle ? <TantuMakuShuttle /> : null}
    </div>
  );
});
