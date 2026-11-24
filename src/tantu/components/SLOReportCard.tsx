import { useId, type HTMLAttributes } from "react";

import { TantuCard } from "./TantuCard.js";
import { TantuTag, type TantuTagTone } from "./TantuTag.js";
import {
  formatErrorRate,
  formatEventCount,
  formatLatencyMs,
  formatUsdCost,
} from "./TelemetrySummaryCard.js";

export type SLOStatus = "pass" | "warn" | "breach" | "insufficient_data";

export type SLOBreachSeverity = "warn" | "breach" | string;

export interface SLOReportMetrics {
  /** Total number of telemetry events evaluated in the window. */
  total_events: number;
  /** Fraction of events with error status in `[0, 1]` (e.g. `0.025` = `2.5%`). */
  error_rate: number;
  /** Optional median (p50) latency in milliseconds. */
  p50_latency_ms?: number;
  /** Observed 95th percentile (p95) latency in milliseconds. */
  p95_latency_ms: number;
  /** Total estimated cost in USD over the evaluation window. */
  total_cost_usd: number;
}

export interface SLOReportTargets {
  /** Maximum allowed p95 latency in milliseconds. */
  max_p95_latency_ms: number;
  /** Maximum allowed error rate as a fraction in `[0, 1]`. */
  max_error_rate: number;
  /** Maximum allowed USD cost cap for the evaluation window. */
  max_cost_usd: number;
  /** Optional minimum event count required before evaluating SLOs. */
  min_events?: number;
}

export interface SLOBreach {
  /** Metric identifier that breached or approached its threshold (e.g. `p95_latency_ms`). */
  metric: string;
  /** Observed metric value. */
  observed: number;
  /** Configured SLO threshold value. */
  threshold: number;
  /** Severity level (`breach` | `warn`). */
  severity: SLOBreachSeverity;
  /** Human-readable explanation of the breach. */
  message: string;
}

export interface SLOReportV1 {
  /** Canonical contract identifier (`slo-report-v1`). */
  schema?: string;
  /** Optional ISO-8601 timestamp of evaluation. */
  evaluated_at?: string;
  /** Optional evaluation window label (e.g. `all`, `last_24h`). */
  window_label?: string;
  /** Optional repository filter applied when computing the report. */
  source_repo?: string | null;
  /** Overall SLO compliance status. */
  status: SLOStatus;
  /** Observed rollup metrics. */
  metrics: SLOReportMetrics;
  /** Target thresholds evaluated against `metrics`. */
  targets: SLOReportTargets;
  /** Itemized list of breaches or warnings. */
  breaches?: SLOBreach[];
}

export interface SLOReportCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Canonical `slo-report-v1` payload from `mcp-observatory`, `HarnessWeave`, or `WeaveOS`. */
  report: SLOReportV1;
  /** Card heading. */
  title?: string;
  /** Optional accessible label for the `role="region"` container. Defaults to `title`. */
  ariaLabel?: string;
}

interface SLOStatusMeta {
  label: string;
  accessibleLabel: string;
  tone: TantuTagTone;
  solid: boolean;
}

const SLO_STATUS_META: Record<SLOStatus, SLOStatusMeta> = {
  pass: {
    label: "PASS",
    accessibleLabel: "SLO status: pass",
    tone: "success",
    solid: true,
  },
  warn: {
    label: "WARN",
    accessibleLabel: "SLO status: warning",
    tone: "caution",
    solid: false,
  },
  breach: {
    label: "BREACH",
    accessibleLabel: "SLO status: breach",
    tone: "accent",
    solid: true,
  },
  insufficient_data: {
    label: "INSUFFICIENT DATA",
    accessibleLabel: "SLO status: insufficient data",
    tone: "neutral",
    solid: false,
  },
};

/** Formats a breach metric's numeric value according to its canonical metric name. */
export function formatSLOBreachValue(metric: string, value: number): string {
  const normalized = metric.toLowerCase();
  if (normalized.includes("latency") || normalized.endsWith("_ms")) {
    return formatLatencyMs(value);
  }
  if (normalized.includes("error_rate") || normalized.endsWith("_rate")) {
    return formatErrorRate(value);
  }
  if (normalized.includes("cost") || normalized.endsWith("_usd")) {
    return formatUsdCost(value);
  }
  if (!Number.isFinite(value)) return "0";
  return String(value);
}

function getMetricDeltaTone(observed: number, threshold: number): TantuTagTone {
  if (!Number.isFinite(observed) || !Number.isFinite(threshold) || threshold <= 0) {
    return "neutral";
  }
  if (observed > threshold) return "accent";
  if (observed >= threshold * 0.85) return "caution";
  return "success";
}

/**
 * Accessible SystemUI card rendering canonical `slo-report-v1` payloads.
 *
 * Displays the overall SLO status pill (`pass` / `warn` / `breach` /
 * `insufficient_data`), p95 latency vs threshold, error rate percentage vs
 * target, total USD cost vs cap, and an itemized breach list when breaches
 * exist inside a `role="region"` container.
 */
export function SLOReportCard({
  report,
  title = "SLO Compliance Report",
  ariaLabel,
  className,
  "aria-label": ariaLabelProp,
  ...rest
}: SLOReportCardProps) {
  const headingId = useId();
  const regionLabel = ariaLabelProp ?? ariaLabel ?? title;
  const statusMeta = SLO_STATUS_META[report.status];
  const schemaVersion = report.schema ?? "slo-report-v1";
  const breaches = report.breaches ?? [];

  const p95Tone = getMetricDeltaTone(
    report.metrics.p95_latency_ms,
    report.targets.max_p95_latency_ms,
  );
  const errorTone = getMetricDeltaTone(report.metrics.error_rate, report.targets.max_error_rate);
  const costTone = getMetricDeltaTone(report.metrics.total_cost_usd, report.targets.max_cost_usd);

  return (
    <TantuCard
      {...rest}
      role="region"
      aria-label={regionLabel}
      talimCode="SLO-REPORT"
      data-schema-version={schemaVersion}
      data-slo-status={report.status}
      className={["tantu-slo-report-card", className].filter(Boolean).join(" ")}
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
              {report.source_repo ? (
                <span data-testid="slo-source-repo">· {report.source_repo}</span>
              ) : null}
              {report.window_label ? (
                <span data-testid="slo-window-label">· {report.window_label}</span>
              ) : null}
              {report.evaluated_at ? (
                <span data-testid="slo-evaluated-at">· {report.evaluated_at}</span>
              ) : null}
            </div>
          </div>

          <TantuTag
            role={report.status === "breach" ? "alert" : "status"}
            aria-label={statusMeta.accessibleLabel}
            tone={statusMeta.tone}
            solid={statusMeta.solid}
            data-testid="slo-status-pill"
            data-slo-status={report.status}
          >
            {statusMeta.label}
          </TantuTag>
        </header>

        <dl
          aria-label="SLO metrics versus targets"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
            gap: "0.6rem",
            margin: 0,
          }}
        >
          <div
            data-testid="slo-metric-p95"
            data-metric-tone={p95Tone}
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
                fontSize: "1.05rem",
                fontWeight: 700,
                fontFamily: "var(--tantu-font-mono, monospace)",
              }}
            >
              {formatLatencyMs(report.metrics.p95_latency_ms)}
              <span
                style={{
                  display: "block",
                  fontSize: "0.74rem",
                  fontWeight: 400,
                  marginTop: "0.15rem",
                  color: "var(--tantu-ink-secondary, #555555)",
                }}
              >
                vs {formatLatencyMs(report.targets.max_p95_latency_ms)} max
              </span>
            </dd>
          </div>

          <div
            data-testid="slo-metric-error-rate"
            data-metric-tone={errorTone}
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
                fontSize: "1.05rem",
                fontWeight: 700,
                fontFamily: "var(--tantu-font-mono, monospace)",
              }}
            >
              {formatErrorRate(report.metrics.error_rate)}
              <span
                style={{
                  display: "block",
                  fontSize: "0.74rem",
                  fontWeight: 400,
                  marginTop: "0.15rem",
                  color: "var(--tantu-ink-secondary, #555555)",
                }}
              >
                vs {formatErrorRate(report.targets.max_error_rate)} max
              </span>
            </dd>
          </div>

          <div
            data-testid="slo-metric-cost"
            data-metric-tone={costTone}
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
                fontSize: "1.05rem",
                fontWeight: 700,
                fontFamily: "var(--tantu-font-mono, monospace)",
              }}
            >
              {formatUsdCost(report.metrics.total_cost_usd)}
              <span
                style={{
                  display: "block",
                  fontSize: "0.74rem",
                  fontWeight: 400,
                  marginTop: "0.15rem",
                  color: "var(--tantu-ink-secondary, #555555)",
                }}
              >
                vs {formatUsdCost(report.targets.max_cost_usd)} cap
              </span>
            </dd>
          </div>

          <div
            data-testid="slo-metric-events"
            style={{
              padding: "0.55rem 0.65rem",
              background: "var(--tantu-bg-elevated, #faf9f6)",
              border: "1px solid var(--tantu-border-hairline, #d4d0c8)",
            }}
          >
            <dt className="tantu-meta-kasuti" style={{ fontSize: "0.7rem", margin: 0 }}>
              EVENTS EVALUATED
            </dt>
            <dd
              style={{
                margin: "0.2rem 0 0 0",
                fontSize: "1.05rem",
                fontWeight: 700,
                fontFamily: "var(--tantu-font-mono, monospace)",
              }}
            >
              {formatEventCount(report.metrics.total_events)}
              {typeof report.targets.min_events === "number" ? (
                <span
                  style={{
                    display: "block",
                    fontSize: "0.74rem",
                    fontWeight: 400,
                    marginTop: "0.15rem",
                    color: "var(--tantu-ink-secondary, #555555)",
                  }}
                >
                  min {formatEventCount(report.targets.min_events)} required
                </span>
              ) : null}
            </dd>
          </div>
        </dl>

        {breaches.length > 0 ? (
          <section aria-label="SLO breaches" data-testid="slo-breaches-section">
            <h4
              className="tantu-meta-kasuti"
              style={{ margin: "0 0 0.45rem 0", fontSize: "0.8rem" }}
            >
              BREACHES ({breaches.length})
            </h4>
            <ul
              data-testid="slo-breaches-list"
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.45rem",
              }}
            >
              {breaches.map((breach, index) => {
                const isBreach = breach.severity === "breach";
                return (
                  <li
                    key={`${breach.metric}-${index}`}
                    data-testid={`slo-breach-${breach.metric}-${index}`}
                    data-severity={breach.severity}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.2rem",
                      padding: "0.5rem 0.65rem",
                      border: `1px solid ${
                        isBreach
                          ? "var(--tantu-accent, #9e2a2b)"
                          : "var(--tantu-border-hairline, #d4d0c8)"
                      }`,
                      background: "var(--tantu-bg-elevated, #faf9f6)",
                      fontSize: "0.82rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                        <TantuTag tone={isBreach ? "accent" : "caution"} solid={isBreach}>
                          {breach.severity.toUpperCase()}
                        </TantuTag>
                        <strong style={{ fontFamily: "var(--tantu-font-mono, monospace)" }}>
                          {breach.metric}
                        </strong>
                      </div>
                      <span
                        style={{
                          fontFamily: "var(--tantu-font-mono, monospace)",
                          fontSize: "0.78rem",
                          color: "var(--tantu-ink-secondary, #555555)",
                        }}
                      >
                        {formatSLOBreachValue(breach.metric, breach.observed)} /{" "}
                        {formatSLOBreachValue(breach.metric, breach.threshold)}
                      </span>
                    </div>
                    <p style={{ margin: 0 }}>{breach.message}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <p
            data-testid="slo-no-breaches"
            style={{
              margin: 0,
              fontSize: "0.82rem",
              color: "var(--tantu-ink-secondary, #555555)",
            }}
          >
            {report.status === "insufficient_data"
              ? "Insufficient telemetry events to evaluate SLO thresholds."
              : "No SLO breaches detected."}
          </p>
        )}
      </div>
    </TantuCard>
  );
}
