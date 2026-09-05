import type { Meta, StoryObj } from "@storybook/react-vite";
import { TantuMakuShuttle } from "./TantuMakuShuttle.js";
import { TantuDarshanLens } from "./TantuDarshanLens.js";
import { TantuTraceSearch } from "./TantuTraceSearch.js";
import { TantuGuptBandhan } from "./TantuGuptBandhan.js";
import { TantuAcousticToggle } from "./TantuAcousticToggle.js";
import { TantuAcousticPalette } from "./TantuAcousticPalette.js";
import { TantuCard } from "./TantuCard.js";
import { TantuButton } from "./TantuButton.js";

const meta = {
  title: "Atmosphere/The room around the loom",
  parameters: {
    a11y: { test: "error" },
    docs: {
      description: {
        component:
          "Page-level apparatus rather than components you place in a layout. Each one is " +
          "ambient by design, which makes each one a risk: a thing that listens to the whole " +
          "document can break every component on it, and the shuttle did exactly that for a " +
          "while.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const MakuShuttle: Story = {
  name: "Maku shuttle",
  parameters: {
    docs: {
      description: {
        story:
          "Focus moving between controls draws a gold weft thread along the path the shuttle " +
          "travelled, snapped to the loom's own column threads.\n\n" +
          "This component is the cautionary tale of the system. It bound `keydown` on " +
          "`document` in the **capture** phase and called `preventDefault()`, so it ran ahead " +
          "of every component handler on the page — Tantu's own tablist never received " +
          "ArrowRight, and neither did any native radio group, listbox, menu, tree or grid in " +
          "a consuming application. The design system silently broke its own components, and " +
          "everyone else's.\n\n" +
          "It now listens in the bubble phase, exits early on `defaultPrevented`, and walks " +
          "ancestors against 26 ARIA roles plus the native controls that own their arrows. " +
          "Tab between the buttons below to see the thread; the arrow keys still route " +
          "spatially across plain controls, because nothing else wanted them.",
      },
    },
  },
  render: () => (
    <div>
      <TantuMakuShuttle />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2rem", maxWidth: "34rem" }}>
        {["Warp", "Weft", "Reed", "Heddle", "Shuttle", "Beam"].map((label) => (
          <TantuButton key={label} variant="secondary">
            {label}
          </TantuButton>
        ))}
      </div>
    </div>
  ),
};

export const DarshanLens: Story = {
  name: "Darshan lens",
  parameters: {
    docs: {
      description: {
        story:
          "Below the loom's breakpoint the tapestry is not reflowed into a column — breaking " +
          "a tapestry's threads to fit a phone is refused outright. Instead the cloth is " +
          "panned and zoomed under a lens. Released fabric glides under its own weight and " +
          "locks; a dragged finger moves it with no easing at all, because it is in direct " +
          "contact.",
      },
    },
  },
  render: () => (
    <div style={{ height: "22rem" }}>
      <TantuDarshanLens talimCode="LENS-01">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 16rem)", gap: "1rem" }}>
          {["Madder", "Indigo", "Katha", "Genda", "Pala", "Zari"].map((dye) => (
            <TantuCard key={dye} talimCode={dye.slice(0, 3).toUpperCase()}>
              <h3 style={{ marginTop: 0 }}>{dye}</h3>
              <p>A bath, a mordant, and a length of time in it.</p>
            </TantuCard>
          ))}
        </div>
      </TantuDarshanLens>
    </div>
  ),
};

export const TraceSearch: Story = {
  name: "Trace search",
  parameters: {
    docs: {
      description: {
        story:
          "Searching does not filter a list — it throws a thread across the page and binds " +
          "it to the matching card, which is then held taut at its selvedges. Type \"indigo\".",
      },
    },
  },
  render: () => (
    <div>
      <TantuTraceSearch label="Trace a dye" audio={false} nodeSelector=".tantu-card" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))", gap: "1rem", marginTop: "2rem" }}>
        {["Madder root", "Indigo vat", "Katha bark"].map((dye) => (
          <TantuCard key={dye} data-trace-label={dye}>
            <h3 style={{ marginTop: 0 }}>{dye}</h3>
          </TantuCard>
        ))}
      </div>
    </div>
  ),
};

export const GuptBandhan: Story = {
  name: "Gupt Bandhan — the hidden knot",
  parameters: {
    docs: {
      description: {
        story:
          "Content bound behind a knot only the right key unties. The key here is `open`.\n\n" +
          "This is presentation, not security: the content is in the DOM. Anything that must " +
          "actually be withheld has to be withheld by a server.",
      },
    },
  },
  render: () => (
    <div style={{ maxWidth: "28rem" }}>
      <TantuGuptBandhan verify={(key) => key === "open"} label="Knot key">
        <TantuCard talimCode="BOUND">
          <p style={{ margin: 0 }}>The thread is untied.</p>
        </TantuCard>
      </TantuGuptBandhan>
    </div>
  ),
};

export const Acoustics: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "The loom has a voice — the batten's strike, the shuttle's pass, the warp's snap. " +
          "It is off until asked for, persists the reader's choice, and every component that " +
          "makes a sound takes an `audio` prop that turns it off individually.\n\n" +
          "Sound is never the only carrier of anything. Nothing in the system requires hearing " +
          "it.",
      },
    },
  },
  render: () => (
    <div style={{ display: "grid", gap: "2rem" }}>
      <TantuAcousticToggle />
      <TantuAcousticPalette />
    </div>
  ),
};
