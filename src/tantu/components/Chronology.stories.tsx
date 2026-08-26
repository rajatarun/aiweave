import type { Meta, StoryObj } from "@storybook/react-vite";
import { TantuPhad } from "./TantuPhad";
import { TantuPanchang } from "./TantuPanchang";

const meta = {
  title: "Chronology/Time as cloth",
  parameters: {
    a11y: { test: "error" },
    docs: {
      description: {
        component:
          "Two ways of weaving time. The Phad is a heavy scroll between two wooden rollers — " +
          "the vertical warp is the continuous flow of time, the horizontal weft is what " +
          "happened. The Panchang is a lattice, and its substrate dye tracks the clock, " +
          "bleeding from Indigo Sky toward Kala Charcoal as night falls over the grid.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Phad: Story = {
  render: () => (
    <div style={{ maxWidth: "34rem" }}>
      <TantuPhad
        silent
        events={[
          { id: "e1", date: "2026-01-04", label: "Beam dressed" },
          { id: "e2", date: "2026-01-19", label: "First pick" },
          { id: "e3", date: "2026-02-11", label: "Warp severed at 1,204" },
          { id: "e4", date: "2026-02-14", label: "Re-tensioned" },
          { id: "e5", date: "2026-03-02", label: "Cut from the loom" },
        ]}
      />
    </div>
  ),
};

export const Panchang: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "The calendar was a `role=\"grid\"` with no rows until an audit caught it — every " +
          "cell sat directly under the grid, which is the shape a screen reader cannot " +
          "navigate: no week boundaries and no vertical arrow movement. The rows are now " +
          "real, carried on `display: contents` so the seven-column weave is untouched.\n\n" +
          "Each day announces its weekday, month, year and any bound event. On screen a bare " +
          "numeral is unambiguous; read aloud, \"14\" is not a date.",
      },
    },
  },
  render: () => (
    <div style={{ maxWidth: "30rem" }}>
      <TantuPanchang
        silent
        month={new Date(2026, 2, 1)}
        months={2}
        marks={[
          { date: "2026-03-14", label: "Dye day" },
          { date: "2026-03-27", label: "Cut" },
        ]}
      />
    </div>
  ),
};

export const PanchangAtNightfall: Story = {
  name: "Panchang — the substrate at nightfall",
  parameters: {
    docs: {
      description: {
        story:
          "`hour` overrides the real clock. The dye is continuous rather than a binary " +
          "day/night flip: 0 at solar noon, 1 at deep night, driving a slow substrate bleed.",
      },
    },
  },
  render: () => (
    <div style={{ display: "grid", gap: "1.5rem", maxWidth: "30rem" }}>
      {[13, 19, 23].map((hour, i) => (
        <div key={hour}>
          <p
            style={{
              fontFamily: "var(--font-kasuti)",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--tantu-ink-secondary)",
              margin: "0 0 0.4rem",
            }}
          >
            {String(hour).padStart(2, "0")}:00
          </p>
          {/* A different month per block: three calendars all labelled "March 2026"
              would be three same-named regions, which axe flags and a screen
              reader cannot tell apart. */}
          <TantuPanchang silent months={1} hour={hour} month={new Date(2026, i, 1)} />
        </div>
      ))}
    </div>
  ),
};
