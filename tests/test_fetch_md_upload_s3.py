"""Unit tests for fetch_md_upload_s3.py."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import fetch_md_upload_s3 as harvester


class _FakeS3:
    def __init__(self, *, fail_keys: set[str] | None = None) -> None:
        self.uploads: dict[str, dict[str, object]] = {}
        self.fail_keys = fail_keys or set()

    def put_object(self, **kwargs: object) -> None:
        key = str(kwargs["Key"])
        if key in self.fail_keys:
            raise RuntimeError(f"simulated S3 error for {key}")
        self.uploads[key] = dict(kwargs)


def test_discover_weave_repos_filters_archived_excluded_and_paginates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pages = [
        {
            "data": {
                "user": {
                    "repositories": {
                        "pageInfo": {"hasNextPage": True, "endCursor": "cursor-1"},
                        "nodes": [
                            {"name": "aiweave", "isArchived": False},
                            {"name": "weave", "isArchived": False},
                            {"name": "WeaveCore", "isArchived": False},
                            {"name": "OldWeave", "isArchived": True},
                            {"name": "HarnessWeave", "isArchived": False},
                            {"name": "not-a-match", "isArchived": False},
                        ],
                    }
                }
            }
        },
        {
            "data": {
                "user": {
                    "repositories": {
                        "pageInfo": {"hasNextPage": False, "endCursor": None},
                        "nodes": [
                            {"name": "PromptWeave", "isArchived": False},
                            {"name": "TrainWeave", "isArchived": False},
                        ],
                    }
                }
            }
        },
    ]
    calls: list[dict] = []

    def fake_graphql(_query: str, variables: dict, _token: str) -> dict:
        calls.append(dict(variables))
        return pages[len(calls) - 1]

    monkeypatch.setattr(harvester, "_gh_graphql", fake_graphql)

    repos = harvester.discover_weave_repos("fake-token")
    assert repos == ["HarnessWeave", "PromptWeave", "TrainWeave"]
    assert calls[0]["after"] is None
    assert calls[1]["after"] == "cursor-1"


def test_discover_weave_repos_handles_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(*_args: object, **_kwargs: object) -> dict:
        raise OSError("network down")

    monkeypatch.setattr(harvester, "_gh_graphql", boom)
    assert harvester.discover_weave_repos("token") == []


def test_build_repo_list_preserves_preferred_order_and_appends_new() -> None:
    ordered = harvester.build_repo_list(["ZetaWeave", "TrainWeave", "AlphaWeave", "HarnessWeave"])
    assert ordered[:3] == ["WeaveOS", "HarnessWeave", "TrainWeave"]
    assert "mcp-observatory" in ordered
    assert ordered[-2:] == ["AlphaWeave", "ZetaWeave"]


def test_list_md_files_filters_blobs_and_handles_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_rest(_path: str, _token: str, params: dict | None = None) -> dict:
        assert params == {"recursive": "1"}
        return {
            "truncated": False,
            "tree": [
                {"path": "README.md", "type": "blob"},
                {"path": "docs/README.md", "type": "blob"},
                {"path": "docs/GUIDE.MD", "type": "blob"},
                {"path": "docs", "type": "tree"},
                {"path": "src/app.py", "type": "blob"},
            ],
        }

    monkeypatch.setattr(harvester, "_gh_rest_get", fake_rest)
    assert harvester.list_md_files("TrainWeave", "tok") == [
        "README.md",
        "docs/README.md",
        "docs/GUIDE.MD",
    ]

    def fail_rest(*_args: object, **_kwargs: object) -> dict:
        raise OSError("503")

    monkeypatch.setattr(harvester, "_gh_rest_get", fail_rest)
    assert harvester.list_md_files("TrainWeave", "tok") == []


def test_upload_to_s3_success_and_error() -> None:
    s3 = _FakeS3(fail_keys={"raw/TrainWeave/broken.md"})
    assert harvester.upload_to_s3(s3, "my-bucket", "raw/TrainWeave/README.md", "# Hi") is True
    assert s3.uploads["raw/TrainWeave/README.md"]["Bucket"] == "my-bucket"
    assert s3.uploads["raw/TrainWeave/README.md"]["Body"] == b"# Hi"

    assert harvester.upload_to_s3(s3, "my-bucket", "raw/TrainWeave/broken.md", "# Fail") is False


def test_main_preserves_relative_paths_without_collision(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_s3 = _FakeS3()
    monkeypatch.setenv("RAG_BUCKET", "weave-rag-test")
    monkeypatch.setenv("GH_TOKEN", "test-token")
    monkeypatch.setattr(harvester.boto3, "client", MagicMock(return_value=fake_s3))
    monkeypatch.setattr(harvester, "discover_weave_repos", lambda _t: ["TrainWeave"])
    monkeypatch.setattr(harvester, "build_repo_list", lambda _d: ["TrainWeave"])
    monkeypatch.setattr(
        harvester,
        "list_md_files",
        lambda _repo, _tok: ["README.md", "docs/README.md", "/nested/arch/SPEC.md"],
    )
    monkeypatch.setattr(
        harvester,
        "fetch_raw_content",
        lambda repo, path, _tok: f"# {repo}:{path}",
    )

    harvester.main()

    assert set(fake_s3.uploads.keys()) == {
        "raw/TrainWeave/README.md",
        "raw/TrainWeave/docs/README.md",
        "raw/TrainWeave/nested/arch/SPEC.md",
    }
    assert fake_s3.uploads["raw/TrainWeave/README.md"]["Body"] == b"# TrainWeave:README.md"
    assert (
        fake_s3.uploads["raw/TrainWeave/docs/README.md"]["Body"]
        == b"# TrainWeave:docs/README.md"
    )


def test_main_exits_nonzero_when_bucket_missing_or_fetch_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("RAG_BUCKET", raising=False)
    with pytest.raises(SystemExit, match="RAG_BUCKET is not set"):
        harvester.main()

    fake_s3 = _FakeS3()
    monkeypatch.setenv("RAG_BUCKET", "weave-rag-test")
    monkeypatch.setattr(harvester.boto3, "client", MagicMock(return_value=fake_s3))
    monkeypatch.setattr(harvester, "discover_weave_repos", lambda _t: ["TrainWeave"])
    monkeypatch.setattr(harvester, "build_repo_list", lambda _d: ["TrainWeave"])
    monkeypatch.setattr(harvester, "list_md_files", lambda _r, _t: ["README.md"])
    monkeypatch.setattr(harvester, "fetch_raw_content", lambda _r, _p, _t: None)

    with pytest.raises(SystemExit) as exc_info:
        harvester.main()
    assert exc_info.value.code == 1
