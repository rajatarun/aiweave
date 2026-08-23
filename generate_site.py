#!/usr/bin/env python3
"""
Discovers *Weave repos + pinned projects via GitHub GraphQL, summarizes READMEs
with Bedrock Claude Haiku 4.5, and generates index.html for aiweave.org.
"""

import hashlib
import html
import json
import os
import re
import requests
from urllib.parse import quote
from datetime import datetime, timezone

try:
    import boto3
    _HAS_BOTO3 = True
except ImportError:
    _HAS_BOTO3 = False

GH_OWNER = "rajatarun"
GH_GRAPHQL_URL = "https://api.github.com/graphql"
BEDROCK_REGION = "us-east-1"
BEDROCK_MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0"

# Always shown regardless of repo naming convention
PINNED_REPOS = ["DataDictionary", "mcp-observatory"]

# Display order for known repos; newly discovered *Weave repos append after
PREFERRED_ORDER = [
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
]

# Icon pool for repos not in REPO_META (deterministic via md5 of name)
ICON_POOL = ["⬢", "⊛", "⌬", "◐", "⬟", "◑", "⬠", "◒"]

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
    "DeployWeave": {
        "icon": "⬟",
        "tagline": "AI/ML deployment automation · AWS CDK · CodePipeline · Blue-green & canary",
        "tech": ["CDK", "CodePipeline", "CodeDeploy", "Lambda", "SAM"],
        "fallback_desc": "Infrastructure-as-code deployment automation for AI/ML workloads on AWS, supporting blue-green and canary release strategies via CDK and CodePipeline.",
    },
    "CipherWeave": {
        "icon": "⊛",
        "tagline": "Secrets & encryption layer · AWS KMS · SSM · Zero-trust data pipelines",
        "tech": ["KMS", "SSM Parameter Store", "Secrets Manager", "Lambda", "IAM"],
        "fallback_desc": "AWS-native encryption and secrets management layer for AI data pipelines, enforcing zero-trust access patterns with KMS, SSM, and Secrets Manager.",
    },
    "DataDictionary": {
        "icon": "◫",
        "tagline": "Schema registry · Data contracts · AWS Glue · Automated documentation",
        "tech": ["AWS Glue", "S3", "Athena", "Lambda", "Schema Registry"],
        "fallback_desc": "Centralized schema registry and data dictionary for AWS-native data pipelines with automated documentation and data contract validation.",
    },
}

LIST_REPOS_QUERY = """
query($owner: String!, $after: String) {
  user(login: $owner) {
    repositories(first: 100, after: $after, privacy: PUBLIC,
                 orderBy: {field: NAME, direction: ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes { name isArchived }
    }
  }
}
"""

REPO_DETAIL_QUERY = """
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


def _gh_post(query: str, variables: dict, token: str) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = requests.post(
        GH_GRAPHQL_URL,
        headers=headers,
        json={"query": query, "variables": variables},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


# Repos excluded from auto-discovery even if their name ends with 'weave'
EXCLUDED_REPOS = {"aiweave"}


def discover_weave_repos(token: str) -> list:
    """Return names of all public non-archived repos whose name ends with 'weave'."""
    found = []
    cursor = None
    while True:
        try:
            data = _gh_post(LIST_REPOS_QUERY, {"owner": GH_OWNER, "after": cursor}, token)
            page = (data.get("data") or {}).get("user", {}).get("repositories", {})
            for node in page.get("nodes", []):
                name = node["name"]
                if (not node.get("isArchived")
                        and name.lower().endswith("weave")
                        and name.lower() not in EXCLUDED_REPOS):
                    found.append(name)
            page_info = page.get("pageInfo", {})
            if not page_info.get("hasNextPage"):
                break
            cursor = page_info["endCursor"]
        except Exception as e:
            print(f"[WARN] discover_weave_repos error: {e}")
            break
    return found


def build_repo_list(discovered_weave: list) -> list:
    """Merge discovered *Weave repos with PINNED_REPOS, respecting PREFERRED_ORDER."""
    all_repos = set(discovered_weave) | set(PINNED_REPOS)
    ordered = [r for r in PREFERRED_ORDER if r in all_repos]
    new_ones = sorted(r for r in all_repos if r not in PREFERRED_ORDER)
    return ordered + new_ones


def _get_meta(repo_name: str) -> dict:
    """Return REPO_META entry, or generate deterministic defaults for unknown repos."""
    if repo_name in REPO_META:
        return REPO_META[repo_name]
    icon_idx = int(hashlib.md5(repo_name.encode()).hexdigest(), 16) % len(ICON_POOL)
    return {
        "icon": ICON_POOL[icon_idx],
        "tagline": "AWS-native AI tool · Open source",
        "tech": ["Python", "AWS", "Open Source"],
        "fallback_desc": "An open-source AWS-native tool from the AIWeave ecosystem.",
    }


def fetch_repo(repo_name: str, token: str) -> dict:
    meta = _get_meta(repo_name)
    try:
        data = _gh_post(REPO_DETAIL_QUERY, {"owner": GH_OWNER, "name": repo_name}, token)
        if "errors" in data:
            print(f"[WARN] GraphQL errors for {repo_name}: {data['errors']}")
        repo = (data.get("data") or {}).get("repository") or {}
        readme_obj = repo.get("readme1") or repo.get("readme2") or {}
        return {
            "name": repo_name,
            "description": repo.get("description") or meta["fallback_desc"],
            "readme_text": readme_obj.get("text", ""),
            "url": repo.get("url") or f"https://github.com/{GH_OWNER}/{repo_name}",
            "stars": repo.get("stargazerCount", 0),
            "language": (repo.get("primaryLanguage") or {}).get("name", "Python"),
        }
    except Exception as e:
        print(f"[WARN] Error fetching {repo_name}: {e}, using fallback")
        return {
            "name": repo_name,
            "description": meta["fallback_desc"],
            "readme_text": "",
            "url": f"https://github.com/{GH_OWNER}/{repo_name}",
            "stars": 0,
            "language": "Python",
        }


def _trim_at_sentence(text: str, max_chars: int = 700) -> str:
    """Return text trimmed to the last complete sentence within max_chars."""
    if len(text) <= max_chars:
        return text
    window = text[:max_chars]
    # Find the last sentence-ending punctuation followed by a space or end-of-string
    match = None
    for m in re.finditer(r"[.!?](?=\s|$)", window):
        match = m
    if match:
        return text[:match.end()].strip()
    # No sentence boundary found — fall back to last whitespace to avoid mid-word cut
    last_space = window.rfind(" ")
    return (text[:last_space].rstrip() + "…") if last_space > 0 else window


def summarize_with_bedrock(readme_text: str, repo_name: str, client) -> str:
    """Use Bedrock Claude Haiku 4.5 Converse API to produce a product-card summary."""
    if not readme_text or client is None:
        return ""
    # Strip heavy markup and truncate before sending (cost control)
    cleaned = re.sub(r"```[\s\S]*?```", "", readme_text)
    cleaned = re.sub(r"!\[.*?\]\(.*?\)", "", cleaned)
    cleaned = re.sub(r"\[!\[.*?\]\(.*?\)\]\(.*?\)", "", cleaned)
    cleaned = re.sub(r"<[^>]+>", "", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()[:3200]
    if not cleaned:
        return ""
    try:
        response = client.converse(
            modelId=BEDROCK_MODEL_ID,
            system=[{"text": (
                "You write copy for a technical product website. "
                "Given a GitHub README, produce 2-3 complete sentences as a plain-text "
                "summary for a project card. Focus on what the tool does, its key "
                "capabilities, and what makes it distinctive. Always finish the last "
                "sentence fully — never stop mid-sentence. "
                "Present tense, third person. No code blocks, no markdown, no bullet points."
            )}],
            messages=[{
                "role": "user",
                "content": [{"text": f"Project: {repo_name}\n\nREADME:\n{cleaned}"}],
            }],
            inferenceConfig={"maxTokens": 300, "temperature": 0.2},
        )
        result = response["output"]["message"]["content"][0]["text"].strip()
        return html.escape(_trim_at_sentence(result, max_chars=700))
    except Exception as e:
        print(f"[WARN] Bedrock summarization failed for {repo_name}: {e}")
        return ""


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
    return html.escape(_trim_at_sentence(summary, max_chars=700))


def build_project_card(repo_data: dict, index: int) -> str:
    name = repo_data["name"]
    meta = repo_data["meta"]
    summary = repo_data["summary"]
    tech_tags = "".join(
        f'<span class="tantu-tag tantu-tag-accent">{t}</span>' for t in meta["tech"]
    )
    stars = repo_data["stars"]
    star_html = (
        f'<span class="tantu-tag tantu-tag-zari" aria-label="{stars} GitHub stars">&#9733; {stars}</span>'
        if stars
        else ""
    )
    card_id = f"project-{name.lower().replace('-', '_').replace(' ', '_')}"
    safe_name = html.escape(name)
    safe_url = html.escape(repo_data["url"])
    safe_tagline = html.escape(meta["tagline"])
    extra_class = BENTO_CLASS.get(name, "")
    delay = f"transition-delay:{index * 60}ms"

    # Assign warpSpan divisors (12-column warp): TrainWeave & ToolWeave get warpSpan 6/12, others 6
    warp_span = 12 if extra_class == "card-wide" else 6
    talim_code = f"TALIM-W{index+1:02d}"

    return f"""
        <article class="tantu-card tantu-relief-kanthi tantu-cell-warp-{warp_span} reveal"
                 id="{card_id}" aria-labelledby="title-{index}" role="listitem"
                 data-darshan-node="{talim_code}"
                 style="{delay}">
          <span class="tantu-card-talim" aria-hidden="true">[{talim_code}]</span>
          <div class="tantu-card-payload">
            <div class="tantu-card-header" style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
              <span style="font-size:1.6rem; line-height:1; color:var(--tantu-accent-highlight);" aria-hidden="true">{meta['icon']}</span>
              <div style="flex:1; min-width:0;">
                <h3 id="title-{index}" style="margin:0 0 4px; font-family:var(--font-kalam); color:var(--tantu-accent-primary);">{safe_name}</h3>
                <p style="margin:0; font-size:0.75rem; color:var(--tantu-ink-secondary); font-family:var(--font-talim);">{safe_tagline}</p>
              </div>
              {star_html}
            </div>
            <p style="font-size:0.88rem; color:var(--tantu-ink-primary); line-height:1.7; margin-bottom:16px;">{summary}</p>
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px;" aria-label="Technologies used in {safe_name}">{tech_tags}</div>
            <a href="{safe_url}"
               class="tantu-btn tantu-btn-secondary"
               target="_blank"
               rel="noopener noreferrer"
               style="display:inline-flex; align-items:center; gap:6px; text-decoration:none; font-size:0.82rem;"
               aria-label="View {safe_name} on GitHub (opens in new tab)">
              View on GitHub &#8594;
            </a>
          </div>
        </article>"""


# ── Logo assets ──────────────────────────────────────────────────────────────
# 4 interlocked rounded-square rings: TR+BL drawn first (under),
# TL+BR drawn second (over) — creates the diagonal chain-weave effect.
_RINGS = (
    '<rect x="36" y="3"  width="49" height="49" rx="12" fill="none"'
    ' stroke="currentColor" stroke-width="10"/>'
    '<rect x="3"  y="36" width="49" height="49" rx="12" fill="none"'
    ' stroke="currentColor" stroke-width="10"/>'
    '<rect x="3"  y="3"  width="49" height="49" rx="12" fill="none"'
    ' stroke="currentColor" stroke-width="10"/>'
    '<rect x="36" y="36" width="49" height="49" rx="12" fill="none"'
    ' stroke="currentColor" stroke-width="10"/>'
)

def _icon_svg(w: int, h: int, extra_attrs: str = "") -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 88"'
        f' width="{w}" height="{h}" aria-hidden="true" focusable="false"'
        f'{" " + extra_attrs if extra_attrs else ""}>'
        f'{_RINGS}</svg>'
    )

# URL-encoded SVG favicon — explicit colours, no CSS inheritance needed.
FAVICON_SVG_URI = (
    "data:image/svg+xml,"
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 88 88'>"
    "<rect width='88' height='88' rx='14' fill='%231a1a1a'/>"
    "<rect x='36' y='3'  width='49' height='49' rx='12' fill='none' stroke='%2300FFD1' stroke-width='10'/>"
    "<rect x='3'  y='36' width='49' height='49' rx='12' fill='none' stroke='%2300FFD1' stroke-width='10'/>"
    "<rect x='3'  y='3'  width='49' height='49' rx='12' fill='none' stroke='%2300FFD1' stroke-width='10'/>"
    "<rect x='36' y='36' width='49' height='49' rx='12' fill='none' stroke='%2300FFD1' stroke-width='10'/>"
    "</svg>"
)


_WORDMARK_JS = """
  /* AIWeave Geometric wordmark engine (AXIOM lineage) */
  (function() {
    const VB_TOP=-90, VB_BOT=790;
    const CY='#00FFD1', GD='#F5C518', INK='#E8EDF5';
    const f=n=>Math.round(n*10)/10;
    let OX=0, OY=0;
    const X=x=>x+OX, Y=y=>y+OY;
    function pt(cx,cy,rx,ry,d){const r=d*Math.PI/180;return [X(cx+rx*Math.sin(r)),Y(cy-ry*Math.cos(r))];}
    function arc(cx,cy,rx,ry,a0,a1,dir){
      const [x0,y0]=pt(cx,cy,rx,ry,a0),[x1,y1]=pt(cx,cy,rx,ry,a1);
      let sp=dir>0?(((a1-a0)%360)+360)%360:(((a0-a1)%360)+360)%360;
      return `M ${f(x0)} ${f(y0)} A ${f(rx)} ${f(ry)} 0 ${sp>180?1:0} ${dir>0?1:0} ${f(x1)} ${f(y1)}`;
    }
    function line(x0,y0,x1,y1){return `M ${f(X(x0))} ${f(Y(y0))} L ${f(X(x1))} ${f(Y(y1))}`;}
    function ring(cx,cy,rx,ry){return [arc(cx,cy,rx,ry,0,180,1),arc(cx,cy,rx,ry,180,360,1)];}
    const G={
      'A':()=>({w:620,p:[line(0,700,310,0),line(310,0,620,700),line(102,470,518,470)]}),
      'B':()=>({w:475,p:[line(0,0,0,700),arc(0,175,420,175,0,180,1),arc(0,525,440,175,0,180,1)]}),
      'C':()=>({w:680,p:[arc(350,350,330,330,50,130,-1)]}),
      'D':()=>({w:560,p:[line(0,0,0,700),line(0,0,300,0),arc(300,250,250,250,0,90,1),line(550,250,550,450),arc(300,450,250,250,90,180,1),line(300,700,0,700)]}),
      'E':()=>({w:520,p:[line(0,0,0,700),line(0,0,520,0),line(0,350,430,350),line(0,700,520,700)]}),
      'F':()=>({w:520,p:[line(0,0,0,700),line(0,0,520,0),line(0,350,430,350)]}),
      'G':()=>({w:680,p:[arc(350,350,330,330,50,130,-1),line(603,562,603,350),line(603,350,438,350)]}),
      'H':()=>({w:560,p:[line(0,0,0,700),line(560,0,560,700),line(0,350,560,350)]}),
      'I':()=>({w:0,p:[line(0,0,0,700)]}),
      'J':()=>({w:470,p:[line(470,0,470,470),arc(220,470,250,250,90,160,1)]}),
      'K':()=>({w:560,p:[line(0,0,0,700),line(0,372,530,0),line(0,372,560,700)]}),
      'L':()=>({w:500,p:[line(0,0,0,700),line(0,700,500,700)]}),
      'M':()=>({w:760,p:[line(0,700,0,0),line(0,0,380,480),line(380,480,760,0),line(760,0,760,700)]}),
      'N':()=>({w:580,p:[line(0,700,0,0),line(0,0,580,700),line(580,700,580,0)]}),
      'O':()=>({w:700,p:ring(350,350,350,350)}),
      'P':()=>({w:490,p:[line(0,0,0,700),line(0,0,300,0),arc(300,190,190,190,0,180,1),line(300,380,0,380)]}),
      'Q':()=>({w:700,p:[...ring(350,350,350,350),line(420,455,650,700)]}),
      'R':()=>({w:540,p:[line(0,0,0,700),line(0,0,300,0),arc(300,190,190,190,0,180,1),line(300,380,0,380),line(250,380,540,700)]}),
      'S':()=>({w:540,p:[arc(280,175,230,175,70,180,-1),arc(280,525,230,175,0,250,1)]}),
      'T':()=>({w:560,p:[line(0,0,560,0),line(280,0,280,700)]}),
      'U':()=>({w:620,p:[line(0,0,0,390),arc(310,390,310,310,270,90,-1),line(620,390,620,0)]}),
      'V':()=>({w:620,p:[line(0,0,310,700),line(310,700,620,0)]}),
      'W':()=>({w:860,p:[line(0,0,190,700),line(190,700,430,180),line(430,180,670,700),line(670,700,860,0)]}),
      'X':()=>({w:560,p:[line(0,0,560,700),line(560,0,0,700)]}),
      'Y':()=>({w:560,p:[line(0,0,280,360),line(560,0,280,360),line(280,360,280,700)]}),
      'Z':()=>({w:540,p:[line(0,0,540,0),line(540,0,0,700),line(0,700,540,700)]}),
      '0':()=>({w:540,p:ring(270,350,270,350),dots:[[270,350,0.16]]}),
      '1':()=>({w:360,p:[line(250,0,250,700),line(95,165,250,0),line(110,700,390,700)]}),
      '2':()=>({w:510,p:[arc(255,210,210,210,300,110,1),line(452,282,70,700),line(70,700,500,700)]}),
      '3':()=>({w:480,p:[arc(265,190,200,190,350,180,1),arc(265,510,200,190,0,190,1)]}),
      '4':()=>({w:560,p:[line(430,0,40,500),line(40,500,560,500),line(430,0,430,700)]}),
      '5':()=>({w:500,p:[line(70,0,500,0),line(70,0,70,330),arc(255,490,235,210,300,200,1)]}),
      '6':()=>({w:505,p:[...ring(270,495,235,205),arc(270,300,255,300,180,350,1)]}),
      '7':()=>({w:520,p:[line(40,0,520,0),line(520,0,175,700)]}),
      '8':()=>({w:485,p:[...ring(270,190,185,185),...ring(270,510,210,190)]}),
      '9':()=>({w:505,p:[...ring(270,205,235,205),arc(270,400,255,300,0,170,1)]}),
      '-':()=>({w:360,p:[line(60,360,300,360)]}),
      '.':()=>({w:90,dots:[[45,650,0.52]]}),
      '/':()=>({w:380,p:[line(40,720,340,-20)]}),
    };
    let gid=0;
    function renderGeo(str,o){
      o=o||{};
      const w=o.weight??100,sb=o.sb??52,track=o.track??0;
      let cursor=0,body='',i=0,id='wmg'+(gid++);
      const useGrad=!!o.grad&&!o.colorFn;
      for(const raw of str){
        const ch=raw.toUpperCase();
        if(ch===' '){cursor+=300+track;continue;}
        const gen=G[ch];if(!gen){cursor+=300+track;continue;}
        const ox=cursor+sb;OX=ox;OY=0;
        const g=gen();OX=0;
        const stroke=o.colorFn?o.colorFn(i,ch):(useGrad?`url(#${id})`:(o.color||INK));
        body+=(g.p||[]).map(d=>`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
        body+=(g.dots||[]).map(dd=>`<circle cx="${f(dd[0]+ox)}" cy="${f(dd[1])}" r="${f(dd[2]*w)}" fill="${stroke}"/>`).join('');
        cursor+=sb+(g.w||0)+sb+track;i++;
      }
      const width=Math.max(cursor-track,1);
      const defs=useGrad?`<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${f(width)}" y2="0"><stop offset="0" stop-color="${CY}"/><stop offset="1" stop-color="${GD}"/></linearGradient></defs>`:'';
      return `<svg class="geo-wm" xmlns="http://www.w3.org/2000/svg" viewBox="0 ${VB_TOP} ${f(width)} ${VB_BOT-VB_TOP}" role="img" aria-label="${str}" style="${o.style||''}">${defs}<g stroke-miterlimit="2.6">${body}</g></svg>`;
    }
    function inject(elId,str,o){const el=document.getElementById(elId);if(el)el.innerHTML=renderGeo(str,o);}
    function initWordmarks(){
      inject('nav-wordmark','AIWEAVE',{weight:120,grad:true,track:4,style:'height:22px;width:auto;display:block'});
      const heroEl=document.getElementById('hero-wordmark');
      if(heroEl){
        heroEl.innerHTML=renderGeo('AIWEAVE',{weight:108,grad:true,track:4,style:'width:min(840px,100%);height:auto'});
        if(!matchMedia('(prefers-reduced-motion:reduce)').matches){
          heroEl.querySelectorAll('path').forEach((p,i)=>{
            const L=p.getTotalLength();
            p.style.strokeDasharray=L;p.style.strokeDashoffset=L;p.style.transition='none';
            requestAnimationFrame(()=>requestAnimationFrame(()=>{
              p.style.transition=`stroke-dashoffset .8s cubic-bezier(.65,0,.2,1) ${0.1+i*0.016}s`;
              p.style.strokeDashoffset='0';
            }));
          });
        }
      }
    }
    document.addEventListener('DOMContentLoaded',()=>{
      initWordmarks();
      let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(initWordmarks,220);});
    });
  })();
"""

# Bento layout overrides: card name → extra CSS class
BENTO_CLASS = {
    "TrainWeave": "card-wide",
    "ToolWeave":  "card-tall",
}

# Architecture layer rows (icon, label, chips)
ARCH_LAYERS = [
    ("◎", "ORCHESTRATION",       ["TeamWeave", "TaskWeave", "Step Functions", "API Gateway"]),
    ("⊞", "RETRIEVAL &amp; RAG", ["ContextWeave", "Memgraph", "pgvector", "Neptune Analytics"]),
    ("⚙", "EXECUTION &amp; TOOLS",["ToolWeave", "TrainWeave", "FastMCP", "EC2 Spot", "Lambda"]),
    ("⊛", "SECURITY &amp; SAFETY",["CipherWeave", "mcp-observatory", "KMS", "PROPOSE/COMMIT"]),
    ("⬢", "COMPUTE &amp; DEPLOY", ["DeployWeave", "CDK", "CodePipeline", "Blue-green"]),
]

# Scrollytelling panels (terminal prompt, title, body, output line)
STORY_PANELS = [
    ("define",   "Define the Agent",
     "Declare intent in plain JSON. TeamWeave resolves the right model, tools, and routing rules automatically — no hard-coded orchestration logic.",
     "✓ agent spec validated"),
    ("route",    "Route &amp; Plan",
     "Step Functions maps the task graph. Parallel branches execute concurrently; retry policies and timeouts are infrastructure concerns, not application code.",
     "✓ execution plan emitted"),
    ("execute",  "Execute with Tools",
     "ToolWeave translates natural language into signed REST calls. Each tool invocation passes through risk scoring before any side-effect is committed.",
     "✓ 3 tools invoked, 0 errors"),
    ("observe",  "Observe Everything",
     "mcp-observatory captures every PROPOSE/COMMIT pair. Structured logs, risk scores, and latency traces flow to CloudWatch &amp; your SIEM of choice.",
     "✓ audit trail persisted"),
]


_PARTICLE_JS = """
  /* Canvas particle field */
  (function(){
    const TERMS=['Bedrock','Lambda','LoRA','RAG','MCP','Step Functions','pgvector','CDK',
                 'Neptune','DynamoDB','FastMCP','KMS','Playwright','LangGraph','EC2 Spot',
                 'S3','Athena','SageMaker','Cognito','EventBridge'];
    const canvas=document.getElementById('hero-canvas');
    if(!canvas)return;
    const ctx=canvas.getContext('2d');
    let W,H,pts=[];
    function resize(){
      W=canvas.width=canvas.offsetWidth;
      H=canvas.height=canvas.offsetHeight;
    }
    function mkPt(){
      return {
        x:Math.random()*W, y:Math.random()*H,
        vx:(Math.random()-.5)*.18, vy:(Math.random()-.5)*.12,
        alpha:Math.random()*.35+.08,
        label:TERMS[Math.floor(Math.random()*TERMS.length)],
        size:Math.random()*1.8+9
      };
    }
    function init(){resize();pts=Array.from({length:28},mkPt);}
    function draw(){
      ctx.clearRect(0,0,W,H);
      ctx.font='500 11px "JetBrains Mono",monospace';
      pts.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy;
        if(p.x<-60)p.x=W+60;
        if(p.x>W+60)p.x=-60;
        if(p.y<-20)p.y=H+20;
        if(p.y>H+20)p.y=-20;
        ctx.globalAlpha=p.alpha;
        ctx.fillStyle='#00FFD1';
        ctx.fillText(p.label,p.x,p.y);
      });
      ctx.globalAlpha=1;
      requestAnimationFrame(draw);
    }
    const mq=matchMedia('(prefers-reduced-motion:reduce)');
    if(!mq.matches){
      init();draw();
      window.addEventListener('resize',()=>{resize();});
    }
  })();
"""

_ANIM_JS = """
  /* Intersection observer – slide-in cards and layers */
  (function(){
    const io=new IntersectionObserver(entries=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          e.target.classList.add('in-view');
          io.unobserve(e.target);
        }
      });
    },{threshold:0.12});
    document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

    /* Count-up for signal bar */
    const cio=new IntersectionObserver(entries=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          e.target.querySelectorAll('[data-count]').forEach(el=>{
            const target=+el.dataset.count, dur=1400;
            let start=null;
            function step(ts){
              if(!start)start=ts;
              const p=Math.min((ts-start)/dur,1);
              const ease=1-Math.pow(1-p,3);
              el.textContent=Math.round(ease*target)+(el.dataset.suffix||'');
              if(p<1)requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
          });
          cio.unobserve(e.target);
        }
      });
    },{threshold:0.5});
    document.querySelectorAll('.signal-bar').forEach(el=>cio.observe(el));

    /* Architecture layers slide-in stagger */
    const lio=new IntersectionObserver(entries=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          e.target.querySelectorAll('.arch-row').forEach((row,i)=>{
            setTimeout(()=>row.classList.add('in-view'),i*80);
          });
          lio.unobserve(e.target);
        }
      });
    },{threshold:0.1});
    document.querySelectorAll('.arch-diagram').forEach(el=>lio.observe(el));
  })();
"""

_STORY_JS = """
  /* Scrollytelling sticky terminal */
  (function(){
    const section=document.getElementById('story');
    const panels=document.querySelectorAll('.story-panel');
    const terminal=document.getElementById('story-terminal');
    if(!section||!panels.length||!terminal)return;

    function activate(idx){
      panels.forEach((p,i)=>{
        p.classList.toggle('active',i===idx);
      });
      const panel=panels[idx];
      if(!panel)return;
      terminal.querySelector('.term-prompt').textContent='$ aiweave '+panel.dataset.cmd;
      terminal.querySelector('.term-title').textContent=panel.dataset.title||'';
      terminal.querySelector('.term-body').textContent=panel.dataset.body||'';
      const out=terminal.querySelector('.term-output');
      out.textContent='';
      setTimeout(()=>{out.textContent=panel.dataset.output||'';},400);
    }

    activate(0);

    const io=new IntersectionObserver(entries=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          const idx=+e.target.dataset.idx;
          activate(idx);
        }
      });
    },{rootMargin:'-40% 0px -40% 0px'});
    panels.forEach(p=>io.observe(p));
  })();
"""

_INIT_JS = """
  /* Nav blur on scroll + theme toggle + smooth scroll */
  (function(){
    const nav=document.querySelector('nav');
    const btn=document.getElementById('theme-toggle');
    const icon=document.getElementById('theme-icon');
    const lbl=document.getElementById('theme-label');
    const htmlEl=document.documentElement;

    /* Nav transparency */
    let ticking=false;
    window.addEventListener('scroll',()=>{
      if(!ticking){
        requestAnimationFrame(()=>{
          nav.classList.toggle('scrolled',window.scrollY>80);
          ticking=false;
        });
        ticking=true;
      }
    },{passive:true});

    /* Theme toggle */
    function applyTheme(t){
      htmlEl.setAttribute('data-theme',t);
      try{localStorage.setItem('aiweave-theme',t);}catch(e){}
      const dark=t==='dark';
      btn.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');
      btn.setAttribute('aria-pressed',dark?'false':'true');
      icon.textContent=dark?'\\u263E':'\\u2600';
      lbl.textContent=dark?'Light':'Dark';
    }
    let saved;try{saved=localStorage.getItem('aiweave-theme');}catch(e){}
    const prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches;
    applyTheme(saved||(prefersDark?'dark':'light'));
    btn.addEventListener('click',()=>applyTheme(htmlEl.getAttribute('data-theme')==='dark'?'light':'dark'));

    /* Smooth scroll */
    document.querySelectorAll('a[href^="#"]').forEach(a=>{
      a.addEventListener('click',e=>{
        const t=document.querySelector(a.getAttribute('href'));
        if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth'});t.setAttribute('tabindex','-1');t.focus({preventScroll:true});}
      });
    });

    /* Scan line animation */
    const scan=document.getElementById('hero-scan');
    if(scan&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
      let dir=1,pos=0;
      function moveScan(){
        pos+=dir*0.3;
        if(pos>100){pos=100;dir=-1;}
        if(pos<0){pos=0;dir=1;}
        scan.style.top=pos+'%';
        requestAnimationFrame(moveScan);
      }
      moveScan();
    }
  })();
"""


def _arch_layers_html() -> str:
    rows = []
    for icon, label, chips in ARCH_LAYERS:
        chips_html = "".join(f'<span class="tantu-tag tantu-tag-neutral">{c}</span>' for c in chips)
        rows.append(
            f'<div class="tantu-card tantu-relief-kanthi tantu-cell-warp-12 reveal" style="margin-bottom:12px;">'
            f'<div class="tantu-card-payload" style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">'
            f'<span style="font-size:1.3rem; color:var(--tantu-accent-highlight);" aria-hidden="true">{icon}</span>'
            f'<span style="font-family:var(--font-kasuti); font-size:0.75rem; font-weight:700; letter-spacing:0.12em; color:var(--tantu-accent-primary); min-width:180px;">{label}</span>'
            f'<div style="display:flex; flex-wrap:wrap; gap:6px;">{chips_html}</div>'
            f'</div>'
            f'</div>'
        )
    return "\n".join(rows)


def _story_panels_html() -> str:
    panels = []
    for i, (cmd, title, body, output) in enumerate(STORY_PANELS):
        safe_body = body.replace('"', '&quot;')
        safe_output = output.replace('"', '&quot;')
        safe_title = title.replace('"', '&quot;')
        panels.append(
            f'<div class="story-panel tantu-card tantu-relief-kanthi tantu-cell-warp-12" data-idx="{i}" data-cmd="{cmd}" '
            f'data-title="{safe_title}" data-body="{safe_body}" data-output="{safe_output}" style="margin-bottom:16px;">'
            f'<div class="tantu-card-payload">'
            f'<div style="font-family:var(--font-kasuti); font-size:0.75rem; color:var(--tantu-accent-highlight); font-weight:700; margin-bottom:8px;">[TALIM-STEP-0{i+1}]</div>'
            f'<h3 style="font-family:var(--font-kalam); font-size:1.25rem; color:var(--tantu-accent-primary); margin-bottom:10px;">{title}</h3>'
            f'<p style="font-size:0.88rem; color:var(--tantu-ink-primary); line-height:1.7; margin:0;">{body}</p>'
            f'</div>'
            f'</div>'
        )
    return "\n".join(panels)


def generate_html(repos_data: list, svg_content: str, icon_svg: str = "", tantu_css: str = "") -> str:
    cards_html = "\n".join(build_project_card(r, i) for i, r in enumerate(repos_data))
    build_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    build_year = datetime.now(timezone.utc).year
    icon_data_uri = (
        FAVICON_SVG_URI if not icon_svg
        else f"data:image/svg+xml;utf8,{quote(icon_svg)}"
    )
    arch_html = _arch_layers_html()
    story_html = _story_panels_html()

    return f"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  <title>AIWeave &#8212; AWS AI Infrastructure Tools Ecosystem (Tantu Design)</title>
  <meta name="description" content="AIWeave is a suite of open-source AWS-native AI infrastructure tools covering model fine-tuning, multi-agent orchestration, GraphRAG, MCP servers, visual QA, and more. Built with Tantu Design Library.">
  <link rel="canonical" href="https://aiweave.org">
  <link rel="icon" type="image/svg+xml" href="{icon_data_uri}">
  <link rel="apple-touch-icon" href="{icon_data_uri}">

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="AIWeave &#8212; AWS AI Infrastructure Tools Ecosystem">
  <meta property="og:description" content="Open-source AWS-native AI infrastructure tools: fine-tuning, multi-agent orchestration, GraphRAG, MCP servers, and visual QA. Built with Tantu Design Library.">
  <meta property="og:url" content="https://aiweave.org">
  <meta property="og:image" content="https://aiweave.org/og-image.png">
  <meta property="og:site_name" content="AIWeave">

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

  <!-- Google Fonts for IBM Plex Fallbacks -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=IBM+Plex+Serif:wght@400;600;700&display=swap" rel="stylesheet">

  <style>
/* TANTU DESIGN SYSTEM INLINED STYLESHEET */
{tantu_css}

/* CUSTOM PAGE OVERRIDES ON TANTU LOOM SUBSTRATE */
:root {{
  --tantu-bg-substrate: #12100e;
  --tantu-kora-raw: #181512;
  --tantu-kora-mud: #201c19;
  --tantu-kala-iron: #faf7f0;
  --tantu-kala-charcoal: #ece6d8;
  --tantu-madder-root: #d44d42;
  --tantu-madder-flame: #e05e53;
  --tantu-indigo-vat: #2b5377;
  --tantu-indigo-sky: #4c7ba6;
  --tantu-zari-pure-gold: #d8b26e;
}}

body {{
  background-color: var(--tantu-bg-substrate);
  color: var(--tantu-ink-primary);
  font-family: var(--font-talim);
}}

/* Loom Selvedge Structure */
.tantu-loom {{
  display: grid;
  width: 100%;
  min-height: 100vh;
  grid-template-columns: var(--tantu-knot-8) 1fr var(--tantu-knot-8);
  background-color: var(--tantu-bg-substrate);
}}

.tantu-loom-selvedge-left,
.tantu-loom-selvedge-right {{
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 12px,
    var(--tantu-grid-thread) 12px,
    var(--tantu-grid-thread) 13px
  );
  opacity: 0.25;
}}

.tantu-loom-content {{
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--tantu-knot-4);
  padding: var(--tantu-knot-6) 0;
}}

@media (max-width: 768px) {{
  .tantu-loom {{
    grid-template-columns: 12px 1fr 12px;
  }}
  .tantu-loom-content {{
    grid-template-columns: 1fr;
  }}
  [class*="tantu-cell-warp-"] {{
    grid-column: span 12 / span 12 !important;
  }}
}}

/* Navbar */
nav.tantu-nav {{
  grid-column: span 12;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px var(--tantu-knot-4);
  border-bottom: var(--tantu-gauge-filament) solid var(--tantu-border-embroidery);
  background: var(--tantu-kora-raw);
  margin-bottom: var(--tantu-knot-6);
}}

.nav-brand {{
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: var(--tantu-accent-primary);
  font-weight: 700;
  font-family: var(--font-kasuti);
}}

.nav-links {{
  display: flex;
  gap: 12px;
  list-style: none;
  margin: 0;
  padding: 0;
}}

/* Hero Section */
.hero-warp {{
  grid-column: span 12;
  text-align: center;
  padding: var(--tantu-knot-8) var(--tantu-knot-4);
  margin-bottom: var(--tantu-knot-6);
}}

.hero-title {{
  font-family: var(--font-kalam);
  font-size: clamp(2.5rem, 6vw, 4.5rem);
  color: var(--tantu-accent-primary);
  margin: 0 0 var(--tantu-knot-3);
  letter-spacing: -0.02em;
}}

.hero-sub {{
  font-family: var(--font-kasuti);
  color: var(--tantu-zari-pure-gold);
  font-size: var(--text-lg);
  margin-bottom: var(--tantu-knot-4);
}}

/* Signal Bar */
.signal-warp {{
  grid-column: span 12;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--tantu-knot-4);
  margin-bottom: var(--tantu-knot-8);
}}

.signal-cell {{
  text-align: center;
  padding: var(--tantu-knot-4);
}}

.signal-num {{
  font-family: var(--font-kasuti);
  font-size: 2.2rem;
  font-weight: 700;
  color: var(--tantu-accent-primary);
  display: block;
}}

/* Section Headings */
.section-title-warp {{
  grid-column: span 12;
  border-bottom: var(--tantu-gauge-filament) dashed var(--tantu-grid-thread);
  padding-bottom: 8px;
  margin-bottom: var(--tantu-knot-6);
}}

.section-title-text {{
  font-family: var(--font-kalam);
  font-size: 1.8rem;
  color: var(--tantu-accent-primary);
  margin: 0;
}}

/* Footer */
footer.tantu-footer {{
  grid-column: span 12;
  text-align: center;
  padding: var(--tantu-knot-8) 0;
  border-top: var(--tantu-gauge-filament) solid var(--tantu-border-embroidery);
  font-size: 0.82rem;
  color: var(--tantu-ink-secondary);
  margin-top: var(--tantu-knot-8);
}}
  </style>
</head>
<body>

  <div class="tantu-loom">
    <div class="tantu-loom-selvedge-left" aria-hidden="true"></div>

    <main id="main" class="tantu-loom-content">

      <!-- NAVIGATION -->
      <nav class="tantu-nav" aria-label="Main navigation">
        <a href="/" class="nav-brand">
          {_icon_svg(28,28)}
          <span>AIWEAVE</span>
        </a>
        <ul class="nav-links">
          <li><a href="#projects" class="tantu-btn tantu-btn-ghost" style="text-decoration:none;">Projects</a></li>
          <li><a href="#architecture" class="tantu-btn tantu-btn-ghost" style="text-decoration:none;">Architecture</a></li>
          <li><a href="#story" class="tantu-btn tantu-btn-ghost" style="text-decoration:none;">Process</a></li>
          <li>
            <a href="https://github.com/{GH_OWNER}"
               class="tantu-btn tantu-btn-primary"
               target="_blank"
               rel="noopener noreferrer"
               style="text-decoration:none;">
              GitHub &#8594;
            </a>
          </li>
        </ul>
      </nav>

      <!-- HERO -->
      <section class="hero-warp tantu-card tantu-relief-zardozi tantu-cell-warp-12">
        <span class="tantu-card-talim" aria-hidden="true">[TALIM-HERO-01]</span>
        <div class="tantu-card-payload">
          <div class="tantu-tag tantu-tag-accent" style="margin-bottom:16px;">TANTU DESIGN SYSTEM V2.0</div>
          <h1 class="hero-title">AIWeave Infrastructure</h1>
          <p class="hero-sub">[ BUILD &middot; FINE-TUNE &middot; ORCHESTRATE &middot; DEPLOY ]</p>
          <p style="max-width:680px; margin:0 auto 28px; font-size:0.95rem; color:var(--tantu-ink-secondary); line-height:1.8;">
            Production-ready AWS-native AI infrastructure engineered with deterministic tapestry standards.
            Model fine-tuning, multi-agent orchestration, GraphRAG, MCP servers, and visual QA.
          </p>
          <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
            <a href="#projects" class="tantu-btn tantu-btn-primary" style="text-decoration:none;">Explore Projects</a>
            <a href="https://github.com/{GH_OWNER}" class="tantu-btn tantu-btn-secondary" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">GitHub Repositories</a>
          </div>
        </div>
      </section>

      <!-- SIGNAL BAR -->
      <div class="signal-warp tantu-card tantu-relief-kanthi tantu-cell-warp-12">
        <div class="tantu-card-payload" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; text-align:center;">
          <div class="signal-cell">
            <span class="signal-num">10</span>
            <span style="font-family:var(--font-kasuti); font-size:0.75rem; color:var(--tantu-ink-secondary);">OPEN SOURCE TOOLS</span>
          </div>
          <div class="signal-cell">
            <span class="signal-num">8+</span>
            <span style="font-family:var(--font-kasuti); font-size:0.75rem; color:var(--tantu-ink-secondary);">AWS SERVICES INTEGRATED</span>
          </div>
          <div class="signal-cell">
            <span class="signal-num">~52%</span>
            <span style="font-family:var(--font-kasuti); font-size:0.75rem; color:var(--tantu-ink-secondary);">COST SAVINGS VS SAGEMAKER</span>
          </div>
        </div>
      </div>

      <!-- PROJECTS -->
      <div id="projects" class="section-title-warp">
        <h2 class="section-title-text">[01] The Weave Ecosystem</h2>
      </div>

      {cards_html}

      <!-- ARCHITECTURE -->
      <div id="architecture" class="section-title-warp" style="margin-top:var(--tantu-knot-8);">
        <h2 class="section-title-text">[02] Architecture Stack</h2>
      </div>

      {arch_html}

      <!-- PROCESS / STORY -->
      <div id="story" class="section-title-warp" style="margin-top:var(--tantu-knot-8);">
        <h2 class="section-title-text">[03] Developer Experience & Execution</h2>
      </div>

      {story_html}

      <!-- ABOUT -->
      <div id="about" class="section-title-warp" style="margin-top:var(--tantu-knot-8);">
        <h2 class="section-title-text">[04] About AIWeave</h2>
      </div>

      <article class="tantu-card tantu-relief-zardozi tantu-cell-warp-12">
        <span class="tantu-card-talim" aria-hidden="true">[TALIM-ABOUT-01]</span>
        <div class="tantu-card-payload">
          <p style="font-size:0.95rem; color:var(--tantu-ink-primary); line-height:1.8; margin-bottom:16px;">
            <strong>AIWeave</strong> is an ecosystem of open-source, AWS-native AI infrastructure tools built for engineers who need production-grade AI systems without proprietary lock-in.
          </p>
          <p style="font-size:0.95rem; color:var(--tantu-ink-secondary); line-height:1.8; margin-bottom:16px;">
            Every library is composed on AWS primitives: Lambda, Bedrock, Step Functions, DynamoDB, EC2 Spot, API Gateway, S3, and Neptune. Redesigned using the <strong>Tantu UI Design Library</strong> (Tapestry Engine V2.0).
          </p>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            <span class="tantu-tag tantu-tag-accent">Python</span>
            <span class="tantu-tag tantu-tag-neutral">AWS Bedrock</span>
            <span class="tantu-tag tantu-tag-neutral">Lambda</span>
            <span class="tantu-tag tantu-tag-neutral">Step Functions</span>
            <span class="tantu-tag tantu-tag-neutral">EC2 Spot</span>
            <span class="tantu-tag tantu-tag-neutral">Tantu Design System</span>
            <span class="tantu-tag tantu-tag-zari">Apache 2.0</span>
          </div>
        </div>
      </article>

      <!-- FOOTER -->
      <footer class="tantu-footer">
        <p>
          &copy; {build_year} AIWeave &middot; Designed with Tantu Design Library &middot; Apache 2.0 License
        </p>
      </footer>

    </main>

    <div class="tantu-loom-selvedge-right" aria-hidden="true"></div>
  </div>

</body>
</html>
"""


def load_svg_asset(filename: str, fallback: str) -> str:
    """Load an SVG file and strip any XML declaration; return fallback if missing."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), filename)
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        return re.sub(r"<\\?xml[^?]*\\?>", "", content).strip()
    except FileNotFoundError:
        print(f"[WARN] {filename} not found, using fallback")
        return fallback

def load_text_asset(filename: str, fallback: str = "") -> str:
    """Load a text asset file; return fallback if missing."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), filename)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        print(f"[WARN] {filename} not found, using fallback")
        return fallback

def main():
    token = os.environ.get("GH_TOKEN", "")
    if not token:
        print("[WARN] GH_TOKEN not set — API calls unauthenticated (60 req/hr limit)")

    bedrock_client = None
    if _HAS_BOTO3:
        try:
            bedrock_client = boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)
            print(f"[INFO] Bedrock client ready (model: {BEDROCK_MODEL_ID})")
        except Exception as e:
            print(f"[WARN] Bedrock client init failed: {e} — falling back to regex summaries")
    else:
        print("[WARN] boto3 not installed — using regex summaries")

    svg_content = load_svg_asset(
        "background.svg",
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"></svg>',
    )
    icon_svg = load_svg_asset(
        "assets/aiweave-icon.svg",
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#00d9ff"/></svg>',
    )

    print("[INFO] Discovering *Weave repos from GitHub...")
    weave_repos = discover_weave_repos(token)
    print(f"       Found: {weave_repos}")
    repo_list = build_repo_list(weave_repos)
    print(f"[INFO] Build order ({len(repo_list)} projects): {repo_list}")

    repos_data = []
    for repo_name in repo_list:
        print(f"[INFO] Fetching {repo_name}...")
        data = fetch_repo(repo_name, token)
        meta = _get_meta(repo_name)

        summary = (
            summarize_with_bedrock(data["readme_text"], repo_name, bedrock_client)
            or extract_summary(data["readme_text"])
            or html.escape(data["description"])
        )

        data["meta"] = meta
        data["summary"] = summary
        repos_data.append(data)
        src = "bedrock" if bedrock_client and data["readme_text"] else "regex/fallback"
        print(f"       stars={data['stars']}  summary_src={src}  summary_len={len(summary)}")

    tantu_css = load_text_asset("assets/tantu.css", "")
    html_content = generate_html(repos_data, svg_content, icon_svg, tantu_css)
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.html")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"[OK] Generated index.html ({len(html_content):,} bytes) — {len(repos_data)} projects")


if __name__ == "__main__":
    main()
