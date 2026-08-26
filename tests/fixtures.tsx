/**
 * One renderable specimen of every component Tantu exports.
 *
 * This is the sample cloth: it exists so the accessibility sweep, the RTL
 * sweep and the SSR sweep all measure the *same* set, and so adding a
 * component to the public surface without adding it here fails a test rather
 * than quietly escaping every check. `tests/surface.test.ts` asserts the two
 * lists agree.
 *
 * Every specimen is given realistic props — labels a screen reader would
 * actually read, plausible data — because axe cannot judge a component
 * rendered with placeholder junk.
 */
import type { ReactElement } from "react";
import {
  CapillaryBleedSurface,
  ChambaRumalCard,
  InkBleedFilter,
  JamdaniBlock,
  KasutiMatrix,
  PatolaField,
  SikkuKolamLoader,
  TalimThread,
  TantuAcousticPalette,
  TantuAcousticToggle,
  TantuAvatarGroup,
  TantuBanner,
  TantuBleedCanvas,
  TantuButton,
  TantuCard,
  TantuCell,
  TantuCut,
  TantuDarshanLens,
  TantuDialog,
  TantuFold,
  TantuGuptBandhan,
  TantuInput,
  TantuLoom,
  TantuMakuShuttle,
  TantuMasthead,
  TantuMeter,
  TantuNotice,
  TantuPagination,
  TantuPanchang,
  TantuPhad,
  TantuPopover,
  TantuRupture,
  TantuSeal,
  TantuSelect,
  TantuSlider,
  TantuSpindle,
  TantuStack,
  TantuStepper,
  TantuTable,
  TantuTabs,
  TantuTag,
  TantuTextarea,
  TantuToggle,
  TantuTooltip,
  TantuTraceSearch,
  TantuTrail,
  TantuUnwoven,
} from "../src/tantu";

export interface Specimen {
  /** The exported name, so a failure names the component. */
  name: string;
  element: ReactElement;
  /**
   * Set when the specimen is not a complete document region on its own and
   * axe would flag the *harness*, not the component — a table cell without a
   * table, a landmark-less fragment. The reason is recorded, never a bare
   * skip.
   */
  axeNote?: string;
}

const TABLE_ROWS = [
  { id: "r1", warp: "Cotton 40s", picks: 48, dye: "Madder root" },
  { id: "r2", warp: "Cotton 60s", picks: 62, dye: "Indigo vat" },
];

export const SPECIMENS: Specimen[] = [
  {
    name: "TantuButton",
    element: <TantuButton>Beat the weft</TantuButton>,
  },
  {
    name: "TantuCard",
    element: (
      <TantuCard talimCode="W-01">
        <h3>Warp tension</h3>
        <p>Forty-eight picks to the inch, held at nine newtons.</p>
      </TantuCard>
    ),
  },
  {
    name: "ChambaRumalCard",
    element: (
      <ChambaRumalCard
        obverse={<p>Front of the rumal</p>}
        reverse={<p>Back of the rumal — the same stitch, read in mirror</p>}
      />
    ),
  },
  {
    name: "TantuLoom",
    element: (
      <TantuLoom viewTalimCode="LOOM-01">
        <TantuCell>
          <p>One pick of the weave.</p>
        </TantuCell>
      </TantuLoom>
    ),
  },
  {
    name: "TantuCell",
    element: (
      <TantuCell>
        <p>A single cell in the warp.</p>
      </TantuCell>
    ),
  },
  {
    name: "TantuStack",
    element: (
      <TantuStack>
        <p>First</p>
        <p>Second</p>
      </TantuStack>
    ),
  },
  { name: "TantuCut", element: <TantuCut /> },
  {
    name: "TantuMasthead",
    element: (
      <TantuMasthead
        mark="Tantu"
        links={[
          { label: "Threads", href: "#threads" },
          { label: "Dyes", href: "#dyes" },
        ]}
      />
    ),
  },
  {
    name: "TantuInput",
    element: <TantuInput label="Warp count" audio={false} defaultValue="40" />,
  },
  {
    name: "TantuTextarea",
    element: <TantuTextarea label="Weaver's note" defaultValue="Held at nine newtons." />,
  },
  {
    name: "TantuSelect",
    element: (
      <TantuSelect label="Dye bath" defaultValue="madder">
        <option value="madder">Madder root</option>
        <option value="indigo">Indigo vat</option>
      </TantuSelect>
    ),
  },
  {
    name: "TantuToggle",
    element: <TantuToggle audio={false}>Engage the treadle</TantuToggle>,
  },
  {
    name: "TantuSlider",
    element: <TantuSlider label="Beat force" min={0} max={12} defaultValue={9} />,
  },
  {
    name: "TantuTabs",
    element: (
      <TantuTabs
        items={[
          { id: "warp", label: "Warp", content: <p>Vertical threads</p> },
          { id: "weft", label: "Weft", content: <p>Horizontal threads</p> },
        ]}
      />
    ),
  },
  {
    name: "TantuFold",
    element: (
      <TantuFold
        items={[
          { id: "a", label: "Setting the warp", content: <p>Beam, cross, heddles.</p> },
          { id: "b", label: "Throwing the weft", content: <p>Shuttle, shed, beat.</p> },
        ]}
      />
    ),
  },
  {
    name: "TantuStepper",
    element: (
      <TantuStepper
        currentStepId="dress"
        steps={[
          { id: "warp", label: "Wind the warp" },
          { id: "dress", label: "Dress the loom" },
          { id: "weave", label: "Weave" },
        ]}
      />
    ),
  },
  {
    name: "TantuPagination",
    element: <TantuPagination totalPages={7} currentPage={3} />,
  },
  {
    name: "TantuTrail",
    element: (
      <TantuTrail
        items={[
          { label: "Mill", href: "#mill" },
          { label: "Loom 4", href: "#loom-4" },
          { label: "Beam" },
        ]}
      />
    ),
  },
  {
    name: "TantuPopover",
    element: (
      <TantuPopover title="Thread gauge" trigger={<button type="button">Gauge</button>}>
        <p>Filament, ply, cord, braid.</p>
      </TantuPopover>
    ),
  },
  {
    name: "TantuTooltip",
    element: (
      <TantuTooltip label="Picks per inch">
        <button type="button">PPI</button>
      </TantuTooltip>
    ),
  },
  {
    name: "TantuDialog",
    element: (
      <TantuDialog open title="Cut the cloth" onClose={() => {}}>
        <p>This cannot be undone once the selvedge is crossed.</p>
      </TantuDialog>
    ),
  },
  { name: "TantuTag", element: <TantuTag>Selvedge</TantuTag> },
  { name: "TantuSeal", element: <TantuSeal name="Rukmini Devi" /> },
  {
    name: "TantuAvatarGroup",
    element: <TantuAvatarGroup names={["Rukmini Devi", "Anwar Khatri", "Meera Bai"]} max={2} />,
  },
  {
    name: "TantuMeter",
    element: <TantuMeter label="Warp tension" value={62} />,
  },
  {
    name: "TantuNotice",
    element: (
      <TantuNotice tone="caution" title="Tension drifting">
        Re-beam before the next pick.
      </TantuNotice>
    ),
  },
  {
    name: "TantuBanner",
    element: <TantuBanner>The mill closes at sundown.</TantuBanner>,
  },
  {
    name: "TantuTable",
    element: (
      <TantuTable
        caption="Beam register"
        rows={TABLE_ROWS}
        rowKey={(r) => r.id}
        columns={[
          { key: "warp", header: "Warp", cell: (r) => r.warp },
          { key: "picks", header: "Picks", cell: (r) => r.picks },
          { key: "dye", header: "Dye", cell: (r) => r.dye },
        ]}
      />
    ),
  },
  {
    name: "TantuRupture",
    element: (
      <TantuRupture
        code="404-WARP-SEVERED"
        message="The warp parted at pick 1,204."
        audio={false}
      />
    ),
  },
  {
    name: "SikkuKolamLoader",
    element: <SikkuKolamLoader state="spinning" audio={false} label="Drawing the beam" />,
  },
  { name: "TantuUnwoven", element: <TantuUnwoven /> },
  { name: "TantuSpindle", element: <TantuSpindle /> },
  {
    name: "KasutiMatrix",
    element: (
      <KasutiMatrix
        caption="Picks per inch by loom"
        data={[
          { label: "Loom 1", value: 48 },
          { label: "Loom 2", value: 62 },
        ]}
      />
    ),
  },
  {
    name: "JamdaniBlock",
    element: (
      <JamdaniBlock
        caption="Dye uptake"
        data={[
          { label: "Madder", value: 62 },
          { label: "Indigo", value: 38 },
        ]}
      />
    ),
  },
  {
    name: "PatolaField",
    element: (
      <PatolaField
        caption="Registration drift"
        data={[
          { x: 1, y: 4 },
          { x: 2, y: 9 },
          { x: 3, y: 6 },
        ]}
      />
    ),
  },
  {
    name: "TantuPhad",
    element: (
      <TantuPhad
        events={[
          { id: "e1", date: "2026-01-04", label: "Beam dressed" },
          { id: "e2", date: "2026-02-11", label: "First cut" },
        ]}
        silent
      />
    ),
  },
  {
    name: "TantuPanchang",
    element: (
      <TantuPanchang
        month={new Date("2026-03-01T00:00:00Z")}
        marks={[{ date: "2026-03-14", label: "Dye day" }]}
        silent
      />
    ),
  },
  {
    name: "TantuDarshanLens",
    element: (
      <TantuDarshanLens>
        <p>A tapestry read through the lens.</p>
      </TantuDarshanLens>
    ),
  },
  {
    name: "TantuGuptBandhan",
    element: (
      <TantuGuptBandhan verify={(key) => key === "open"} label="Knot key">
        <p>The bound content.</p>
      </TantuGuptBandhan>
    ),
  },
  {
    name: "TantuTraceSearch",
    element: <TantuTraceSearch label="Trace a card" audio={false} />,
  },
  {
    name: "TantuMakuShuttle",
    element: <TantuMakuShuttle />,
    axeNote:
      "Renders only a decorative aria-hidden SVG overlay plus a document-level key listener; there is no accessible content to evaluate.",
  },
  {
    name: "CapillaryBleedSurface",
    element: (
      <CapillaryBleedSurface>
        <p>Dye wicks from wherever the surface is touched.</p>
      </CapillaryBleedSurface>
    ),
  },
  {
    name: "TantuBleedCanvas",
    element: <TantuBleedCanvas />,
    axeNote: "A bare decorative canvas; carries no content and no role.",
  },
  {
    name: "InkBleedFilter",
    element: <InkBleedFilter id="tantu-test-bleed" />,
    axeNote: "An <svg> filter definition with no rendered output.",
  },
  { name: "TalimThread", element: <TalimThread code="T-0421" /> },
  {
    name: "TantuAcousticToggle",
    element: <TantuAcousticToggle />,
  },
  {
    name: "TantuAcousticPalette",
    element: <TantuAcousticPalette />,
  },
];
