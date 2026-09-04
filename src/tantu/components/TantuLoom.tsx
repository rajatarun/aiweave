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
      {/* The selvedges are the cloth's finished edges: a decorative margin
          carrying the Talim stamp. They were <aside> and <nav>, which made
          them landmarks — two unnamed `complementary` regions plus a
          `navigation` region containing no navigation. A screen-reader user
          cycling landmarks got three stops that hold nothing to act on, and
          the pair collided on axe's landmark-unique rule. Real navigation
          belongs in `children`.

          Making them plain divs fixed that and left a smaller problem behind:
          content in no landmark at all, which is axe's `region`. It went
          unseen because the story sweep disables that rule (a story is a
          fragment, so it must) and no whole-page sweep ran it until now.

          So they are decoration, and say so. A Talim code is a provenance
          ornament — the loom's own stamp on the cloth — not something a reader
          needs read aloud before the content starts. aria-hidden takes it out
          of the tree entirely: no phantom landmark, no orphaned content, and
          nothing announced that a reader cannot act on. It stays fully visible,
          which is the point of it. */}
      <div className="tantu-selvedge-left" aria-hidden="true">
        <TalimThread code={viewTalimCode} />
      </div>

      {darshan ? (
        <TantuDarshanLens talimCode={viewTalimCode}>
          <main className="tantu-loom-content">{children}</main>
        </TantuDarshanLens>
      ) : (
        <main className="tantu-loom-content">{children}</main>
      )}

      <div className="tantu-selvedge-right" aria-hidden="true">
        <TalimThread code="END-OF-WEAVE" />
      </div>

      {shuttle ? <TantuMakuShuttle /> : null}
    </div>
  );
});
