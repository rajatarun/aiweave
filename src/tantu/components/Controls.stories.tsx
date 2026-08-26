import type { Meta, StoryObj } from "@storybook/react-vite";
import { TantuInput } from "./TantuInput";
import { TantuTextarea } from "./TantuTextarea";
import { TantuSelect } from "./TantuSelect";
import { TantuToggle } from "./TantuToggle";
import { TantuSlider } from "./TantuSlider";

const meta = {
  title: "Controls/Form controls",
  parameters: {
    a11y: { test: "error" },
    docs: {
      description: {
        component:
          "Every control is a real form element with a real label — the visual treatment is " +
          "a skin over native semantics, never a div pretending to be a control. That is why " +
          "the text field can suppress the native caret and draw a shuttle block instead " +
          "without losing anything: the input underneath is still an `<input>`.\n\n" +
          "The caret rides the measured text advance from wherever text *begins*, which is " +
          "the right-hand edge under `dir=\"rtl\"`. Try the direction toggle.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const row: React.CSSProperties = { display: "grid", gap: "1.25rem", maxWidth: "26rem" };

export const TextField: Story = {
  render: () => (
    <div style={row}>
      <TantuInput label="Warp count" audio={false} defaultValue="40" />
      <TantuInput label="Beam identifier" audio={false} placeholder="e.g. B-04" />
      <TantuInput label="Locked" audio={false} defaultValue="Cotton 60s" disabled />
    </div>
  ),
};

export const Textarea: Story = {
  render: () => (
    <div style={row}>
      <TantuTextarea
        label="Weaver's note"
        rows={4}
        defaultValue="Held at nine newtons. Re-beam before the next pick."
      />
    </div>
  ),
};

export const Select: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "The chevron is drawn with two gradients pinned to the trailing edge, which is the " +
          "left edge in RTL — one of the three things logical properties cannot express, so " +
          "it carries an explicit `[dir=\"rtl\"]` rule.",
      },
    },
  },
  render: () => (
    <div style={row}>
      <TantuSelect label="Dye bath" defaultValue="madder">
        <option value="madder">Madder root</option>
        <option value="indigo">Indigo vat</option>
        <option value="katha">Katha bark</option>
      </TantuSelect>
    </div>
  ),
};

export const Toggle: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Three knot forms — checkbox, radio and treadle switch, each a real native input. Under forced colours the knob's position still carries the state, " +
          "but its colour does not survive — so both states are additionally restated in " +
          "`CanvasText` and `Highlight` rather than relying on a 20px offset alone.",
      },
    },
  },
  render: () => (
    <div style={row}>
      <TantuToggle audio={false} variant="checkbox">
        Madder knot — a checkbox
      </TantuToggle>
      <TantuToggle audio={false} variant="radio" name="shed" defaultChecked>
        Bias diamond — a radio
      </TantuToggle>
      <TantuToggle audio={false} variant="radio" name="shed">
        Bias diamond — the other one
      </TantuToggle>
      <TantuToggle audio={false} variant="switch">
        Engage the treadle — a switch
      </TantuToggle>
    </div>
  ),
};

export const Slider: Story = {
  render: () => (
    <div style={row}>
      <TantuSlider label="Beat force" min={0} max={12} defaultValue={9} />
      <TantuSlider label="Warp tension" min={0} max={100} defaultValue={62} />
    </div>
  ),
};

export const AllControls: Story = {
  name: "The whole set",
  render: () => (
    <div style={{ display: "grid", gap: "1.5rem", maxWidth: "26rem" }}>
      <TantuInput label="Warp count" audio={false} defaultValue="40" />
      <TantuSelect label="Dye bath" defaultValue="madder">
        <option value="madder">Madder root</option>
        <option value="indigo">Indigo vat</option>
      </TantuSelect>
      <TantuSlider label="Beat force" min={0} max={12} defaultValue={9} />
      <TantuToggle audio={false}>Engage the treadle</TantuToggle>
      <TantuTextarea label="Weaver's note" rows={3} defaultValue="Held at nine newtons." />
    </div>
  ),
};
