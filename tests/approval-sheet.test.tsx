import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ApprovalSheet, canonicalizeArgs } from "../src/tantu/index";

describe("ApprovalSheet", () => {
  it("renders tool name, risk tier badge, summary, and key-sorted canonical args", () => {
    render(
      <ApprovalSheet
        open
        toolName="device.unlock_front_door"
        riskTier="critical"
        agentName="home-concierge"
        summary="Unlock the front door for the arriving courier."
        args={{ z_reason: "delivery", a_device_id: "lock-01", nested: { b: 2, a: 1 } }}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("data-risk-tier", "critical");

    expect(screen.getByText("device.unlock_front_door")).toBeInTheDocument();
    expect(screen.getByTestId("approval-risk-badge")).toHaveTextContent("CRITICAL RISK");
    expect(screen.getByText("AGENT · home-concierge")).toBeInTheDocument();
    expect(
      screen.getByText("Unlock the front door for the arriving courier."),
    ).toBeInTheDocument();

    const preview = screen.getByTestId("approval-args-preview");
    expect(preview.textContent).toBe(
      canonicalizeArgs({ a_device_id: "lock-01", nested: { a: 1, b: 2 }, z_reason: "delivery" }),
    );
  });

  it("renders all four risk tier badges accurately", () => {
    const tiers = [
      ["low", "LOW RISK"],
      ["medium", "MEDIUM RISK"],
      ["high", "HIGH RISK"],
      ["critical", "CRITICAL RISK"],
    ] as const;

    for (const [tier, expectedLabel] of tiers) {
      const { unmount } = render(
        <ApprovalSheet
          open
          toolName={`tool.${tier}`}
          riskTier={tier}
          args={{ tier }}
          onApprove={() => {}}
          onReject={() => {}}
        />,
      );
      const badge = screen.getByTestId("approval-risk-badge");
      expect(badge).toHaveTextContent(expectedLabel);
      expect(badge).toHaveAttribute("data-risk-tier", tier);
      unmount();
    }
  });

  it("invokes onApprove and onReject callbacks on button clicks", () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();

    render(
      <ApprovalSheet
        open
        toolName="calendar.create_event"
        riskTier="medium"
        args={{ title: "Standup" }}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it("dismisses via Escape key (calling onClose or defaulting to onReject)", () => {
    const onReject = vi.fn();
    const { rerender } = render(
      <ApprovalSheet
        open
        toolName="shell.exec"
        riskTier="high"
        args={{ cmd: "rm -rf /tmp/demo" }}
        onApprove={() => {}}
        onReject={onReject}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onReject).toHaveBeenCalledTimes(1);

    const onClose = vi.fn();
    rerender(
      <ApprovalSheet
        open
        toolName="shell.exec"
        riskTier="high"
        args={{ cmd: "rm -rf /tmp/demo" }}
        onApprove={() => {}}
        onReject={onReject}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not render when closed and disables buttons when busy", () => {
    const { rerender } = render(
      <ApprovalSheet
        open={false}
        toolName="notes.append"
        riskTier="low"
        args={{ text: "hi" }}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(
      <ApprovalSheet
        open
        busy
        toolName="notes.append"
        riskTier="low"
        args={{ text: "hi" }}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
  });
});
