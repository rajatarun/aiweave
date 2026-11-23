import { useId, type HTMLAttributes } from "react";

import { TantuCard } from "./TantuCard.js";
import { TantuTag, type TantuTagTone } from "./TantuTag.js";

export type DoctorOverallStatus = "healthy" | "degraded" | "unhealthy";
export type DoctorPluginMode = "active" | "fallback";
export type DoctorSecurityLevel = "pass" | "warn" | "fail";

export interface DoctorSqliteWalStatus {
  /** Whether SQLite WAL mode is enabled and writable. */
  enabled: boolean;
  /** Reported SQLite journal mode (e.g. `wal`, `delete`). */
  journalMode?: string;
  /** Optional database path shown for operator diagnostics. */
  dbPath?: string;
  /** Optional diagnostic note. */
  detail?: string;
}

export interface DoctorPluginEntry {
  /** Canonical Weave sibling module name (e.g. `cipherweave`, `contextweave`). */
  name: string;
  /** Whether the optional plugin is actively wired or running in built-in fallback mode. */
  mode: DoctorPluginMode;
  /** Optional installed package version. */
  version?: string;
  /** Optional short diagnostic note. */
  detail?: string;
}

export interface DoctorSecurityIndicator {
  /** Stable identifier for the security check. */
  id: string;
  /** Human-readable posture indicator label (e.g. `Ed25519 Passport Admission`). */
  label: string;
  /** Evaluation outcome (`pass | warn | fail`). */
  level: DoctorSecurityLevel;
  /** Optional remediation or status detail. */
  detail?: string;
}

export interface DoctorHealthCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Overall `weaveos-doctor` health verdict. */
  status: DoctorOverallStatus;
  /** SQLite WAL storage check summary. */
  sqliteWal: DoctorSqliteWalStatus;
  /** Optional sibling plugin discovery list with active/fallback status. */
  plugins: DoctorPluginEntry[];
  /** Security posture checks (identity, admission, PII firewall, token auth). */
  securityPosture: DoctorSecurityIndicator[];
  /** Card heading. */
  title?: string;
  /** Optional ISO-8601 timestamp for when diagnostics were collected. */
  checkedAt?: string;
  /** Optional edge node / host label (e.g. `raspberrypi-5`). */
  hostLabel?: string;
}

const OVERALL_META: Record<
  DoctorOverallStatus,
  { label: string; tone: TantuTagTone; solid: boolean }
> = {
  healthy: { label: "HEALTHY", tone: "success", solid: true },
  degraded: { label: "DEGRADED", tone: "caution", solid: false },
  unhealthy: { label: "UNHEALTHY", tone: "accent", solid: true },
};

const PLUGIN_META: Record<
  DoctorPluginMode,
  { label: string; tone: TantuTagTone; solid: boolean }
> = {
  active: { label: "ACTIVE", tone: "success", solid: false },
  fallback: { label: "FALLBACK", tone: "caution", solid: false },
};

const SECURITY_META: Record<
  DoctorSecurityLevel,
  { label: string; tone: TantuTagTone; solid: boolean }
> = {
  pass: { label: "PASS", tone: "success", solid: false },
  warn: { label: "WARN", tone: "caution", solid: false },
  fail: { label: "FAIL", tone: "accent", solid: true },
};

/**
 * Accessible SystemUI diagnostics card rendering `weaveos-doctor` output.
 *
 * Displays the overall health status (`healthy | degraded | unhealthy`),
 * SQLite WAL storage status, installed optional plugins with `active` /
 * `fallback` tags, and security posture indicators.
 */
export function DoctorHealthCard({
  status,
  sqliteWal,
  plugins,
  securityPosture,
  title = "System Health Diagnostics",
  checkedAt,
  hostLabel,
  className,
  ...rest
}: DoctorHealthCardProps) {
  const headingId = useId();
  const overall = OVERALL_META[status];
  const walModeLabel = (sqliteWal.journalMode ?? (sqliteWal.enabled ? "wal" : "off")).toUpperCase();

  return (
    <TantuCard
      {...rest}
      aria-labelledby={headingId}
      talimCode={hostLabel ?? "DOCTOR"}
      data-health-status={status}
      className={["tantu-doctor-health-card", className].filter(Boolean).join(" ")}
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
            {checkedAt ? (
              <time
                dateTime={checkedAt}
                style={{
                  fontFamily: "var(--tantu-font-mono, monospace)",
                  fontSize: "0.75rem",
                  color: "var(--tantu-ink-secondary, #555555)",
                }}
              >
                Checked {checkedAt}
              </time>
            ) : null}
          </div>
          <TantuTag
            role="status"
            tone={overall.tone}
            solid={overall.solid}
            data-testid="doctor-overall-status"
            data-status={status}
          >
            {overall.label}
          </TantuTag>
        </header>

        <section aria-label="SQLite WAL storage">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <span className="tantu-meta-kasuti" style={{ fontWeight: 600 }}>
              SQLITE WAL STORAGE
            </span>
            <TantuTag
              tone={sqliteWal.enabled ? "success" : "accent"}
              solid={!sqliteWal.enabled}
              data-testid="doctor-wal-badge"
              data-wal-enabled={String(sqliteWal.enabled)}
            >
              {sqliteWal.enabled ? `WAL ACTIVE (${walModeLabel})` : `WAL DISABLED (${walModeLabel})`}
            </TantuTag>
          </div>
          {sqliteWal.dbPath || sqliteWal.detail ? (
            <p
              style={{
                margin: "0.35rem 0 0 0",
                fontSize: "0.8rem",
                color: "var(--tantu-ink-secondary, #555555)",
                fontFamily: "var(--tantu-font-mono, monospace)",
              }}
            >
              {[sqliteWal.dbPath, sqliteWal.detail].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </section>

        <section aria-label="Optional plugins">
          <h4 className="tantu-meta-kasuti" style={{ margin: "0 0 0.45rem 0", fontSize: "0.8rem" }}>
            OPTIONAL PLUGINS ({plugins.length})
          </h4>
          {plugins.length === 0 ? (
            <p
              data-testid="doctor-plugins-empty"
              style={{ margin: 0, fontSize: "0.85rem", color: "var(--tantu-ink-secondary, #555555)" }}
            >
              No optional plugins discovered.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
              }}
            >
              {plugins.map((plugin) => {
                const meta = PLUGIN_META[plugin.mode];
                return (
                  <li
                    key={plugin.name}
                    data-testid={`doctor-plugin-${plugin.name}`}
                    data-plugin-mode={plugin.mode}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                      padding: "0.4rem 0.6rem",
                      background: "var(--tantu-bg-elevated, #faf9f6)",
                      border: "1px solid var(--tantu-border-hairline, #d4d0c8)",
                    }}
                  >
                    <span style={{ fontSize: "0.85rem" }}>
                      <strong>{plugin.name}</strong>
                      {plugin.version ? ` v${plugin.version}` : ""}
                      {plugin.detail ? ` — ${plugin.detail}` : ""}
                    </span>
                    <TantuTag tone={meta.tone} solid={meta.solid}>
                      {meta.label}
                    </TantuTag>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="Security posture">
          <h4 className="tantu-meta-kasuti" style={{ margin: "0 0 0.45rem 0", fontSize: "0.8rem" }}>
            SECURITY POSTURE ({securityPosture.length})
          </h4>
          {securityPosture.length === 0 ? (
            <p
              data-testid="doctor-security-empty"
              style={{ margin: 0, fontSize: "0.85rem", color: "var(--tantu-ink-secondary, #555555)" }}
            >
              No security posture checks reported.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
              }}
            >
              {securityPosture.map((check) => {
                const meta = SECURITY_META[check.level];
                return (
                  <li
                    key={check.id}
                    data-testid={`doctor-security-${check.id}`}
                    data-security-level={check.level}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                      padding: "0.4rem 0.6rem",
                      background: "var(--tantu-bg-elevated, #faf9f6)",
                      border: "1px solid var(--tantu-border-hairline, #d4d0c8)",
                    }}
                  >
                    <span style={{ fontSize: "0.85rem" }}>
                      <strong>{check.label}</strong>
                      {check.detail ? ` — ${check.detail}` : ""}
                    </span>
                    <TantuTag tone={meta.tone} solid={meta.solid}>
                      {meta.label}
                    </TantuTag>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </TantuCard>
  );
}
