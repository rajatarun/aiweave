import type { ReactElement } from "react";
import { useMakuShuttle, type MakuShuttleOptions } from "../hooks/useMakuShuttle";
import { InkBleedFilter } from "./InkBleedFilter";

export interface TantuMakuShuttleProps extends MakuShuttleOptions {}

/**
 * The Weaver's Shuttle overlay — mount once per application, inside the loom.
 *
 * Renders the fixed, pointer-transparent plane on which the gold zari weft
 * thread is drawn between focus stops, plus the Kasuti coordinate chip that
 * exposes the machine grid position of the focused node.
 */
export function TantuMakuShuttle(props: TantuMakuShuttleProps): ReactElement {
  const { svgRef, coordRef } = useMakuShuttle(props);

  return (
    <div className="tantu-maku-overlay" aria-hidden="true">
      <InkBleedFilter id="tantu-maku-capillary" frequency={0.05} scale={9} soak={1.2} />
      <svg ref={svgRef} className="tantu-maku-plane" focusable="false" />
      <span ref={coordRef} className="tantu-maku-coord" data-state="hidden" />
    </div>
  );
}
