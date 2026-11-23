import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DoctorHealthCard,
  type DoctorOverallStatus,
} from "../index.js";

describe("DoctorHealthCard", () => {
  it("renders overall status, SQLite WAL state, optional plugins, and security posture", () => {
    render(
      <DoctorHealthCard
        status="healthy"
        hostLabel="PI5-NODE"
        checkedAt="2026-11-23T12:30:00Z"
        sqliteWal={{
          enabled: true,
          journalMode: "wal",
          dbPath: "/var/lib/weaveos/weaveos.db",
          detail: "writable",
        }}
        plugins={[
          { name: "cipherweave", mode: "active", version: "0.2.0" },
          { name: "gatewayweave", mode: "active", version: "0.1.0" },
          { name: "promptweave", mode: "fallback", detail: "using stdlib renderer" },
        ]}
        securityPosture={[
          { id: "ed25519", label: "Ed25519 Passport Admission", level: "pass" },
          { id: "revocations", label: "Passport Revocation List", level: "warn", detail: "empty" },
          { id: "ssrf", label: "LAN Allowlist Guard", level: "pass" },
        ]}
      />,
    );

    const card = screen.getByRole("article", { name: "System Health Diagnostics" });
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute("data-health-status", "healthy");

    const overallBadge = screen.getByTestId("doctor-overall-status");
    expect(overallBadge).toHaveAttribute("role", "status");
    expect(overallBadge).toHaveAttribute("data-status", "healthy");
    expect(overallBadge).toHaveTextContent("HEALTHY");

    const walBadge = screen.getByTestId("doctor-wal-badge");
    expect(walBadge).toHaveAttribute("data-wal-enabled", "true");
    expect(walBadge).toHaveTextContent("WAL ACTIVE (WAL)");

    const cipherPlugin = screen.getByTestId("doctor-plugin-cipherweave");
    expect(cipherPlugin).toHaveAttribute("data-plugin-mode", "active");
    expect(cipherPlugin).toHaveTextContent("ACTIVE");

    const promptPlugin = screen.getByTestId("doctor-plugin-promptweave");
    expect(promptPlugin).toHaveAttribute("data-plugin-mode", "fallback");
    expect(promptPlugin).toHaveTextContent("FALLBACK");

    expect(screen.getByTestId("doctor-security-ed25519")).toHaveTextContent("PASS");
    expect(screen.getByTestId("doctor-security-revocations")).toHaveTextContent("WARN");
  });

  it("renders all three overall health status badges accurately", () => {
    const statuses: Array<[DoctorOverallStatus, string]> = [
      ["healthy", "HEALTHY"],
      ["degraded", "DEGRADED"],
      ["unhealthy", "UNHEALTHY"],
    ];

    for (const [status, expectedLabel] of statuses) {
      const { unmount } = render(
        <DoctorHealthCard
          status={status}
          sqliteWal={{ enabled: status !== "unhealthy", journalMode: status === "unhealthy" ? "delete" : "wal" }}
          plugins={[]}
          securityPosture={[]}
        />,
      );
      const badge = screen.getByTestId("doctor-overall-status");
      expect(badge).toHaveTextContent(expectedLabel);
      expect(badge).toHaveAttribute("data-status", status);
      unmount();
    }
  });

  it("renders disabled WAL state and empty states for plugins and security posture", () => {
    render(
      <DoctorHealthCard
        status="unhealthy"
        sqliteWal={{ enabled: false, journalMode: "delete", detail: "read-only filesystem" }}
        plugins={[]}
        securityPosture={[]}
      />,
    );

    const walBadge = screen.getByTestId("doctor-wal-badge");
    expect(walBadge).toHaveAttribute("data-wal-enabled", "false");
    expect(walBadge).toHaveTextContent("WAL DISABLED (DELETE)");
    expect(screen.getByTestId("doctor-plugins-empty")).toBeInTheDocument();
    expect(screen.getByTestId("doctor-security-empty")).toBeInTheDocument();
  });

  it("renders cleanly via SSR (renderToStaticMarkup)", () => {
    const html = renderToStaticMarkup(
      <DoctorHealthCard
        status="degraded"
        sqliteWal={{ enabled: true, journalMode: "wal" }}
        plugins={[{ name: "contextweave", mode: "fallback" }]}
        securityPosture={[{ id: "tls", label: "Local UDS Socket", level: "fail" }]}
      />,
    );
    expect(html).toContain("DEGRADED");
    expect(html).toContain("contextweave");
    expect(html).toContain("FAIL");
  });
});
