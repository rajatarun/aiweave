import type { Meta, StoryObj } from "@storybook/react-vite";
import { CapillaryBleedSurface } from "./CapillaryBleedSurface";
import { TantuBleedCanvas } from "./TantuBleedCanvas";
import { InkBleedFilter } from "./InkBleedFilter";
import { TantuButton } from "./TantuButton";
import { TantuCard } from "./TantuCard";
import { wickProgress } from "../lib/bleed-bus";

const meta = {
  title: "Dye/Capillary bleed",
  parameters: {
    a11y: { test: "error" },
    docs: {
      description: {
        component:
          "Dye advancing through a porous medium follows the **Lucas–Washburn law**, " +
          "`L ∝ √t`. Tantu grew its fronts as `1 − e^(−kt)` for three iterations before that " +
          "was caught — a *saturation* curve, which is right for how wet one point becomes " +
          "as dye pools there and wrong for where the front has reached.\n\n" +
          "The difference is visible, not academic. Measured against its own peak speed, an " +
          "exponential front is 92% stopped by t=0.75 and 95% by t=0.90, so the back half of " +
          "the animation is dead air. Washburn holds about 22% of peak speed all the way to " +
          "the end, which is the gradual, still-travelling slowdown real cloth shows.\n\n" +
          "One WebGL context serves the whole page regardless of how many surfaces are on it. " +
          "Safari caps live contexts and drops the oldest past the cap, so a per-surface " +
          "context would blank surfaces mid-scroll.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Surface: Story = {
  parameters: {
    docs: {
      description: {
        story: "Press anywhere inside. The front is an ellipse, not a circle — cloth conducts along its threads faster than on the bias.",
      },
    },
  },
  render: () => (
    <CapillaryBleedSurface style={{ minHeight: "16rem", padding: "2rem" }}>
      <h3 style={{ marginTop: 0 }}>Press the cloth</h3>
      <p style={{ maxWidth: "40ch" }}>
        Dye wicks out of wherever the surface is touched, stretched along the warp.
      </p>
    </CapillaryBleedSurface>
  ),
};

export const LayerArbitration: Story = {
  name: "One gesture, one front",
  parameters: {
    docs: {
      description: {
        story:
          "A bleeding button inside a bleeding surface used to be two dye fronts for one " +
          "press, and the larger, longer one won the eye — which is backwards, since the " +
          "innermost is what actually answers the press.\n\n" +
          "The bleed bus arbitrates by **registration, not listener order**. That matters " +
          "because the participants do not all listen to the same event: the substrate reacts " +
          "to `pointerdown` and a card flip starts on `click`, so an ordering-based scheme " +
          "would let the substrate fire before the card could claim the gesture.\n\n" +
          "Press the button, then press the surface around it, and watch which layer answers.",
      },
    },
  },
  render: () => (
    <CapillaryBleedSurface style={{ minHeight: "16rem", padding: "2rem", display: "grid", placeItems: "center", gap: "1rem" }}>
      <p style={{ margin: 0, maxWidth: "40ch", textAlign: "center" }}>
        The surface owns the ground. The button owns itself.
      </p>
      <TantuButton variant="primary">Press me, not the cloth</TantuButton>
    </CapillaryBleedSurface>
  ),
};

export const Substrate: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "The page ground. It only answers gestures nothing else has claimed — the " +
          "`substrate` layer stands down for every registered owner above it.",
      },
    },
  },
  render: () => (
    <div style={{ position: "relative", minHeight: "14rem" }}>
      <TantuBleedCanvas />
      <div style={{ position: "relative", padding: "2rem" }}>
        <TantuCard talimCode="SUB-01">
          <p style={{ margin: 0 }}>Press outside this card.</p>
        </TantuCard>
      </div>
    </div>
  ),
};

export const FrayedEdge: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "The SVG filter that gives a dye front its fibrous edge: turbulence displaces the " +
          "silhouette, then a blur softens it.\n\n" +
          "It took four root causes to get here. The last one is the interesting one: the " +
          "final `feComposite atop` re-clips the displaced result back to the *original* " +
          "silhouette, which cancels the fray entirely — the filter was working the whole " +
          "time and being undone by its own last step. `edgeFray` skips it.",
      },
    },
  },
  render: () => (
    <>
      <InkBleedFilter id="sb-bleed-plain" frequency={0.035} scale={22} soak={2} fibreContrast={3.5} />
      <InkBleedFilter id="sb-bleed-fray" frequency={0.035} scale={22} soak={2} fibreContrast={3.5} edgeFray />
      <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
        {[
          ["Re-clipped (no fray)", "sb-bleed-plain"],
          ["edgeFray", "sb-bleed-fray"],
        ].map(([label, id]) => (
          <figure key={id} style={{ margin: 0 }}>
            <div
              style={{
                width: 160,
                height: 160,
                background: "var(--tantu-madder-root)",
                filter: `url(#${id})`,
              }}
            />
            <figcaption
              style={{
                fontFamily: "var(--tantu-font-meta)",
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--tantu-ink-secondary)",
                marginTop: "0.5rem",
              }}
            >
              {label}
            </figcaption>
          </figure>
        ))}
      </div>
    </>
  ),
};

export const TheWickLaw: Story = {
  name: "The wick law, plotted",
  parameters: {
    docs: {
      description: {
        story:
          "Washburn against the exponential it replaced and against linear. The asymmetry is " +
          "the signature: half the travel is done at t ≈ 0.33. It is asserted in the test " +
          "suite by reconstructing the raw law from the normalised output, so no easing curve " +
          "can quietly be substituted for it.",
      },
    },
  },
  render: () => {
    const N = 120;
    const path = (f: (t: number) => number) =>
      Array.from({ length: N + 1 }, (_, i) => {
        const t = i / N;
        return `${i === 0 ? "M" : "L"} ${(t * 300).toFixed(1)} ${(160 - f(t) * 150).toFixed(1)}`;
      }).join(" ");

    const series = [
      ["Lucas–Washburn (used)", (t: number) => wickProgress(t), "var(--tantu-accent-primary)"],
      ["1 − e^(−4t) (replaced)", (t: number) => 1 - Math.exp(-4 * t), "var(--tantu-accent-structural)"],
      ["linear", (t: number) => t, "var(--tantu-ink-secondary)"],
    ] as const;

    return (
      <div>
        <svg viewBox="0 0 320 180" width="100%" style={{ maxWidth: 520 }} role="img"
             aria-label="Front position against time: the Washburn curve rises steeply then crawls; the exponential flattens early; linear is straight.">
          <line x1="0" y1="160" x2="300" y2="160" stroke="var(--tantu-border-hairline)" />
          <line x1="0" y1="10" x2="0" y2="160" stroke="var(--tantu-border-hairline)" />
          {series.map(([, f, colour]) => (
            <path key={colour} d={path(f)} fill="none" stroke={colour} strokeWidth="2" />
          ))}
        </svg>
        <ul style={{ listStyle: "none", padding: 0, margin: "0.75rem 0 0", display: "grid", gap: "0.3rem" }}>
          {series.map(([label, , colour]) => (
            <li key={label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 13 }}>
              <span style={{ width: 18, height: 3, background: colour }} />
              {label}
            </li>
          ))}
        </ul>
      </div>
    );
  },
};
