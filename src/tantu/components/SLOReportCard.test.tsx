import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  SLOReportCard,
  formatSLOBreachValue,
  type SLOReportV1,
} from "../index.js";

const BASE_TARGETS = {
  max_p95_latency_ms: 2000,
  max_error_rate: 0.05,
  max_cost_usd: 5.0,
  min_events: 10,
};

describe("SLOReportCard", () => {
  it("renders a passing slo-report-v1 payload with accessible region and formatted metrics", () => {
    const report: SLOReportV1 = {
      schema: "slo-report-v1",
      evaluated_at: "2026-11-24T12:00:00Z",
      window_label: "last_24h",
      source_repo: "HarnessWeave",
      status: "pass",
      metrics: {
        total_events: 420,
        error_rate: 0.012,
        p50_latency_ms: 110.5,
        p95_latency_ms: 480.2,
        total_cost_usd: 1.25,
      },
      targets: BASE_TARGETS,
      breaches: [],
    };

    render(<SLOReportCard report={report} title="Edge SLO Status" />);

    const region = screen.getByRole("region", { name: "Edge SLO Status" });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("data-schema-version", "slo-report-v1");
    expect(region).toHaveAttribute("data-slo-status", "pass");

    const pill = screen.getByTestId("slo-status-pill");
    expect(pill).toHaveAttribute("role", "status");
    expect(pill).toHaveAttribute("aria-label", "SLO status: pass");
    expect(pill).toHaveTextContent("PASS");

    expect(screen.getByTestId("slo-source-repo")).toHaveTextContent("HarnessWeave");
    expect(screen.getByTestId("slo-window-label")).toHaveTextContent("last_24h");
    expect(screen.getByTestId("slo-metric-p95")).toHaveTextContent("480.2 ms");
    expect(screen.getByTestId("slo-metric-p95")).toHaveTextContent("vs 2000.0 ms max");
    expect(screen.getByTestId("slo-metric-error-rate")).toHaveTextContent("1.2%");
    expect(screen.getByTestId("slo-metric-error-rate")).toHaveTextContent("vs 5.0% max");
    expect(screen.getByTestId("slo-metric-cost")).toHaveTextContent("$1.25");
    expect(screen.getByTestId("slo-metric-cost")).toHaveTextContent("vs $5.00 cap");
    expect(screen.getByTestId("slo-metric-events")).toHaveTextContent("420");
    expect(screen.getByTestId("slo-no-breaches")).toHaveTextContent("No SLO breaches detected.");
  });

  it("renders warn and breach states with alert role and itemized breach list", () => {
    const breachReport: SLOReportV1 = {
      schema: "slo-report-v1",
      status: "breach",
      metrics: {
        total_events: 150,
        error_rate: 0.082,
        p95_latency_ms: 2450.5,
        total_cost_usd: 4.5,
      },
      targets: BASE_TARGETS,
      breaches: [
        {
          metric: "p95_latency_ms",
          observed: 2450.5,
          threshold: 2000,
          severity: "breach",
          message: "p95 latency exceeded 2000ms target",
        },
        {
          metric: "total_cost_usd",
          observed: 4.5,
          threshold: 5.0,
          severity: "warn",
          message: "total cost is at 90% of daily cap",
        },
      ],
    };

    const { rerender } = render(
      <SLOReportCard report={breachReport} ariaLabel="Production SLO Card" />,
    );

    expect(screen.getByRole("region", { name: "Production SLO Card" })).toBeInTheDocument();
    const pill = screen.getByTestId("slo-status-pill");
    expect(pill).toHaveAttribute("role", "alert");
    expect(pill).toHaveTextContent("BREACH");

    expect(screen.getByTestId("slo-breaches-section")).toBeInTheDocument();
    expect(screen.getByTestId("slo-breach-p95_latency_ms-0")).toHaveTextContent(
      "p95 latency exceeded 2000ms target",
    );
    expect(screen.getByTestId("slo-breach-total_cost_usd-1")).toHaveTextContent(
      "total cost is at 90% of daily cap",
    );

    const warnReport: SLOReportV1 = {
      ...breachReport,
      status: "warn",
      breaches: [breachReport.breaches![1]],
    };
    rerender(<SLOReportCard report={warnReport} />);
    expect(screen.getByTestId("slo-status-pill")).toHaveAttribute("role", "status");
    expect(screen.getByTestId("slo-status-pill")).toHaveTextContent("WARN");
  });

  it("renders insufficient_data state cleanly and supports SSR", () => {
    const report: SLOReportV1 = {
      status: "insufficient_data",
      metrics: {
        total_events: 0,
        error_rate: 0,
        p95_latency_ms: 0,
        total_cost_usd: 0,
      },
      targets: BASE_TARGETS,
      breaches: [],
    };

    render(<SLOReportCard report={report} />);
    expect(screen.getByTestId("slo-status-pill")).toHaveTextContent("INSUFFICIENT DATA");
    expect(screen.getByTestId("slo-no-breaches")).toHaveTextContent(
      "Insufficient telemetry events to evaluate SLO thresholds.",
    );

    const html = renderToStaticMarkup(<SLOReportCard report={report} />);
    expect(html).toContain("INSUFFICIENT DATA");
  });

  it("formats breach values by metric type", () => {
    expect(formatSLOBreachValue("p95_latency_ms", 1234.56)).toBe("1234.6 ms");
    expect(formatSLOBreachValue("error_rate", 0.075)).toBe("7.5%");
    expect(formatSLOBreachValue("total_cost_usd", 6.25)).toBe("$6.25");
    expect(formatSLOBreachValue("custom_count", 42)).toBe("42");
    expect(formatSLOBreachValue("custom_count", Number.NaN)).toBe("0");
  });
});
