import type { Meta, StoryObj } from "@storybook/react-vite";
import { TantuTable } from "./TantuTable";
import { KasutiMatrix } from "./KasutiMatrix";
import { JamdaniBlock } from "./JamdaniBlock";
import { PatolaField } from "./PatolaField";

const meta = {
  title: "Data/Counted threads",
  parameters: {
    a11y: { test: "error" },
    docs: {
      description: {
        component:
          "The charts are woven rather than plotted: a Kasuti matrix counts threads, a " +
          "Jamdani block is supplementary weft laid across the ground, a Patola field is " +
          "resist-dyed before the cloth exists. Each takes a `caption` that names what is " +
          "being counted — a chart with no accessible name is an image of numbers.\n\n" +
          "These are the one place in the system that opts out of forced colours, with " +
          "`forced-color-adjust: none`. That is the correct behaviour under the spec when " +
          "colour *is* the content: a flattened ikat band shows nothing at all.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const ROWS = [
  { id: "r1", warp: "Cotton 40s", picks: 48, dye: "Madder root", tension: "9.0 N" },
  { id: "r2", warp: "Cotton 60s", picks: 62, dye: "Indigo vat", tension: "8.4 N" },
  { id: "r3", warp: "Tussar silk", picks: 71, dye: "Katha bark", tension: "6.2 N" },
];

export const Table: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "A real `<table>` with a real `<caption>`. Numeric columns are tabular-lined so " +
          "digits align down the column rather than shuffling.",
      },
    },
  },
  render: () => (
    <TantuTable
      caption="Beam register — Loom 4"
      rows={ROWS}
      rowKey={(r) => r.id}
      columns={[
        { key: "warp", header: "Warp", cell: (r) => r.warp },
        { key: "picks", header: "Picks / in", cell: (r) => r.picks },
        { key: "dye", header: "Dye", cell: (r) => r.dye },
        { key: "tension", header: "Tension", cell: (r) => r.tension },
      ]}
    />
  ),
};

export const Kasuti: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Counted-thread embroidery: the series is stitched onto a fixed grid of rows, so " +
          "the value is quantised to whole threads rather than drawn to an arbitrary height. " +
          "The stitch animates in as the chart scrolls into view, and runs out in one frame " +
          "under reduced motion.",
      },
    },
  },
  render: () => (
    <div style={{ maxWidth: "40rem" }}>
      <KasutiMatrix
        caption="Picks per inch, by loom"
        audio={false}
        data={[
          { label: "Loom 1", value: 48 },
          { label: "Loom 2", value: 62 },
          { label: "Loom 3", value: 71 },
          { label: "Loom 4", value: 55 },
          { label: "Loom 5", value: 39 },
        ]}
      />
    </div>
  ),
};

export const Jamdani: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Supplementary weft: each bar is a discontinuous float laid across the ground " +
          "weave. Focusing a column releases its tension, and the picks visibly loosen and " +
          "separate to expose the grid underneath.",
      },
    },
  },
  render: () => (
    <div style={{ maxWidth: "34rem" }}>
      <JamdaniBlock
        caption="Dye uptake by bath"
        audio={false}
        data={[
          { label: "Madder", value: 62 },
          { label: "Indigo", value: 38 },
          { label: "Katha", value: 51 },
          { label: "Genda", value: 24 },
        ]}
      />
    </div>
  ),
};

export const Patola: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Double ikat: warp and weft are both resist-dyed before weaving, so the pattern " +
          "only registers if the two align. Drift in the registration is the visual language " +
          "here — a band that has slipped reads as a blurred edge, which is exactly what a " +
          "real patola shows.",
      },
    },
  },
  render: () => (
    <div style={{ maxWidth: "34rem" }}>
      <PatolaField
        caption="Registration drift across the width"
        data={[
          { x: 1, y: 4 },
          { x: 2, y: 9 },
          { x: 3, y: 6 },
          { x: 4, y: 11 },
          { x: 5, y: 3 },
        ]}
      />
    </div>
  ),
};
