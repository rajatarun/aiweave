import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { TantuDialog } from "./TantuDialog";
import { TantuPopover } from "./TantuPopover";
import { TantuTooltip } from "./TantuTooltip";
import { TantuButton } from "./TantuButton";

const meta = {
  title: "Overlays/Panels cut from the substrate",
  parameters: {
    a11y: { test: "error" },
    docs: {
      description: {
        component:
          "`aria-modal=\"true\"` is a promise to assistive technology that nothing outside " +
          "the panel is reachable. The browser does not enforce it — the author has to — and " +
          "Tantu did not until an audit caught it: Tab walked straight out of the dialog into " +
          "the page behind the scrim, where a keyboard user could operate controls they could " +
          "not see.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function DialogHarness({ persistent = false }: { persistent?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
      <TantuButton onClick={() => setOpen(true)}>Cut the cloth</TantuButton>
      <TantuButton variant="ghost">Behind the scrim</TantuButton>
      <TantuDialog
        open={open}
        persistent={persistent}
        title="Cut the cloth"
        meta="IRREVERSIBLE"
        onClose={() => setOpen(false)}
        footer={
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <TantuButton variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </TantuButton>
            <TantuButton variant="primary" onClick={() => setOpen(false)}>
              Cut
            </TantuButton>
          </div>
        }
      >
        <p>Once the selvedge is crossed the cloth cannot be re-tensioned on this beam.</p>
      </TantuDialog>
    </div>
  );
}

export const Dialog: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Open it and hold Tab. Focus cycles inside the panel and never reaches the ghost " +
          "button behind the scrim. Escape closes it and hands focus back to whatever opened " +
          "it — without that, the keyboard lands at the top of the document and the reader " +
          "has to re-traverse the page.\n\n" +
          "The accessible name comes from the heading via `aria-labelledby`; a dialog with " +
          "no name is announced as just \"dialog\".",
      },
    },
  },
  render: () => <DialogHarness />,
};

export const PersistentDialog: Story = {
  parameters: {
    docs: {
      description: {
        story: "`persistent` blocks Escape and scrim dismissal. Focus is still contained.",
      },
    },
  },
  render: () => <DialogHarness persistent />,
};

export const Popover: Story = {
  render: () => (
    <TantuPopover title="Thread gauge" trigger={<TantuButton variant="secondary">Gauge</TantuButton>}>
      <p style={{ margin: 0 }}>Filament, ply, cord, braid — 1px, 2px, 4px, 6px.</p>
    </TantuPopover>
  ),
};

export const Tooltip: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "A pinned talim note. It is anchored with `left: 50%` and `translateX(-50%)`, which " +
          "is one of the few physical pairs the stylesheet deliberately does *not* mirror: " +
          "the pair is symmetric about the midpoint, so flipping it would move the tooltip " +
          "rather than leave it centred.",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", gap: "2rem", paddingTop: "3rem" }}>
      <TantuTooltip label="Picks per inch">
        <TantuButton variant="ghost">PPI</TantuButton>
      </TantuTooltip>
      <TantuTooltip label="Ends per inch">
        <TantuButton variant="ghost">EPI</TantuButton>
      </TantuTooltip>
    </div>
  ),
};
