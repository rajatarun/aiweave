import { type HTMLAttributes, type ReactNode } from "react";

import { type TantuBannerTone } from "./TantuBanner.js";
import { TantuTag, type TantuTagTone } from "./TantuTag.js";
import { formatUsdCost } from "./TelemetrySummaryCard.js";

export type PolicyEnforcementMode = "enforce" | "audit" | "disabled";

export type PolicyRoutingMode = "normal" | "prefer_local" | "local_only" | "halt";

export interface AgentPolicyV1 {
  /** Canonical contract identifier (`agent-policy-v1`). */
  schema?: string;
  /** Unique policy identifier. */
  policy_id: string;
  /** Optional subject or contract identifier governed by this policy. */
  subject_id?: string;
  /** Enforcement posture (`enforce` | `audit` | `disabled`). */
  enforcement_mode: PolicyEnforcementMode;
  /** Model routing mode (`normal` | `prefer_local` | `local_only` | `halt`). */
  routing_mode: PolicyRoutingMode;
  /** Maximum permitted USD cost per call (`null` / `undefined` when uncapped). */
  max_cost_usd_per_call?: number | null;
  /** Optional maximum capability delegation chain depth. */
  max_delegation_depth?: number;
  /** Optional scopes required for execution. */
  required_scopes?: string[];
  /** Optional capability scopes explicitly denied by policy. */
  denied_scopes?: string[];
  /** Optional allowlisted tools. */
  allowed_tools?: string[];
  /** Optional tools explicitly denied by policy. */
  denied_tools?: string[];
  /** Optional manifest permissions explicitly denied by policy. */
  denied_permissions?: string[];
  /** Optional ISO-8601 timestamp when the policy was generated. */
  generated_at?: string;
}

export interface PolicyGuardBannerProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Canonical `agent-policy-v1` payload representing active runtime posture. */
  policy: AgentPolicyV1;
  /** Optional banner heading. Defaults to `"Policy Guard"`. */
  title?: string;
  /** Optional accessible label for the banner (`role="status"` or `role="alert"`). */
  ariaLabel?: string;
  /** Optional action slot rendered at the end of the banner. */
  action?: ReactNode;
}

interface ModeMeta {
  label: string;
  accessibleLabel: string;
  tone: TantuTagTone;
  solid: boolean;
}

const ENFORCEMENT_META: Record<PolicyEnforcementMode, ModeMeta> = {
  enforce: {
    label: "ENFORCE",
    accessibleLabel: "Enforcement mode: enforce",
    tone: "accent",
    solid: true,
  },
  audit: {
    label: "AUDIT",
    accessibleLabel: "Enforcement mode: audit",
    tone: "caution",
    solid: false,
  },
  disabled: {
    label: "DISABLED",
    accessibleLabel: "Enforcement mode: disabled",
    tone: "neutral",
    solid: false,
  },
};

const ROUTING_META: Record<PolicyRoutingMode, ModeMeta> = {
  normal: {
    label: "NORMAL",
    accessibleLabel: "Routing mode: normal",
    tone: "success",
    solid: false,
  },
  prefer_local: {
    label: "PREFER LOCAL",
    accessibleLabel: "Routing mode: prefer local",
    tone: "caution",
    solid: false,
  },
  local_only: {
    label: "LOCAL ONLY",
    accessibleLabel: "Routing mode: local only",
    tone: "caution",
    solid: true,
  },
  halt: {
    label: "HALT",
    accessibleLabel: "Routing mode: halt",
    tone: "accent",
    solid: true,
  },
};

/** Derives the visual banner tone from the active enforcement and routing modes. */
export function derivePolicyBannerTone(
  enforcementMode: PolicyEnforcementMode,
  routingMode: PolicyRoutingMode,
): TantuBannerTone {
  if (routingMode === "halt") return "critical";
  if (routingMode === "local_only" || routingMode === "prefer_local") return "caution";
  if (enforcementMode === "enforce") return "info";
  if (enforcementMode === "audit") return "caution";
  return "info";
}

/** Formats `max_cost_usd_per_call` into a human-readable USD cap or `"Uncapped"`. */
export function formatMaxCostPerCall(maxCostUsd: number | null | undefined): string {
  if (maxCostUsd === null || maxCostUsd === undefined || !Number.isFinite(maxCostUsd)) {
    return "Uncapped";
  }
  return formatUsdCost(maxCostUsd);
}

/** Collects and deduplicates denied scopes, tools, and permissions from an `agent-policy-v1` payload. */
export function collectDeniedCapabilities(policy: AgentPolicyV1): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const list of [policy.denied_scopes, policy.denied_tools, policy.denied_permissions]) {
    if (!list) continue;
    for (const item of list) {
      const trimmed = item.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        result.push(trimmed);
      }
    }
  }
  return result;
}

/**
 * Accessible SystemUI banner rendering canonical `agent-policy-v1` active posture.
 *
 * Uses `role="alert"` when execution is halted (`routing_mode === "halt"`) or
 * actively enforcing (`enforcement_mode === "enforce"`), and `role="status"`
 * otherwise. Displays `enforcement_mode`, `routing_mode` badge
 * (`normal` / `prefer_local` / `local_only` / `halt`), `max_cost_usd_per_call`,
 * and denied-capability tags.
 */
export function PolicyGuardBanner({
  policy,
  title = "Policy Guard",
  ariaLabel,
  action,
  className,
  "aria-label": ariaLabelProp,
  ...rest
}: PolicyGuardBannerProps) {
  const isAlert = policy.routing_mode === "halt" || policy.enforcement_mode === "enforce";
  const bannerRole = isAlert ? "alert" : "status";
  const tone = derivePolicyBannerTone(policy.enforcement_mode, policy.routing_mode);
  const enforcementMeta = ENFORCEMENT_META[policy.enforcement_mode];
  const routingMeta = ROUTING_META[policy.routing_mode];
  const schemaVersion = policy.schema ?? "agent-policy-v1";
  const deniedCapabilities = collectDeniedCapabilities(policy);
  const maxCostDisplay = formatMaxCostPerCall(policy.max_cost_usd_per_call);
  const bannerLabel =
    ariaLabelProp ??
    ariaLabel ??
    `${title}: ${policy.enforcement_mode} enforcement, ${policy.routing_mode} routing`;

  return (
    <div
      {...rest}
      role={bannerRole}
      aria-label={bannerLabel}
      data-schema-version={schemaVersion}
      data-policy-id={policy.policy_id}
      data-enforcement-mode={policy.enforcement_mode}
      data-routing-mode={policy.routing_mode}
      className={[
        "tantu-banner",
        `tantu-banner-${tone}`,
        "tantu-policy-guard-banner",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="tantu-banner-body"
        style={{ display: "flex", flexDirection: "column", gap: "0.55rem", width: "100%" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.65rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
            <strong style={{ fontSize: "0.95rem" }}>{title}</strong>
            <span
              data-testid="policy-meta"
              style={{
                fontFamily: "var(--tantu-font-mono, monospace)",
                fontSize: "0.75rem",
                color: "var(--tantu-ink-secondary, #555555)",
              }}
            >
              {policy.policy_id}
              {policy.subject_id ? ` · ${policy.subject_id}` : ""}
              {` · ${schemaVersion}`}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
            <TantuTag
              tone={enforcementMeta.tone}
              solid={enforcementMeta.solid}
              aria-label={enforcementMeta.accessibleLabel}
              data-testid="policy-enforcement-badge"
              data-enforcement-mode={policy.enforcement_mode}
            >
              {enforcementMeta.label}
            </TantuTag>

            <TantuTag
              tone={routingMeta.tone}
              solid={routingMeta.solid}
              aria-label={routingMeta.accessibleLabel}
              data-testid="policy-routing-badge"
              data-routing-mode={policy.routing_mode}
            >
              {routingMeta.label}
            </TantuTag>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.85rem",
            flexWrap: "wrap",
            fontFamily: "var(--tantu-font-mono, monospace)",
            fontSize: "0.8rem",
          }}
        >
          <span data-testid="policy-max-cost">
            Max cost/call: <strong>{maxCostDisplay}</strong>
          </span>
          {typeof policy.max_delegation_depth === "number" ? (
            <span data-testid="policy-max-delegation-depth">
              Max delegation depth: <strong>{policy.max_delegation_depth}</strong>
            </span>
          ) : null}
          {policy.routing_mode === "halt" ? (
            <span
              data-testid="policy-halt-notice"
              style={{ fontWeight: 700, color: "var(--tantu-accent, #9e2a2b)" }}
            >
              Execution halted by active budget/policy guard.
            </span>
          ) : null}
        </div>

        {deniedCapabilities.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
            <span
              className="tantu-meta-kasuti"
              style={{ fontSize: "0.72rem", color: "var(--tantu-ink-secondary, #555555)" }}
            >
              DENIED ({deniedCapabilities.length}):
            </span>
            <ul
              aria-label="Denied capabilities"
              data-testid="policy-denied-capabilities"
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexWrap: "wrap",
                gap: "0.3rem",
              }}
            >
              {deniedCapabilities.map((cap) => (
                <li key={cap}>
                  <TantuTag tone="accent" data-testid={`policy-denied-tag-${cap}`}>
                    {cap}
                  </TantuTag>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <span
            data-testid="policy-denied-empty"
            style={{
              fontSize: "0.78rem",
              color: "var(--tantu-ink-secondary, #555555)",
            }}
          >
            No denied capabilities.
          </span>
        )}
      </div>

      {action ? <div className="tantu-banner-action">{action}</div> : null}
    </div>
  );
}
