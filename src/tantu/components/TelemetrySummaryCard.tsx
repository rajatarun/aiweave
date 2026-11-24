import { useId, type HTMLAttributes } from "react";

import { TantuCard } from "./TantuCard.js";
import { TantuTag, type TantuTagTone } from "./TantuTag.js";

export interface TelemetryRepoBreakdown {
  /** Canonical Weave repository name (e.g. `HarnessWeave`, `ModelWeave`, `ToolWeave`). */
  sourceRepo: string;
  /** Number of `weave-telemetry-v1` events emitted by this repository. */
  totalEvents: number;
  /** Fraction of events with error status in `[0, 1]` (e.g. `0.025` = `2.5%`). */
  errorRate: number;
  /** Optional raw count of error events. */
  errorCount?: number;
  /** Median (p50) latency in milliseconds. */
  p50LatencyMs: number;
  /** 95th percentile (p95) latency in milliseconds. */
  p95LatencyMs: number;
  /** Total estimated cost in USD for this repository. */
  totalCostUsd: number;
  /** Optional input token total for this repository. */
  tokensIn?: number;
  /** Optional output token total for this repository. */
  tokensOut?: number;
}

export interface TelemetrySummaryCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Total number of ingested `weave-telemetry-v1` events. */
  totalEvents: number;
  /** Aggregate p50 (median) latency in milliseconds. */
  p50LatencyMs: number;
  /** Aggregate p95 latency in milliseconds. */
  p95LatencyMs: number;
  /** Aggregate error rate as a fraction in `[0, 1]` (e.g. `0.05` = `5.0%`). */
  errorRate: number;
  /** Aggregate total cost in USD. */
  totalCostUsd: number;
  /** Optional per-repository rollup rows. */
  repos: TelemetryRepoBreakdown[];
  /** Optional raw error event count. */
  errorCount?: number;
  /** Optional aggregate input token count. */
  totalTokensIn?: number;
  /** Optional aggregate output token count. */
  totalTokensOut?: number;
  /** Card heading. */
  title?: string;
  /** Optional accessible label for the `role="region"` container. Defaults to `title`. */
  ariaLabel?: string;
  /** Optional reporting window or `since` label (e.g. `Last 24h` or ISO-8601 timestamp). */
  windowLabel?: string;
  /** Optional schema identifier badge (defaults to `weave-telemetry-v1`). */
  schemaVersion?: string;
  /** Empty-state message when `repos` is empty. */
  emptyMessage?: string;
}

const INT_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function sanitizeNonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function clampRate(rate: number): number {
  if (!Number.isFinite(rate) || rate < 0) return 0;
  if (rate > 1) return 1;
  return rate;
}

export function formatEventCount(count: number): string {
  return INT_FORMATTER.format(Math.round(sanitizeNonNegative(count)));
}

export function formatLatencyMs(ms: number): string {
  return `${sanitizeNonNegative(ms).toFixed(1)} ms`;
}

export function formatErrorRate(rate: number): string {
  return `${(clampRate(rate) * 100).toFixed(1)}%`;
}

export function formatUsdCost(usd: number): string {
  const safe = sanitizeNonNegative(usd);
  if (safe > 0 && safe < 0.01) {
    return `$${safe.toFixed(4)}`;
  }
  return `$${safe.toFixed(2)}`;
}

function getErrorTone(rate: number): { tone: TantuTagTone; solid: boolean; label: string } {
  const clamped = clampRate(rate);
  if (clamped >= 0.05) {
    return { tone: "accent", solid: true, label: "ELEVATED ERRORS" };
  }
  if (clamped > 0) {
    return { tone: "caution", solid: false, label: "DEGRADED" };
  }
  return { tone: "success", solid: false, label: "NOMINAL" };
}

/**
 * Accessible SystemUI summary card rendering `mcp-observatory`
 * `weave-telemetry-v1` rollup metrics.
 *
 * Displays aggregate event volume, p50/p95 latency in milliseconds,
 * error rate percentage, total USD cost, optional token totals, and a
 * per-repository breakdown table inside a `role="region"` container.
 */
export function TelemetrySummaryCard({
  totalEvents,
  p50LatencyMs,
  p95LatencyMs,
  errorRate,
  totalCostUsd,
  repos,
  errorCount,
  totalTokensIn,
  totalTokensOut,
  title = "Telemetry Rollup Summary",
  ariaLabel,
  windowLabel,
  schemaVersion = "weave-telemetry-v1",
  emptyMessage = "No per-repository telemetry recorded yet.",
  className,
  "aria-label": ariaLabelProp,
  ...rest
}: TelemetrySummaryCardProps) {
  const headingId = useId();
  const regionLabel = ariaLabelProp ?? ariaLabel ?? title;
  const health = getErrorTone(errorRate);

  return (
    <TantuCard
      {...rest}
      role="region"
      aria-label={regionLabel}
      talimCode="TELEMETRY"
      data-schema-version={schemaVersion}
      data-error-state={health.label.toLowerCase().replace(/\s+/g, "_")}
      className={["tantu-telemetry-summary-card", className].filter(Boolean).join(" ")}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            flexWrap: "wrap",
            borderBottom: "1px solid var(--tantu-border-hairline, #d4d0c8)",
            paddingBottom: "0.6rem",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
            <h3 id={headingId} style={{ margin: 0, fontSize: "1.05rem" }}>
              {title}
            </h3>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
                fontFamily: "var(--tantu-font-mono, monospace)",
                fontSize: "0.75rem",
                color: "var(--tantu-ink-secondary, #555555)",
              }}
            >
              <span>{schemaVersion}</span>
              {windowLabel ? <span data-testid="telemetry-window-label">· {windowLabel}</span> : null}
            </div>
          </div>

          <TantuTag
            role="status"
            tone={health.tone}
            solid={health.solid}
            data-testid="telemetry-health-badge"
          >
            {health.label}
          </TantuTag>
        </header>

        <dl
          aria-label="Aggregate telemetry metrics"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))",
            gap: "0.6rem",
            margin: 0,
          }}
        >
          <div
            data-testid="telemetry-metric-events"
            style={{
              padding: "0.55rem 0.65rem",
              background: "var(--tantu-bg-elevated, #faf9f6)",
              border: "1px solid var(--tantu-border-hairline, #d4d0c8)",
            }}
          >
            <dt className="tantu-meta-kasuti" style={{ fontSize: "0.7rem", margin: 0 }}>
              TOTAL EVENTS
            </dt>
            <dd
              style={{
                margin: "0.2rem 0 0 0",
                fontSize: "1.1rem",
                fontWeight: 700,
                fontFamily: "var(--tantu-font-mono, monospace)",
              }}
            >
              {formatEventCount(totalEvents)}
            </dd>
          </div>

          <div
            data-testid="telemetry-metric-p50"
            style={{
              padding: "0.55rem 0.65rem",
              background: "var(--tantu-bg-elevated, #faf9f6)",
              border: "1px solid var(--tantu-border-hairline, #d4d0c8)",
            }}
          >
            <dt className="tantu-meta-kasuti" style={{ fontSize: "0.7rem", margin: 0 }}>
              P50 LATENCY
            </dt>
            <dd
              style={{
                margin: "0.2rem 0 0 0",
                fontSize: "1.1rem",
                fontWeight: 700,
                fontFamily: "var(--tantu-font-mono, monospace)",
              }}
            >
              {formatLatencyMs(p50LatencyMs)}
            </dd>
          </div>

          <div
            data-testid="telemetry-metric-p95"
            style={{
              padding: "0.55rem 0.65rem",
              background: "var(--tantu-bg-elevated, #faf9f6)",
              border: "1px solid var(--tantu-border-hairline, #d4d0c8)",
            }}
          >
            <dt className="tantu-meta-kasuti" style={{ fontSize: "0.7rem", margin: 0 }}>
              P95 LATENCY
            </dt>
            <dd
              style={{
                margin: "0.2rem 0 0 0",
                fontSize: "1.1rem",
                fontWeight: 700,
                fontFamily: "var(--tantu-font-mono, monospace)",
              }}
            >
              {formatLatencyMs(p95LatencyMs)}
            </dd>
          </div>

          <div
            data-testid="telemetry-metric-error-rate"
            style={{
              padding: "0.55rem 0.65rem",
              background: "var(--tantu-bg-elevated, #faf9f6)",
              border: "1px solid var(--tantu-border-hairline, #d4d0c8)",
            }}
          >
            <dt className="tantu-meta-kasuti" style={{ fontSize: "0.7rem", margin: 0 }}>
              ERROR RATE
            </dt>
            <dd
              style={{
                margin: "0.2rem 0 0 0",
                fontSize: "1.1rem",
                fontWeight: 700,
                fontFamily: "var(--tantu-font-mono, monospace)",
              }}
            >
              {formatErrorRate(errorRate)}
              {typeof errorCount === "number" ? (
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 400,
                    marginLeft: "0.35rem",
                    color: "var(--tantu-ink-secondary, #555555)",
                  }}
                >
                  ({formatEventCount(errorCount)})
                </span>
              ) : null}
            </dd>
          </div>

          <div
            data-testid="telemetry-metric-cost"
            style={{
              padding: "0.55rem 0.65rem",
              background: "var(--tantu-bg-elevated, #faf9f6)",
              border: "1px solid var(--tantu-border-hairline, #d4d0c8)",
            }}
          >
            <dt className="tantu-meta-kasuti" style={{ fontSize: "0.7rem", margin: 0 }}>
              TOTAL COST
            </dt>
            <dd
              style={{
                margin: "0.2rem 0 0 0",
                fontSize: "1.1rem",
                fontWeight: 700,
                fontFamily: "var(--tantu-font-mono, monospace)",
              }}
            >
              {formatUsdCost(totalCostUsd)}
            </dd>
          </div>
        </dl>

        {typeof totalTokensIn === "number" || typeof totalTokensOut === "number" ? (
          <p
            data-testid="telemetry-token-totals"
            style={{
              margin: 0,
              fontSize: "0.8rem",
              fontFamily: "var(--tantu-font-mono, monospace)",
              color: "var(--tantu-ink-secondary, #555555)",
            }}
          >
            Tokens: {formatEventCount(totalTokensIn ?? 0)} in / {formatEventCount(totalTokensOut ?? 0)} out
          </p>
        ) : null}

        <section aria-label="Per-repository breakdown">
          <h4 className="tantu-meta-kasuti" style={{ margin: "0 0 0.45rem 0", fontSize: "0.8rem" }}>
            PER-REPO BREAKDOWN ({repos.length})
          </h4>
          {repos.length === 0 ? (
            <p
              data-testid="telemetry-repos-empty"
              style={{
                margin: 0,
                fontSize: "0.85rem",
                color: "var(--tantu-ink-secondary, #555555)",
              }}
            >
              {emptyMessage}
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                data-testid="telemetry-repos-table"
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.82rem",
                  fontFamily: "var(--tantu-font-mono, monospace)",
                }}
              >
                <thead>
                  <tr
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid var(--tantu-border-hairline, #d4d0c8)",
                    }}
                  >
                    <th scope="col" style={{ padding: "0.4rem 0.5rem" }}>
                      Repo
                    </th>
                    <th scope="col" style={{ padding: "0.4rem 0.5rem", textAlign: "right" }}>
                      Events
                    </th>
                    <th scope="col" style={{ padding: "0.4rem 0.5rem", textAlign: "right" }}>
                      p50
                    </th>
                    <th scope="col" style={{ padding: "0.4rem 0.5rem", textAlign: "right" }}>
                      p95
                    </th>
                    <th scope="col" style={{ padding: "0.4rem 0.5rem", textAlign: "right" }}>
                      Errors
                    </th>
                    <th scope="col" style={{ padding: "0.4rem 0.5rem", textAlign: "right" }}>
                      Cost
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {repos.map((repo) => {
                    const rowErrorTone = getErrorTone(repo.errorRate);
                    return (
                      <tr
                        key={repo.sourceRepo}
                        data-testid={`telemetry-repo-row-${repo.sourceRepo}`}
                        style={{
                          borderBottom: "1px solid var(--tantu-border-hairline, #e6e2d8)",
                        }}
                      >
                        <th
                          scope="row"
                          style={{
                            padding: "0.45rem 0.5rem",
                            textAlign: "left",
                            fontWeight: 600,
                            fontFamily: "inherit",
                          }}
                        >
                          {repo.sourceRepo}
                        </th>
                        <td style={{ padding: "0.45rem 0.5rem", textAlign: "right" }}>
                          {formatEventCount(repo.totalEvents)}
                        </td>
                        <td style={{ padding: "0.45rem 0.5rem", textAlign: "right" }}>
                          {formatLatencyMs(repo.p50LatencyMs)}
                        </td>
                        <td style={{ padding: "0.45rem 0.5rem", textAlign: "right" }}>
                          {formatLatencyMs(repo.p95LatencyMs)}
                        </td>
                        <td style={{ padding: "0.45rem 0.5rem", textAlign: "right" }}>
                          <TantuTag tone={rowErrorTone.tone} solid={rowErrorTone.solid}>
                            {formatErrorRate(repo.errorRate)}
                          </TantuTag>
                        </td>
                        <td style={{ padding: "0.45rem 0.5rem", textAlign: "right" }}>
                          {formatUsdCost(repo.totalCostUsd)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </TantuCard>
  );
}
