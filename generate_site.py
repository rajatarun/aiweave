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
        f'<span class="tech-tag">{t}</span>' for t in meta["tech"]
    )
    stars = repo_data["stars"]
    star_html = (
        f'<span class="star-count" aria-label="{stars} GitHub stars">&#9733; {stars}</span>'
        if stars
        else ""
    )
    card_id = f"project-{name.lower().replace('-', '_').replace(' ', '_')}"
    safe_name = html.escape(name)
    safe_url = html.escape(repo_data["url"])
    safe_tagline = html.escape(meta["tagline"])
    extra_class = BENTO_CLASS.get(name, "")
    delay = f"transition-delay:{index * 60}ms"

    return f"""
        <article class="project-card reveal{' ' + extra_class if extra_class else ''}"
                 id="{card_id}" aria-labelledby="title-{index}" role="listitem"
                 style="{delay}">
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
        chips_html = "".join(f'<span class="arch-chip">{c}</span>' for c in chips)
        rows.append(
            f'<div class="arch-row reveal">'
            f'<span class="arch-icon" aria-hidden="true">{icon}</span>'
            f'<span class="arch-label">{label}</span>'
            f'<div class="arch-chips">{chips_html}</div>'
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
            f'<div class="story-panel" data-idx="{i}" data-cmd="{cmd}" '
            f'data-title="{safe_title}" data-body="{safe_body}" data-output="{safe_output}">'
            f'<div class="story-step-num">0{i+1}</div>'
            f'<h3 class="story-step-title">{title}</h3>'
            f'<p class="story-step-body">{body}</p>'
            f'</div>'
        )
    return "\n".join(panels)


def generate_html(repos_data: list, svg_content: str, icon_svg: str = "") -> str:
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
  <title>AIWeave &#8212; AWS AI Infrastructure Tools Ecosystem</title>
  <meta name="description" content="AIWeave is a suite of open-source AWS-native AI infrastructure tools covering model fine-tuning, multi-agent orchestration, GraphRAG, MCP servers, visual QA, and more.">
  <link rel="canonical" href="https://aiweave.org">
  <link rel="icon" type="image/svg+xml" href="{icon_data_uri}">
  <link rel="apple-touch-icon" href="{icon_data_uri}">

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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">

  <style>
    /* Tokens */
    :root {{
      --font-display: 'Space Grotesk', system-ui, sans-serif;
      --font-body:    'Inter', system-ui, -apple-system, sans-serif;
      --font-mono:    'JetBrains Mono', ui-monospace, monospace;
      --text-xs:   0.625rem;
      --text-sm:   0.75rem;
      --text-base: 1rem;
      --text-lg:   1.125rem;
      --text-xl:   1.375rem;
      --text-2xl:  clamp(1.5rem, 2.5vw, 2rem);
      --text-3xl:  clamp(2rem, 4vw, 3rem);
      --text-hero: clamp(3rem, 8vw, 6rem);
    }}
    :root, [data-theme="dark"] {{
      --bg-void:       #080B10;
      --bg-surface:    #0E1219;
      --bg-elevated:   #141A24;
      --border-subtle: #1E2A3A;
      --border-glow:   rgba(0,255,209,0.35);
      --accent-cyan:   #00FFD1;
      --accent-gold:   #F5C518;
      --accent-dim:    rgba(0,255,209,0.08);
      --text-primary:  #E8EDF5;
      --text-secondary:#8A9BB8;
      --text-muted:    #4A5568;
      --text-code:     #00FFD1;
      --nav-bg:        rgba(8,11,16,0.88);
      --card-shadow:   0 4px 32px rgba(0,0,0,0.55);
      --glow-cyan:     0 0 32px rgba(0,255,209,0.18);
    }}
    [data-theme="light"] {{
      --bg-void:       #F5F7FA;
      --bg-surface:    #FFFFFF;
      --bg-elevated:   #EEF2F8;
      --border-subtle: #D1DCF0;
      --border-glow:   rgba(0,119,204,0.4);
      --accent-cyan:   #0077CC;
      --accent-gold:   #B8860B;
      --accent-dim:    rgba(0,119,204,0.08);
      --text-primary:  #0E1219;
      --text-secondary:#4A5568;
      --text-muted:    #9AA3B0;
      --text-code:     #0077CC;
      --nav-bg:        rgba(245,247,250,0.9);
      --card-shadow:   0 4px 24px rgba(0,0,0,0.08);
      --glow-cyan:     0 0 24px rgba(0,119,204,0.12);
    }}

    /* Background SVG */
    .bg-container {{ opacity: 0.45; }}
    [data-theme="light"] .bg-container {{ opacity: 0.25; }}
    [data-theme="dark"]  .arch-element {{ stroke: rgba(255,255,255,0.12); fill: none; stroke-linecap: round; }}
    [data-theme="dark"]  .arch-text    {{ fill: rgba(255,255,255,0.12); }}
    [data-theme="light"] .arch-element {{ stroke: rgba(40,60,120,0.14); fill: none; stroke-linecap: round; }}
    [data-theme="light"] .arch-text    {{ fill: rgba(40,60,120,0.14); }}

    /* Reset */
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    html {{ scroll-behavior: smooth; font-size: 16px; }}
    body {{
      font-family: var(--font-body);
      background: var(--bg-void);
      color: var(--text-primary);
      min-height: 100vh;
      line-height: 1.65;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
      transition: background 0.3s, color 0.3s;
    }}
    h1,h2,h3,h4 {{
      font-family: var(--font-display);
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -.02em;
    }}
    code,pre,kbd {{ font-family: var(--font-mono); font-size: .9em; }}

    /* Accessibility */
    .sr-only {{
      position:absolute; width:1px; height:1px;
      padding:0; margin:-1px; overflow:hidden;
      clip:rect(0,0,0,0); white-space:nowrap; border:0;
    }}
    .skip-link {{
      position:absolute; top:-120px; left:16px; z-index:9999;
      background:var(--accent-cyan); color:#000; padding:10px 20px;
      border-radius:6px; font-weight:700; text-decoration:none;
      transition:top 0.2s; font-family:var(--font-body);
    }}
    .skip-link:focus {{ top:16px; outline:3px solid var(--accent-gold); outline-offset:2px; }}
    :focus-visible {{ outline:3px solid var(--accent-cyan); outline-offset:3px; border-radius:4px; }}

    /* Fixed BG */
    .bg-container {{
      position:fixed; inset:0; z-index:0;
      pointer-events:none; overflow:hidden;
    }}
    .bg-container svg {{ width:100%; height:100%; }}

    /* Nav */
    nav {{
      position:fixed; top:0; left:0; right:0; z-index:200;
      background:transparent;
      border-bottom:1px solid transparent;
      height:64px;
      display:flex; align-items:center;
      padding:0 clamp(16px,4vw,56px); gap:8px;
      transition:background 0.3s, border-color 0.3s;
    }}
    nav.scrolled {{
      background:var(--nav-bg);
      border-color:var(--border-subtle);
      backdrop-filter:blur(16px);
      -webkit-backdrop-filter:blur(16px);
    }}
    .nav-logo {{
      display:inline-flex; align-items:center; gap:12px;
      text-decoration:none; margin-right:auto;
      white-space:nowrap; flex-shrink:0;
    }}
    .nav-logo > svg {{ flex-shrink:0; color:var(--accent-cyan); }}
    .nav-wm {{ display:inline-flex; align-items:center; }}
    .nav-wm .geo-wm {{ height:22px; width:auto; display:block; }}
    .nav-links {{
      display:flex; align-items:center; gap:4px; list-style:none;
    }}
    .nav-links a {{
      color:var(--text-secondary); text-decoration:none;
      padding:7px 13px; border-radius:7px;
      font-size:0.875rem; font-weight:500; letter-spacing:0.02em;
      transition:color 0.2s, background 0.2s; white-space:nowrap;
    }}
    .nav-links a:hover {{ color:var(--accent-cyan); background:var(--accent-dim); }}
    .theme-toggle {{
      background:transparent; border:1px solid var(--border-subtle);
      color:var(--text-secondary); padding:6px 13px; border-radius:20px;
      cursor:pointer; font-size:0.8rem; font-family:var(--font-body);
      transition:border-color 0.2s, color 0.2s;
      display:inline-flex; align-items:center; gap:5px; white-space:nowrap;
    }}
    .theme-toggle:hover {{ border-color:var(--accent-cyan); color:var(--accent-cyan); }}
    .github-btn {{
      background:var(--accent-cyan); color:#000; font-weight:700;
      font-family:var(--font-body); font-size:0.82rem;
      padding:8px 16px; border-radius:8px; text-decoration:none;
      display:inline-flex; align-items:center; gap:6px;
      transition:opacity 0.2s, transform 0.15s; white-space:nowrap;
    }}
    .github-btn:hover {{ opacity:0.85; transform:translateY(-1px); }}
    @media (max-width:640px) {{ .nav-home,.nav-about {{ display:none; }} }}

    /* Main */
    main {{ position:relative; z-index:10; padding-top:64px; }}

    /* HERO */
    #home {{
      min-height:100vh;
      display:flex; flex-direction:column;
      justify-content:center; align-items:center;
      text-align:center;
      padding:clamp(60px,10vw,140px) clamp(16px,4vw,48px) 80px;
      position:relative; overflow:hidden;
    }}
    #hero-canvas {{
      position:absolute; inset:0; width:100%; height:100%;
      pointer-events:none; z-index:0;
    }}
    .hero-inner {{ position:relative; z-index:1; width:100%; max-width:1100px; margin:0 auto; }}
    .hero-eyebrow {{
      font-family:var(--font-mono); font-size:var(--text-xs);
      letter-spacing:.22em; text-transform:uppercase;
      color:var(--accent-cyan); margin-bottom:20px; font-weight:400;
    }}
    .hero-heading {{
      display:flex; flex-direction:column; align-items:center;
      gap:0; margin-bottom:16px;
      filter:drop-shadow(0 0 36px rgba(0,255,209,0.18));
      position:relative;
    }}
    .hero-wm {{ display:flex; justify-content:center; }}
    .hero-wm .geo-wm {{ width:min(840px,92vw); height:auto; display:block; }}
    .hero-scan {{
      position:absolute; left:0; right:0; top:0;
      height:1px; background:linear-gradient(90deg,transparent,var(--accent-cyan),transparent);
      opacity:0.45; pointer-events:none;
    }}
    .hero-subtitle {{
      font-family:var(--font-mono); font-size:clamp(0.68rem,1.3vw,0.82rem);
      font-weight:400; color:var(--text-secondary);
      letter-spacing:0.2em; text-transform:uppercase; margin-bottom:24px;
    }}
    .hero-description {{
      max-width:600px; font-size:clamp(0.93rem,1.5vw,1.04rem);
      color:var(--text-secondary); margin:0 auto 44px; line-height:1.9;
    }}
    .hero-ctas {{
      display:flex; gap:14px; flex-wrap:wrap; justify-content:center;
    }}
    .btn-primary {{
      background:var(--accent-cyan); color:#000; border:none;
      padding:14px 34px; border-radius:8px;
      font-family:var(--font-body); font-size:0.95rem; font-weight:700;
      text-decoration:none; cursor:pointer;
      transition:transform 0.15s, box-shadow 0.2s;
      box-shadow:var(--glow-cyan);
    }}
    .btn-primary:hover {{ transform:translateY(-2px); box-shadow:0 0 48px rgba(0,255,209,0.35); }}
    .btn-outline {{
      background:transparent; color:var(--accent-cyan);
      border:1px solid var(--accent-cyan);
      padding:13px 32px; border-radius:8px;
      font-family:var(--font-body); font-size:0.95rem; font-weight:600;
      text-decoration:none; transition:background 0.2s, color 0.2s;
    }}
    .btn-outline:hover {{ background:var(--accent-cyan); color:#000; }}
    .scroll-indicator {{
      position:absolute; bottom:28px; left:50%; transform:translateX(-50%);
      display:flex; flex-direction:column; align-items:center; gap:6px;
    }}
    .scroll-line {{
      width:1px; height:44px;
      background:linear-gradient(to bottom,var(--accent-cyan),transparent);
      animation:pulse-line 2.4s ease-in-out infinite;
    }}
    .scroll-label {{
      font-size:0.62rem; letter-spacing:0.22em;
      text-transform:uppercase; color:var(--text-muted);
    }}
    @keyframes pulse-line {{
      0%,100% {{ opacity:0.2; }}
      50%      {{ opacity:0.9; }}
    }}

    /* SIGNAL BAR */
    .signal-bar {{
      position:relative; z-index:10;
      background:var(--bg-surface);
      border-top:1px solid var(--border-subtle);
      border-bottom:1px solid var(--border-subtle);
      padding:28px clamp(16px,4vw,56px);
      display:grid; grid-template-columns:repeat(3,1fr); gap:0;
    }}
    .signal-stat {{
      text-align:center; padding:12px;
      border-right:1px solid var(--border-subtle);
    }}
    .signal-stat:last-child {{ border-right:none; }}
    .signal-stat-num {{
      font-family:var(--font-display); font-size:var(--text-3xl);
      font-weight:700; color:var(--accent-cyan); line-height:1;
      display:block; margin-bottom:6px;
    }}
    .signal-stat-label {{
      font-size:var(--text-xs); text-transform:uppercase;
      letter-spacing:.18em; color:var(--text-muted); font-weight:500;
    }}

    /* SECTION SHARED */
    .section-wrap {{
      padding:clamp(72px,9vw,128px) clamp(16px,4vw,56px);
    }}
    .section-header {{ text-align:center; margin-bottom:clamp(40px,6vw,80px); }}
    .section-eyebrow {{
      font-family:var(--font-mono); font-size:var(--text-xs);
      letter-spacing:.3em; text-transform:uppercase;
      color:var(--text-muted); margin-bottom:12px; font-weight:500;
      display:inline-flex; align-items:center; gap:12px;
    }}
    .section-eyebrow::before {{
      content:""; width:24px; height:1px;
      background:var(--accent-cyan); opacity:.7; flex-shrink:0;
    }}
    .section-title {{
      font-family:var(--font-display);
      font-size:clamp(1.8rem,4vw,2.8rem);
      font-weight:700; color:var(--text-primary); line-height:1.15;
    }}
    .section-title span {{ color:var(--accent-cyan); }}

    /* PROJECTS BENTO */
    .projects-grid {{
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));
      gap:clamp(14px,2vw,24px);
      max-width:1320px; margin:0 auto;
    }}
    .project-card {{
      background:var(--bg-surface);
      border:1px solid var(--border-subtle);
      border-radius:14px;
      padding:clamp(20px,2.8vw,30px);
      box-shadow:var(--card-shadow);
      display:flex; flex-direction:column; gap:14px;
      opacity:0; transform:translateY(18px);
      transition:transform 0.22s ease, box-shadow 0.22s ease,
                 border-color 0.22s ease, opacity 0.55s ease;
    }}
    .project-card.in-view {{ opacity:1; transform:translateY(0); }}
    .project-card:hover {{
      transform:translateY(-4px);
      box-shadow:0 12px 44px rgba(0,255,209,0.12),var(--card-shadow);
      border-color:var(--border-glow);
    }}
    .project-card.in-view:hover {{ transform:translateY(-4px); }}
    @media (min-width:900px) {{
      .card-wide {{ grid-column:span 2; }}
      .card-tall {{ grid-row:span 2; }}
    }}
    .card-header {{ display:flex; align-items:flex-start; gap:12px; }}
    .card-icon {{ font-size:1.75rem; line-height:1; flex-shrink:0; margin-top:2px; }}
    .card-title-group {{ flex:1; min-width:0; }}
    .card-title {{
      font-family:var(--font-display); font-size:1rem; font-weight:700;
      color:var(--accent-cyan); margin:0 0 3px;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }}
    .card-tagline {{ font-size:0.72rem; color:var(--text-muted); line-height:1.5; }}
    .star-count {{
      flex-shrink:0; font-size:0.75rem; color:var(--text-muted);
      margin-left:auto; padding-left:8px; white-space:nowrap;
    }}
    .card-summary {{
      font-size:0.875rem; color:var(--text-secondary);
      line-height:1.8; flex:1; font-weight:400;
    }}
    .tech-tags {{ display:flex; flex-wrap:wrap; gap:5px; }}
    .tech-tag {{
      background:var(--accent-dim); color:var(--accent-cyan);
      border:1px solid var(--border-subtle);
      padding:3px 8px; border-radius:20px;
      font-size:0.67rem; font-weight:600; letter-spacing:0.04em; white-space:nowrap;
    }}
    .card-link {{
      align-self:flex-start; color:var(--accent-cyan); text-decoration:none;
      font-size:0.82rem; font-weight:600; padding:8px 14px;
      border:1px solid var(--border-subtle); border-radius:7px;
      transition:background 0.2s, border-color 0.2s;
      display:inline-flex; align-items:center; gap:4px;
    }}
    .card-link:hover {{ background:var(--accent-dim); border-color:var(--border-glow); }}

    /* ARCHITECTURE */
    .arch-diagram {{
      max-width:960px; margin:0 auto;
      display:flex; flex-direction:column; gap:10px;
    }}
    .arch-row {{
      display:flex; align-items:center; gap:16px;
      background:var(--bg-elevated); border:1px solid var(--border-subtle);
      border-radius:10px; padding:14px 20px;
      opacity:0; transform:translateX(-20px);
      transition:transform 0.4s ease, opacity 0.4s ease, border-color 0.3s;
    }}
    .arch-row.in-view {{ opacity:1; transform:translateX(0); }}
    .arch-row:hover {{ border-color:var(--border-glow); }}
    .arch-icon {{
      font-size:1.1rem; color:var(--accent-cyan);
      flex-shrink:0; width:28px; text-align:center;
    }}
    .arch-label {{
      font-family:var(--font-mono); font-size:var(--text-xs);
      font-weight:500; color:var(--text-secondary);
      letter-spacing:.16em; text-transform:uppercase;
      flex-shrink:0; min-width:200px;
    }}
    .arch-chips {{ display:flex; flex-wrap:wrap; gap:6px; }}
    .arch-chip {{
      background:var(--bg-surface); color:var(--text-secondary);
      border:1px solid var(--border-subtle);
      padding:3px 10px; border-radius:20px;
      font-size:var(--text-xs); font-weight:500; white-space:nowrap;
    }}
    @media (max-width:600px) {{
      .arch-label {{ min-width:110px; font-size:0.55rem; }}
      .arch-chip {{ font-size:0.6rem; }}
    }}

    /* SCROLLYTELLING */
    .story-outer {{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:0 clamp(24px,4vw,64px);
      max-width:1060px; margin:0 auto;
    }}
    @media (max-width:768px) {{
      .story-outer {{ grid-template-columns:1fr; }}
      .story-terminal-col {{ display:none; }}
    }}
    .story-panels-col {{ display:flex; flex-direction:column; }}
    .story-panel {{
      padding:clamp(28px,4vw,52px) 0;
      border-bottom:1px solid var(--border-subtle);
      opacity:0.38; transition:opacity 0.35s;
    }}
    .story-panel:last-child {{ border-bottom:none; }}
    .story-panel.active {{ opacity:1; }}
    .story-step-num {{
      font-family:var(--font-mono); font-size:var(--text-xs);
      color:var(--accent-cyan); font-weight:700;
      letter-spacing:.2em; margin-bottom:10px;
    }}
    .story-step-title {{
      font-family:var(--font-display); font-size:var(--text-2xl);
      font-weight:700; color:var(--text-primary); margin-bottom:14px;
    }}
    .story-step-body {{ font-size:0.92rem; color:var(--text-secondary); line-height:1.85; }}
    .story-terminal-col {{
      position:sticky; top:calc(50vh - 160px);
      height:320px; align-self:start;
    }}
    .story-terminal {{
      background:rgba(14,18,25,0.88);
      border:1px solid var(--border-subtle);
      border-radius:12px; padding:22px;
      font-family:var(--font-mono); font-size:0.78rem;
      backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
      height:100%; overflow:hidden;
    }}
    [data-theme="light"] .story-terminal {{
      background:rgba(255,255,255,0.9);
      border-color:var(--border-subtle);
    }}
    .term-bar {{
      display:flex; gap:6px; margin-bottom:16px; align-items:center;
    }}
    .term-dot {{ width:10px; height:10px; border-radius:50%; }}
    .term-dot:nth-child(1) {{ background:#FF5F57; }}
    .term-dot:nth-child(2) {{ background:#FEBC2E; }}
    .term-dot:nth-child(3) {{ background:#28C840; }}
    .term-prompt {{
      color:var(--accent-cyan); margin-bottom:10px;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }}
    .term-title {{
      color:var(--accent-gold); margin-bottom:8px;
      font-weight:700; font-size:var(--text-xs); letter-spacing:.1em;
    }}
    .term-body {{
      color:var(--text-secondary); line-height:1.75;
      font-size:0.75rem; margin-bottom:12px;
    }}
    .term-output {{
      color:var(--accent-cyan); font-size:var(--text-xs);
      opacity:0; transition:opacity 0.4s;
    }}
    .term-output:not(:empty) {{ opacity:1; }}

    /* ABOUT */
    #about .section-wrap {{ max-width:860px; margin:0 auto; }}
    .about-card {{
      background:var(--bg-surface);
      border:1px solid var(--border-subtle);
      border-radius:18px; padding:clamp(32px,5vw,56px);
      box-shadow:var(--card-shadow);
    }}
    .about-card p {{
      font-size:clamp(0.92rem,1.4vw,1.02rem); color:var(--text-secondary);
      line-height:1.9; margin-bottom:18px; font-weight:400;
    }}
    .about-card strong {{ color:var(--text-primary); font-weight:600; }}
    .tech-pills {{ display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; }}
    .tech-pill {{
      background:var(--bg-elevated); color:var(--text-secondary);
      border:1px solid var(--border-subtle);
      padding:4px 12px; border-radius:20px;
      font-family:var(--font-mono); font-size:var(--text-xs);
      font-weight:500; white-space:nowrap;
    }}

    /* FOOTER */
    footer {{
      position:relative; z-index:10; text-align:center;
      padding:24px clamp(16px,4vw,56px);
      border-top:1px solid var(--border-subtle);
      font-size:0.8rem; color:var(--text-muted);
    }}
    footer a {{ color:var(--text-secondary); text-decoration:none; transition:color 0.2s; }}
    footer a:hover {{ color:var(--accent-cyan); }}

    /* Reveal */
    .reveal {{
      opacity:0; transform:translateY(18px);
      transition:opacity 0.55s ease, transform 0.55s ease;
    }}
    .reveal.in-view {{ opacity:1; transform:none; }}

    /* Reduced motion */
    @media (prefers-reduced-motion:reduce) {{
      *,*::before,*::after {{
        animation-duration:0.001ms !important;
        transition-duration:0.001ms !important;
        scroll-behavior:auto !important;
      }}
      .reveal,.project-card,.arch-row {{ opacity:1 !important; transform:none !important; }}
    }}

    /* High contrast */
    @media (forced-colors:active) {{
      .project-card,.about-card {{ border:2px solid ButtonText; }}
      .btn-primary,.github-btn {{ forced-color-adjust:none; }}
    }}
  </style>
</head>
<body>

  <a href="#main" class="skip-link">Skip to main content</a>

  <nav aria-label="Main navigation">
    <a href="/" class="nav-logo" aria-label="AIWeave home">{_icon_svg(30,30)}<span id="nav-wordmark" class="nav-wm"></span></a>
    <ul class="nav-links" role="list">
      <li><a href="#home" class="nav-home" aria-label="Home">Home</a></li>
      <li><a href="#projects" aria-label="Projects">Projects</a></li>
      <li><a href="#story" aria-label="How it works">How it works</a></li>
      <li><a href="#about" class="nav-about" aria-label="About">About</a></li>
      <li>
        <button class="theme-toggle" id="theme-toggle"
                aria-label="Switch to light mode" aria-pressed="false">
          <span id="theme-icon" aria-hidden="true">&#9790;</span>
          <span id="theme-label">Light</span>
        </button>
      </li>
      <li>
        <a href="https://github.com/{GH_OWNER}" class="github-btn"
           target="_blank" rel="noopener noreferrer"
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

    <!-- HERO -->
    <section id="home" aria-labelledby="hero-title">
      <canvas id="hero-canvas" aria-hidden="true"></canvas>
      <div class="hero-inner">
        <p class="hero-eyebrow">Open-Source AWS AI Infrastructure</p>
        <div class="hero-heading">
          <h1 id="hero-title" class="sr-only">AIWeave</h1>
          <div id="hero-wordmark" class="hero-wm" aria-hidden="true"></div>
          <div id="hero-scan" class="hero-scan" aria-hidden="true"></div>
        </div>
        <p class="hero-subtitle">Build &middot; Fine-tune &middot; Orchestrate &middot; Deploy</p>
        <p class="hero-description">
          Production-ready AWS-native AI infrastructure: model fine-tuning, multi-agent
          orchestration, GraphRAG, MCP servers, visual QA, and observability &mdash;
          engineered to ship AI systems faster.
        </p>
        <div class="hero-ctas">
          <a href="#projects" class="btn-primary"
             aria-label="Explore all AIWeave projects">Explore Projects</a>
          <a href="https://github.com/{GH_OWNER}" class="btn-outline"
             target="_blank" rel="noopener noreferrer"
             aria-label="View all repositories on GitHub (opens in new tab)">View on GitHub</a>
        </div>
      </div>
      <div class="scroll-indicator" aria-hidden="true">
        <div class="scroll-line"></div>
        <span class="scroll-label">Scroll</span>
      </div>
    </section>

    <!-- SIGNAL BAR -->
    <div class="signal-bar" aria-label="Project statistics">
      <div class="signal-stat">
        <span class="signal-stat-num" data-count="10" data-suffix="">10</span>
        <span class="signal-stat-label">Open-source tools</span>
      </div>
      <div class="signal-stat">
        <span class="signal-stat-num" data-count="8" data-suffix="+">8+</span>
        <span class="signal-stat-label">AWS services integrated</span>
      </div>
      <div class="signal-stat">
        <span class="signal-stat-num" data-count="52" data-suffix="%">52%</span>
        <span class="signal-stat-label">Cost savings vs SageMaker</span>
      </div>
    </div>

    <!-- PROJECTS -->
    <section id="projects" aria-labelledby="projects-title" class="section-wrap">
      <div class="section-header">
        <p class="section-eyebrow">Open Source Tooling</p>
        <h2 id="projects-title" class="section-title">The <span>Weave</span> Ecosystem</h2>
      </div>
      <div class="projects-grid" role="list" aria-label="AIWeave projects">
{cards_html}
      </div>
    </section>

    <!-- ARCHITECTURE -->
    <section id="architecture" aria-labelledby="arch-title"
             style="background:var(--bg-surface);border-top:1px solid var(--border-subtle);border-bottom:1px solid var(--border-subtle);">
      <div class="section-wrap">
        <div class="section-header">
          <p class="section-eyebrow">System Design</p>
          <h2 id="arch-title" class="section-title">The <span>Architecture</span> Stack</h2>
        </div>
        <div class="arch-diagram">
{arch_html}
        </div>
      </div>
    </section>

    <!-- SCROLLYTELLING -->
    <section id="story" aria-labelledby="story-title" class="section-wrap">
      <div class="section-header">
        <p class="section-eyebrow">Developer Experience</p>
        <h2 id="story-title" class="section-title">From <span>Intent</span> to Execution</h2>
      </div>
      <div class="story-outer">
        <div class="story-panels-col">
{story_html}
        </div>
        <div class="story-terminal-col" aria-hidden="true">
          <div id="story-terminal" class="story-terminal">
            <div class="term-bar">
              <div class="term-dot"></div>
              <div class="term-dot"></div>
              <div class="term-dot"></div>
            </div>
            <div class="term-prompt">$ aiweave define</div>
            <div class="term-title">Define the Agent</div>
            <div class="term-body">Declare intent in plain JSON. TeamWeave resolves the right model, tools, and routing rules automatically.</div>
            <div class="term-output"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- ABOUT -->
    <section id="about" aria-labelledby="about-title"
             style="background:var(--bg-surface);border-top:1px solid var(--border-subtle);">
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
          <div class="tech-pills" aria-label="Core technologies">
            <span class="tech-pill">Python</span>
            <span class="tech-pill">AWS Bedrock</span>
            <span class="tech-pill">Lambda</span>
            <span class="tech-pill">Step Functions</span>
            <span class="tech-pill">EC2 Spot</span>
            <span class="tech-pill">DynamoDB</span>
            <span class="tech-pill">FastMCP</span>
            <span class="tech-pill">Apache 2.0</span>
          </div>
        </div>
      </div>
    </section>

  </main>

  <footer>
    <p>
      {_icon_svg(14,14,'style="vertical-align:middle;color:var(--accent-cyan)"')}
      &copy; {build_year} AIWeave &middot;
      <a href="https://github.com/{GH_OWNER}" target="_blank" rel="noopener noreferrer"
         aria-label="GitHub profile (opens in new tab)">GitHub</a>
      &middot;
      <a href="https://aiweave.org" aria-label="AIWeave homepage">aiweave.org</a>
      &middot; Apache 2.0 License
    </p>
  </footer>

  <script>
{_WORDMARK_JS}
{_PARTICLE_JS}
{_ANIM_JS}
{_STORY_JS}
{_INIT_JS}
  </script>

</body>
</html>
"""




def load_svg_asset(filename: str, fallback: str) -> str:
    """Load an SVG file and strip any XML declaration; return fallback if missing."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), filename)
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        return re.sub(r"<\?xml[^?]*\?>", "", content).strip()
    except FileNotFoundError:
        print(f"[WARN] {filename} not found, using fallback")
        return fallback

def main():
    token = os.environ.get("GH_TOKEN", "")
    if not token:
        print("[WARN] GH_TOKEN not set — API calls unauthenticated (60 req/hr limit)")

    # Initialise Bedrock client when boto3 and AWS credentials are available
    bedrock_client = None
    if _HAS_BOTO3:
        try:
            bedrock_client = boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)
            print(f"[INFO] Bedrock client ready (model: {BEDROCK_MODEL_ID})")
        except Exception as e:
            print(f"[WARN] Bedrock client init failed: {e} — falling back to regex summaries")
    else:
        print("[WARN] boto3 not installed — using regex summaries")

    # Load SVG assets (inlined in generated HTML so deployments only need index.html)
    svg_content = load_svg_asset(
        "background.svg",
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"></svg>',
    )
    icon_svg = load_svg_asset(
        "assets/aiweave-icon.svg",
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#00d9ff"/></svg>',
    )

    # Discover all public *Weave repos, merge with pinned list
    print("[INFO] Discovering *Weave repos from GitHub...")
    weave_repos = discover_weave_repos(token)
    print(f"       Found: {weave_repos}")
    repo_list = build_repo_list(weave_repos)
    print(f"[INFO] Build order ({len(repo_list)} projects): {repo_list}")

    # Fetch + summarise each repo
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

    html_content = generate_html(repos_data, svg_content, icon_svg)
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.html")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"[OK] Generated index.html ({len(html_content):,} bytes) — {len(repos_data)} projects")


if __name__ == "__main__":
    main()
