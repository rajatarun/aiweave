import { useId, useState, type HTMLAttributes } from "react";

import { TantuTag, type TantuTagTone } from "./TantuTag.js";

export type FlowEventType =
  | "flow.started"
  | "flow.step"
  | "approval.requested"
  | "approval.resolved"
  | "flow.completed"
  | (string & {});

export type FlowEventStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "completed"
  | "failed";

export interface FlowTimelineEvent {
  /** Unique identifier for this timeline event. */
  id: string;
  /** Canonical FlowEventBus event type (e.g. `flow.started`, `flow.step`, `approval.requested`). */
  type: FlowEventType;
  /** ISO-8601 timestamp string for when the event occurred. */
  timestamp: string;
  /** Optional human-readable event label. Defaults to `stepName` or `type`. */
  title?: string;
  /** Optional flow step name associated with the event. */
  stepName?: string;
  /** Optional explicit lifecycle status. Derived from `type` when omitted. */
  status?: FlowEventStatus;
  /** Optional concise summary line displayed beneath the event header. */
  summary?: string;
  /** Optional structured step payload revealed via the detail disclosure toggle. */
  details?: unknown;
}

export interface FlowTimelineProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Ordered list of flow lifecycle events to render. */
  events: FlowTimelineEvent[];
  /** Optional flow or run identifier displayed in the timeline header. */
  flowId?: string;
  /** Accessible title for the timeline log region. */
  title?: string;
  /** Message rendered when `events` is empty. */
  emptyMessage?: string;
  /** Event IDs whose detail disclosure panels are expanded on initial render. */
  defaultExpandedIds?: string[];
}

interface StatusMeta {
  label: string;
  tone: TantuTagTone;
  solid: boolean;
}

const STATUS_META: Record<FlowEventStatus, StatusMeta> = {
  pending: { label: "PENDING", tone: "neutral", solid: false },
  running: { label: "RUNNING", tone: "structural", solid: false },
  awaiting_approval: { label: "APPROVAL REQUIRED", tone: "caution", solid: false },
  approved: { label: "APPROVED", tone: "success", solid: false },
  rejected: { label: "REJECTED", tone: "accent", solid: true },
  completed: { label: "COMPLETED", tone: "success", solid: true },
  failed: { label: "FAILED", tone: "accent", solid: true },
};

function deriveEventStatus(event: FlowTimelineEvent): FlowEventStatus {
  if (event.status) return event.status;
  switch (event.type) {
    case "flow.started":
    case "flow.step":
      return "running";
    case "approval.requested":
      return "awaiting_approval";
    case "approval.resolved":
      return "approved";
    case "flow.completed":
      return "completed";
    default:
      return "pending";
  }
}

function formatDetails(details: unknown): string {
  if (typeof details === "string") return details;
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

/**
 * Accessible SystemUI timeline for live `FlowEventBus` SSE lifecycle streams.
 *
 * Renders ordered `flow.started`, `flow.step`, `approval.requested`,
 * `approval.resolved`, and `flow.completed` events inside a `role="log"`
 * (`aria-live="polite"`) region with status badges, semantic `<time>`
 * timestamps, expandable step detail disclosures, and an empty state.
 */
export function FlowTimeline({
  events,
  flowId,
  title = "Flow execution timeline",
  emptyMessage = "No flow events recorded yet.",
  defaultExpandedIds = [],
  className,
  style,
  ...rest
}: FlowTimelineProps) {
  const baseId = useId();
  const [expandedIds, setExpandedIds] = useState<string[]>(defaultExpandedIds);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  return (
    <div
      {...rest}
      role="log"
      aria-live="polite"
      aria-label={title}
      className={["tantu-flow-timeline", className].filter(Boolean).join(" ")}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        padding: "1rem",
        background: "var(--tantu-bg-surface, #ffffff)",
        border: "1px solid var(--tantu-border-hairline, #d4d0c8)",
        color: "var(--tantu-ink-primary, #1a1a1a)",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          flexWrap: "wrap",
          borderBottom: "1px solid var(--tantu-border-hairline, #d4d0c8)",
          paddingBottom: "0.5rem",
        }}
      >
        <span className="tantu-meta-kasuti" style={{ fontWeight: 600 }}>
          {title}
        </span>
        {flowId ? (
          <TantuTag tone="structural" data-testid="flow-timeline-id">
            FLOW · {flowId}
          </TantuTag>
        ) : null}
      </div>

      {events.length === 0 ? (
        <p
          data-testid="flow-timeline-empty"
          style={{
            margin: 0,
            padding: "0.75rem 0",
            color: "var(--tantu-ink-secondary, #555555)",
            fontSize: "0.875rem",
          }}
        >
          {emptyMessage}
        </p>
      ) : (
        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.625rem",
          }}
        >
          {events.map((event) => {
            const resolvedStatus = deriveEventStatus(event);
            const meta = STATUS_META[resolvedStatus];
            const hasDetails = event.details !== undefined && event.details !== null;
            const isExpanded = expandedIds.includes(event.id);
            const detailPanelId = `${baseId}-detail-${event.id}`;
            const heading = event.title ?? event.stepName ?? event.type;

            return (
              <li
                key={event.id}
                data-testid={`flow-event-${event.id}`}
                data-event-type={event.type}
                data-event-status={resolvedStatus}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                  padding: "0.65rem 0.75rem",
                  background: "var(--tantu-bg-elevated, #faf9f6)",
                  border: "1px solid var(--tantu-border-hairline, #d4d0c8)",
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
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <strong style={{ fontSize: "0.9rem" }}>{heading}</strong>
                    <TantuTag
                      tone={meta.tone}
                      solid={meta.solid}
                      data-testid={`flow-event-badge-${event.id}`}
                      data-event-status={resolvedStatus}
                    >
                      {meta.label}
                    </TantuTag>
                    <span
                      style={{
                        fontFamily: "var(--tantu-font-mono, monospace)",
                        fontSize: "0.75rem",
                        color: "var(--tantu-ink-secondary, #555555)",
                      }}
                    >
                      {event.type}
                    </span>
                  </div>
                  <time
                    dateTime={event.timestamp}
                    data-testid={`flow-event-time-${event.id}`}
                    style={{
                      fontFamily: "var(--tantu-font-mono, monospace)",
                      fontSize: "0.75rem",
                      color: "var(--tantu-ink-secondary, #555555)",
                    }}
                  >
                    {event.timestamp}
                  </time>
                </div>

                {event.summary ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.85rem",
                      color: "var(--tantu-ink-secondary, #555555)",
                    }}
                  >
                    {event.summary}
                  </p>
                ) : null}

                {hasDetails ? (
                  <div>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={detailPanelId}
                      onClick={() => toggleExpanded(event.id)}
                      style={{
                        background: "transparent",
                        border: "1px solid var(--tantu-border-hairline, #d4d0c8)",
                        color: "var(--tantu-ink-primary, #1a1a1a)",
                        padding: "0.2rem 0.5rem",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                      }}
                    >
                      {isExpanded ? "Hide details" : "Show details"}
                    </button>
                    {isExpanded ? (
                      <pre
                        id={detailPanelId}
                        data-testid={`flow-event-details-${event.id}`}
                        style={{
                          margin: "0.4rem 0 0 0",
                          padding: "0.5rem",
                          background: "var(--tantu-bg-surface, #ffffff)",
                          border: "1px solid var(--tantu-border-hairline, #d4d0c8)",
                          fontFamily: "var(--tantu-font-mono, monospace)",
                          fontSize: "0.75rem",
                          lineHeight: 1.45,
                          overflowX: "auto",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        <code>{formatDetails(event.details)}</code>
                      </pre>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
