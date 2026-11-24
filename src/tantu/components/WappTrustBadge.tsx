import { useId, type HTMLAttributes } from "react";

import { TantuCard } from "./TantuCard.js";
import { TantuTag, type TantuTagTone } from "./TantuTag.js";

export type WappSignatureStatus = "verified" | "unverified" | "invalid";
export type WappTrustVerdict = "trusted" | "caution" | "unverified" | "untrusted" | "revoked";

export interface WappChaosCertification {
  /** Whether the bundle passed ChaosWeave certification (`chaos-cert-v1`). */
  certified: boolean;
  /** Observed resilience score in `[0, 1]` (e.g. `0.92` = `92%`). */
  score: number;
  /** Optional ChaosWeave profile name (e.g. `edge_pi`, `tool_flaky`). */
  profile?: string;
}

export interface WappTrustBadgeProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Canonical `wapp-manifest-v1` application identifier (e.g. `com.weave.daily-brief`). */
  appId: string;
  /** Optional human-readable app display name. Defaults to `appId`. */
  name?: string;
  /** Optional semantic version string (e.g. `1.2.0`). */
  version?: string;
  /** Ed25519 passport signature verification outcome. */
  signatureStatus: WappSignatureStatus;
  /** Whether the bundle's passport has been revoked via `RevocationList`. */
  revoked?: boolean;
  /** Optional revocation rationale shown in the warning banner when `revoked` is `true`. */
  revocationReason?: string;
  /** Optional `chaos-cert-v1` resilience certification result. */
  chaosCertification?: WappChaosCertification;
  /** Declared `wapp-manifest-v1` permission scopes (e.g. `network:lan`, `memory:read`). */
  permissions?: string[];
  /** Optional Ed25519 signer key identifier or fingerprint. */
  signerKeyId?: string;
  /** Optional accessible label for the `role="region"` container. */
  ariaLabel?: string;
}

interface StatusMeta {
  label: string;
  accessibleLabel: string;
  tone: TantuTagTone;
  solid: boolean;
}

const SIGNATURE_META: Record<WappSignatureStatus, StatusMeta> = {
  verified: {
    label: "ED25519 VERIFIED",
    accessibleLabel: "Ed25519 signature verified",
    tone: "success",
    solid: false,
  },
  unverified: {
    label: "ED25519 UNVERIFIED",
    accessibleLabel: "Ed25519 signature unverified",
    tone: "caution",
    solid: false,
  },
  invalid: {
    label: "ED25519 INVALID",
    accessibleLabel: "Ed25519 signature invalid",
    tone: "accent",
    solid: true,
  },
};

const VERDICT_META: Record<WappTrustVerdict, StatusMeta> = {
  trusted: {
    label: "TRUSTED",
    accessibleLabel: "Bundle trust status: trusted",
    tone: "success",
    solid: true,
  },
  caution: {
    label: "SIGNED · UNCERTIFIED",
    accessibleLabel: "Bundle trust status: signed but not chaos certified",
    tone: "caution",
    solid: false,
  },
  unverified: {
    label: "UNVERIFIED",
    accessibleLabel: "Bundle trust status: unverified signature",
    tone: "caution",
    solid: false,
  },
  untrusted: {
    label: "UNTRUSTED",
    accessibleLabel: "Bundle trust status: untrusted invalid signature",
    tone: "accent",
    solid: true,
  },
  revoked: {
    label: "REVOKED",
    accessibleLabel: "Bundle trust status: revoked",
    tone: "accent",
    solid: true,
  },
};

function clampScore(score: number): number {
  if (!Number.isFinite(score) || score < 0) return 0;
  if (score > 1) return 1;
  return score;
}

export function formatChaosScorePercent(score: number): string {
  return `${Math.round(clampScore(score) * 100)}%`;
}

export function deriveWappTrustVerdict(
  signatureStatus: WappSignatureStatus,
  revoked: boolean,
  chaosCertification?: WappChaosCertification,
): WappTrustVerdict {
  if (revoked) return "revoked";
  if (signatureStatus === "invalid") return "untrusted";
  if (signatureStatus === "unverified") return "unverified";
  if (chaosCertification && !chaosCertification.certified) return "caution";
  return "trusted";
}

/**
 * Accessible SystemUI trust badge rendering `wapp-manifest-v1` bundle posture.
 *
 * Displays Ed25519 signature verification status, Chaos Certification
 * (`chaos-cert-v1`) score pill, revoked/unverified warning states, and
 * declared permission tags with explicit ARIA status labels.
 */
export function WappTrustBadge({
  appId,
  name,
  version,
  signatureStatus,
  revoked = false,
  revocationReason,
  chaosCertification,
  permissions = [],
  signerKeyId,
  ariaLabel,
  className,
  "aria-label": ariaLabelProp,
  ...rest
}: WappTrustBadgeProps) {
  const headingId = useId();
  const displayName = name ?? appId;
  const verdict = deriveWappTrustVerdict(signatureStatus, revoked, chaosCertification);
  const verdictMeta = VERDICT_META[verdict];
  const signatureMeta = SIGNATURE_META[signatureStatus];
  const regionLabel = ariaLabelProp ?? ariaLabel ?? `Wapp trust status for ${displayName}`;

  const chaosPercent = chaosCertification ? formatChaosScorePercent(chaosCertification.score) : null;
  const chaosTone: TantuTagTone = !chaosCertification
    ? "neutral"
    : chaosCertification.certified
      ? "success"
      : "accent";
  const chaosLabel = !chaosCertification
    ? "CHAOS N/A"
    : chaosCertification.certified
      ? `CHAOS ${chaosPercent}`
      : `CHAOS ${chaosPercent} (FAIL)`;
  const chaosAccessibleLabel = !chaosCertification
    ? "Chaos certification not provided"
    : chaosCertification.certified
      ? `Chaos certification passed with score ${chaosPercent}${chaosCertification.profile ? ` on profile ${chaosCertification.profile}` : ""}`
      : `Chaos certification failed with score ${chaosPercent}${chaosCertification.profile ? ` on profile ${chaosCertification.profile}` : ""}`;

  return (
    <TantuCard
      {...rest}
      role="region"
      aria-label={regionLabel}
      talimCode="WAPP-TRUST"
      data-trust-verdict={verdict}
      data-signature-status={signatureStatus}
      data-revoked={String(revoked)}
      className={["tantu-wapp-trust-badge", className].filter(Boolean).join(" ")}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            flexWrap: "wrap",
            borderBottom: "1px solid var(--tantu-border-hairline, #d4d0c8)",
            paddingBottom: "0.55rem",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
            <h3 id={headingId} style={{ margin: 0, fontSize: "1rem" }}>
              {displayName}
              {version ? (
                <span
                  style={{
                    marginLeft: "0.45rem",
                    fontSize: "0.8rem",
                    fontWeight: 400,
                    fontFamily: "var(--tantu-font-mono, monospace)",
                    color: "var(--tantu-ink-secondary, #555555)",
                  }}
                >
                  v{version}
                </span>
              ) : null}
            </h3>
            <span
              style={{
                fontFamily: "var(--tantu-font-mono, monospace)",
                fontSize: "0.75rem",
                color: "var(--tantu-ink-secondary, #555555)",
              }}
            >
              {appId}
              {signerKeyId ? ` · key ${signerKeyId}` : ""}
            </span>
          </div>

          <TantuTag
            role="status"
            aria-label={verdictMeta.accessibleLabel}
            tone={verdictMeta.tone}
            solid={verdictMeta.solid}
            data-testid="wapp-trust-verdict"
            data-verdict={verdict}
          >
            {verdictMeta.label}
          </TantuTag>
        </header>

        {revoked ? (
          <div
            role="alert"
            data-testid="wapp-revoked-warning"
            style={{
              padding: "0.55rem 0.75rem",
              border: "1px solid var(--tantu-accent, #9e2a2b)",
              background: "var(--tantu-bg-elevated, #fdf2f2)",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            REVOKED BUNDLE: This .wapp passport has been revoked and should not be installed or executed.
            {revocationReason ? ` Reason: ${revocationReason}` : ""}
          </div>
        ) : signatureStatus !== "verified" ? (
          <div
            role={signatureStatus === "invalid" ? "alert" : "status"}
            data-testid="wapp-unverified-warning"
            style={{
              padding: "0.5rem 0.75rem",
              border: "1px solid var(--tantu-border-hairline, #d4d0c8)",
              background: "var(--tantu-bg-elevated, #faf9f6)",
              fontSize: "0.82rem",
            }}
          >
            {signatureStatus === "invalid"
              ? "Signature verification failed: bundle contents do not match the Ed25519 passport."
              : "Unverified bundle: no trusted Ed25519 signature has been verified yet."}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <TantuTag
            role="status"
            aria-label={signatureMeta.accessibleLabel}
            tone={signatureMeta.tone}
            solid={signatureMeta.solid}
            data-testid="wapp-signature-badge"
            data-signature-status={signatureStatus}
          >
            {signatureMeta.label}
          </TantuTag>

          <TantuTag
            role="status"
            aria-label={chaosAccessibleLabel}
            tone={chaosTone}
            solid={Boolean(chaosCertification && !chaosCertification.certified)}
            data-testid="wapp-chaos-pill"
            data-chaos-certified={
              chaosCertification ? String(chaosCertification.certified) : "none"
            }
          >
            {chaosLabel}
          </TantuTag>
        </div>

        <section aria-label="Declared permissions">
          <h4 className="tantu-meta-kasuti" style={{ margin: "0 0 0.4rem 0", fontSize: "0.75rem" }}>
            DECLARED PERMISSIONS ({permissions.length})
          </h4>
          {permissions.length === 0 ? (
            <p
              data-testid="wapp-permissions-empty"
              style={{
                margin: 0,
                fontSize: "0.82rem",
                color: "var(--tantu-ink-secondary, #555555)",
              }}
            >
              No permissions declared.
            </p>
          ) : (
            <ul
              data-testid="wapp-permissions-list"
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexWrap: "wrap",
                gap: "0.35rem",
              }}
            >
              {permissions.map((permission) => (
                <li key={permission}>
                  <TantuTag
                    tone="structural"
                    data-testid={`wapp-permission-${permission}`}
                  >
                    {permission}
                  </TantuTag>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </TantuCard>
  );
}
