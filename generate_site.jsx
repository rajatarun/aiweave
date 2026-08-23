import fs from "node:fs";
import path from "node:path";
import React from "react";
import ReactDOMServer from "react-dom/server";

import {
  TantuLoom,
  TantuCard,
  TantuButton,
  TantuTag,
  TantuAcousticToggle,
  TantuStack,
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
            body {
              background-color: var(--tantu-bg-substrate);
              color: var(--tantu-ink-primary);
              font-family: var(--font-talim);
              margin: 0;
              padding: 0;
              transition: background-color 0.2s ease, color 0.2s ease;
            }
            .tantu-loom {
              display: grid;
              width: 100%;
              min-height: 100vh;
              grid-template-columns: var(--tantu-knot-8) 1fr var(--tantu-knot-8);
              background-color: var(--tantu-bg-substrate);
            }
            .tantu-loom-selvedge-left, .tantu-loom-selvedge-right {
              background: repeating-linear-gradient(
                0deg,
                transparent,
                transparent 12px,
                var(--tantu-grid-thread) 12px,
                var(--tantu-grid-thread) 13px
              );
              opacity: 0.25;
            }
            .tantu-loom-content {
              display: grid;
              grid-template-columns: repeat(12, 1fr);
              gap: var(--tantu-knot-4);
              padding: var(--tantu-knot-6) 0;
            }
            nav.tantu-nav {
              grid-column: span 12;
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 16px var(--tantu-knot-4);
              border-bottom: var(--tantu-gauge-filament) solid var(--tantu-border-embroidery);
              background: var(--tantu-kora-raw);
              margin-bottom: var(--tantu-knot-6);
            }
            .nav-brand {
              display: flex;
              align-items: center;
              gap: 12px;
              text-decoration: none;
              color: var(--tantu-accent-primary);
              font-weight: 700;
              font-family: var(--font-kasuti);
            }
            .hero-warp {
              grid-column: span 12;
              text-align: center;
            }
            .hero-title {
              font-family: var(--font-kalam);
              font-size: clamp(2.5rem, 6vw, 4.5rem);
              color: var(--tantu-accent-primary);
              margin: 0 0 var(--tantu-knot-3);
            }
            .signal-warp {
              grid-column: span 12;
            }
            .section-title-warp {
              grid-column: span 12;
              border-bottom: var(--tantu-gauge-filament) dashed var(--tantu-grid-thread);
              padding-bottom: 8px;
              margin-bottom: var(--tantu-knot-6);
            }
            .section-title-text {
              font-family: var(--font-kalam);
              font-size: 1.8rem;
              color: var(--tantu-accent-primary);
              margin: 0;
            }
            footer.tantu-footer {
              grid-column: span 12;
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
        <TantuLoom viewTalimCode="AIW-HOME-01" shuttle={true}>
            {/* Navigation */}
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
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
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

            {/* Hero Section */}
            <div className="hero-warp">
              <TantuCard warpSpan={12} reliefLevel="zardozi" talimCode="TALIM-HERO-01">
                <div style={{ padding: "12px 0" }}>
                  <TantuTag tone="accent" solid={false}>TANTU DESIGN SYSTEM (REACT NATIVE ENGINE)</TantuTag>
                  <h1 className="hero-title" style={{ marginTop: "16px" }}>AIWeave Infrastructure</h1>
                  <p style={{ fontFamily: "var(--font-kasuti)", color: "var(--tantu-zari-pure-gold)", fontSize: "1.1rem" }}>
                    [ BUILD · FINE-TUNE · ORCHESTRATE · DEPLOY ]
                  </p>
                  <p style={{ maxWidth: "680px", margin: "0 auto 28px", fontSize: "0.95rem", color: "var(--tantu-ink-secondary)", lineHeight: 1.8 }}>
                    Production-ready AWS-native AI infrastructure generated natively with Tantu React Design Library components.
                  </p>
                  <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                    <a href="#projects" style={{ textDecoration: "none" }}>
                      <TantuButton variant="primary" bleed={false}>Explore Projects</TantuButton>
                    </a>
                    <a href={`https://github.com/${GH_OWNER}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      <TantuButton variant="secondary" bleed={false}>GitHub Repositories</TantuButton>
                    </a>
                  </div>
                </div>
              </TantuCard>
            </div>

            {/* Stat Band (3-up desktop, stacked mobile) */}
            <TantuCard warpSpan={4} reliefLevel="kanthi">
              <div style={{ textAlign: "center" }}>
                <span style={{ fontFamily: "var(--font-kasuti)", fontSize: "2.2rem", fontWeight: 700, color: "var(--tantu-accent-primary)" }}>10</span>
                <div style={{ fontFamily: "var(--font-kasuti)", fontSize: "0.75rem", color: "var(--tantu-ink-secondary)", marginTop: "4px" }}>OPEN SOURCE TOOLS</div>
              </div>
            </TantuCard>
            <TantuCard warpSpan={4} reliefLevel="kanthi">
              <div style={{ textAlign: "center" }}>
                <span style={{ fontFamily: "var(--font-kasuti)", fontSize: "2.2rem", fontWeight: 700, color: "var(--tantu-accent-primary)" }}>8+</span>
                <div style={{ fontFamily: "var(--font-kasuti)", fontSize: "0.75rem", color: "var(--tantu-ink-secondary)", marginTop: "4px" }}>AWS SERVICES INTEGRATED</div>
              </div>
            </TantuCard>
            <TantuCard warpSpan={4} reliefLevel="kanthi">
              <div style={{ textAlign: "center" }}>
                <span style={{ fontFamily: "var(--font-kasuti)", fontSize: "2.2rem", fontWeight: 700, color: "var(--tantu-accent-primary)" }}>~52%</span>
                <div style={{ fontFamily: "var(--font-kasuti)", fontSize: "0.75rem", color: "var(--tantu-ink-secondary)", marginTop: "4px" }}>COST SAVINGS VS SAGEMAKER</div>
              </div>
            </TantuCard>

            {/* Projects */}
            <div id="projects" className="section-title-warp" style={{ marginTop: "32px" }}>
              <h2 className="section-title-text">[01] The Weave Ecosystem</h2>
            </div>

            {reposData.map((repo, idx) => {
              const meta = REPO_META[repo] || {
                icon: "⬢",
                tagline: "AWS-native AI tool · Open source",
                tech: ["Python", "AWS", "Open Source"],
                fallback_desc: "An open-source AWS-native tool from the AIWeave ecosystem.",
              };
              const talimCode = `TALIM-W${String(idx + 1).padStart(2, "0")}`;

              return (
                <TantuCard key={repo} warpSpan={6} reliefLevel="kanthi" talimCode={talimCode}>
                  <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
                        <span style={{ fontSize: "1.6rem", lineHeight: 1, color: "var(--tantu-accent-highlight)" }}>{meta.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{ margin: "0 0 4px", fontFamily: "var(--font-kalam)", color: "var(--tantu-accent-primary)" }}>{repo}</h3>
                          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--tantu-ink-secondary)", fontFamily: "var(--font-talim)" }}>{meta.tagline}</p>
                        </div>
                      </div>
                      <p style={{ fontSize: "0.88rem", color: "var(--tantu-ink-primary)", lineHeight: 1.7, marginBottom: "16px" }}>{meta.fallback_desc}</p>
                    </div>
                    <div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
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
            <div id="architecture" className="section-title-warp" style={{ marginTop: "40px", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-kasuti)", fontSize: "0.8rem", color: "var(--tantu-accent-highlight)", letterSpacing: "0.15em" }}>
                | SYSTEM DESIGN
              </div>
              <h2 className="hero-title" style={{ fontSize: "2.8rem", margin: "8px 0" }}>
                The <span style={{ color: "var(--tantu-accent-structural)" }}>Architecture</span> Stack
              </h2>
            </div>

            {ARCH_LAYERS.map((layer) => (
              <TantuCard key={layer.label} warpSpan={12} reliefLevel="kanthi">
                <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "1.3rem", color: "var(--tantu-accent-highlight)" }}>{layer.icon}</span>
                  <span style={{ fontFamily: "var(--font-kasuti)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--tantu-accent-primary)", minWidth: "180px" }}>
                    {layer.label}
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {layer.chips.map((chip) => (
                      <TantuTag key={chip} tone="neutral">{chip}</TantuTag>
                    ))}
                  </div>
                </div>
              </TantuCard>
            ))}

            {/* Developer Experience */}
            <div id="story" className="section-title-warp" style={{ marginTop: "40px", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-kasuti)", fontSize: "0.8rem", color: "var(--tantu-accent-highlight)", letterSpacing: "0.15em" }}>
                | DEVELOPER EXPERIENCE
              </div>
              <h2 className="hero-title" style={{ fontSize: "2.5rem", margin: "8px 0" }}>
                Execution & Workflow
              </h2>
            </div>

            {STORY_PANELS.map((panel) => (
              <TantuCard key={panel.step} warpSpan={3} reliefLevel="kanthi">
                <div style={{ fontFamily: "var(--font-kasuti)", fontSize: "0.75rem", color: "var(--tantu-accent-highlight)", fontWeight: 700, marginBottom: "8px" }}>
                  [TALIM-STEP-{panel.step}]
                </div>
                <h3 style={{ fontFamily: "var(--font-kalam)", fontSize: "1.2rem", color: "var(--tantu-accent-primary)", marginBottom: "10px" }}>{panel.title}</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--tantu-ink-primary)", lineHeight: 1.6, margin: 0 }}>{panel.body}</p>
              </TantuCard>
            ))}

            {/* About */}
            <div id="about" className="section-title-warp" style={{ marginTop: "40px" }}>
              <h2 className="section-title-text">[04] About AIWeave</h2>
            </div>

            <TantuCard warpSpan={12} reliefLevel="zardozi" talimCode="TALIM-ABOUT-01">
              <p style={{ fontSize: "0.95rem", color: "var(--tantu-ink-primary)", lineHeight: 1.8, marginBottom: "16px" }}>
                <strong>AIWeave</strong> is an ecosystem of open-source, AWS-native AI infrastructure tools built for engineers who need production-grade AI systems without proprietary lock-in.
              </p>
              <p style={{ fontSize: "0.95rem", color: "var(--tantu-ink-secondary)", lineHeight: 1.8, marginBottom: "16px" }}>
                Every library is composed on AWS primitives: Lambda, Bedrock, Step Functions, DynamoDB, EC2 Spot, API Gateway, S3, and Neptune. Built natively using <strong>Tantu React Design Library Components</strong>.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <TantuTag tone="accent">JavaScript / React</TantuTag>
                <TantuTag tone="neutral">AWS Bedrock</TantuTag>
                <TantuTag tone="neutral">Lambda</TantuTag>
                <TantuTag tone="neutral">Step Functions</TantuTag>
                <TantuTag tone="neutral">EC2 Spot</TantuTag>
                <TantuTag tone="zari">Tantu Native Component Library</TantuTag>
              </div>
            </TantuCard>

            {/* Footer */}
            <footer className="tantu-footer">
              <p>© 2026 AIWeave · Built with Tantu · Apache 2.0</p>
            </footer>
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
