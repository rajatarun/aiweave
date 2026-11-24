import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  PolicyGuardBanner,
  collectDeniedCapabilities,
  derivePolicyBannerTone,
  formatMaxCostPerCall,
  type AgentPolicyV1,
} from "../index.js";

describe("PolicyGuardBanner", () => {
  it("renders enforcing policy with role='alert', cost cap, and deduplicated denied capability tags", () => {
    const policy: AgentPolicyV1 = {
      schema: "agent-policy-v1",
      policy_id: "pol-edge-01",
      subject_id: "contract-pi-home",
      enforcement_mode: "enforce",
      routing_mode: "local_only",
      max_cost_usd_per_call: 0.0,
      max_delegation_depth: 2,
      denied_scopes: ["admin:root", "shell:exec"],
      denied_tools: ["shell:exec", "http:unrestricted"],
      denied_permissions: ["fs:write_root"],
    };

    render(<PolicyGuardBanner policy={policy} />);

    const banner = screen.getByRole("alert");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("data-schema-version", "agent-policy-v1");
    expect(banner).toHaveAttribute("data-policy-id", "pol-edge-01");
    expect(banner).toHaveAttribute("data-enforcement-mode", "enforce");
    expect(banner).toHaveAttribute("data-routing-mode", "local_only");

    expect(screen.getByTestId("policy-enforcement-badge")).toHaveTextContent("ENFORCE");
    expect(screen.getByTestId("policy-routing-badge")).toHaveTextContent("LOCAL ONLY");
    expect(screen.getByTestId("policy-max-cost")).toHaveTextContent("$0.00");
    expect(screen.getByTestId("policy-max-delegation-depth")).toHaveTextContent("2");

    // Deduplicated across denied_scopes, denied_tools, denied_permissions
    expect(screen.getByTestId("policy-denied-tag-admin:root")).toBeInTheDocument();
    expect(screen.getByTestId("policy-denied-tag-shell:exec")).toBeInTheDocument();
    expect(screen.getByTestId("policy-denied-tag-http:unrestricted")).toBeInTheDocument();
    expect(screen.getByTestId("policy-denied-tag-fs:write_root")).toBeInTheDocument();
  });

  it("renders halt routing mode with role='alert' and halt notice even in audit mode", () => {
    const haltedPolicy: AgentPolicyV1 = {
      policy_id: "pol-halt-01",
      enforcement_mode: "audit",
      routing_mode: "halt",
      max_cost_usd_per_call: 0,
    };

    render(<PolicyGuardBanner policy={haltedPolicy} ariaLabel="Budget Halt Guard" />);

    const banner = screen.getByRole("alert", { name: "Budget Halt Guard" });
    expect(banner).toBeInTheDocument();
    expect(screen.getByTestId("policy-routing-badge")).toHaveTextContent("HALT");
    expect(screen.getByTestId("policy-halt-notice")).toHaveTextContent(
      "Execution halted by active budget/policy guard.",
    );
  });

  it("renders audit/disabled non-halt policies with role='status' and uncapped cost display", () => {
    const auditPolicy: AgentPolicyV1 = {
      policy_id: "pol-audit-01",
      enforcement_mode: "audit",
      routing_mode: "prefer_local",
      max_cost_usd_per_call: 0.01,
    };

    const { rerender } = render(<PolicyGuardBanner policy={auditPolicy} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByTestId("policy-enforcement-badge")).toHaveTextContent("AUDIT");
    expect(screen.getByTestId("policy-routing-badge")).toHaveTextContent("PREFER LOCAL");
    expect(screen.getByTestId("policy-max-cost")).toHaveTextContent("$0.01");
    expect(screen.getByTestId("policy-denied-empty")).toHaveTextContent("No denied capabilities.");

    const disabledPolicy: AgentPolicyV1 = {
      policy_id: "pol-disabled-01",
      enforcement_mode: "disabled",
      routing_mode: "normal",
      max_cost_usd_per_call: null,
    };
    rerender(<PolicyGuardBanner policy={disabledPolicy} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByTestId("policy-enforcement-badge")).toHaveTextContent("DISABLED");
    expect(screen.getByTestId("policy-routing-badge")).toHaveTextContent("NORMAL");
    expect(screen.getByTestId("policy-max-cost")).toHaveTextContent("Uncapped");

    const html = renderToStaticMarkup(<PolicyGuardBanner policy={disabledPolicy} />);
    expect(html).toContain("pol-disabled-01");
  });

  it("exposes pure helpers for tone derivation, cost formatting, and capability collection", () => {
    expect(derivePolicyBannerTone("enforce", "halt")).toBe("critical");
    expect(derivePolicyBannerTone("enforce", "local_only")).toBe("caution");
    expect(derivePolicyBannerTone("enforce", "prefer_local")).toBe("caution");
    expect(derivePolicyBannerTone("enforce", "normal")).toBe("info");
    expect(derivePolicyBannerTone("audit", "normal")).toBe("caution");
    expect(derivePolicyBannerTone("disabled", "normal")).toBe("info");

    expect(formatMaxCostPerCall(null)).toBe("Uncapped");
    expect(formatMaxCostPerCall(undefined)).toBe("Uncapped");
    expect(formatMaxCostPerCall(0.005)).toBe("$0.0050");

    expect(
      collectDeniedCapabilities({
        policy_id: "p",
        enforcement_mode: "enforce",
        routing_mode: "normal",
        denied_scopes: [" a ", "b"],
        denied_tools: ["b", ""],
        denied_permissions: ["c"],
      }),
    ).toEqual(["a", "b", "c"]);
  });
});
