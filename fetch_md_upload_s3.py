#!/usr/bin/env python3
"""Fetches all .md files from every project repo via the GitHub GraphQL + REST
APIs and uploads them flat to S3: raw/<projectname>/<basename>.md
"""

import os
import requests
import boto3

GH_OWNER = "rajatarun"
GH_GRAPHQL_URL = "https://api.github.com/graphql"
GH_API_URL = "https://api.github.com"
RAG_BUCKET = "contextweave-rag-artifacts-239571291755-prod"

PINNED_REPOS = ["DataDictionary", "mcp-observatory"]
EXCLUDED_REPOS = {"aiweave"}

PREFERRED_ORDER = [
    "TrainWeave", "TeamWeave", "TaskWeave", "ToolWeave", "ContextWeave",
    "ScreenWeave", "DeployWeave", "CipherWeave", "mcp-observatory", "DataDictionary",
]

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


def _gh_graphql(query: str, variables: dict, token: str) -> dict:
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


def _gh_rest_get(path: str, token: str, params: dict = None) -> dict:
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = requests.get(
        f"{GH_API_URL}/{path.lstrip('/')}",
        headers=headers,
        params=params,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def discover_weave_repos(token: str) -> list:
    """Return all public non-archived repo names ending with 'weave'."""
    found = []
    cursor = None
    while True:
        try:
            data = _gh_graphql(LIST_REPOS_QUERY, {"owner": GH_OWNER, "after": cursor}, token)
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
    all_repos = set(discovered_weave) | set(PINNED_REPOS)
    ordered = [r for r in PREFERRED_ORDER if r in all_repos]
    new_ones = sorted(r for r in all_repos if r not in PREFERRED_ORDER)
    return ordered + new_ones


def list_md_files(repo_name: str, token: str) -> list:
    """Return all .md file paths in repo using recursive git tree via REST API."""
    try:
        tree_data = _gh_rest_get(
            f"repos/{GH_OWNER}/{repo_name}/git/trees/HEAD",
            token,
            params={"recursive": "1"},
        )
        if tree_data.get("truncated"):
            print(f"[WARN] Tree response truncated for {repo_name} — some files may be missed")
        return [
            item["path"]
            for item in tree_data.get("tree", [])
            if item["type"] == "blob" and item["path"].lower().endswith(".md")
        ]
    except Exception as e:
        print(f"[WARN] Failed to list files for {repo_name}: {e}")
        return []


def fetch_raw_content(repo_name: str, file_path: str, token: str) -> str | None:
    """Fetch raw file content from GitHub."""
    url = f"https://raw.githubusercontent.com/{GH_OWNER}/{repo_name}/HEAD/{file_path}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        print(f"[WARN] Failed to fetch {repo_name}/{file_path}: {e}")
        return None


def upload_to_s3(s3, bucket: str, key: str, content: str) -> bool:
    try:
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=content.encode("utf-8"),
            ContentType="text/markdown; charset=utf-8",
        )
        return True
    except Exception as e:
        print(f"[WARN] S3 upload failed for {key}: {e}")
        return False


def main():
    token = os.environ.get("GH_TOKEN", "")
    if not token:
        print("[WARN] GH_TOKEN not set — unauthenticated API calls (60 req/hr limit)")

    s3 = boto3.client("s3", region_name="us-east-1")

    print("[INFO] Discovering repos via GitHub GraphQL...")
    weave_repos = discover_weave_repos(token)
    repo_list = build_repo_list(weave_repos)
    print(f"[INFO] {len(repo_list)} repos to process: {repo_list}")

    total_uploaded = 0
    total_failed = 0

    for repo_name in repo_list:
        print(f"[INFO] {repo_name}: scanning for .md files...")
        md_paths = list_md_files(repo_name, token)

        if not md_paths:
            print(f"       No .md files found")
            continue

        print(f"       {len(md_paths)} .md file(s): {md_paths}")

        for file_path in md_paths:
            content = fetch_raw_content(repo_name, file_path, token)
            if content is None:
                total_failed += 1
                continue

            # Flatten path — strip all directory prefixes, keep only the filename
            basename = os.path.basename(file_path)
            s3_key = f"raw/{repo_name}/{basename}"

            if upload_to_s3(s3, RAG_BUCKET, s3_key, content):
                print(f"       -> s3://{RAG_BUCKET}/{s3_key} ({len(content):,} bytes)")
                total_uploaded += 1
            else:
                total_failed += 1

    print(f"[OK] Done — uploaded: {total_uploaded}, failed: {total_failed}")
    if total_failed > 0:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
