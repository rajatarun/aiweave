import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  TelemetrySummaryCard,
  formatErrorRate,
  formatEventCount,
  formatLatencyMs,
  formatUsdCost,
} from "../index.js";

describe("TelemetrySummaryCard", () => {
  it("renders aggregate weave-telemetry-v1 metrics and per-repo breakdown rows with ARIA region", () => {
    render(
      <TelemetrySummaryCard
        title="Edge Agent Telemetry"
        windowLabel="Last 24h"
        totalEvents={1420}
        p50LatencyMs={42.46}
        p95LatencyMs={189.2}
        errorRate={0.025}
        errorCount={36}
        totalCostUsd={1.854}
        totalTokensIn={125000}
        totalTokensOut={48200}
        repos={[
          {
            sourceRepo: "HarnessWeave",
            totalEvents: 820,
            errorRate: 0,
            p50LatencyMs: 38.0,
            p95LatencyMs: 140.5,
            totalCostUsd: 1.2,
          },
          {
            sourceRepo: "ModelWeave",
            totalEvents: 400,
            errorRate: 0.015,
            p50LatencyMs: 65.2,
            p95LatencyMs: 210.0,
            totalCostUsd: 0.65,
          },
          {
            sourceRepo: "ToolWeave",
            totalEvents: 200,
            errorRate: 0.12,
            p50LatencyMs: 19.4,
            p95LatencyMs: 95.8,
            totalCostUsd: 0.0042,
          },
        ]}
      />,
    );

    const region = screen.getByRole("region", { name: "Edge Agent Telemetry" });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-label", "Edge Agent Telemetry");
    expect(region).toHaveAttribute("data-schema-version", "weave-telemetry-v1");

    expect(screen.getByTestId("telemetry-window-label")).toHaveTextContent("Last 24h");
    expect(screen.getByTestId("telemetry-health-badge")).toHaveTextContent("DEGRADED");

    expect(screen.getByTestId("telemetry-metric-events")).toHaveTextContent("1,420");
    expect(screen.getByTestId("telemetry-metric-p50")).toHaveTextContent("42.5 ms");
    expect(screen.getByTestId("telemetry-metric-p95")).toHaveTextContent("189.2 ms");
    expect(screen.getByTestId("telemetry-metric-error-rate")).toHaveTextContent("2.5%");
    expect(screen.getByTestId("telemetry-metric-error-rate")).toHaveTextContent("(36)");
    expect(screen.getByTestId("telemetry-metric-cost")).toHaveTextContent("$1.85");
    expect(screen.getByTestId("telemetry-token-totals")).toHaveTextContent("125,000 in / 48,200 out");

    const table = screen.getByTestId("telemetry-repos-table");
    expect(table).toBeInTheDocument();

    const harnessRow = screen.getByTestId("telemetry-repo-row-HarnessWeave");
    expect(within(harnessRow).getByText("HarnessWeave")).toBeInTheDocument();
    expect(within(harnessRow).getByText("820")).toBeInTheDocument();
    expect(within(harnessRow).getByText("38.0 ms")).toBeInTheDocument();
    expect(within(harnessRow).getByText("140.5 ms")).toBeInTheDocument();
    expect(within(harnessRow).getByText("0.0%")).toBeInTheDocument();
    expect(within(harnessRow).getByText("$1.20")).toBeInTheDocument();

    const toolRow = screen.getByTestId("telemetry-repo-row-ToolWeave");
    expect(within(toolRow).getByText("12.0%")).toBeInTheDocument();
    expect(within(toolRow).getByText("$0.0042")).toBeInTheDocument();
  });

  it("supports custom ariaLabel, elevated error status, and empty repository breakdown", () => {
    render(
      <TelemetrySummaryCard
        ariaLabel="Production Observatory Rollup"
        totalEvents={0}
        p50LatencyMs={0}
        p95LatencyMs={0}
        errorRate={0.08}
        totalCostUsd={0}
        repos={[]}
      />,
    );

    const region = screen.getByRole("region", { name: "Production Observatory Rollup" });
    expect(region).toHaveAttribute("aria-label", "Production Observatory Rollup");
    expect(region).toHaveAttribute("data-error-state", "elevated_errors");

    const badge = screen.getByTestId("telemetry-health-badge");
    expect(badge).toHaveAttribute("role", "status");
    expect(badge).toHaveTextContent("ELEVATED ERRORS");

    expect(screen.getByTestId("telemetry-repos-empty")).toHaveTextContent(
      "No per-repository telemetry recorded yet.",
    );
  });

  it("formats edge-case metric values safely without NaN or negative outputs", () => {
    expect(formatEventCount(-5)).toBe("0");
    expect(formatEventCount(12345)).toBe("12,345");
    expect(formatLatencyMs(Number.NaN)).toBe("0.0 ms");
    expect(formatLatencyMs(12.34)).toBe("12.3 ms");
    expect(formatErrorRate(-0.5)).toBe("0.0%");
    expect(formatErrorRate(1.5)).toBe("100.0%");
    expect(formatErrorRate(0.034)).toBe("3.4%");
    expect(formatUsdCost(0)).toBe("$0.00");
    expect(formatUsdCost(0.0025)).toBe("$0.0025");
    expect(formatUsdCost(12.345)).toBe("$12.35");
  });

  it("renders cleanly via SSR (renderToStaticMarkup)", () => {
    const html = renderToStaticMarkup(
      <TelemetrySummaryCard
        totalEvents={50}
        p50LatencyMs={15.0}
        p95LatencyMs={40.0}
        errorRate={0}
        totalCostUsd={0.05}
        repos={[
          {
            sourceRepo: "ModelWeave",
            totalEvents: 50,
            errorRate: 0,
            p50LatencyMs: 15.0,
            p95LatencyMs: 40.0,
            totalCostUsd: 0.05,
          },
        ]}
      />,
    );
    expect(html).toContain('role="region"');
    expect(html).toContain("NOMINAL");
    expect(html).toContain("ModelWeave");
    expect(html).toContain("$0.05");
  });
});
