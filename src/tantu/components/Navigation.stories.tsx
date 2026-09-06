import type { Meta, StoryObj } from "@storybook/react-vite";
import { TantuTabs } from "./TantuTabs.js";
import { TantuFold } from "./TantuFold.js";
import { TantuStepper } from "./TantuStepper.js";
import { TantuNaksha, type NakshaBand, type NakshaState } from "./TantuNaksha.js";
import { TantuPagination } from "./TantuPagination.js";
import { TantuTrail } from "./TantuTrail.js";

const meta = {
  title: "Navigation/Moving through the cloth",
  parameters: {
    a11y: { test: "error" },
    docs: {
      description: {
        component:
          "Every composite widget here follows the WAI-ARIA Authoring Practices, including " +
          "the part most implementations miss: **in a right-to-left context the left and " +
          "right arrow keys swap roles.** Switch the direction in the toolbar and press " +
          "ArrowRight on the tablist — selection moves towards the *start* of the " +
          "collection, because that is where 'right' now points.\n\n" +
          "Direction is resolved from the widget's own computed style rather than a global " +
          "flag, so an LTR island inside an RTL document still behaves as LTR.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const TAB_ITEMS = [
  { id: "warp", label: "Warp", content: <p>The vertical threads, held under tension on the beam.</p> },
  { id: "weft", label: "Weft", content: <p>The horizontal threads, thrown across by the shuttle.</p> },
  { id: "selvedge", label: "Selvedge", content: <p>The finished edge, where the weft turns back.</p> },
];

export const Tabs: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Arrow keys move selection **and focus** together — a roving-tabindex tablist that " +
          "moved only selection would strand the keyboard on an element that had just become " +
          "`tabindex=\"-1\"`, so the next Tab press would leave the widget from the wrong " +
          "place. Home and End jump to the ends. Disabled tabs are skipped.",
      },
    },
  },
  render: () => <TantuTabs items={TAB_ITEMS} />,
};

export const TabsWithDisabled: Story = {
  render: () => (
    <TantuTabs
      items={[TAB_ITEMS[0], { ...TAB_ITEMS[1], disabled: true }, TAB_ITEMS[2]]}
    />
  ),
};

export const Fold: Story = {
  parameters: {
    docs: {
      description: {
        story: "A cloth folded along its weft. `single` makes the folds mutually exclusive.",
      },
    },
  },
  render: () => (
    <TantuFold
      items={[
        { id: "a", label: "Setting the warp", content: <p>Beam, cross, heddles, reed.</p> },
        { id: "b", label: "Throwing the weft", content: <p>Shuttle, shed, beat.</p> },
        { id: "c", label: "Cutting the cloth", content: <p>Only once, and only at the selvedge.</p> },
      ]}
      defaultOpenIds={["a"]}
    />
  ),
};

export const Stepper: Story = {
  render: () => (
    <TantuStepper
      currentStepId="dress"
      steps={[
        { id: "warp", label: "Wind the warp" },
        { id: "dress", label: "Dress the loom" },
        { id: "weave", label: "Weave" },
        { id: "cut", label: "Cut" },
      ]}
    />
  ),
};

/**
 * A hundred squares in four bands of very different sizes — the shape a long
 * curriculum actually has, and the reason the chart draws band area from node
 * count rather than taking a scale from the caller.
 */
const BAND_SIZES: Array<[string, string, number, string]> = [
  ["one", "First band", 10, "training"],
  ["two", "Second band", 20, "no fail state"],
  ["three", "Third band", 30, "urgency enters"],
  ["four", "Fourth band", 40, "everything at once"],
];

const CHART: NakshaBand[] = (() => {
  let n = 0;
  return BAND_SIZES.map(([id, label, count, note]) => ({
    id,
    label,
    note,
    nodes: Array.from({ length: count }, () => {
      n += 1;
      const state: NakshaState = n < 14 ? "completed" : n === 14 ? "active" : "locked";
      return { id: `sq-${n}`, label: `Square ${n}`, state };
    }),
  }));
})();

export const Naksha: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "A naksha is a brocade design squared onto a grid before a single pick is thrown, " +
          "and also the ordinary word for a map. Both meanings are the component: the plan " +
          "of a long journey, and how far along it the work has reached.\n\n" +
          "Three states and no fourth — TantuStepper's own vocabulary. `completed` squares " +
          "carry the Jamdani pack, `active` is the fell with the batten's accent cord at it, " +
          "`locked` is bare warp. Locked is neutral cloth on purpose: a chart is mostly " +
          "unwoven by definition, and a hundred caution dyes is not a state.\n\n" +
          "Every square is the same size in every band, so a band's area is exactly " +
          "proportional to its node count and the compression between bands is drawn rather " +
          "than declared. Bands are parted by the Panchang's fringe — the weft stops and only " +
          "the warp crosses the gap.\n\n" +
          "**Keyboard.** TantuAcousticPalette's roving tabindex taken from one row to many. " +
          "One tab stop in the whole chart; Left/Right walk the flattened order across rows " +
          "and bands (and swap roles under `dir=\"rtl\"`), Up/Down move a row holding the " +
          "column, Home/End reach the ends of the row, Ctrl+Home/End the ends of the chart. " +
          "Locked squares stay in the roving order carrying `aria-disabled` rather than being " +
          "skipped: they are most of the chart, and a keyboard that could only reach the " +
          "unlocked handful would hide the one thing the chart is for.",
      },
    },
  },
  render: () => (
    <div style={{ maxWidth: "24rem" }}>
      <TantuNaksha label="Sampler chart" bands={CHART} currentId="sq-14" />
    </div>
  ),
};

export const Pagination: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Each page sits in its own `listitem`, so the list announces its length and the " +
          "reader's position in it — a bare row of buttons inside `role=\"list\"` announces " +
          "neither. And a numbered button's accessible name is \"Page 3 of 7\", because read " +
          "out of context \"3\" is not a destination.",
      },
    },
  },
  render: () => <TantuPagination totalPages={7} currentPage={3} />,
};

export const Trail: Story = {
  render: () => (
    <TantuTrail
      items={[
        { label: "Mill", href: "#mill" },
        { label: "Loom 4", href: "#loom-4" },
        { label: "Beam" },
      ]}
    />
  ),
};
