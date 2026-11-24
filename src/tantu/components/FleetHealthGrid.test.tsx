import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { FleetHealthGrid, type FleetHealthV1 } from "../index.js";

describe("FleetHealthGrid", () => {
  it("renders healthy fleet with summary counters, node cards, and zero axe violations", async () => {
    const fleet: FleetHealthV1 = {
      schema: "fleet-health-v1",
      fleet_id: "home-pi-fleet",
      generated_at: "2026-11-24T12:00:00Z",
      nodes: [
        {
          node_id: "pi5-kitchen",
          status: "healthy",
          slo_passed: true,
          budget_mode: "normal",
          active_wapps: 4,
          last_seen_at: "2026-11-24T11:59:50Z",
        },
        {
          node_id: "pi4-study",
          status: "healthy",
          slo_passed: true,
          budget_mode: "prefer_local",
          active_wapps: 2,
          last_seen_at: "2026-11-24T11:59:45Z",
        },
      ],
      summary: {
        total_nodes: 2,
        healthy: 2,
        degraded: 0,
        offline: 0,
        overall_status: "healthy",
      },
    };

    const { container } = render(<FleetHealthGrid fleet={fleet} title="Home Fleet" />);

    const region = screen.getByRole("region", { name: "Home Fleet" });
    expect(region).toHaveAttribute("data-schema-version", "fleet-health-v1");
    expect(region).toHaveAttribute("data-fleet-status", "healthy");

    const badge = screen.getByTestId("fleet-overall-badge");
    expect(badge).toHaveAttribute("role", "status");
    expect(badge).toHaveTextContent("HEALTHY");

    expect(screen.getByTestId("fleet-count-total")).toHaveTextContent("2");
    expect(screen.getByTestId("fleet-count-healthy")).toHaveTextContent("2");
    expect(screen.getByTestId("fleet-node-pi5-kitchen")).toBeInTheDocument();
    expect(screen.getByTestId("fleet-node-slo-pi5-kitchen")).toHaveTextContent("SLO Pass");
    expect(screen.getByTestId("fleet-node-budget-pi4-study")).toHaveTextContent("prefer_local");
    expect(screen.getByTestId("fleet-node-wapps-pi5-kitchen")).toHaveTextContent("4");

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it("renders degraded and critical states with alert role and per-node reasons", async () => {
    const fleet: FleetHealthV1 = {
      schema: "fleet-health-v1",
      fleet_id: "edge-cluster-01",
      generated_at: "2026-11-24T12:15:00Z",
      nodes: [
        {
          node_id: "pi5-garage",
          status: "degraded",
          slo_passed: false,
          budget_mode: "local_only",
          active_wapps: 1,
          last_seen_at: "2026-11-24T12:14:30Z",
          reasons: ["p95 latency exceeded 2000ms"],
        },
        {
          node_id: "pi4-attic",
          status: "offline",
          slo_passed: false,
          budget_mode: "halt",
          active_wapps: 0,
          last_seen_at: "2026-11-24T11:00:00Z",
          reasons: ["Heartbeat stale >300s"],
        },
      ],
      summary: {
        total_nodes: 2,
        healthy: 0,
        degraded: 1,
        offline: 1,
        overall_status: "critical",
      },
    };

    const { container } = render(<FleetHealthGrid fleet={fleet} />);

    const badge = screen.getByTestId("fleet-overall-badge");
    expect(badge).toHaveAttribute("role", "alert");
    expect(badge).toHaveTextContent("CRITICAL");

    expect(screen.getByTestId("fleet-node-slo-pi5-garage")).toHaveTextContent("SLO Breach");
    expect(screen.getByTestId("fleet-node-reasons-pi5-garage")).toHaveTextContent(
      "p95 latency exceeded 2000ms",
    );
    expect(screen.getByTestId("fleet-node-reasons-pi4-attic")).toHaveTextContent(
      "Heartbeat stale >300s",
    );

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it("renders empty fleet state cleanly", async () => {
    const emptyFleet: FleetHealthV1 = {
      schema: "fleet-health-v1",
      fleet_id: "empty-fleet",
      generated_at: "2026-11-24T12:20:00Z",
      nodes: [],
      summary: {
        total_nodes: 0,
        healthy: 0,
        degraded: 0,
        offline: 0,
        overall_status: "healthy",
      },
    };

    const { container } = render(<FleetHealthGrid fleet={emptyFleet} />);
    expect(screen.getByTestId("fleet-empty-state")).toHaveTextContent(
      "No edge nodes registered in this fleet.",
    );

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
