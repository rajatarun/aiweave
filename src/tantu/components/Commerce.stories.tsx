import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { TantuImage } from "./TantuImage.js";
import { TantuPrice } from "./TantuPrice.js";
import { TantuQuantity } from "./TantuQuantity.js";
import { TantuSwatchSet } from "./TantuSwatchSet.js";
import { TantuGallery } from "./TantuGallery.js";
import { TantuProvenance } from "./TantuProvenance.js";
import { TantuProductCard } from "./TantuProductCard.js";
import { TantuTag } from "./TantuTag.js";

const meta = {
  title: "Commerce/Shop",
  parameters: {
    a11y: { test: "error" },
    docs: {
      description: {
        component:
          "The shop vocabulary — cloth in a frame, a sum of money, which one, how many, who " +
          "made it, and one piece in a collection.\n\n" +
          "Nothing in this group names a craft, a region or a tradition. That is deliberate: " +
          "these are the structural components a shop anywhere reaches for, and the tradition " +
          "arrives through the pack that dyes them.\n\n" +
          "Three of them exist because the obvious implementation is quietly wrong. A struck " +
          "price is a purely visual convention and reads to a screen reader as two unrelated " +
          "numbers. A sold-out size drawn as a disabled button leaves the tab order, so the " +
          "shopper who wanted that size never learns it exists. And a card wrapped in one big " +
          "`<a>` gives one link whose name is the entire card read as a single run-on string.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/* Photographs as data URIs: the sweep runs with no network, and a story that
   depends on a remote file is a story that fails for a reason unrelated to
   the component. */
const cloth = (weave: string, ground: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
      <rect width="400" height="500" fill="${ground}"/>
      <g stroke="${weave}" stroke-width="2" opacity="0.55">
        ${Array.from({ length: 25 }, (_, i) => `<line x1="0" y1="${i * 20}" x2="400" y2="${i * 20}"/>`).join("")}
        ${Array.from({ length: 20 }, (_, i) => `<line x1="${i * 20}" y1="0" x2="${i * 20}" y2="500"/>`).join("")}
      </g>
      <text x="200" y="480" font-family="serif" font-size="18" fill="${weave}"
            text-anchor="middle">${label}</text>
    </svg>`,
  )}`;

const indigo = cloth("#1d3a5c", "#c9d4e2", "warp");
const madder = cloth("#8c2f22", "#e8cfc7", "selvedge");
const kora = cloth("#7a6f5c", "#e6e1d4", "greige");

const column: React.CSSProperties = { display: "grid", gap: "1.75rem", maxWidth: "30rem" };

export const Photograph: Story = {
  render: () => (
    <div style={column}>
      <TantuImage src={indigo} alt="Indigo cotton, the weave seen square on." ratio="4 / 5" eager />
      <TantuImage
        src="/this-file-is-not-there.jpg"
        alt="Madder-dyed shawl folded over a rail."
        ratio="4 / 5"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "The second frame is a deliberate 404. It keeps its proportion and says what is " +
          "missing, because on a shop page the thing that failed to load is the merchandise.",
      },
    },
  },
};

export const Money: Story = {
  render: () => (
    <div style={column}>
      <TantuPrice amount={85} currency="GBP" locale="en-GB" />
      <TantuPrice amount={51.9} compareAt={85} currency="GBP" locale="en-GB" />
      <TantuPrice amount={4200} currency="JPY" locale="ja-JP" />
      <TantuPrice amount={32} currency="EUR" locale="de-DE" unit="per metre" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Yen takes no decimal places and the euro trails the number in German — both come " +
          "from `Intl`, not from a symbol glued to `toFixed(2)`. The reduction announces " +
          "“Reduced from £85.00 to £51.90” as one sentence; the struck pair beside " +
          "it is `aria-hidden`.",
      },
    },
  },
};

export const WhichOne: Story = {
  render: function WhichOneStory() {
    const [dye, setDye] = useState("indigo");
    const [length, setLength] = useState("2m");
    return (
      <div style={column}>
        <TantuSwatchSet
          label="Dye"
          value={dye}
          onChange={setDye}
          options={[
            { id: "indigo", label: "Indigo", swatch: "var(--tantu-indigo-vat)" },
            { id: "madder", label: "Madder", swatch: "var(--tantu-madder-root)" },
            { id: "kora", label: "Undyed", swatch: "var(--tantu-kora-raw)" },
            { id: "iron", label: "Iron black", swatch: "var(--tantu-kala-iron)", available: false },
          ]}
        />
        <TantuSwatchSet
          label="Length"
          value={length}
          onChange={setLength}
          options={[
            { id: "1m", label: "1 m" },
            { id: "2m", label: "2 m" },
            { id: "3m", label: "3 m", available: false },
          ]}
        />
        <TantuQuantity label="Quantity" defaultValue={1} min={1} max={4} />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "Iron black and 3 m are sold out. Tab into either group and arrow through it: the " +
          "sold-out options are still reachable and announce themselves as unavailable, " +
          "rather than vanishing from the tab order the way a disabled button would. Each " +
          "group is one tab stop. Under `dir=\"rtl\"` the arrows reverse.\n\n" +
          "The quantity ceiling is four; the + button spends itself there.",
      },
    },
  },
};

export const Frames: Story = {
  render: () => (
    <div style={{ maxWidth: "26rem" }}>
      <TantuGallery
        frames={[
          { id: "square", src: indigo, alt: "The cloth square on, showing the weave density." },
          { id: "edge", src: madder, alt: "The selvedge, where the weft turns." },
          { id: "worn", src: kora, alt: "The shawl over a shoulder, showing how it falls." },
        ]}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Each frame carries its own alt. Three photographs all called “Indigo shawl” " +
          "tell a listener there are three photographs and nothing more; these tell them what " +
          "they would have learned by looking.",
      },
    },
  },
};

export const WhoMadeIt: Story = {
  render: () => (
    <div style={{ maxWidth: "34rem" }}>
      <TantuProvenance
        title="At the loom"
        entries={[
          { term: "Woven by", detail: "Rehmat Bibi" },
          { term: "Workshop", detail: "Bhujodi, Kachchh" },
          { term: "Technique", detail: "Extra-weft on a pit loom" },
          { term: "Fibre", detail: "Kala cotton, undyed warp" },
          { term: "At the loom", detail: "Nine days" },
        ]}
        mark="Handloom Mark — registered"
      >
        Kala cotton is rain-fed and short-staple, which is why the cloth has the slub it does.
        The warp is left undyed so the weft carries the whole colour.
      </TantuProvenance>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "The block a craft shop has and a general commerce kit does not — and on a handloom " +
          "shop it converts better than anything else on the page. It is a real `<dl>`, so a " +
          "screen reader moves through it pair by pair.\n\n" +
          "`mark` is a plain string the shop passes. There is deliberately no built-in list of " +
          "certifications to choose from: whether a piece may carry a geographical indication " +
          "is a legal fact about that piece, not a style a component may confer.",
      },
    },
  },
};

export const Collection: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
        gap: "1.25rem",
      }}
    >
      <TantuProductCard
        warpSpan={4}
        eager
        title="Bhujodi shawl, indigo"
        href="#bhujodi"
        src={indigo}
        alt="Indigo shawl, the weave seen square on."
        note="Kachchh · extra-weft"
        price={{ amount: 85, currency: "GBP", locale: "en-GB" }}
      />
      <TantuProductCard
        warpSpan={4}
        title="Madder stole"
        href="#madder"
        src={madder}
        alt="Madder-dyed stole folded to show the selvedge."
        note="Kachchh · plain weave"
        price={{ amount: 51.9, compareAt: 85, currency: "GBP", locale: "en-GB" }}
        flags={<TantuTag tone="caution">Last one</TantuTag>}
      />
      <TantuProductCard
        warpSpan={4}
        title="Greige yardage"
        href="#kora"
        src={kora}
        alt="Undyed cotton yardage on the roll."
        note="Kala cotton · undyed"
        price={{ amount: 32, currency: "GBP", locale: "en-GB", unit: "per metre" }}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Tab through this. Three cards, three tab stops, each one named for its piece — not " +
          "twelve stops, and not one link called “Madder stole Kachchh plain weave £51.90 " +
          "was £85.00 Last one”. The whole card is still the click target: the title's " +
          "link is stretched over it with a pseudo-element.\n\n" +
          "Only the first card loads its photograph eagerly.",
      },
    },
  },
};
