import type { Meta, StoryObj } from "@storybook/react-vite";
import { TantuTag } from "./TantuTag.js";
import { TantuSeal } from "./TantuSeal.js";
import { TantuAvatarGroup } from "./TantuAvatarGroup.js";
import { TantuMeter } from "./TantuMeter.js";
import { TantuNotice } from "./TantuNotice.js";
import { TantuBanner } from "./TantuBanner.js";
import { TantuRupture } from "./TantuRupture.js";
import { SikkuKolamLoader } from "./SikkuKolamLoader.js";
import { TantuUnwoven, TantuSpindle } from "./TantuLoading.js";

const meta = {
  title: "Feedback/State of the weave",
  parameters: {
    a11y: { test: "error" },
    docs: {
      description: {
        component:
          "Nothing here carries its meaning in colour alone. Every tone has a word, a shape " +
          "or a position saying the same thing — which is what makes the forced-colors " +
          "restatement possible rather than a rewrite: when the user agent flattens a fill, " +
          "the meaning is still on the page.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tags: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      <TantuTag>Selvedge</TantuTag>
      <TantuTag tone="accent">Madder</TantuTag>
      <TantuTag tone="structural">Indigo</TantuTag>
      <TantuTag tone="success">Tensioned</TantuTag>
      <TantuTag tone="caution">Drifting</TantuTag>
      <TantuTag tone="zari">Gold weft</TantuTag>
    </div>
  ),
};

export const SolidTags: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "`solid` fills the tag with its own tone and inverts the label. Every tone is here " +
          "rather than one representative, because the fill and the label are a *pair* — a " +
          "tone that reads well as text on the page ground can still fail as a background " +
          "behind an inverted label, and only rendering it says which.",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      <TantuTag solid>Neutral</TantuTag>
      <TantuTag solid tone="accent">Madder</TantuTag>
      <TantuTag solid tone="structural">Indigo</TantuTag>
      <TantuTag solid tone="success">Tensioned</TantuTag>
      <TantuTag solid tone="caution">Drifting</TantuTag>
      <TantuTag solid tone="zari">Gold weft</TantuTag>
    </div>
  ),
};

export const Seals: Story = {
  parameters: {
    docs: {
      description: {
        story: "A weaver's seal, and the overlapping cluster. `max` collapses the tail into a count.",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", gap: "2rem", alignItems: "center", flexWrap: "wrap" }}>
      <TantuSeal name="Rukmini Devi" />
      <TantuAvatarGroup names={["Rukmini Devi", "Anwar Khatri", "Meera Bai", "Salim Ansari"]} max={3} />
    </div>
  ),
};

export const Meter: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "1rem", maxWidth: "24rem" }}>
      <TantuMeter label="Warp tension" value={62} />
      <TantuMeter label="Dye uptake" value={94} />
      {/* Omitting `value` is what makes it indeterminate — the shuttle passes
          rather than filling to a figure. */}
      <TantuMeter label="Drawing the beam" />
    </div>
  ),
};

export const Notices: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "The accent bar sits on `border-inline-start`, so it moves to the other side under " +
          "`dir=\"rtl\"` without a second rule. Try the direction toggle.",
      },
    },
  },
  render: () => (
    <div style={{ display: "grid", gap: "0.75rem", maxWidth: "34rem" }}>
      <TantuNotice tone="info" title="Beam dressed">
        Four hundred and eighty ends, threaded through the heddles.
      </TantuNotice>
      <TantuNotice tone="success" title="Tension holding">
        Nine newtons across the full width.
      </TantuNotice>
      <TantuNotice tone="caution" title="Tension drifting">
        Re-beam before the next pick.
      </TantuNotice>
      <TantuNotice tone="critical" title="Warp severed">
        The warp parted at pick 1,204.
      </TantuNotice>
    </div>
  ),
};

export const Banner: Story = {
  render: () => <TantuBanner>The mill closes at sundown.</TantuBanner>,
};

export const Loading: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "The Sikku Kolam draws a single continuous thread around a bindu matrix and snaps " +
          "it taut on resolve. Under `prefers-reduced-motion` every one of these runs to its " +
          "end state in a single frame rather than being cancelled — several are `forwards` " +
          "reveals starting from `opacity: 0`, and cancelling them would leave the content " +
          "invisible instead of still.",
      },
    },
  },
  render: () => (
    <div style={{ display: "grid", gap: "2rem" }}>
      <SikkuKolamLoader state="spinning" audio={false} />
      <TantuUnwoven />
      <p style={{ margin: 0 }}>
        Inline: drawing the beam <TantuSpindle />
      </p>
    </div>
  ),
};

export const Rupture: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "The error state. The lattice severs at the coordinate of failure and the weaver " +
          "must physically re-tension the loom to recover. The Talim ligatures detach into " +
          "isolated glyphs, so each glyph is `aria-hidden` and the intact code is restated in " +
          "a visually-hidden span — it used to be an `aria-label` on a `<p>`, which ARIA " +
          "prohibits and user agents may ignore, leaving the error code inaudible.",
      },
    },
  },
  render: () => (
    <TantuRupture
      code="404-WARP-SEVERED"
      message="The warp parted at pick 1,204. Re-tension the loom to continue."
      audio={false}
    />
  ),
};
