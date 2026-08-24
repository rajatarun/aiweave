import fs from "node:fs";
import path from "node:path";
import React from "react";
import ReactDOMServer from "react-dom/server";

import {
  TantuLoom,
  TantuCell,
  TantuCard,
  TantuButton,
  TantuTag,
  TantuMeter,
  TantuStepper,
} from "./src/tantu/index.ts";

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
              src: url("fonts/Kasuti-Gauze.woff2") format("woff2"),
                   url("fonts/Kasuti-Gauze.woff") format("woff");
              font-weight: 400;
              font-style: normal;
              font-display: swap;
            }
            @font-face {
              font-family: "Talim-Mono";
              src: url("fonts/Talim-Mono.woff2") format("woff2"),
                   url("fonts/Talim-Mono.woff") format("woff");
              font-weight: 400;
              font-style: normal;
              font-display: swap;
            }
            @font-face {
              font-family: "Kalam-Rupa";
              src: url("fonts/Kalam-Rupa.woff2") format("woff2"),
                   url("fonts/Kalam-Rupa.woff") format("woff");
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
              background: var(--tantu-kora-raw);
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
            <TantuCard warpSpan={4} reliefLevel="kanthi" absorbent>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontFamily: "var(--font-kasuti)", fontSize: "2.2rem", fontWeight: 700, color: "var(--tantu-accent-primary)" }}>10</span>
                <div style={{ fontFamily: "var(--font-kasuti)", fontSize: "0.75rem", color: "var(--tantu-ink-secondary)", marginTop: "var(--tantu-knot-1)" }}>OPEN SOURCE TOOLS</div>
              </div>
            </TantuCard>
            <TantuCard warpSpan={4} reliefLevel="kanthi" absorbent>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontFamily: "var(--font-kasuti)", fontSize: "2.2rem", fontWeight: 700, color: "var(--tantu-accent-primary)" }}>8+</span>
                <div style={{ fontFamily: "var(--font-kasuti)", fontSize: "0.75rem", color: "var(--tantu-ink-secondary)", marginTop: "var(--tantu-knot-1)" }}>AWS SERVICES INTEGRATED</div>
              </div>
            </TantuCard>
            <TantuCard warpSpan={4} reliefLevel="kanthi" absorbent>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontFamily: "var(--font-kasuti)", fontSize: "2.2rem", fontWeight: 700, color: "var(--tantu-accent-primary)" }}>~52%</span>
                <div style={{ fontFamily: "var(--font-kasuti)", fontSize: "0.75rem", color: "var(--tantu-ink-secondary)", marginTop: "var(--tantu-knot-1)" }}>COST SAVINGS VS SAGEMAKER</div>
                <TantuMeter value={52} label="Cost savings vs SageMaker" style={{ marginTop: "var(--tantu-knot-2)" }} />
              </div>
            </TantuCard>

            {/* Projects */}
            <SectionHeader id="projects" number="01" title="The Weave Ecosystem" style={{ marginTop: "var(--tantu-knot-6)" }} />

            {reposData.map((repo) => {
              const meta = REPO_META[repo] || {
                icon: "⬢",
                tagline: "AWS-native AI tool · Open source",
                tech: ["Python", "AWS", "Open Source"],
                fallback_desc: "An open-source AWS-native tool from the AIWeave ecosystem.",
              };

              return (
                <TantuCard key={repo} warpSpan={6} reliefLevel="kanthi" absorbent>
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
                      <a href={`https://github.com/${GH_OWNER}/${repo}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                        <TantuButton variant="secondary" bleed={false}>View on GitHub →</TantuButton>
                      </a>
                    </div>
                  </div>
                </TantuCard>
              );
            })}

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
            `,
          }}
        />
        {/* Boots the T2 capillary engine compiled from
            src/tantu/lib/capillary-bleed.ts (npm run build:capillary) —
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
