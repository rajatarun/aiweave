import type { Meta, StoryObj } from "@storybook/react-vite";
import { TantuLoom } from "./TantuLoom";
import { TantuCell } from "./TantuCell";
import { TantuCard } from "./TantuCard";
import { ChambaRumalCard } from "./ChambaRumalCard";
import { TantuStack, TantuCut, TantuMasthead } from "./TantuLayout";
import { TalimThread } from "./TalimThread";

const meta = {
  title: "Layout/The loom",
  parameters: {
    a11y: { test: "error" },
    docs: {
      description: {
        component:
          "A twelve-thread warp that drops to four below 768px. Cells span divisors of " +
          "twelve — 1, 2, 3, 4, 6, 12 — and the 1px gap between them is the background " +
          "showing through, which is why the threads are literal rather than drawn.\n\n" +
          "Below the breakpoint every direct child is clamped to the four-thread travel " +
          "loom whatever span class it carries. A consumer laying a full-width section " +
          "straight into the content grid must not be able to widen it past its explicit " +
          "columns — that implicit-column overflow used to collapse unrelated siblings " +
          "into near-zero-width tracks and render their text one letter per line.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const filler = (n: number) => (
  <p style={{ margin: 0 }}>{"Forty-eight picks to the inch. ".repeat(n)}</p>
);

export const TwelveThreadWarp: Story = {
  render: () => (
    <TantuLoom viewTalimCode="LOOM-01" shuttle={false}>
      <TantuCell warpSpan={6}>
        <strong>Six threads</strong>
        {filler(2)}
      </TantuCell>
      <TantuCell warpSpan={3}>
        <strong>Three</strong>
        {filler(1)}
      </TantuCell>
      <TantuCell warpSpan={3}>
        <strong>Three</strong>
        {filler(1)}
      </TantuCell>
      <TantuCell warpSpan={12}>
        <strong>The full width</strong>
        {filler(3)}
      </TantuCell>
    </TantuLoom>
  ),
};

export const Card: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Three relief levels. The dashed basted ring is drawn from tokens only, and its " +
          "colour is `--tantu-border-hairline` rather than the decorative weave — a card's " +
          "own background sits at roughly 1.1:1 against the page ground, so that hairline is " +
          "what identifies the component and WCAG 1.4.11 applies to it.",
      },
    },
  },
  render: () => (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))" }}>
      <TantuCard talimCode="W-01">
        <h3 style={{ marginTop: 0 }}>Flat</h3>
        <p>The standard kora substrate.</p>
      </TantuCard>
      <TantuCard reliefLevel="kanthi" talimCode="W-02">
        <h3 style={{ marginTop: 0 }}>Kanthi</h3>
        <p>A dashed running-stitch boundary.</p>
      </TantuCard>
      <TantuCard reliefLevel="zardozi" talimCode="W-03">
        <h3 style={{ marginTop: 0 }}>Zardozi</h3>
        <p>A thick, prominent structural border.</p>
      </TantuCard>
    </div>
  ),
};

export const RumalCard: Story = {
  name: "Chamba rumal — dye reveal",
  parameters: {
    docs: {
      description: {
        story:
          "The double-sided embroidery of a Chamba rumal: both faces are the same stitch, " +
          "read in mirror. Turning it over is not a flip — the reverse wicks through as dye " +
          "spreading into cloth, on the Lucas–Washburn law, and the front position is " +
          "genuinely `√t` rather than an ease-out that resembles it.\n\n" +
          "Press the card. Half the travel is done in the first third of the duration; the " +
          "rest is the long crawl real cloth shows.",
      },
    },
  },
  render: () => (
    <div style={{ maxWidth: "22rem" }}>
      <ChambaRumalCard
        obverse={
          <>
            <h3 style={{ marginTop: 0 }}>Obverse</h3>
            <p>The face the room sees.</p>
          </>
        }
        reverse={
          <>
            <h3 style={{ marginTop: 0 }}>Reverse</h3>
            <p>The same stitch, read in mirror — no knots, no loose ends.</p>
          </>
        }
      />
    </div>
  ),
};

export const RumalCardReverse: Story = {
  name: "Chamba rumal — the dyed face",
  parameters: {
    docs: {
      description: {
        story:
          "The same card at rest on its reverse. This story exists because its absence was a " +
          "hole in every automated sweep: the card was only ever rendered showing its obverse, " +
          "so nothing measured the reverse face's text against its own dye — which was " +
          "**1.19:1** in the light theme, near-black ink on near-black indigo, effectively " +
          "invisible.\n\n" +
          "Each dye is now declared alongside the ink that reads on it (14.88 light, 5.04 " +
          "dark), the dye fills the card edge to edge rather than an inset rectangle, and the " +
          "text sits inside the colour rather than flush against its boundary.",
      },
    },
  },
  render: () => (
    <div style={{ maxWidth: "22rem" }}>
      <ChambaRumalCard
        isFlipped
        obverse={
          <>
            <h3 style={{ marginTop: 0 }}>Obverse</h3>
            <p>The face the room sees.</p>
          </>
        }
        reverse={
          <>
            <h3 style={{ marginTop: 0 }}>Reverse</h3>
            <p>The same stitch, read in mirror — no knots, no loose ends.</p>
          </>
        }
      />
    </div>
  ),
};

export const StackAndCut: Story = {
  render: () => (
    <TantuStack>
      <p style={{ margin: 0 }}>Wind the warp.</p>
      <TantuCut />
      <p style={{ margin: 0 }}>Dress the loom.</p>
      <TantuCut />
      <p style={{ margin: 0 }}>Weave.</p>
    </TantuStack>
  ),
};

export const Masthead: Story = {
  render: () => (
    <TantuMasthead
      mark="Tantu"
      links={[
        { label: "Threads", href: "#threads" },
        { label: "Dyes", href: "#dyes" },
        { label: "Looms", href: "#looms" },
      ]}
    />
  ),
};

export const TalimCode: Story = {
  name: "Talim thread",
  parameters: {
    docs: {
      description: {
        story:
          "A Kashmiri shawl's coded instruction, stamped in the selvedge margin. Decorative " +
          "in effect but named for assistive technology, because a machine code read aloud " +
          "character by character is noise.",
      },
    },
  },
  render: () => <TalimThread code="T-0421-WARP" />,
};
