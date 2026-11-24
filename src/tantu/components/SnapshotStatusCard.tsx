import { useId, type HTMLAttributes } from "react";

import { TantuCard } from "./TantuCard.js";
import { TantuTag, type TantuTagTone } from "./TantuTag.js";

export type SnapshotComponentKind =
  | "sqlite_db"
  | "encrypted_blob"
  | "json_bundle"
  | "wapp_manifest"
  | "lora_adapter"
  | "config";

export interface NodeSnapshotComponent {
  name: string;
  kind: SnapshotComponentKind;
  relative_path: string;
  sha256: string;
  size_bytes: number;
  encrypted: boolean;
}

export interface NodeSnapshotSignature {
  alg: "Ed25519" | "ES256";
  kid: string;
  value: string;
  signed_at: string;
}

export interface NodeSnapshotV1 {
  /** Canonical contract identifier (`node-snapshot-v1`). */
  schema?: string;
  /** Unique snapshot identifier. */
  snapshot_id: string;
  /** Originating edge node identifier. */
  node_id: string;
  /** RFC 3339 creation timestamp. */
  created_at: string;
  /** Optional WeaveOS or module version. */
  weave_version?: string;
  /** Snapshotted components with SHA-256 digests and sizes. */
  components: NodeSnapshotComponent[];
  /** Canonical SHA-256 hex digest covering `components`. */
  checksum_sha256: string;
  /** Optional CipherWeave cryptographic signature. */
  signature?: NodeSnapshotSignature;
}

export interface SnapshotStatusCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Canonical `node-snapshot-v1` manifest payload. */
  snapshot: NodeSnapshotV1;
  /** Optional verification verdict (`true` verified, `false` failed, `undefined` unverified). */
  verified?: boolean;
  /** Card heading. */
  title?: string;
  /** Optional accessible label for the region landmark. */
  ariaLabel?: string;
}

/** Formats byte counts into compact human-readable units. */
export function formatSnapshotBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KiB`;
  const mib = kib / 1024;
  if (mib < 1024) return `${mib.toFixed(2)} MiB`;
  return `${(mib / 1024).toFixed(2)} GiB`;
}

/** Truncates a 64-char SHA-256 hex digest for compact display. */
export function truncateSha256(hex: string): string {
  if (!hex || hex.length <= 16) return hex;
  return `${hex.slice(0, 8)}...${hex.slice(-8)}`;
}

/**
 * Displays a canonical `node-snapshot-v1` manifest with component summary,
 * truncated SHA-256 fingerprint, encryption/signature badges, and verification status.
 */
export function SnapshotStatusCard({
  snapshot,
  verified,
  title = "Node Snapshot",
  ariaLabel,
  className,
  style,
  ...rest
}: SnapshotStatusCardProps) {
  const headingId = useId();
  const totalBytes = snapshot.components.reduce(
    (sum, comp) => sum + (Number.isFinite(comp.size_bytes) ? comp.size_bytes : 0),
    0,
  );
  const encryptedCount = snapshot.components.filter((c) => c.encrypted).length;
  const allEncrypted = snapshot.components.length > 0 && encryptedCount === snapshot.components.length;
  const isSigned = Boolean(snapshot.signature);

  let verifyLabel = "Unverified";
  let verifyTone: TantuTagTone = "neutral";
  let verifySolid = false;
  if (verified === true) {
    verifyLabel = "Verified";
    verifyTone = "success";
    verifySolid = true;
  } else if (verified === false) {
    verifyLabel = "Verification Failed";
    verifyTone = "accent";
    verifySolid = true;
  }

  return (
    <section
      role="region"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : headingId}
      data-schema-version={snapshot.schema ?? "node-snapshot-v1"}
      data-snapshot-verified={verified === undefined ? "unknown" : String(verified)}
      className={className}
      style={style}
      {...rest}
    >
      <TantuCard>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            marginBottom: "0.875rem",
          }}
        >
          <div>
            <h2
              id={headingId}
              style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}
            >
              {title}
            </h2>
            <p
              data-testid="snapshot-id"
              style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", opacity: 0.85 }}
            >
              <code>{snapshot.snapshot_id}</code> · Node <strong>{snapshot.node_id}</strong>
            </p>
          </div>
          <span
            data-testid="snapshot-verification-badge"
            role={verified === false ? "alert" : "status"}
            aria-label={`Snapshot verification: ${verifyLabel}`}
          >
            <TantuTag tone={verifyTone} solid={verifySolid}>
              {verifyLabel}
            </TantuTag>
          </span>
        </div>

        <div
          data-testid="snapshot-security-badges"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          <span data-testid="snapshot-signature-badge">
            <TantuTag tone={isSigned ? "success" : "neutral"}>
              {isSigned && snapshot.signature
                ? `Signed (${snapshot.signature.alg})`
                : "Unsigned"}
            </TantuTag>
          </span>
          <span data-testid="snapshot-encryption-badge">
            <TantuTag tone={encryptedCount > 0 ? "success" : "neutral"}>
              {allEncrypted
                ? "Encrypted"
                : encryptedCount > 0
                  ? `${encryptedCount}/${snapshot.components.length} Encrypted`
                  : "Unencrypted"}
            </TantuTag>
          </span>
        </div>

        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "0.75rem",
            margin: 0,
          }}
        >
          <div data-testid="snapshot-components-summary">
            <dt style={{ fontSize: "0.75rem", opacity: 0.75 }}>Components</dt>
            <dd style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>
              {snapshot.components.length} ({formatSnapshotBytes(totalBytes)})
            </dd>
          </div>
          <div data-testid="snapshot-fingerprint">
            <dt style={{ fontSize: "0.75rem", opacity: 0.75 }}>SHA-256 Checksum</dt>
            <dd style={{ margin: 0, fontSize: "0.875rem" }}>
              <code title={snapshot.checksum_sha256}>
                {truncateSha256(snapshot.checksum_sha256)}
              </code>
            </dd>
          </div>
          <div data-testid="snapshot-created-at">
            <dt style={{ fontSize: "0.75rem", opacity: 0.75 }}>Created</dt>
            <dd style={{ margin: 0, fontSize: "0.875rem" }}>{snapshot.created_at}</dd>
          </div>
        </dl>
      </TantuCard>
    </section>
  );
}
