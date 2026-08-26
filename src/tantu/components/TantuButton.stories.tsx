import type { Meta, StoryObj } from "@storybook/react-vite";
import { TantuButton } from "./TantuButton";

const meta = {
  title: "Controls/Button",
  component: TantuButton,
  parameters: {
    docs: {
      description: {
        component:
          "The batten. A press is answered by dye wicking out of the contact point — the " +
          "control's own bleed, arbitrated by the bleed bus so a button inside a bleeding " +
          "card produces one dye front, not three.\n\n" +
          "The focus ring is two-tone by necessity: the brand reserves zari gold for focus, " +
          "and gold on cream measures 1.89:1, so a contrast halo rides just outside it. " +
          "Measured at 14.57:1 in light and 16.68:1 in dark.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost"],
      description: "Weight of the mark on the cloth.",
    },
    bleed: {
      control: "boolean",
      description: "Emit a mordant capillary bleed from the contact point on press.",
    },
    disabled: { control: "boolean" },
    children: { control: "text" },
  },
  args: {
    children: "Beat the weft",
  },
} satisfies Meta<typeof TantuButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: "primary" },
};

export const Secondary: Story = {
  args: { variant: "secondary" },
};

export const Ghost: Story = {
  args: { variant: "ghost" },
};

export const Disabled: Story = {
  args: { variant: "primary", disabled: true },
  parameters: {
    docs: {
      description: {
        story:
          "Disabled controls are dimmed with opacity, which forced-colors mode does not " +
          "touch — so under system colours they are additionally given `GrayText`, which " +
          "is the signal the OS and assistive technology both expect.",
      },
    },
  },
};

export const EveryVariant: Story = {
  parameters: {
    docs: {
      description: {
        story: "Switch the theme and direction in the toolbar; all four combinations are checked in CI.",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
      <TantuButton variant="primary">Primary</TantuButton>
      <TantuButton variant="secondary">Secondary</TantuButton>
      <TantuButton variant="ghost">Ghost</TantuButton>
      <TantuButton variant="primary" disabled>
        Disabled
      </TantuButton>
    </div>
  ),
};
