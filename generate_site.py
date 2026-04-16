#!/usr/bin/env python3
"""Fetch READMEs via GitHub GraphQL API and generate index.html for aiweave.org."""

import html
import json
import os
import re
import requests
from datetime import datetime, timezone

GH_OWNER = "rajatarun"
GH_GRAPHQL_URL = "https://api.github.com/graphql"

REPOS = [
    "TrainWeave",
    "TeamWeave",
    "TaskWeave",
    "ToolWeave",
    "ContextWeave",
    "ScreenWeave",
    "mcp-observatory",
]

REPO_META = {
    "TrainWeave": {
        "icon": "⚙",
        "tagline": "AWS LoRA fine-tuning · EC2 Spot · ~52% cost savings vs SageMaker",
        "tech": ["LoRA", "EC2 Spot", "Lambda", "S3", "SAM"],
        "fallback_desc": "Automated LoRA fine-tuning on AWS EC2 Spot instances, Lambda-orchestrated for maximum cost efficiency.",
    },
    "TeamWeave": {
        "icon": "⬡",
        "tagline": "Config-driven multi-agent orchestration · Step Functions · Bedrock",
        "tech": ["Step Functions", "API Gateway", "DynamoDB", "Bedrock", "Multi-Agent"],
        "fallback_desc": "Config-driven multi-agent orchestration platform on AWS using Step Functions, Bedrock, and DynamoDB — no code changes required.",
    },
    "TaskWeave": {
        "icon": "◈",
        "tagline": "API-first JSON agent framework · LangChain · LangGraph · POST /invoke",
        "tech": ["LangChain", "LangGraph", "REST API", "JSON", "Python"],
        "fallback_desc": "API-first JSON-driven agent framework combining LangChain and LangGraph with a clean POST /invoke endpoint.",
    },
    "ToolWeave": {
        "icon": "⚒",
        "tagline": "FastMCP server · Natural language → REST API · Bedrock · Lambda",
        "tech": ["FastMCP", "Lambda", "DynamoDB", "Bedrock", "OpenAPI"],
        "fallback_desc": "FastMCP server converting natural language requests into secure REST API calls via AWS Lambda, DynamoDB, and Bedrock.",
    },
    "ContextWeave": {
        "icon": "◆",
        "tagline": "GraphRAG + CAG · Memgraph · pgvector · Neptune Analytics · Adaptive routing",
        "tech": ["GraphRAG", "Memgraph", "pgvector", "Neptune", "Bedrock", "CAG"],
        "fallback_desc": "AWS-native GraphRAG and CAG platform with adaptive routing — Memgraph, PostgreSQL pgvector, Neptune Analytics, and Bedrock.",
    },
    "ScreenWeave": {
        "icon": "⬚",
        "tagline": "Website crawling + visual QA · Playwright · Claude 3.5 Sonnet · Bedrock",
        "tech": ["Playwright", "Claude 3.5", "Bedrock", "EC2", "S3"],
        "fallback_desc": "AWS-native website crawling and visual QA platform using Playwright automation and Claude 3.5 Sonnet via Bedrock.",
    },
    "mcp-observatory": {
        "icon": "◉",
        "tagline": "Two-phase PROPOSE/COMMIT · Risk scoring · Safe MCP execution · Observability",
        "tech": ["FastMCP", "PROPOSE/COMMIT", "Risk Scoring", "PostgreSQL", "Observability"],
        "fallback_desc": "Two-phase execution framework for high-risk MCP tool operations — PROPOSE scores risk, COMMIT verifies signed tokens before side-effects.",
    },
}

GRAPHQL_QUERY = """
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    description
    url
    stargazerCount
    primaryLanguage { name }
    readme1: object(expression: "HEAD:README.md") {
      ... on Blob { text }
    }
    readme2: object(expression: "HEAD:readme.md") {
      ... on Blob { text }
    }
    arch: object(expression: "HEAD:docs/ARCHITECTURE.md") {
      ... on Blob { text }
    }
  }
}
"""


def fetch_via_graphql(repo_name: str, token: str) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    payload = {
        "query": GRAPHQL_QUERY,
        "variables": {"owner": GH_OWNER, "name": repo_name},
    }

    try:
        resp = requests.post(GH_GRAPHQL_URL, headers=headers, json=payload, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        if "errors" in data:
            print(f"[WARN] GraphQL errors for {repo_name}: {data['errors']}")

        repo = (data.get("data") or {}).get("repository") or {}
        readme_obj = repo.get("readme1") or repo.get("readme2") or {}
        arch_obj = repo.get("arch") or {}

        return {
            "name": repo_name,
            "description": repo.get("description") or REPO_META[repo_name]["fallback_desc"],
            "readme_text": readme_obj.get("text", ""),
            "arch_text": arch_obj.get("text", ""),
            "url": repo.get("url") or f"https://github.com/{GH_OWNER}/{repo_name}",
            "stars": repo.get("stargazerCount", 0),
            "language": (repo.get("primaryLanguage") or {}).get("name", "Python"),
        }

    except requests.exceptions.Timeout:
        print(f"[WARN] Timeout fetching {repo_name}, using fallback")
        return _fallback_repo(repo_name)
    except requests.exceptions.RequestException as e:
        print(f"[WARN] Request error for {repo_name}: {e}, using fallback")
        return _fallback_repo(repo_name)
    except (KeyError, ValueError, json.JSONDecodeError) as e:
        print(f"[WARN] Parse error for {repo_name}: {e}, using fallback")
        return _fallback_repo(repo_name)


def _fallback_repo(repo_name: str) -> dict:
    meta = REPO_META[repo_name]
    return {
        "name": repo_name,
        "description": meta["fallback_desc"],
        "readme_text": "",
        "arch_text": "",
        "url": f"https://github.com/{GH_OWNER}/{repo_name}",
        "stars": 0,
        "language": "Python",
    }


def extract_summary(readme_text: str, max_sentences: int = 3) -> str:
    if not readme_text:
        return ""
    text = re.sub(r"```[\s\S]*?```", "", readme_text)
    text = re.sub(r"`[^`]+`", "", text)
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)
    text = re.sub(r"\[!\[.*?\]\(.*?\)\]\(.*?\)", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)
    text = re.sub(r"^#{1,6}\s.*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"^[-*+]\s", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\|.*\|$", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{2,}", "\n", text)
    text = text.strip()

    sentences = re.split(r"(?<=[.!?])\s+", text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 25]
    summary = " ".join(sentences[:max_sentences])
    return html.escape(summary[:420])


def build_project_card(repo_data: dict, index: int) -> str:
    name = repo_data["name"]
    meta = REPO_META[name]
    summary = extract_summary(repo_data["readme_text"]) or html.escape(repo_data["description"])
    tech_tags = "".join(
        f'<span class="tech-tag">{t}</span>' for t in meta["tech"]
    )
    stars = repo_data["stars"]
    star_html = (
        f'<span class="star-count" aria-label="{stars} GitHub stars">&#9733; {stars}</span>'
        if stars
        else ""
    )
    card_id = f"project-{name.lower().replace('-', '_')}"
    safe_name = html.escape(name)
    safe_url = html.escape(repo_data["url"])
    safe_tagline = html.escape(meta["tagline"])

    return f"""
        <article class="project-card" id="{card_id}" aria-labelledby="title-{index}" role="listitem">
          <div class="card-header">
            <span class="card-icon" aria-hidden="true">{meta['icon']}</span>
            <div class="card-title-group">
              <h3 id="title-{index}" class="card-title">{safe_name}</h3>
              <p class="card-tagline">{safe_tagline}</p>
            </div>
            {star_html}
          </div>
          <p class="card-summary">{summary}</p>
          <div class="tech-tags" aria-label="Technologies used in {safe_name}">{tech_tags}</div>
          <a href="{safe_url}"
             class="card-link"
             target="_blank"
             rel="noopener noreferrer"
             aria-label="View {safe_name} on GitHub (opens in new tab)">
            View on GitHub &#8594;
          </a>
        </article>"""


def generate_html(repos_data: list, svg_content: str) -> str:
    cards_html = "\n".join(build_project_card(r, i) for i, r in enumerate(repos_data))
    build_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    build_year = datetime.now(timezone.utc).year

    return f"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  <title>AIWeave &#8212; AWS AI Infrastructure Tools Ecosystem</title>
  <meta name="description" content="AIWeave is a suite of open-source AWS-native AI infrastructure tools covering model fine-tuning, multi-agent orchestration, GraphRAG, MCP servers, visual QA, and more.">
  <link rel="canonical" href="https://aiweave.org">

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="AIWeave &#8212; AWS AI Infrastructure Tools Ecosystem">
  <meta property="og:description" content="Open-source AWS-native AI infrastructure tools: fine-tuning, multi-agent orchestration, GraphRAG, MCP servers, and visual QA.">
  <meta property="og:url" content="https://aiweave.org">
  <meta property="og:image" content="https://aiweave.org/og-image.png">
  <meta property="og:site_name" content="AIWeave">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="AIWeave &#8212; AWS AI Infrastructure Tools Ecosystem">
  <meta name="twitter:description" content="Open-source AWS-native AI infrastructure tools: fine-tuning, multi-agent orchestration, GraphRAG, MCP servers, and visual QA.">
  <meta name="twitter:image" content="https://aiweave.org/og-image.png">

  <!-- Structured Data -->
  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@graph": [
      {{
        "@type": "WebSite",
        "@id": "https://aiweave.org/#website",
        "url": "https://aiweave.org",
        "name": "AIWeave",
        "description": "AWS AI Infrastructure Tools Ecosystem"
      }},
      {{
        "@type": "Organization",
        "@id": "https://aiweave.org/#organization",
        "name": "AIWeave",
        "url": "https://aiweave.org",
        "sameAs": ["https://github.com/{GH_OWNER}"]
      }}
    ]
  }}
  </script>

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:ital,wght@0,300;0,400;0,600;1,300&display=swap" rel="stylesheet">

  <style>
    /* ── Theme variables ─────────────────────────────────── */
    :root, [data-theme="dark"] {{
      --bg:           #050a14;
      --surface:      #0d1a2e;
      --surface-2:    #162238;
      --surface-3:    #1c2d47;
      --accent:       #00d4ff;
      --accent-dim:   rgba(0,212,255,0.12);
      --secondary:    #7b2fff;
      --text:         #e2e8f0;
      --text-muted:   #8899aa;
      --border:       rgba(0,212,255,0.18);
      --card-shadow:  0 4px 28px rgba(0,0,0,0.5);
      --nav-bg:       rgba(5,10,20,0.88);
      --glow:         0 0 28px rgba(0,212,255,0.18);
    }}
    [data-theme="light"] {{
      --bg:           #eef2f7;
      --surface:      #ffffff;
      --surface-2:    #e6ecf5;
      --surface-3:    #dce4f0;
      --accent:       #005fcc;
      --accent-dim:   rgba(0,95,204,0.09);
      --secondary:    #5500bb;
      --text:         #0f1e2e;
      --text-muted:   #4a5568;
      --border:       rgba(0,95,204,0.18);
      --card-shadow:  0 4px 28px rgba(0,0,0,0.08);
      --nav-bg:       rgba(238,242,247,0.92);
      --glow:         0 0 28px rgba(0,95,204,0.1);
    }}

    /* ── SVG theme ───────────────────────────────────────── */
    [data-theme="dark"]  .arch-element {{ stroke: rgba(255,255,255,0.5); fill: none; stroke-linecap: round; }}
    [data-theme="dark"]  .arch-text    {{ fill: rgba(255,255,255,0.5); }}
    [data-theme="light"] .arch-element {{ stroke: rgba(80,100,140,0.5); fill: none; stroke-linecap: round; }}
    [data-theme="light"] .arch-text    {{ fill: rgba(60,80,120,0.5); }}

    /* ── Reset ───────────────────────────────────────────── */
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    html {{ scroll-behavior: smooth; font-size: 16px; }}
    body {{
      font-family: 'Exo 2', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.6;
      transition: background 0.35s, color 0.35s;
      overflow-x: hidden;
    }}

    /* ── Accessibility ───────────────────────────────────── */
    .skip-link {{
      position: absolute;
      top: -120px;
      left: 16px;
      z-index: 9999;
      background: var(--accent);
      color: #000;
      padding: 10px 20px;
      border-radius: 6px;
      font-weight: 700;
      text-decoration: none;
      transition: top 0.2s;
      font-family: 'Exo 2', sans-serif;
    }}
    .skip-link:focus {{ top: 16px; outline: 3px solid var(--secondary); outline-offset: 2px; }}
    :focus-visible {{
      outline: 3px solid var(--accent);
      outline-offset: 3px;
      border-radius: 4px;
    }}

    /* ── Fixed SVG background ────────────────────────────── */
    .bg-container {{
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;
    }}
    .bg-container svg {{
      width: 100%;
      height: 100%;
    }}

    /* ── Navigation ──────────────────────────────────────── */
    nav {{
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 200;
      background: var(--nav-bg);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--border);
      height: 64px;
      display: flex;
      align-items: center;
      padding: 0 clamp(16px,4vw,56px);
      gap: 8px;
    }}
    .nav-logo {{
      font-family: 'Orbitron', sans-serif;
      font-size: 1.35rem;
      font-weight: 900;
      text-decoration: none;
      letter-spacing: 0.04em;
      color: var(--accent);
      margin-right: auto;
      white-space: nowrap;
    }}
    .nav-logo span {{ color: var(--secondary); }}
    .nav-links {{
      display: flex;
      align-items: center;
      gap: 4px;
      list-style: none;
    }}
    .nav-links a {{
      color: var(--text-muted);
      text-decoration: none;
      padding: 7px 13px;
      border-radius: 7px;
      font-size: 0.9rem;
      font-weight: 400;
      letter-spacing: 0.02em;
      transition: color 0.2s, background 0.2s;
      white-space: nowrap;
    }}
    .nav-links a:hover {{ color: var(--accent); background: var(--accent-dim); }}
    .theme-toggle {{
      background: var(--surface-2);
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 6px 13px;
      border-radius: 20px;
      cursor: pointer;
      font-size: 0.82rem;
      font-family: 'Exo 2', sans-serif;
      transition: border-color 0.2s, color 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }}
    .theme-toggle:hover {{ border-color: var(--accent); color: var(--accent); }}
    .github-btn {{
      background: var(--accent);
      color: #000;
      font-weight: 700;
      font-family: 'Exo 2', sans-serif;
      font-size: 0.85rem;
      padding: 8px 16px;
      border-radius: 8px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: opacity 0.2s, transform 0.15s;
      white-space: nowrap;
    }}
    .github-btn:hover {{ opacity: 0.85; transform: translateY(-1px); }}
    @media (max-width: 620px) {{
      .nav-home, .nav-about {{ display: none; }}
    }}

    /* ── Main content above SVG ──────────────────────────── */
    main {{
      position: relative;
      z-index: 10;
      padding-top: 64px;
    }}

    /* ── Hero ────────────────────────────────────────────── */
    #home {{
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: clamp(48px,8vw,120px) clamp(16px,4vw,48px) 80px;
      position: relative;
    }}
    .hero-eyebrow {{
      font-size: 0.78rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 18px;
      font-weight: 600;
    }}
    .hero-title {{
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(3.2rem, 9vw, 7.5rem);
      font-weight: 900;
      line-height: 1;
      letter-spacing: -0.01em;
      margin-bottom: 10px;
      background: linear-gradient(135deg, var(--accent) 0%, var(--secondary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      color: transparent;
    }}
    .hero-subtitle {{
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(0.95rem, 2.2vw, 1.35rem);
      font-weight: 400;
      color: var(--text-muted);
      letter-spacing: 0.1em;
      margin-bottom: 28px;
    }}
    .hero-description {{
      max-width: 620px;
      font-size: clamp(0.98rem, 1.6vw, 1.1rem);
      color: var(--text-muted);
      margin-bottom: 48px;
      line-height: 1.85;
      font-weight: 300;
    }}
    .hero-ctas {{
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      justify-content: center;
    }}
    .btn-primary {{
      background: linear-gradient(135deg, var(--accent), var(--secondary));
      color: #fff;
      border: none;
      padding: 14px 34px;
      border-radius: 10px;
      font-family: 'Exo 2', sans-serif;
      font-size: 1rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: transform 0.15s, opacity 0.2s;
      box-shadow: var(--glow);
    }}
    .btn-primary:hover {{ transform: translateY(-2px); opacity: 0.9; }}
    .btn-outline {{
      background: transparent;
      color: var(--accent);
      border: 2px solid var(--accent);
      padding: 12px 32px;
      border-radius: 10px;
      font-family: 'Exo 2', sans-serif;
      font-size: 1rem;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.2s, color 0.2s;
    }}
    .btn-outline:hover {{ background: var(--accent); color: #000; }}
    .scroll-indicator {{
      position: absolute;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }}
    .scroll-line {{
      width: 1px;
      height: 44px;
      background: linear-gradient(to bottom, var(--accent), transparent);
      animation: pulse-line 2.2s ease-in-out infinite;
    }}
    .scroll-label {{
      font-size: 0.68rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--text-muted);
    }}
    @keyframes pulse-line {{
      0%, 100% {{ opacity: 0.25; }}
      50%        {{ opacity: 0.9; }}
    }}

    /* ── Section shared ──────────────────────────────────── */
    .section-wrap {{
      padding: clamp(64px,8vw,120px) clamp(16px,4vw,56px);
    }}
    .section-header {{
      text-align: center;
      margin-bottom: clamp(36px,5vw,72px);
    }}
    .section-eyebrow {{
      font-size: 0.75rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 12px;
      font-weight: 600;
    }}
    .section-title {{
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(1.8rem, 4vw, 3rem);
      font-weight: 700;
      color: var(--text);
      line-height: 1.15;
    }}
    .section-title span {{ color: var(--accent); }}

    /* ── Project cards ───────────────────────────────────── */
    .projects-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
      gap: clamp(16px,2.2vw,28px);
      max-width: 1300px;
      margin: 0 auto;
    }}
    .project-card {{
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: clamp(20px,3vw,30px);
      box-shadow: var(--card-shadow);
      display: flex;
      flex-direction: column;
      gap: 14px;
      transition: transform 0.22s, box-shadow 0.22s, border-color 0.22s;
    }}
    .project-card:hover {{
      transform: translateY(-5px);
      box-shadow: 0 12px 44px rgba(0,212,255,0.14), var(--card-shadow);
      border-color: var(--accent);
    }}
    [data-theme="light"] .project-card:hover {{
      box-shadow: 0 12px 44px rgba(0,95,204,0.12), var(--card-shadow);
    }}
    .card-header {{
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }}
    .card-icon {{
      font-size: 1.75rem;
      line-height: 1;
      flex-shrink: 0;
      margin-top: 2px;
    }}
    .card-title-group {{ flex: 1; min-width: 0; }}
    .card-title {{
      font-family: 'Orbitron', sans-serif;
      font-size: 1rem;
      font-weight: 700;
      color: var(--accent);
      margin: 0 0 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }}
    .card-tagline {{
      font-size: 0.76rem;
      color: var(--text-muted);
      line-height: 1.5;
    }}
    .star-count {{
      flex-shrink: 0;
      font-size: 0.78rem;
      color: var(--text-muted);
      margin-left: auto;
      padding-left: 8px;
      white-space: nowrap;
    }}
    .card-summary {{
      font-size: 0.875rem;
      color: var(--text);
      line-height: 1.75;
      flex: 1;
      font-weight: 300;
    }}
    .tech-tags {{
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }}
    .tech-tag {{
      background: var(--accent-dim);
      color: var(--accent);
      border: 1px solid var(--border);
      padding: 3px 9px;
      border-radius: 20px;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.03em;
      white-space: nowrap;
    }}
    .card-link {{
      align-self: flex-start;
      color: var(--accent);
      text-decoration: none;
      font-size: 0.86rem;
      font-weight: 600;
      padding: 8px 15px;
      border: 1px solid var(--border);
      border-radius: 8px;
      transition: background 0.2s, border-color 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }}
    .card-link:hover {{ background: var(--accent-dim); border-color: var(--accent); }}

    /* ── About section ───────────────────────────────────── */
    #about .section-wrap {{
      max-width: 880px;
      margin: 0 auto;
    }}
    .about-card {{
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: clamp(32px,5vw,60px);
      box-shadow: var(--card-shadow);
    }}
    .about-card p {{
      font-size: clamp(0.93rem,1.4vw,1.04rem);
      color: var(--text-muted);
      line-height: 1.9;
      margin-bottom: 18px;
      font-weight: 300;
    }}
    .about-card p:last-child {{ margin-bottom: 0; }}
    .about-card strong {{ color: var(--text); font-weight: 600; }}

    /* ── Footer ──────────────────────────────────────────── */
    footer {{
      position: relative;
      z-index: 10;
      text-align: center;
      padding: 28px clamp(16px,4vw,56px);
      border-top: 1px solid var(--border);
      background: var(--nav-bg);
      backdrop-filter: blur(10px);
      font-size: 0.82rem;
      color: var(--text-muted);
    }}
    footer a {{ color: var(--accent); text-decoration: none; }}
    footer a:hover {{ text-decoration: underline; }}

    /* ── Reduced motion ──────────────────────────────────── */
    @media (prefers-reduced-motion: reduce) {{
      *, *::before, *::after {{
        animation-duration: 0.001ms !important;
        transition-duration: 0.001ms !important;
        scroll-behavior: auto !important;
      }}
    }}

    /* ── High-contrast focus ─────────────────────────────── */
    @media (forced-colors: active) {{
      .project-card, .about-card {{ border: 2px solid ButtonText; }}
      .btn-primary, .github-btn {{ forced-color-adjust: none; }}
    }}
  </style>
</head>
<body>

  <a href="#main" class="skip-link">Skip to main content</a>

  <nav aria-label="Main navigation">
    <a href="/" class="nav-logo" aria-label="AIWeave home">AI<span>Weave</span></a>
    <ul class="nav-links" role="list">
      <li><a href="#home" class="nav-home" aria-label="Go to Home section">Home</a></li>
      <li><a href="#projects" aria-label="Go to Projects section">Projects</a></li>
      <li><a href="#about" class="nav-about" aria-label="Go to About section">About</a></li>
      <li>
        <button class="theme-toggle" id="theme-toggle"
                aria-label="Switch to light mode"
                aria-pressed="false">
          <span id="theme-icon" aria-hidden="true">&#9790;</span>
          <span id="theme-label">Light</span>
        </button>
      </li>
      <li>
        <a href="https://github.com/{GH_OWNER}"
           class="github-btn"
           target="_blank"
           rel="noopener noreferrer"
           aria-label="Visit {GH_OWNER} on GitHub (opens in new tab)">
          &#128195; GitHub
        </a>
      </li>
    </ul>
  </nav>

  <div class="bg-container" aria-hidden="true" role="presentation">
    {svg_content}
  </div>

  <main id="main">

    <!-- ═══════ HERO ═══════ -->
    <section id="home" aria-labelledby="hero-title">
      <p class="hero-eyebrow">Open-Source AWS AI Infrastructure</p>
      <h1 id="hero-title" class="hero-title">AIWeave</h1>
      <p class="hero-subtitle">Build &middot; Fine-tune &middot; Orchestrate &middot; Deploy</p>
      <p class="hero-description">
        A suite of production-ready, AWS-native AI infrastructure tools spanning
        model fine-tuning, multi-agent orchestration, GraphRAG, MCP servers,
        visual quality assurance, and observability &mdash; designed to ship AI systems faster.
      </p>
      <div class="hero-ctas">
        <a href="#projects" class="btn-primary"
           aria-label="Explore all AIWeave projects">Explore Projects</a>
        <a href="https://github.com/{GH_OWNER}"
           class="btn-outline"
           target="_blank"
           rel="noopener noreferrer"
           aria-label="View all repositories on GitHub (opens in new tab)">View on GitHub</a>
      </div>
      <div class="scroll-indicator" aria-hidden="true">
        <div class="scroll-line"></div>
        <span class="scroll-label">Scroll</span>
      </div>
    </section>

    <!-- ═══════ PROJECTS ═══════ -->
    <section id="projects" aria-labelledby="projects-title" class="section-wrap">
      <div class="section-header">
        <p class="section-eyebrow">Open Source Tooling</p>
        <h2 id="projects-title" class="section-title">The <span>Weave</span> Ecosystem</h2>
      </div>
      <div class="projects-grid" role="list" aria-label="AIWeave projects">
{cards_html}
      </div>
    </section>

    <!-- ═══════ ABOUT ═══════ -->
    <section id="about" aria-labelledby="about-title">
      <div class="section-wrap">
        <div class="section-header">
          <p class="section-eyebrow">About</p>
          <h2 id="about-title" class="section-title">What is <span>AIWeave</span>?</h2>
        </div>
        <div class="about-card">
          <p>
            <strong>AIWeave</strong> is a collection of open-source, AWS-native AI infrastructure
            tools built for engineers who need production-grade AI systems without proprietary
            lock-in. Each tool addresses a distinct layer of the AI engineering stack &mdash;
            from raw compute and model training through retrieval, orchestration, and quality assurance.
          </p>
          <p>
            Every library is built on AWS primitives: <strong>Lambda, Bedrock, Step Functions,
            DynamoDB, EC2 Spot, API Gateway, S3</strong>, and <strong>Neptune</strong>.
            Rather than abstracting cloud infrastructure away, AIWeave composes these services
            into opinionated, battle-tested patterns that reduce operational overhead and cost
            while remaining fully observable and auditable.
          </p>
          <p>
            All tools are open source under the <strong>Apache 2.0 license</strong>, written in
            Python, and designed for reliability. Site generated on {build_date}.
          </p>
        </div>
      </div>
    </section>

  </main>

  <footer>
    <p>
      &copy; {build_year} AIWeave &middot;
      <a href="https://github.com/{GH_OWNER}"
         target="_blank"
         rel="noopener noreferrer"
         aria-label="GitHub profile (opens in new tab)">GitHub</a>
      &middot;
      <a href="https://aiweave.org" aria-label="AIWeave homepage">aiweave.org</a>
      &middot; Apache 2.0 License
    </p>
  </footer>

  <script>
    (function () {{
      var html = document.documentElement;
      var btn  = document.getElementById('theme-toggle');
      var icon = document.getElementById('theme-icon');
      var lbl  = document.getElementById('theme-label');

      function applyTheme(t) {{
        html.setAttribute('data-theme', t);
        try {{ localStorage.setItem('aiweave-theme', t); }} catch(e) {{}}
        var isDark = t === 'dark';
        btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
        btn.setAttribute('aria-pressed', isDark ? 'false' : 'true');
        icon.textContent = isDark ? '\u263E' : '\u2600';
        lbl.textContent  = isDark ? 'Light'  : 'Dark';
      }}

      var saved;
      try {{ saved = localStorage.getItem('aiweave-theme'); }} catch(e) {{}}
      var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(saved || (prefersDark ? 'dark' : 'light'));

      btn.addEventListener('click', function () {{
        applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      }});

      document.querySelectorAll('a[href^="#"]').forEach(function (a) {{
        a.addEventListener('click', function (e) {{
          var target = document.querySelector(this.getAttribute('href'));
          if (target) {{
            e.preventDefault();
            target.scrollIntoView({{ behavior: 'smooth' }});
            target.setAttribute('tabindex', '-1');
            target.focus({{ preventScroll: true }});
          }}
        }});
      }});
    }})();
  </script>

</body>
</html>"""


def main():
    token = os.environ.get("GH_TOKEN", "")
    if not token:
        print("[WARN] GH_TOKEN not set — API calls unauthenticated (60 req/hr limit)")

    svg_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "background.svg")
    try:
        with open(svg_path, "r", encoding="utf-8") as f:
            svg_content = f.read()
        svg_content = re.sub(r"<\?xml[^?]*\?>", "", svg_content).strip()
    except FileNotFoundError:
        print("[WARN] background.svg not found, using empty placeholder")
        svg_content = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"></svg>'

    repos_data = []
    for repo_name in REPOS:
        print(f"[INFO] Fetching {repo_name}...")
        data = fetch_via_graphql(repo_name, token)
        repos_data.append(data)
        print(f"       stars={data['stars']}  readme_len={len(data['readme_text'])}")

    html_content = generate_html(repos_data, svg_content)
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.html")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"[OK] Generated index.html ({len(html_content):,} bytes)")


if __name__ == "__main__":
    main()
