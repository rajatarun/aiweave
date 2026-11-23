"""Verify generate_site.jsx REPO_META stays synchronized with weave/ecosystem.json."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GENERATE_SITE = ROOT / "generate_site.jsx"
ECOSYSTEM_JSON = ROOT.parent / "weave" / "ecosystem.json"

CANONICAL_REPOS: frozenset[str] = frozenset(
    {
        "ChaosWeave",
        "CipherWeave",
        "ContextWeave",
        "DeployWeave",
        "DeviceWeave",
        "GatewayWeave",
        "HarnessWeave",
        "IntentWeave",
        "ModelWeave",
        "PromptWeave",
        "RoutineWeave",
        "ScreenWeave",
        "TeamWeave",
        "ToolWeave",
        "TrainWeave",
        "WeaveCore",
        "WeaveOS",
        "aiweave",
        "mcp-observatory",
        "weave",
    }
)


def _extract_repo_meta_keys(source: str) -> set[str]:
    """Parse top-level object keys inside ``const REPO_META = { ... };``."""
    start_match = re.search(r"const\s+REPO_META\s*=\s*\{", source)
    assert start_match is not None, "Could not locate `const REPO_META = {` in generate_site.jsx"

    brace_depth = 0
    block_start = start_match.end() - 1
    block_end = -1
    for idx in range(block_start, len(source)):
        ch = source[idx]
        if ch == "{":
            brace_depth += 1
        elif ch == "}":
            brace_depth -= 1
            if brace_depth == 0:
                block_end = idx
                break
    assert block_end > block_start, "Unbalanced braces while parsing REPO_META"

    # Collect keys at depth 1 (direct children of REPO_META)
    keys: set[str] = set()
    body = source[block_start + 1 : block_end]
    depth = 0
    for line in body.splitlines():
        if depth == 0:
            key_match = re.match(r"""^\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_-]+))\s*:\s*\{""", line)
            if key_match:
                key = next(g for g in key_match.groups() if g is not None)
                keys.add(key)
        depth += line.count("{") - line.count("}")
    return keys


def _load_expected_repos() -> set[str]:
    if ECOSYSTEM_JSON.is_file():
        data = json.loads(ECOSYSTEM_JSON.read_text(encoding="utf-8"))
        repos = data.get("repositories", [])
        names = {str(entry["name"]) for entry in repos if isinstance(entry, dict) and "name" in entry}
        assert len(names) == 20, f"Expected 20 repos in {ECOSYSTEM_JSON}, found {len(names)}"
        return names
    return set(CANONICAL_REPOS)


def test_repo_meta_covers_all_20_ecosystem_repositories() -> None:
    expected = _load_expected_repos()
    assert len(expected) == 20

    source = GENERATE_SITE.read_text(encoding="utf-8")
    repo_meta_keys = _extract_repo_meta_keys(source)

    missing = sorted(expected - repo_meta_keys)
    assert not missing, (
        f"generate_site.jsx REPO_META is missing {len(missing)} canonical Weave "
        f"ecosystem repositories: {missing}"
    )


def test_canonical_fallback_list_matches_ecosystem_json_when_present() -> None:
    if not ECOSYSTEM_JSON.is_file():
        return
    data = json.loads(ECOSYSTEM_JSON.read_text(encoding="utf-8"))
    live_names = {entry["name"] for entry in data["repositories"]}
    assert live_names == set(CANONICAL_REPOS)
