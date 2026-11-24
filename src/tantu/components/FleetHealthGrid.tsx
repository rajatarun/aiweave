import { useId, type HTMLAttributes } from "react";

import { TantuCard } from "./TantuCard.js";
import { TantuTag, type TantuTagTone } from "./TantuTag.js";

export type FleetNodeStatus = "healthy" | "degraded" | "offline";
export type FleetOverallStatus = "healthy" | "degraded" | "critical";
export type FleetBudgetMode = "normal" | "prefer_local" | "local_only" | "halt";

export interface FleetHealthNode {
  /** Unique edge node identifier (e.g. `pi5-kitchen`). */
  node_id: string;
  /** Node availability and health status. */
  status: FleetNodeStatus;
  /** True when the node's latest SLO check passed. */
  slo_passed: boolean;
  /** Current budget-adaptive routing mode. */
  budget_mode: FleetBudgetMode;
  /** Count of active installed `.wapp` bundles on the node. */
  active_wapps: number;
  /** RFC 3339 timestamp of the node's last heartbeat. */
  last_seen_at: string;
  /** Optional reasons explaining degraded or offline status. */
  reasons?: string[];
}

export interface FleetHealthSummary {
  total_nodes: number;
  healthy: number;
  degraded: number;
  offline: number;
  overall_status: FleetOverallStatus;
}

export interface FleetHealthV1 {
  /** Canonical contract identifier (`fleet-health-v1`). */
  schema?: string;
  /** Logical edge fleet identifier. */
  fleet_id: string;
  /** RFC 3339 timestamp when the rollup was generated. */
  generated_at: string;
  /** Per-node health records. */
  nodes: FleetHealthNode[];
  /** Aggregate node counts and overall status verdict. */
  summary: FleetHealthSummary;
}

export interface FleetHealthGridProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Canonical `fleet-health-v1` payload from `mcp-observatory` or `WeaveOS`. */
  fleet: FleetHealthV1;
  /** Section heading. */
  title?: string;
  /** Optional accessible label for the region landmark. */
  ariaLabel?: string;
}

interface StatusBadgeMeta {
  label: string;
  tone: TantuTagTone;
  solid: boolean;
}

const OVERALL_STATUS_META: Record<FleetOverallStatus, StatusBadgeMeta> = {
  healthy: { label: "HEALTHY", tone: "success", solid: true },
  degraded: { label: "DEGRADED", tone: "caution", solid: false },
  critical: { label: "CRITICAL", tone: "accent", solid: true },
};

const NODE_STATUS_META: Record<FleetNodeStatus, StatusBadgeMeta> = {
  healthy: { label: "Healthy", tone: "success", solid: true },
  degraded: { label: "Degraded", tone: "caution", solid: false },
  offline: { label: "Offline", tone: "accent", solid: true },
};

const BUDGET_MODE_META: Record<FleetBudgetMode, { label: string; tone: TantuTagTone }> = {
  normal: { label: "normal", tone: "neutral" },
  prefer_local: { label: "prefer_local", tone: "caution" },
  local_only: { label: "local_only", tone: "caution" },
  halt: { label: "halt", tone: "accent" },
};

/**
 * Displays a canonical `fleet-health-v1` multi-node rollup with an overall
 * health badge, summary counters, and per-node status cards.
 */
export function FleetHealthGrid({
  fleet,
  title = "Edge Fleet Health",
  ariaLabel,
  className,
  style,
  ...rest
}: FleetHealthGridProps) {
  const headingId = useId();
  const overall = OVERALL_STATUS_META[fleet.summary.overall_status] ?? OVERALL_STATUS_META.degraded;
  const isCritical = fleet.summary.overall_status === "critical";

  return (
    <section
      role="region"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : headingId}
      data-schema-version={fleet.schema ?? "fleet-health-v1"}
      data-fleet-status={fleet.summary.overall_status}
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        ...style,
      }}
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
            marginBottom: "1rem",
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
              data-testid="fleet-id"
              style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", opacity: 0.8 }}
            >
              Fleet: <code>{fleet.fleet_id}</code> · Updated {fleet.generated_at}
            </p>
          </div>
          <span
            data-testid="fleet-overall-badge"
            role={isCritical ? "alert" : "status"}
            aria-label={`Fleet status: ${fleet.summary.overall_status}`}
          >
            <TantuTag tone={overall.tone} solid={overall.solid}>
              {overall.label}
            </TantuTag>
          </span>
        </div>

        <dl
          data-testid="fleet-summary-counters"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: "0.75rem",
            margin: "0 0 1.25rem",
          }}
        >
          <div data-testid="fleet-count-total">
            <dt style={{ fontSize: "0.75rem", opacity: 0.75 }}>Total Nodes</dt>
            <dd style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
              {fleet.summary.total_nodes}
            </dd>
          </div>
          <div data-testid="fleet-count-healthy">
            <dt style={{ fontSize: "0.75rem", opacity: 0.75 }}>Healthy</dt>
            <dd style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
              {fleet.summary.healthy}
            </dd>
          </div>
          <div data-testid="fleet-count-degraded">
            <dt style={{ fontSize: "0.75rem", opacity: 0.75 }}>Degraded</dt>
            <dd style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
              {fleet.summary.degraded}
            </dd>
          </div>
          <div data-testid="fleet-count-offline">
            <dt style={{ fontSize: "0.75rem", opacity: 0.75 }}>Offline</dt>
            <dd style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
              {fleet.summary.offline}
            </dd>
          </div>
        </dl>

        {fleet.nodes.length === 0 ? (
          <p data-testid="fleet-empty-state" style={{ margin: 0, fontSize: "0.875rem", opacity: 0.8 }}>
            No edge nodes registered in this fleet.
          </p>
        ) : (
          <ul
            data-testid="fleet-nodes-grid"
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "0.75rem",
            }}
          >
            {fleet.nodes.map((node) => {
              const nodeMeta = NODE_STATUS_META[node.status] ?? NODE_STATUS_META.degraded;
              const budgetMeta = BUDGET_MODE_META[node.budget_mode] ?? BUDGET_MODE_META.normal;
              const reasons = node.reasons ?? [];

              return (
                <li key={node.node_id} data-testid={`fleet-node-${node.node_id}`}>
                  <TantuCard>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <strong style={{ fontSize: "0.95rem" }}>{node.node_id}</strong>
                      <TantuTag tone={nodeMeta.tone} solid={nodeMeta.solid}>
                        {nodeMeta.label}
                      </TantuTag>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.4rem",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <span data-testid={`fleet-node-slo-${node.node_id}`}>
                        <TantuTag tone={node.slo_passed ? "success" : "accent"}>
                          {node.slo_passed ? "SLO Pass" : "SLO Breach"}
                        </TantuTag>
                      </span>
                      <span data-testid={`fleet-node-budget-${node.node_id}`}>
                        <TantuTag tone={budgetMeta.tone}>
                          Budget: {budgetMeta.label}
                        </TantuTag>
                      </span>
                    </div>

                    <p
                      data-testid={`fleet-node-wapps-${node.node_id}`}
                      style={{ margin: "0 0 0.25rem", fontSize: "0.8125rem" }}
                    >
                      Active wapps: <strong>{node.active_wapps}</strong>
                    </p>
                    <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.75 }}>
                      Last seen: {node.last_seen_at}
                    </p>

                    {reasons.length > 0 && (
                      <ul
                        data-testid={`fleet-node-reasons-${node.node_id}`}
                        style={{
                          margin: "0.5rem 0 0",
                          paddingLeft: "1.1rem",
                          fontSize: "0.8125rem",
                        }}
                      >
                        {reasons.map((reason, idx) => (
                          <li key={`${node.node_id}-reason-${idx}`}>{reason}</li>
                        ))}
                      </ul>
                    )}
                  </TantuCard>
                </li>
              );
            })}
          </ul>
        )}
      </TantuCard>
    </section>
  );
}
