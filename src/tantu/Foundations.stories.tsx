import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * The foundations pages read their values out of the live cascade rather than
 * from a hand-kept list. A swatch sheet that has to be updated alongside the
 * stylesheet is a swatch sheet that will eventually lie about the system it
 * documents.
 */

const meta = {
  title: "Foundations/Tokens",
  parameters: {
    a11y: { test: "error" },
    docs: {
      description: {
        component:
          "Every value below is read from the live stylesheet at render time. " +
          "Switch the theme in the toolbar and the whole sheet re-resolves — " +
          "if a token were missing from one theme, it would show as blank here " +
          "rather than pass silently.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function readToken(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ---- contrast, computed live so the sheet cannot drift from the audit ---- */

function toRgb(css: string): [number, number, number, number] | null {
  const probe = document.createElement("div");
  probe.style.color = css;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  const m = resolved.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(",").map((x) => parseFloat(x));
  return [p[0], p[1], p[2], p[3] ?? 1];
}

function luminance([r, g, b]: number[]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(fg: string, bg: string): number | null {
  const f = toRgb(fg);
  const b = toRgb(bg);
  if (!f || !b) return null;
  // Flatten a translucent foreground onto its real backdrop before measuring;
  // comparing the unflattened colour is how a hairline that actually sits at
  // 1.46:1 gets reported as passing.
  const flat = f[3] === 1 ? f.slice(0, 3) : [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3]));
  const [hi, lo] = [luminance(flat), luminance(b.slice(0, 3))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const GROUPS: Array<{ heading: string; note: string; tokens: string[] }> = [
  {
    heading: "Dye primitives",
    note:
      "The raw pigments. Theme-invariant on purpose — they describe what is in the vat, " +
      "not how the cloth is read, so they must never be used directly in a component.",
    tokens: [
      "--tantu-kora-raw", "--tantu-kora-bleached", "--tantu-kora-mud",
      "--tantu-kala-iron", "--tantu-kala-charcoal",
      "--tantu-madder-root", "--tantu-madder-flame",
      "--tantu-indigo-vat", "--tantu-indigo-sky",
      "--tantu-pala-copper", "--tantu-genda-rust", "--tantu-katha-bark",
      "--tantu-zari-pure-gold", "--tantu-zari-tarnish",
    ],
  },
  {
    heading: "Grounds",
    note: "What a component sits on. These are the backdrops every contrast figure is measured against.",
    tokens: ["--tantu-bg-substrate", "--tantu-bg-elevated", "--tantu-bg-surface-active", "--tantu-color-surface"],
  },
  {
    heading: "Ink",
    note: "Text. Measured against all three grounds by scripts/audit_a11y.mjs on every commit.",
    tokens: ["--tantu-ink-primary", "--tantu-ink-secondary", "--tantu-ink-inverted"],
  },
  {
    heading: "Accents and state",
    note: "Emphasis and meaning. Never the only carrier of state — form and text say it too.",
    tokens: [
      "--tantu-accent-primary", "--tantu-accent-highlight", "--tantu-accent-structural",
      "--tantu-state-success", "--tantu-state-caution",
    ],
  },
  {
    heading: "Lines",
    note:
      "The decorative weave is exempt from contrast minima; the hairline that delimits a " +
      "component is not, and the two were one token until an audit separated them.",
    tokens: ["--tantu-grid-thread", "--tantu-border-hairline", "--tantu-border-embroidery", "--tantu-focus-contrast"],
  },
];

function Swatch({ name }: { name: string }) {
  const value = readToken(name);
  const onGround = contrast(value, readToken("--tantu-bg-substrate"));
  const onCard = contrast(value, readToken("--tantu-color-surface"));
  const fmt = (n: number | null) => (n === null ? "—" : n.toFixed(2));

  return (
    <div style={{ border: "1px solid var(--tantu-border-hairline)", display: "flex", flexDirection: "column" }}>
      <div style={{ background: value, height: "3.5rem", borderBottom: "1px solid var(--tantu-border-hairline)" }} />
      <div style={{ padding: "0.5rem 0.6rem", display: "grid", gap: "0.15rem" }}>
        <code style={{ fontFamily: "var(--font-talim)", fontSize: 11, wordBreak: "break-all" }}>{name}</code>
        <code style={{ fontFamily: "var(--font-talim)", fontSize: 11, color: "var(--tantu-ink-secondary)" }}>
          {value || "unset"}
        </code>
        <span style={{ fontFamily: "var(--font-kasuti)", fontSize: 10, color: "var(--tantu-ink-secondary)" }}>
          {fmt(onGround)} ground · {fmt(onCard)} card
        </span>
      </div>
    </div>
  );
}

export const Colour: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "2rem" }}>
      {GROUPS.map((group) => (
        <section key={group.heading}>
          <h3 style={{ fontFamily: "var(--font-kalam)", margin: "0 0 0.25rem", color: "var(--tantu-ink-primary)" }}>
            {group.heading}
          </h3>
          <p style={{ margin: "0 0 0.9rem", maxWidth: "60ch", color: "var(--tantu-ink-secondary)", fontSize: 13 }}>
            {group.note}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))",
              gap: "0.6rem",
            }}
          >
            {group.tokens.map((t) => (
              <Swatch key={t} name={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};

export const Typography: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Three faces with strict jobs, and a fourth stack that is deliberately not one of " +
          "them. Talim is machine voice — codes, counts, coordinates, captions. Kalam is " +
          "display. Kasuti is counted-thread metadata. None of them sets a paragraph, so " +
          "`--font-body` names a platform stack: the reader's own UI font already has their " +
          "script, which matters because the three Tantu faces cover Latin only.",
      },
    },
  },
  render: () => (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {[
        ["--font-kalam", "Display and headings", "Warp and Weft"],
        ["--font-talim", "Machine voice", "T-0421 · 48 PICKS/IN · 9N"],
        ["--font-kasuti", "Counted-thread metadata", "[W:04-H:02]"],
        ["--font-body", "Prose", "Forty-eight picks to the inch, held at nine newtons."],
      ].map(([token, role, sample]) => (
        <div key={token} style={{ borderTop: "1px solid var(--tantu-border-hairline)", paddingTop: "0.8rem" }}>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
            <code style={{ fontFamily: "var(--font-talim)", fontSize: 11 }}>{token}</code>
            <span style={{ fontFamily: "var(--font-kasuti)", fontSize: 10, color: "var(--tantu-ink-secondary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {role}
            </span>
          </div>
          <p style={{ fontFamily: `var(${token})`, fontSize: 24, margin: 0, color: "var(--tantu-ink-primary)" }}>
            {sample}
          </p>
        </div>
      ))}
    </div>
  ),
};

export const Spacing: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Base-6, and deliberately non-linear: 1, 2, 3, 4, then 6, 8, 12. `knot-5` and " +
          "`knot-7` are intentionally absent — the gap is the point, not an oversight to fix.",
      },
    },
  },
  render: () => (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      {["1", "2", "3", "4", "6", "8", "12"].map((n) => (
        <div key={n} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <code style={{ fontFamily: "var(--font-talim)", fontSize: 11, width: "9rem" }}>--tantu-knot-{n}</code>
          <div style={{ background: "var(--tantu-accent-primary)", height: 12, width: `var(--tantu-knot-${n})` }} />
          <span style={{ fontFamily: "var(--font-kasuti)", fontSize: 10, color: "var(--tantu-ink-secondary)" }}>
            {readToken(`--tantu-knot-${n}`)}
          </span>
        </div>
      ))}
    </div>
  ),
};
