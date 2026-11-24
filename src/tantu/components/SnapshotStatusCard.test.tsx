import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  SnapshotStatusCard,
  formatSnapshotBytes,
  truncateSha256,
  type NodeSnapshotV1,
} from "../index.js";

const SAMPLE_SNAPSHOT: NodeSnapshotV1 = {
  schema: "node-snapshot-v1",
  snapshot_id: "snap-20261124-001",
  node_id: "pi5-living-room",
  created_at: "2026-11-24T12:00:00Z",
  weave_version: "0.1.0",
  components: [
    {
      name: "weaveos_db",
      kind: "sqlite_db",
      relative_path: "dbs/weaveos_state.db",
      sha256: "a".repeat(64),
      size_bytes: 2048,
      encrypted: false,
    },
    {
      name: "context_corpus",
      kind: "encrypted_blob",
      relative_path: "memory.enc",
      sha256: "b".repeat(64),
      size_bytes: 4096,
      encrypted: true,
    },
  ],
  checksum_sha256: "0123456789abcdef".repeat(4),
  signature: {
    alg: "ES256",
    kid: "key-pi5-01",
    value: "c2lnbmF0dXJl",
    signed_at: "2026-11-24T12:00:01Z",
  },
};

describe("SnapshotStatusCard", () => {
  it("renders a verified signed snapshot with component summary, fingerprint, and zero axe violations", async () => {
    const { container } = render(
      <SnapshotStatusCard
        snapshot={SAMPLE_SNAPSHOT}
        verified={true}
        title="Latest Edge Backup"
      />,
    );

    const region = screen.getByRole("region", { name: "Latest Edge Backup" });
    expect(region).toHaveAttribute("data-schema-version", "node-snapshot-v1");
    expect(region).toHaveAttribute("data-snapshot-verified", "true");

    const badge = screen.getByTestId("snapshot-verification-badge");
    expect(badge).toHaveAttribute("role", "status");
    expect(badge).toHaveTextContent("Verified");

    expect(screen.getByTestId("snapshot-id")).toHaveTextContent("snap-20261124-001");
    expect(screen.getByTestId("snapshot-id")).toHaveTextContent("pi5-living-room");
    expect(screen.getByTestId("snapshot-signature-badge")).toHaveTextContent("Signed (ES256)");
    expect(screen.getByTestId("snapshot-encryption-badge")).toHaveTextContent("1/2 Encrypted");
    expect(screen.getByTestId("snapshot-components-summary")).toHaveTextContent("2 (6.0 KiB)");
    expect(screen.getByTestId("snapshot-fingerprint")).toHaveTextContent("01234567...89abcdef");

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it("renders verification failure with alert role and unsigned/unencrypted states", async () => {
    const unsigned: NodeSnapshotV1 = {
      ...SAMPLE_SNAPSHOT,
      signature: undefined,
      components: [{ ...SAMPLE_SNAPSHOT.components[0], encrypted: false }],
    };

    const { container } = render(<SnapshotStatusCard snapshot={unsigned} verified={false} />);

    const badge = screen.getByTestId("snapshot-verification-badge");
    expect(badge).toHaveAttribute("role", "alert");
    expect(badge).toHaveTextContent("Verification Failed");
    expect(screen.getByTestId("snapshot-signature-badge")).toHaveTextContent("Unsigned");
    expect(screen.getByTestId("snapshot-encryption-badge")).toHaveTextContent("Unencrypted");

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it("formats bytes and truncates SHA-256 digests accurately", () => {
    expect(formatSnapshotBytes(512)).toBe("512 B");
    expect(formatSnapshotBytes(1024)).toBe("1.0 KiB");
    expect(formatSnapshotBytes(1024 * 1024)).toBe("1.00 MiB");
    expect(truncateSha256("0123456789abcdef".repeat(4))).toBe("01234567...89abcdef");
    expect(truncateSha256("short")).toBe("short");
  });
});
