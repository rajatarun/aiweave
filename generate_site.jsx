import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import ReactDOMServer from "react-dom/server";

import {
  TantuLoom,
  TantuCell,
  TantuCard,
  ChambaRumalCard,
  TalimThread,
  TantuButton,
  TantuTag,
  TantuMeter,
  TantuStepper,
} from "./src/tantu/index.ts";

// deploy.yaml serves fonts/ with `cache-control: public, max-age=86400` under
// stable filenames, so a browser that has loaded a glyph keeps rendering it
// from cache for up to a day after the font is rebuilt — a fixed glyph looks
// unfixed on the live site, indistinguishable from the fix never shipping.
// Appending a short content hash gives every rebuild a fresh URL, so the
// cache is bypassed exactly when the bytes change and reused when they don't.
const fontRev = (file) => {
  try {
    const bytes = fs.readFileSync(path.join("fonts", file));
    return crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 8);
  } catch {
    return null;
  }
};

const fontSrc = (family) => {
  const w2 = fontRev(`${family}.woff2`);
  const w1 = fontRev(`${family}.woff`);
  const q = (rev) => (rev ? `?v=${rev}` : "");
  return `url("fonts/${family}.woff2${q(w2)}") format("woff2"),
                   url("fonts/${family}.woff${q(w1)}") format("woff")`;
};

const GH_OWNER = "rajatarun";
const GH_GRAPHQL_URL = "https://api.github.com/graphql";

const PINNED_REPOS = ["DataDictionary", "mcp-observatory", "DeviceWeave", "IntentWeave"];

const PREFERRED_ORDER = [
  "TrainWeave",
  "TeamWeave",
  "TaskWeave",
  "ToolWeave",
  "ContextWeave",
  "ScreenWeave",
  "DeployWeave",
  "CipherWeave",
  "mcp-observatory",
  "DataDictionary",
  "DeviceWeave",
  "IntentWeave",
];

const REPO_META = {
  TrainWeave: {
    icon: "⚙",
    tagline: "AWS LoRA fine-tuning · EC2 Spot · ~52% cost savings vs SageMaker",
    tech: ["LoRA", "EC2 Spot", "Lambda", "S3", "SAM"],
    fallback_desc: "Automated LoRA fine-tuning on AWS EC2 Spot instances, Lambda-orchestrated for maximum cost efficiency.",
  },
  TeamWeave: {
    icon: "⬡",
    tagline: "Config-driven multi-agent orchestration · Step Functions · Bedrock",
    tech: ["Step Functions", "API Gateway", "DynamoDB", "Bedrock", "Multi-Agent"],
    fallback_desc: "Config-driven multi-agent orchestration platform on AWS using Step Functions, Bedrock, and DynamoDB.",
  },
  TaskWeave: {
    icon: "◈",
    tagline: "API-first JSON agent framework · LangChain · LangGraph · POST /invoke",
    tech: ["LangChain", "LangGraph", "REST API", "JSON", "Python"],
    fallback_desc: "API-first JSON-driven agent framework combining LangChain and LangGraph with a clean POST /invoke endpoint.",
  },
  ToolWeave: {
    icon: "⚒",
    tagline: "FastMCP server · Natural language → REST API · Bedrock · Lambda",
    tech: ["FastMCP", "Lambda", "DynamoDB", "Bedrock", "OpenAPI"],
    fallback_desc: "FastMCP server converting natural language requests into secure REST API calls via AWS Lambda.",
  },
  ContextWeave: {
    icon: "◆",
    tagline: "GraphRAG + CAG · Memgraph · pgvector · Neptune Analytics",
    tech: ["GraphRAG", "Memgraph", "pgvector", "Neptune", "Bedrock", "CAG"],
    fallback_desc: "AWS-native GraphRAG and CAG platform with adaptive routing.",
  },
  ScreenWeave: {
    icon: "⬚",
    tagline: "Website crawling + visual QA · Playwright · Claude 3.5 Sonnet",
    tech: ["Playwright", "Claude 3.5", "Bedrock", "EC2", "S3"],
    fallback_desc: "AWS-native website crawling and visual QA platform using Playwright automation.",
  },
  "mcp-observatory": {
    icon: "◉",
    tagline: "Two-phase PROPOSE/COMMIT · Risk scoring · Safe MCP execution",
    tech: ["FastMCP", "PROPOSE/COMMIT", "Risk Scoring", "PostgreSQL", "Observability"],
    fallback_desc: "Two-phase execution framework for high-risk MCP tool operations.",
  },
  DeployWeave: {
    icon: "⬟",
    tagline: "AI/ML deployment automation · AWS CDK · CodePipeline",
    tech: ["CDK", "CodePipeline", "CodeDeploy", "Lambda", "SAM"],
    fallback_desc: "Infrastructure-as-code deployment automation for AI/ML workloads on AWS.",
  },
  CipherWeave: {
    icon: "⊛",
    tagline: "Secrets & encryption layer · AWS KMS · SSM · Zero-trust pipelines",
    tech: ["KMS", "SSM Parameter Store", "Secrets Manager", "Lambda", "IAM"],
    fallback_desc: "AWS-native encryption and secrets management layer for AI data pipelines.",
  },
  DataDictionary: {
    icon: "◫",
    tagline: "Schema registry · Data contracts · AWS Glue · Automated documentation",
    tech: ["AWS Glue", "S3", "Athena", "Lambda", "Schema Registry"],
    fallback_desc: "Centralized schema registry and data dictionary for AWS-native data pipelines.",
  },
  DeviceWeave: {
    icon: "📱",
    tagline: "Edge AI & IoT orchestration · AWS Greengrass · AWS IoT Core",
    tech: ["IoT Core", "Greengrass", "Edge AI", "Lambda"],
    fallback_desc: "AWS-native edge AI deployment and IoT device orchestration framework.",
  },
  IntentWeave: {
    icon: "⚡",
    tagline: "Intent-driven LLM routing · Bedrock · CloudWatch",
    tech: ["Bedrock", "Intent Routing", "CloudWatch", "DynamoDB"],
    fallback_desc: "Natural language intent parsing and cost-optimized model routing engine on AWS.",
  },
};

const ARCH_LAYERS = [
  { icon: "◎", label: "ORCHESTRATION", chips: ["TeamWeave", "TaskWeave", "Step Functions", "API Gateway"] },
  { icon: "⊞", label: "RETRIEVAL & RAG", chips: ["ContextWeave", "Memgraph", "pgvector", "Neptune Analytics"] },
  { icon: "⚙", label: "EXECUTION & TOOLS", chips: ["ToolWeave", "TrainWeave", "FastMCP", "EC2 Spot", "Lambda"] },
  { icon: "⊛", label: "SECURITY & SAFETY", chips: ["CipherWeave", "mcp-observatory", "KMS", "PROPOSE/COMMIT"] },
  { icon: "⬢", label: "COMPUTE & DEPLOY", chips: ["DeployWeave", "CDK", "CodePipeline", "Blue-green"] },
];

const STORY_PANELS = [
  {
    step: "01",
    cmd: "define",
    title: "Define the Agent",
    body: "Declare intent in plain JSON. TeamWeave resolves the right model, tools, and routing rules automatically.",
  },
  {
    step: "02",
    cmd: "route",
    title: "Route & Plan",
    body: "Step Functions maps the task graph. Parallel branches execute concurrently; retry policies and timeouts are infrastructure concerns.",
  },
  {
    step: "03",
    cmd: "execute",
    title: "Execute with Tools",
    body: "ToolWeave translates natural language into signed REST calls. Each tool invocation passes through risk scoring before commit.",
  },
  {
    step: "04",
    cmd: "observe",
    title: "Observe Everything",
    body: "mcp-observatory captures every PROPOSE/COMMIT pair. Structured logs, risk scores, and latency traces flow to CloudWatch & SIEM.",
  },
];

async function fetchRepoList() {
  const token = process.env.GH_TOKEN || "";
  const query = `
    query($owner: String!) {
      user(login: $owner) {
        repositories(first: 100, privacy: PUBLIC, orderBy: {field: NAME, direction: ASC}) {
          nodes { name isArchived }
        }
      }
    }
  `;

  try {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(GH_GRAPHQL_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables: { owner: GH_OWNER } }),
    });

    if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
    const data = await res.json();
    const nodes = data?.data?.user?.repositories?.nodes || [];

    const discovered = nodes
      .filter((n) => !n.isArchived && n.name.toLowerCase().endsWith("weave") && n.name.toLowerCase() !== "aiweave")
      .map((n) => n.name);

    const allRepos = Array.from(new Set([...discovered, ...PINNED_REPOS]));
    const ordered = PREFERRED_ORDER.filter((r) => allRepos.includes(r));
    const newOnes = allRepos.filter((r) => !PREFERRED_ORDER.includes(r)).sort();
    return [...ordered, ...newOnes];
  } catch (err) {
    console.warn("[WARN] Fetching repo list via GraphQL failed, using fallback list:", err.message);
    return PREFERRED_ORDER;
  }
}

/**
 * SectionHeader — the one numbered marker every major section shares.
 *
 * Composed from the sanctioned primitives (TantuCell for loom placement,
 * TantuTag for the count) rather than hand-styled bracket text, so "[01]"
 * reads as a designed weaver's-count chip instead of stray characters set
 * in the display serif.
 */
function SectionHeader({ id, number, title, style }) {
  return (
    <TantuCell warpSpan={12} id={id} className="section-title-warp" style={style}>
      <div className="section-title-row">
        <TantuTag tone="structural" solid>{number}</TantuTag>
        <h2 className="section-title-text">{title}</h2>
      </div>
    </TantuCell>
  );
}

const pad2 = (n) => String(n).padStart(2, "0");

/**
 * Warp/height coordinate for a card at `index` in a repeating row of cards
 * each spanning `span` of the 12-column warp — the same "[W:xx-H:xx]" grid
 * address TantuCard's own talimCode prop renders, computed here instead of
 * invented per-card so it actually reflects each card's real grid position.
 */
function talimCoord(index, span, rowOffset = 1) {
  const perRow = Math.max(1, Math.floor(12 / span));
  const col = (index % perRow) * span + 1;
  const row = Math.floor(index / perRow) + rowOffset;
  return `W:${pad2(col)}-H:${pad2(row)}`;
}

const KASUTI_VIEW_W = 600;
const KASUTI_VIEW_H = 200;

/**
 * Static Kasuti Matrix — same markup and CSS classes as the KasutiMatrix
 * component (src/tantu/components/KasutiMatrix.tsx), so it renders pixel-
 * identical to the "real" one, but with the whole thread drawn immediately
 * instead of stitched in on an IntersectionObserver: that component's
 * progressive reveal is client-state-driven (needs the React runtime this
 * static build doesn't ship — see the capillary/maku boot scripts below for
 * how the two stateful effects that DO get ported are handled), and a chart
 * whose reveal-animation JS never runs would render stuck on its first point.
 * Kasuti forbids the diagonal and the curve — routing is right-angle only.
 */
function StaticKasutiChart({ data, rows = 6, caption }) {
  const ceiling = Math.max(...data.map((point) => point.value), 1);
  const stepX = data.length > 1 ? KASUTI_VIEW_W / (data.length - 1) : KASUTI_VIEW_W;

  const snapY = (value) => {
    const ratio = Math.max(0, Math.min(1, value / ceiling));
    const row = Math.round(ratio * rows);
    return KASUTI_VIEW_H - (row / rows) * KASUTI_VIEW_H;
  };

  const knots = data.map((point, index) => ({ x: Math.round(index * stepX), y: snapY(point.value), point }));
  const path = knots.map((knot, index) => (index === 0 ? `M ${knot.x} ${knot.y}` : `H ${knot.x} V ${knot.y}`)).join(" ");

  return (
    <figure className="tantu-kasuti" style={{ margin: 0 }}>
      {/* .tantu-kasuti-axis lays its labels out with justify-content:
          space-between and no wrap — comfortable for a handful of short
          labels, but 12 full repo names squeezed into a phone-width flex
          item wrap letter-by-letter into an unreadable column. Rather than
          touch that shared rule (other Kasuti charts elsewhere may have far
          fewer/shorter labels and be fine as-is), give this specific chart
          body a floor width and let it scroll horizontally inside its own
          card instead of destroying the label text — the same
          overflow-x:auto-on-the-wide-thing pattern as a responsive table. */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: `${Math.max(KASUTI_VIEW_W, data.length * 90)}px` }}>
          <svg
            className="tantu-kasuti-canvas"
            viewBox={`0 0 ${KASUTI_VIEW_W} ${KASUTI_VIEW_H}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={data.map((point) => `${point.label}: ${point.value}`).join(", ")}
          >
            <g className="tantu-kasuti-ground" aria-hidden="true">
              {Array.from({ length: rows + 1 }, (_, row) => (
                <line key={`weft-${row}`} x1="0" x2={KASUTI_VIEW_W} y1={(row / rows) * KASUTI_VIEW_H} y2={(row / rows) * KASUTI_VIEW_H} />
              ))}
              {knots.map((knot) => (
                <line key={`warp-${knot.x}`} y1="0" y2={KASUTI_VIEW_H} x1={knot.x} x2={knot.x} />
              ))}
            </g>
            <path className="tantu-kasuti-thread" d={path} />
            {knots.map((knot) => (
              <rect
                key={`knot-${knot.point.label}`}
                className="tantu-kasuti-knot"
                x={Math.min(KASUTI_VIEW_W - 7, Math.max(0, knot.x - 4))}
                y={knot.y - 4}
                width="8"
                height="8"
              >
                <title>{`${knot.point.label} · ${knot.point.value}`}</title>
              </rect>
            ))}
          </svg>
          <div className="tantu-kasuti-axis" aria-hidden="true">
            {data.map((point) => (
              <span key={point.label}>{point.label}</span>
            ))}
          </div>
        </div>
      </div>
      {caption ? <figcaption className="tantu-kasuti-caption">{caption}</figcaption> : null}
    </figure>
  );
}

/**
 * Sikku Kolam — same markup/classes as SikkuKolamLoader's default "spinning"
 * state (src/tantu/components/SikkuKolamLoader.tsx), used here as a section
 * ornament rather than a pending-fetch indicator. Deliberately NOT the
 * "resolved" state: that state's CSS hides the wound thread entirely and
 * shows only the taut snap grid (the point being "the mess of loose thread
 * is gone") — the opposite of what an ornament wants. "spinning" is also
 * the state whose reveal and wind animations are plain CSS @keyframes with
 * no JS driving them (the component's own audio/state-transition logic is
 * what needs React — the animation itself doesn't), so the one continuous
 * unbroken filament doc DOC-13 describes ("the perfect image of work in
 * progress") actually renders and keeps winding on this static build.
 * Purely decorative: aria-hidden, not a status region.
 */
function SikkuKolamOrnament({ cols = 8, rows = 2 }) {
  const PITCH = 24;
  const MARGIN = 18;
  const width = MARGIN * 2 + (cols - 1) * PITCH;
  const height = MARGIN * 2 + (rows - 1) * PITCH;

  const x = (c) => MARGIN + c * PITCH;
  const y = (r) => MARGIN + r * PITCH;
  const loop = PITCH * 0.62;
  let d = `M ${x(0) - loop * 0.5} ${y(0)}`;
  for (let r = 0; r < rows; r += 1) {
    const leftToRight = r % 2 === 0;
    const order = leftToRight
      ? Array.from({ length: cols }, (_, i) => i)
      : Array.from({ length: cols }, (_, i) => cols - 1 - i);
    order.forEach((c, index) => {
      const sign = index % 2 === 0 ? -1 : 1;
      d += ` Q ${x(c)} ${y(r) + sign * loop} ${x(c) + (leftToRight ? loop * 0.5 : -loop * 0.5)} ${y(r)}`;
    });
    if (r < rows - 1) {
      const edge = leftToRight ? x(cols - 1) + loop : x(0) - loop;
      d += ` Q ${edge} ${y(r) + PITCH * 0.5} ${leftToRight ? x(cols - 1) + loop * 0.5 : x(0) - loop * 0.5} ${y(r + 1)}`;
    }
  }

  const dots = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      dots.push(<rect key={`${r}-${c}`} className="tantu-kolam-bindu" x={MARGIN + c * PITCH - 1} y={MARGIN + r * PITCH - 1} width={2} height={2} />);
    }
  }

  return (
    <div aria-hidden="true" style={{ display: "flex", justifyContent: "center", padding: "var(--tantu-knot-4) 0" }}>
      <div data-state="spinning" className="tantu-kolam">
        <svg className="tantu-kolam-field" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true" focusable="false">
          <g className="tantu-kolam-matrix">{dots}</g>
          <path className="tantu-kolam-thread" d={d} />
          <g className="tantu-kolam-snap">
            {Array.from({ length: rows }, (_, r) => (
              <line key={`h-${r}`} x1={0} y1={MARGIN + r * PITCH} x2={width} y2={MARGIN + r * PITCH} />
            ))}
            {Array.from({ length: cols }, (_, c) => (
              <line key={`v-${c}`} x1={MARGIN + c * PITCH} y1={0} x2={MARGIN + c * PITCH} y2={height} />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

function SiteApp({ reposData, tantuCss }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>AIWeave — Native Tantu UI Design System Ecosystem</title>
        <meta
          name="description"
          content="AIWeave AWS AI Infrastructure Tools Ecosystem engineered with native Tantu React Design Library."
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=IBM+Plex+Serif:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: tantuCss }} />
        <style
          dangerouslySetInnerHTML={{
            __html: `
            /* Tantu's own stylesheet deliberately ships no @font-face rules
               (see the "TYPOGRAPHIC SPECIFICATIONS" comment in tantu.css) —
               loading the brand font files is a consumer concern, since the
               design system has no way to know where this page will host
               them. This is that wiring: build.py (npm run build:fonts, not
               yet part of the default build — run it once after a fresh
               checkout, or whenever a glyph changes) writes fonts/*.woff2
               and .woff, and the --font-talim/--font-kalam/--font-kasuti
               tokens above already name these families first in their
               stacks, so once registered here the browser prefers them
               over the IBM Plex fallback automatically — no other change
               needed. */
            @font-face {
              font-family: "Kasuti-Gauze";
              src: ${fontSrc("Kasuti-Gauze")};
              font-weight: 400;
              font-style: normal;
              font-display: swap;
            }
            @font-face {
              font-family: "Talim-Mono";
              src: ${fontSrc("Talim-Mono")};
              font-weight: 400;
              font-style: normal;
              font-display: swap;
            }
            @font-face {
              font-family: "Kalam-Rupa";
              src: ${fontSrc("Kalam-Rupa")};
              font-weight: 400;
              font-style: normal;
              font-display: swap;
            }
            /* Not var(--font-talim): tantu.css's own typography comment is
               explicit that Talim is "machine voice only — codes, counts,
               coordinates, captions, code blocks. Never body copy," and
               Kalam is scoped to "display and headings," not prose either.
               Neither of Tantu's two prose-adjacent faces is meant to carry
               ordinary paragraph text, so the page default has to come from
               somewhere else — a plain system stack, not a third custom
               voice the design system doesn't define. Every paragraph in
               this page inherits this rule unless it opts into a specific
               Tantu voice (the .tantu-heading-kalam headings do; the small
               kasuti/talim taglines set their own font-family already). */
            body {
              background-color: var(--tantu-bg-substrate);
              color: var(--tantu-ink-primary);
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 0;
              transition: background-color var(--tantu-motion-unspool) ease,
                color var(--tantu-motion-unspool) ease;
            }
            /* Cosmetic overrides only — layout (display/grid-template-columns,
               including the 768px Loom Drop) stays owned by the canonical
               .tantu-loom / .tantu-loom-content rules in tantu.css so this
               page never fights the design system's responsive collapse. */
            .tantu-loom {
              background-color: var(--tantu-bg-substrate);
            }
            .tantu-selvedge-left, .tantu-selvedge-right {
              background: repeating-linear-gradient(
                0deg,
                transparent,
                transparent var(--tantu-knot-2),
                var(--tantu-grid-thread) var(--tantu-knot-2),
                var(--tantu-grid-thread) calc(var(--tantu-knot-2) + var(--tantu-gauge-filament))
              );
              opacity: 0.25;
            }
            .tantu-loom-content {
              gap: var(--tantu-knot-4);
              padding: var(--tantu-knot-6) 0;
            }
            nav.tantu-nav {
              display: flex;
              align-items: center;
              justify-content: space-between;
              flex-wrap: wrap;
              gap: var(--tantu-knot-2);
              padding: var(--tantu-knot-3) var(--tantu-knot-4);
              border-bottom: var(--tantu-gauge-filament) solid var(--tantu-border-embroidery);
              /* Not --tantu-kora-raw: that's a raw dye primitive, fixed at
                 #faf7f0 outside both [data-theme] blocks by design (it's the
                 constant ink used on top of accent-colored surfaces
                 elsewhere) — using it here pinned the nav to a cream
                 background no matter the theme, while every sibling chrome
                 element (.tantu-selvedge-left/right) correctly tracks
                 --tantu-bg-elevated, which flips with the theme. */
              background: var(--tantu-bg-elevated);
              margin-bottom: var(--tantu-knot-6);
            }
            .nav-brand {
              display: flex;
              align-items: center;
              flex-shrink: 0;
              white-space: nowrap;
              gap: var(--tantu-knot-2);
              text-decoration: none;
              color: var(--tantu-accent-primary);
              font-weight: 700;
              font-family: var(--font-kasuti);
            }
            .hero-warp {
              text-align: center;
            }
            .hero-title {
              font-family: var(--font-kalam);
              font-size: clamp(2.5rem, 6vw, 4.5rem);
              color: var(--tantu-accent-primary);
              margin: 0 0 var(--tantu-knot-3);
            }
            .section-title-warp {
              border-bottom: var(--tantu-gauge-filament) dashed var(--tantu-grid-thread);
              padding-bottom: var(--tantu-knot-1);
            }
            .section-title-row {
              display: flex;
              align-items: center;
              gap: var(--tantu-knot-2);
            }
            .section-title-text {
              font-family: var(--font-kalam);
              font-size: 1.8rem;
              color: var(--tantu-accent-primary);
              margin: 0;
            }
            .arch-stepper {
              margin-bottom: var(--tantu-knot-4);
            }
            footer.tantu-footer {
              text-align: center;
              padding: var(--tantu-knot-8) 0;
              border-top: var(--tantu-gauge-filament) solid var(--tantu-border-embroidery);
              font-size: 0.82rem;
              color: var(--tantu-ink-secondary);
              margin-top: var(--tantu-knot-8);
            }
          `,
          }}
        />
      </head>
      <body>
        {/* The T2 capillary substrate — mounted once at the root, per the
            design system's "one WebGL context" rule. Pointer contact
            anywhere in the document wicks dye through the weave; the canvas
            itself is fixed, aria-hidden and pointer-events:none, so it never
            intercepts interaction. The engine is loaded client-side by the
            module script below (the static build has no React runtime to
            drive the component's own hook). */}
        <canvas aria-hidden="true" className="tantu-loom-substrate" />
        <TantuLoom viewTalimCode="AIW-HOME-01" shuttle={true}>
            {/* Navigation — only TantuCell/TantuCard/ChambaRumalCard may be a
                direct child of TantuLoom, so the nav lives inside a cell. */}
            <TantuCell warpSpan={12}>
            <nav className="tantu-nav" aria-label="Main navigation">
              <a href="/" className="nav-brand">
                <svg width="28" height="28" viewBox="0 0 88 88" aria-hidden="true">
                  <rect x="36" y="3" width="49" height="49" rx="12" fill="none" stroke="currentColor" strokeWidth="10" />
                  <rect x="3" y="36" width="49" height="49" rx="12" fill="none" stroke="currentColor" strokeWidth="10" />
                  <rect x="3" y="3" width="49" height="49" rx="12" fill="none" stroke="currentColor" strokeWidth="10" />
                  <rect x="36" y="36" width="49" height="49" rx="12" fill="none" stroke="currentColor" strokeWidth="10" />
                </svg>
                <span>AIWEAVE</span>
              </a>
              <div style={{ display: "flex", gap: "var(--tantu-knot-2)", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <a href="#home" style={{ textDecoration: "none" }}>
                  <TantuButton variant="ghost" bleed={false}>HOME</TantuButton>
                </a>
                <a href="#projects" style={{ textDecoration: "none" }}>
                  <TantuButton variant="ghost" bleed={false}>PROJECTS</TantuButton>
                </a>
                <a href="#story" style={{ textDecoration: "none" }}>
                  <TantuButton variant="ghost" bleed={false}>HOW IT WORKS</TantuButton>
                </a>
                <a href="#about" style={{ textDecoration: "none" }}>
                  <TantuButton variant="ghost" bleed={false}>ABOUT</TantuButton>
                </a>
                <button id="theme-toggle" className="tantu-btn tantu-btn-ghost" type="button" style={{ cursor: "pointer", fontFamily: "var(--font-kasuti)", fontSize: "11px" }}>
                  ✱ DARK
                </button>
                <a href={`https://github.com/${GH_OWNER}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                  <TantuButton variant="primary" bleed={false}>GITHUB →</TantuButton>
                </a>
              </div>
            </nav>
            </TantuCell>

            {/* Hero Section — TantuCard is itself a sanctioned direct loom
                child, so hero-warp styling rides on the card, no extra div. */}
            <TantuCard warpSpan={12} reliefLevel="zardozi" className="hero-warp">
              <div style={{ padding: "var(--tantu-knot-2) 0" }}>
                <TantuTag tone="accent" solid={false}>TANTU DESIGN SYSTEM (REACT NATIVE ENGINE)</TantuTag>
                <h1 className="hero-title" style={{ marginTop: "var(--tantu-knot-3)" }}>AIWeave Infrastructure</h1>
                <p style={{ fontFamily: "var(--font-kasuti)", color: "var(--tantu-zari-pure-gold)", fontSize: "1.1rem" }}>
                  [ BUILD · FINE-TUNE · ORCHESTRATE · DEPLOY ]
                </p>
                <p style={{ maxWidth: "680px", margin: "0 auto var(--tantu-knot-4)", fontSize: "0.95rem", color: "var(--tantu-ink-secondary)", lineHeight: 1.8 }}>
                  Production-ready AWS-native AI infrastructure generated natively with Tantu React Design Library components.
                </p>
                <div style={{ display: "flex", gap: "var(--tantu-knot-2)", justifyContent: "center", flexWrap: "wrap" }}>
                  <a href="#projects" style={{ textDecoration: "none" }}>
                    <TantuButton variant="primary" bleed={false}>Explore Projects</TantuButton>
                  </a>
                  <a href={`https://github.com/${GH_OWNER}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                    <TantuButton variant="secondary" bleed={false}>GitHub Repositories</TantuButton>
                  </a>
                </div>
              </div>
            </TantuCard>

            {/* Stat Band (3-up desktop, stacked mobile) */}
            <TantuCard warpSpan={4} reliefLevel="kanthi" absorbent talimCode={talimCoord(0, 4)}>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontFamily: "var(--font-kasuti)", fontSize: "2.2rem", fontWeight: 700, color: "var(--tantu-accent-primary)" }}>10</span>
                <div style={{ fontFamily: "var(--font-kasuti)", fontSize: "0.75rem", color: "var(--tantu-ink-secondary)", marginTop: "var(--tantu-knot-1)" }}>OPEN SOURCE TOOLS</div>
              </div>
            </TantuCard>
            <TantuCard warpSpan={4} reliefLevel="kanthi" absorbent talimCode={talimCoord(1, 4)}>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontFamily: "var(--font-kasuti)", fontSize: "2.2rem", fontWeight: 700, color: "var(--tantu-accent-primary)" }}>8+</span>
                <div style={{ fontFamily: "var(--font-kasuti)", fontSize: "0.75rem", color: "var(--tantu-ink-secondary)", marginTop: "var(--tantu-knot-1)" }}>AWS SERVICES INTEGRATED</div>
              </div>
            </TantuCard>
            <TantuCard warpSpan={4} reliefLevel="kanthi" absorbent talimCode={talimCoord(2, 4)}>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontFamily: "var(--font-kasuti)", fontSize: "2.2rem", fontWeight: 700, color: "var(--tantu-accent-primary)" }}>~52%</span>
                <div style={{ fontFamily: "var(--font-kasuti)", fontSize: "0.75rem", color: "var(--tantu-ink-secondary)", marginTop: "var(--tantu-knot-1)" }}>COST SAVINGS VS SAGEMAKER</div>
                <TantuMeter value={52} label="Cost savings vs SageMaker" style={{ marginTop: "var(--tantu-knot-2)" }} />
              </div>
            </TantuCard>

            {/* Counted-thread chart, drawn Kasuti-style (orthogonal, no
                smoothed spline — per the doc's "no diagonals allowed") from
                each tool's actual primitive count (meta.tech.length), not a
                fabricated series. */}
            <TantuCard warpSpan={12} reliefLevel="flat" talimCode={talimCoord(0, 12, 4)}>
              <StaticKasutiChart
                rows={4}
                data={reposData.map((repo) => ({
                  label: repo.replace("Weave", ""),
                  value: (REPO_META[repo]?.tech ?? []).length,
                }))}
                caption="KasutiMatrix — AWS/technology primitives declared per tool, counted-thread style. Series drawn from meta.tech, not estimated."
              />
            </TantuCard>

            {/* Projects */}
            <SectionHeader id="projects" number="01" title="The Weave Ecosystem" style={{ marginTop: "var(--tantu-knot-6)" }} />

            {reposData.map((repo, index) => {
              const meta = REPO_META[repo] || {
                icon: "⬢",
                tagline: "AWS-native AI tool · Open source",
                tech: ["Python", "AWS", "Open Source"],
                fallback_desc: "An open-source AWS-native tool from the AIWeave ecosystem.",
              };
              const flipLabel = `View technical manifest for ${repo}`;
              const backLabel = `Back to ${repo} overview`;

              return (
                // Chamba Rumal Dorukha: a double-sided card (see
                // .tantu-card-rumal in tantu.css), styled front/back like
                // Himachal Pradesh's double-satin embroidery — obverse and
                // reverse both fully worked, not one face and a blank. The
                // flip button toggles data-state via the plain script below
                // (this page has no React runtime to drive isFlipped).
                <ChambaRumalCard
                  key={repo}
                  warpSpan={6}
                  className="tantu-relief-kanthi tantu-substrate-porous"
                  obverse={
                    <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--tantu-knot-2)", marginBottom: "var(--tantu-knot-2)" }}>
                          <span style={{ fontSize: "1.6rem", lineHeight: 1, color: "var(--tantu-accent-highlight)" }}>{meta.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 style={{ margin: "0 0 var(--tantu-knot-1)", fontFamily: "var(--font-kalam)", color: "var(--tantu-accent-primary)" }}>{repo}</h3>
                            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--tantu-ink-secondary)", fontFamily: "var(--font-talim)" }}>{meta.tagline}</p>
                          </div>
                        </div>
                        <p style={{ fontSize: "0.88rem", color: "var(--tantu-ink-primary)", lineHeight: 1.7, marginBottom: "var(--tantu-knot-3)" }}>{meta.fallback_desc}</p>
                      </div>
                      <div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--tantu-knot-1)", marginBottom: "var(--tantu-knot-3)" }}>
                          {meta.tech.map((tech) => (
                            <TantuTag key={tech} tone="accent">{tech}</TantuTag>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: "var(--tantu-knot-2)", alignItems: "center", flexWrap: "wrap" }}>
                          <a href={`https://github.com/${GH_OWNER}/${repo}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                            <TantuButton variant="secondary" bleed={false}>View on GitHub →</TantuButton>
                          </a>
                          <button type="button" className="tantu-rumal-flip" aria-label={flipLabel} title={flipLabel} style={{ cursor: "pointer", background: "none", border: "none", color: "var(--tantu-ink-secondary)", fontFamily: "var(--font-kasuti)", fontSize: "11px", letterSpacing: "0.08em", padding: 0 }}>
                            ⟲ MANIFEST
                          </button>
                        </div>
                      </div>
                    </div>
                  }
                  reverse={
                    <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--tantu-knot-2)" }}>
                          <h3 className="tantu-heading-kalam" style={{ margin: 0 }}>{repo}</h3>
                          <TalimThread code={talimCoord(index, 6)} />
                        </div>
                        <p className="tantu-meta-kasuti" style={{ marginBottom: "var(--tantu-knot-2)" }}>TECHNICAL MANIFEST · {meta.tech.length} PRIMITIVE{meta.tech.length === 1 ? "" : "S"}</p>
                        <ul style={{ listStyle: "none", margin: "0 0 var(--tantu-knot-3)", padding: 0, display: "flex", flexDirection: "column", gap: "var(--tantu-knot-1)" }}>
                          {meta.tech.map((tech) => (
                            <li key={tech} className="tantu-meta-talim" style={{ fontSize: "12px" }}>· {tech}</li>
                          ))}
                        </ul>
                      </div>
                      <div style={{ display: "flex", gap: "var(--tantu-knot-2)", alignItems: "center", flexWrap: "wrap" }}>
                        <a href={`https://github.com/${GH_OWNER}/${repo}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                          <TantuButton variant="secondary" bleed={false}>View on GitHub →</TantuButton>
                        </a>
                        <button type="button" className="tantu-rumal-flip" aria-label={backLabel} title={backLabel} style={{ cursor: "pointer", background: "none", border: "none", color: "var(--tantu-ink-inverted)", fontFamily: "var(--font-kasuti)", fontSize: "11px", letterSpacing: "0.08em", padding: 0 }}>
                          ⟲ OVERVIEW
                        </button>
                      </div>
                    </div>
                  }
                />
              );
            })}

            {/* A Sikku Kolam is traditionally drawn each dawn as one
                continuous, unbroken loop — used here as a settled section
                ornament, not a loading state (this build has nothing async
                to spin it for). */}
            <TantuCell warpSpan={12}>
              <SikkuKolamOrnament />
            </TantuCell>

            {/* Architecture Stack */}
            <SectionHeader
              id="architecture"
              number="02"
              title={<>The <span style={{ color: "var(--tantu-accent-structural)" }}>Architecture</span> Stack</>}
              style={{ marginTop: "var(--tantu-knot-6)" }}
            />

            <TantuCell warpSpan={12} className="arch-stepper-cell">
              <TantuStepper
                steps={ARCH_LAYERS.map((layer) => ({ id: layer.label, label: layer.label, description: layer.chips[0] }))}
                currentStepId={ARCH_LAYERS[ARCH_LAYERS.length - 1].label}
                className="arch-stepper"
              />
            </TantuCell>

            {ARCH_LAYERS.map((layer) => (
              <TantuCard key={layer.label} warpSpan={12} reliefLevel="kanthi" absorbent>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--tantu-knot-3)", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "1.3rem", color: "var(--tantu-accent-highlight)" }}>{layer.icon}</span>
                  <span style={{ fontFamily: "var(--font-kasuti)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--tantu-accent-primary)", minWidth: "180px" }}>
                    {layer.label}
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--tantu-knot-1)" }}>
                    {layer.chips.map((chip) => (
                      <TantuTag key={chip} tone="neutral">{chip}</TantuTag>
                    ))}
                  </div>
                </div>
              </TantuCard>
            ))}

            {/* Developer Experience */}
            <SectionHeader id="story" number="03" title="Execution & Workflow" style={{ marginTop: "var(--tantu-knot-6)" }} />

            {STORY_PANELS.map((panel) => (
              <TantuCard key={panel.step} warpSpan={3} reliefLevel="kanthi" absorbent>
                <h3 style={{ fontFamily: "var(--font-kalam)", fontSize: "1.2rem", color: "var(--tantu-accent-primary)", marginBottom: "var(--tantu-knot-2)" }}>{panel.title}</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--tantu-ink-primary)", lineHeight: 1.6, margin: 0 }}>{panel.body}</p>
              </TantuCard>
            ))}

            {/* About */}
            <SectionHeader id="about" number="04" title="About AIWeave" style={{ marginTop: "var(--tantu-knot-6)" }} />

            <TantuCard warpSpan={12} reliefLevel="zardozi">
              <p style={{ fontSize: "0.95rem", color: "var(--tantu-ink-primary)", lineHeight: 1.8, marginBottom: "var(--tantu-knot-3)" }}>
                <strong>AIWeave</strong> is an ecosystem of open-source, AWS-native AI infrastructure tools built for engineers who need production-grade AI systems without proprietary lock-in.
              </p>
              <p style={{ fontSize: "0.95rem", color: "var(--tantu-ink-secondary)", lineHeight: 1.8, marginBottom: "var(--tantu-knot-3)" }}>
                Every library is composed on AWS primitives: Lambda, Bedrock, Step Functions, DynamoDB, EC2 Spot, API Gateway, S3, and Neptune. Built natively using <strong>Tantu React Design Library Components</strong>.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--tantu-knot-1)" }}>
                <TantuTag tone="accent">JavaScript / React</TantuTag>
                <TantuTag tone="neutral">AWS Bedrock</TantuTag>
                <TantuTag tone="neutral">Lambda</TantuTag>
                <TantuTag tone="neutral">Step Functions</TantuTag>
                <TantuTag tone="neutral">EC2 Spot</TantuTag>
                <TantuTag tone="zari">Tantu Native Component Library</TantuTag>
              </div>
            </TantuCard>

            {/* Footer */}
            <TantuCell warpSpan={12}>
            <footer className="tantu-footer">
              <p>© 2026 AIWeave · Built with Tantu · Apache 2.0</p>
            </footer>
            </TantuCell>
        </TantuLoom>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var btn = document.getElementById('theme-toggle');
                if (!btn) return;
                btn.addEventListener('click', function() {
                  var current = document.documentElement.getAttribute('data-theme') || 'light';
                  var next = current === 'dark' ? 'light' : 'dark';
                  document.documentElement.setAttribute('data-theme', next);
                  btn.textContent = next === 'dark' ? '☀️ LIGHT' : '✱ DARK';
                });
              })();

              // Chamba Rumal flip: toggles the same data-state="reverse"
              // attribute ChambaRumalCard's isFlipped prop would drive in a
              // hydrated app (see .tantu-card-rumal in tantu.css). Delegated
              // to the document since the cards are generated per-repo.
              (function() {
                document.addEventListener('click', function (event) {
                  var trigger = event.target.closest && event.target.closest('.tantu-rumal-flip');
                  if (!trigger) return;
                  var card = trigger.closest('.tantu-card-rumal');
                  if (!card) return;
                  var reversed = card.getAttribute('data-state') === 'reverse';
                  card.setAttribute('data-state', reversed ? 'obverse' : 'reverse');
                  var obverse = card.querySelector('.tantu-rumal-obverse');
                  var reverse = card.querySelector('.tantu-rumal-reverse');
                  if (obverse) obverse.setAttribute('aria-hidden', reversed ? 'false' : 'true');
                  if (reverse) reverse.setAttribute('aria-hidden', reversed ? 'true' : 'false');
                });
              })();
            `,
          }}
        />
        {/* Boots the T2 capillary engine compiled from
            src/tantu/lib/capillary-bleed.ts (npm run build:client-assets) —
            the same code TantuBleedCanvas's useCapillaryBleed hook drives,
            wired up by hand since this page ships no React runtime.
            Reproduces its global mode exactly: pointerdown always bleeds,
            pointermove trails at most every 90ms, resize/ResizeObserver
            keep the drawing buffer current. */}
        <script
          type="module"
          dangerouslySetInnerHTML={{
            __html: `
              import { createCapillaryBleed } from "./assets/capillary-bleed.js";

              (function () {
                var canvas = document.querySelector(".tantu-loom-substrate");
                if (!canvas) return;
                if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

                var engine = createCapillaryBleed(canvas, {
                  dye: "#2E4B6B",
                  duration: 2600,
                  maxRadius: 420,
                  fray: 1,
                  saturation: 0.5,
                });
                if (!engine.supported) return;

                var trailInterval = 90;
                var lastTrail = 0;

                function emit(event) {
                  var rect = canvas.getBoundingClientRect();
                  engine.bleed(event.clientX - rect.left, event.clientY - rect.top);
                }

                window.addEventListener("pointerdown", emit);
                window.addEventListener("pointermove", function (event) {
                  var now = performance.now();
                  if (now - lastTrail < trailInterval) return;
                  lastTrail = now;
                  emit(event);
                });
                window.addEventListener("resize", function () {
                  engine.resize();
                });

                if (typeof ResizeObserver !== "undefined") {
                  new ResizeObserver(function () {
                    engine.resize();
                  }).observe(canvas);
                }
              })();
            `,
          }}
        />
        {/* Boots the Weaver's Shuttle compiled from
            src/tantu/lib/maku-shuttle.ts (npm run build:client-assets) — the
            same DOM logic useMakuShuttle drives (audio omitted; see that
            file's header), wired up by hand for the same reason the
            capillary engine above is. TantuLoom already rendered the
            .tantu-maku-plane SVG and .tantu-maku-coord readout (shuttle
            prop, default true) — without this script they sit in the DOM
            inert, exactly like the loom substrate canvas would without the
            capillary boot above it. */}
        <script
          type="module"
          dangerouslySetInnerHTML={{
            __html: `
              import { createMakuShuttle } from "./assets/maku-shuttle.js";

              (function () {
                var svg = document.querySelector(".tantu-maku-plane");
                var coord = document.querySelector(".tantu-maku-coord");
                if (!svg || !coord) return;
                var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                createMakuShuttle(svg, coord, { spatialRouting: true, throwDuration: reduceMotion ? 1 : 180, trailDuration: reduceMotion ? 1 : 520 });
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}

async function main() {
  console.log("[INFO] Fetching repo list...");
  const reposData = await fetchRepoList();
  console.log("[INFO] Building with repos:", reposData);

  const tantuCssPath = path.resolve("./src/tantu/styles/tantu.css");
  const tantuCss = fs.readFileSync(tantuCssPath, "utf-8");

  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(SiteApp, { reposData, tantuCss })
  );

  const fullHtml = "<!DOCTYPE html>\n" + html;
  fs.writeFileSync("index.html", fullHtml, "utf-8");
  console.log(`[OK] Generated index.html natively with React & Tantu components (${fullHtml.length.toLocaleString()} bytes)`);
}

main().catch((err) => {
  console.error("[ERROR] Failed to generate site:", err);
  process.exit(1);
});
