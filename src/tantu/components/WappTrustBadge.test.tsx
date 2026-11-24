import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  WappTrustBadge,
  deriveWappTrustVerdict,
  formatChaosScorePercent,
} from "../index.js";

describe("WappTrustBadge", () => {
  it("renders trusted wapp-manifest-v1 posture with Ed25519 badge, Chaos score pill, and permission tags", () => {
    render(
      <WappTrustBadge
        appId="com.weave.morning-brief"
        name="Morning Brief Agent"
        version="1.4.0"
        signerKeyId="ed25519:9a4f2c"
        signatureStatus="verified"
        chaosCertification={{ certified: true, score: 0.94, profile: "edge_pi" }}
        permissions={["network:lan", "memory:read", "device:speaker"]}
      />,
    );

    const region = screen.getByRole("region", { name: "Wapp trust status for Morning Brief Agent" });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("data-trust-verdict", "trusted");
    expect(region).toHaveAttribute("data-signature-status", "verified");
    expect(region).toHaveAttribute("data-revoked", "false");

    const verdict = screen.getByTestId("wapp-trust-verdict");
    expect(verdict).toHaveAttribute("role", "status");
    expect(verdict).toHaveAttribute("aria-label", "Bundle trust status: trusted");
    expect(verdict).toHaveTextContent("TRUSTED");

    const sigBadge = screen.getByTestId("wapp-signature-badge");
    expect(sigBadge).toHaveAttribute("aria-label", "Ed25519 signature verified");
    expect(sigBadge).toHaveTextContent("ED25519 VERIFIED");

    const chaosPill = screen.getByTestId("wapp-chaos-pill");
    expect(chaosPill).toHaveAttribute("data-chaos-certified", "true");
    expect(chaosPill).toHaveAttribute(
      "aria-label",
      "Chaos certification passed with score 94% on profile edge_pi",
    );
    expect(chaosPill).toHaveTextContent("CHAOS 94%");

    expect(screen.queryByTestId("wapp-revoked-warning")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wapp-unverified-warning")).not.toBeInTheDocument();

    expect(screen.getByTestId("wapp-permission-network:lan")).toHaveTextContent("network:lan");
    expect(screen.getByTestId("wapp-permission-memory:read")).toHaveTextContent("memory:read");
    expect(screen.getByTestId("wapp-permission-device:speaker")).toHaveTextContent("device:speaker");
  });

  it("renders prominent revoked warning alert overriding verified signature", () => {
    render(
      <WappTrustBadge
        appId="com.weave.compromised-app"
        signatureStatus="verified"
        revoked
        revocationReason="Key rotated after incident #42"
        chaosCertification={{ certified: true, score: 0.91 }}
        permissions={["shell:exec"]}
      />,
    );

    const region = screen.getByRole("region", {
      name: "Wapp trust status for com.weave.compromised-app",
    });
    expect(region).toHaveAttribute("data-trust-verdict", "revoked");
    expect(region).toHaveAttribute("data-revoked", "true");

    const verdict = screen.getByTestId("wapp-trust-verdict");
    expect(verdict).toHaveTextContent("REVOKED");
    expect(verdict).toHaveAttribute("aria-label", "Bundle trust status: revoked");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-testid", "wapp-revoked-warning");
    expect(alert).toHaveTextContent("REVOKED BUNDLE");
    expect(alert).toHaveTextContent("Key rotated after incident #42");
  });

  it("renders unverified and invalid signature warning states and failed chaos pill", () => {
    const { rerender } = render(
      <WappTrustBadge
        appId="com.weave.unsigned-demo"
        signatureStatus="unverified"
        permissions={[]}
      />,
    );

    expect(screen.getByTestId("wapp-trust-verdict")).toHaveTextContent("UNVERIFIED");
    expect(screen.getByTestId("wapp-signature-badge")).toHaveTextContent("ED25519 UNVERIFIED");
    expect(screen.getByTestId("wapp-chaos-pill")).toHaveTextContent("CHAOS N/A");
    expect(screen.getByTestId("wapp-unverified-warning")).toHaveAttribute("role", "status");
    expect(screen.getByTestId("wapp-permissions-empty")).toHaveTextContent("No permissions declared.");

    rerender(
      <WappTrustBadge
        appId="com.weave.tampered-app"
        signatureStatus="invalid"
        chaosCertification={{ certified: false, score: 0.42, profile: "tool_flaky" }}
      />,
    );

    expect(screen.getByTestId("wapp-trust-verdict")).toHaveTextContent("UNTRUSTED");
    expect(screen.getByTestId("wapp-signature-badge")).toHaveTextContent("ED25519 INVALID");
    expect(screen.getByTestId("wapp-unverified-warning")).toHaveAttribute("role", "alert");
    expect(screen.getByTestId("wapp-chaos-pill")).toHaveTextContent("CHAOS 42% (FAIL)");
    expect(screen.getByTestId("wapp-chaos-pill")).toHaveAttribute(
      "aria-label",
      "Chaos certification failed with score 42% on profile tool_flaky",
    );
  });

  it("derives verdicts and formats chaos scores deterministically", () => {
    expect(deriveWappTrustVerdict("verified", true)).toBe("revoked");
    expect(deriveWappTrustVerdict("invalid", false)).toBe("untrusted");
    expect(deriveWappTrustVerdict("unverified", false)).toBe("unverified");
    expect(deriveWappTrustVerdict("verified", false, { certified: false, score: 0.5 })).toBe("caution");
    expect(deriveWappTrustVerdict("verified", false, { certified: true, score: 0.9 })).toBe("trusted");

    expect(formatChaosScorePercent(-0.2)).toBe("0%");
    expect(formatChaosScorePercent(1.5)).toBe("100%");
    expect(formatChaosScorePercent(0.876)).toBe("88%");
  });

  it("renders cleanly via SSR (renderToStaticMarkup)", () => {
    const html = renderToStaticMarkup(
      <WappTrustBadge
        appId="com.weave.ssr-check"
        signatureStatus="verified"
        chaosCertification={{ certified: true, score: 0.88 }}
        permissions={["memory:read"]}
      />,
    );
    expect(html).toContain('role="region"');
    expect(html).toContain("ED25519 VERIFIED");
    expect(html).toContain("CHAOS 88%");
    expect(html).toContain("memory:read");
  });
});
