import { type HTMLAttributes, type ReactNode } from "react";

import { TantuButton } from "./TantuButton.js";
import { TantuDialog } from "./TantuDialog.js";
import { TantuTag, type TantuTagTone } from "./TantuTag.js";

export type ApprovalRiskTier = "low" | "medium" | "high" | "critical";

export interface ApprovalSheetProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Whether the approval sheet is currently visible. */
  open: boolean;
  /** Canonical MCP / agent tool name awaiting human approval. */
  toolName: string;
  /** Risk classification for the proposed action. */
  riskTier: ApprovalRiskTier;
  /** Tool arguments rendered in deterministic canonical JSON form. */
  args: unknown;
  /** Optional human-readable explanation of why the agent proposed this action. */
  summary?: ReactNode;
  /** Optional agent or flow identifier displayed in the sheet header metadata. */
  agentName?: string;
  /** Invoked when the operator approves the proposed tool execution. */
  onApprove: () => void;
  /** Invoked when the operator rejects the proposed tool execution. */
  onReject: () => void;
  /** Invoked on Escape / scrim dismissal. Defaults to `onReject`. */
  onClose?: () => void;
  /** Block dismissal via Escape / scrim click when true. */
  persistent?: boolean;
  /** Disable action controls while a decision request is in flight. */
  busy?: boolean;
  /** Custom label for the Approve action button. */
  approveLabel?: string;
  /** Custom label for the Reject action button. */
  rejectLabel?: string;
}

const RISK_META: Record<
  ApprovalRiskTier,
  { label: string; tone: TantuTagTone; solid: boolean }
> = {
  low: { label: "LOW RISK", tone: "success", solid: false },
  medium: { label: "MEDIUM RISK", tone: "caution", solid: false },
  high: { label: "HIGH RISK", tone: "accent", solid: false },
  critical: { label: "CRITICAL RISK", tone: "accent", solid: true },
};

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      out[k] = sortKeysDeep(v);
    }
    return out;
  }
  return value;
}

/**
 * Serialize tool arguments into deterministic, key-sorted JSON so operators
 * always inspect the exact canonical payload that will be committed.
 */
export function canonicalizeArgs(args: unknown): string {
  try {
    return JSON.stringify(sortKeysDeep(args ?? {}), null, 2);
  } catch {
    return String(args);
  }
}

/**
 * Agentic Propose/Commit approval sheet built on Tantu primitives and tokens.
 *
 * Displays the target tool name, a color-coded risk tier badge
 * (`low | medium | high | critical`), a canonical JSON arguments preview,
 * and accessible Approve / Reject actions with keyboard Escape dismissal
 * and WCAG modal focus containment.
 */
export function ApprovalSheet({
  open,
  toolName,
  riskTier,
  args,
  summary,
  agentName,
  onApprove,
  onReject,
  onClose,
  persistent = false,
  busy = false,
  approveLabel = "Approve",
  rejectLabel = "Reject",
  className,
  ...rest
}: ApprovalSheetProps) {
  const risk = RISK_META[riskTier];
  const canonicalJson = canonicalizeArgs(args);
  const handleDismiss = onClose ?? onReject;

  return (
    <TantuDialog
      {...rest}
      open={open}
      onClose={handleDismiss}
      persistent={persistent}
      data-risk-tier={riskTier}
      className={["tantu-approval-sheet", className].filter(Boolean).join(" ")}
      title={
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <span>{toolName}</span>
          <TantuTag
            tone={risk.tone}
            solid={risk.solid}
            data-testid="approval-risk-badge"
            data-risk-tier={riskTier}
          >
            {risk.label}
          </TantuTag>
        </span>
      }
      meta={agentName ? `AGENT · ${agentName}` : "PROPOSE / COMMIT"}
      footer={
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
            width: "100%",
          }}
        >
          <TantuButton
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onReject}
          >
            {rejectLabel}
          </TantuButton>
          <TantuButton
            type="button"
            variant="primary"
            disabled={busy}
            onClick={onApprove}
          >
            {approveLabel}
          </TantuButton>
        </div>
      }
    >
      {summary ? (
        <p
          style={{
            margin: "0 0 0.75rem 0",
            color: "var(--tantu-ink-secondary)",
          }}
        >
          {summary}
        </p>
      ) : null}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.35rem",
        }}
      >
        <span
          className="tantu-meta-kasuti"
          style={{ color: "var(--tantu-ink-secondary)" }}
        >
          CANONICAL ARGUMENTS
        </span>
        <pre
          data-testid="approval-args-preview"
          style={{
            margin: 0,
            padding: "0.75rem",
            background: "var(--tantu-bg-elevated)",
            border: "1px solid var(--tantu-border-hairline)",
            color: "var(--tantu-ink-primary)",
            fontFamily: "var(--tantu-font-mono, monospace)",
            fontSize: "0.8125rem",
            lineHeight: 1.5,
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          <code>{canonicalJson}</code>
        </pre>
      </div>
    </TantuDialog>
  );
}
