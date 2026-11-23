import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { FlowTimeline, type FlowTimelineEvent } from "../index.js";

const SAMPLE_EVENTS: FlowTimelineEvent[] = [
  {
    id: "e1",
    type: "flow.started",
    timestamp: "2026-11-23T12:00:00Z",
    title: "Home evening routine",
    summary: "Triggered via weave-trigger-v1 webhook.",
  },
  {
    id: "e2",
    type: "flow.step",
    timestamp: "2026-11-23T12:00:01Z",
    stepName: "memory.recall",
    summary: "Loaded evening preferences from ContextWeave.",
    details: { hits: 3, latency_ms: 14 },
  },
  {
    id: "e3",
    type: "approval.requested",
    timestamp: "2026-11-23T12:00:02Z",
    stepName: "device.lock_doors",
    details: { devices: ["front-door", "patio-door"] },
  },
  {
    id: "e4",
    type: "approval.resolved",
    timestamp: "2026-11-23T12:00:08Z",
    stepName: "device.lock_doors",
    status: "approved",
    summary: "Approved by operator.",
  },
  {
    id: "e5",
    type: "flow.completed",
    timestamp: "2026-11-23T12:00:09Z",
    summary: "All steps succeeded.",
  },
];

describe("FlowTimeline", () => {
  it("renders ordered flow lifecycle events with status badges, timestamps, and ARIA log role", () => {
    render(<FlowTimeline flowId="run-101" events={SAMPLE_EVENTS} />);

    const logRegion = screen.getByRole("log", { name: "Flow execution timeline" });
    expect(logRegion).toBeInTheDocument();
    expect(logRegion).toHaveAttribute("aria-live", "polite");
    expect(screen.getByTestId("flow-timeline-id")).toHaveTextContent("FLOW · run-101");

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveAttribute("data-event-type", "flow.started");
    expect(items[1]).toHaveAttribute("data-event-type", "flow.step");
    expect(items[2]).toHaveAttribute("data-event-type", "approval.requested");
    expect(items[3]).toHaveAttribute("data-event-type", "approval.resolved");
    expect(items[4]).toHaveAttribute("data-event-type", "flow.completed");

    expect(screen.getByTestId("flow-event-badge-e1")).toHaveTextContent("RUNNING");
    expect(screen.getByTestId("flow-event-badge-e3")).toHaveTextContent("APPROVAL REQUIRED");
    expect(screen.getByTestId("flow-event-badge-e4")).toHaveTextContent("APPROVED");
    expect(screen.getByTestId("flow-event-badge-e5")).toHaveTextContent("COMPLETED");

    expect(screen.getByTestId("flow-event-time-e1")).toHaveAttribute(
      "datetime",
      "2026-11-23T12:00:00Z",
    );
  });

  it("toggles step detail disclosure panels via accessible aria-expanded buttons", () => {
    render(<FlowTimeline events={SAMPLE_EVENTS} />);

    expect(screen.queryByTestId("flow-event-details-e2")).not.toBeInTheDocument();

    const toggleButtons = screen.getAllByRole("button", { name: "Show details" });
    expect(toggleButtons).toHaveLength(2);
    expect(toggleButtons[0]).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggleButtons[0]);
    expect(toggleButtons[0]).toHaveAttribute("aria-expanded", "true");
    const detailsPanel = screen.getByTestId("flow-event-details-e2");
    expect(detailsPanel).toBeInTheDocument();
    expect(detailsPanel.textContent).toContain('"latency_ms": 14');

    fireEvent.click(screen.getByRole("button", { name: "Hide details" }));
    expect(screen.queryByTestId("flow-event-details-e2")).not.toBeInTheDocument();
  });

  it("renders accessible empty state when no events are provided", () => {
    render(<FlowTimeline events={[]} emptyMessage="Waiting for SSE events..." />);

    const logRegion = screen.getByRole("log");
    expect(logRegion).toHaveAttribute("aria-live", "polite");
    expect(screen.getByTestId("flow-timeline-empty")).toHaveTextContent(
      "Waiting for SSE events...",
    );
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("renders cleanly via SSR (renderToStaticMarkup)", () => {
    const html = renderToStaticMarkup(
      <FlowTimeline flowId="ssr-run" events={SAMPLE_EVENTS.slice(0, 2)} />,
    );
    expect(html).toContain('role="log"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Home evening routine");
  });
});
