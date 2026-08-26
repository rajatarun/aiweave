import { useCallback, useId, useState, type HTMLAttributes, type ReactNode } from "react";
import { inlineArrowStep } from "../lib/direction";

export interface TantuTabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TantuTabsProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  items: TantuTabItem[];
  /** Uncontrolled initial tab id. */
  defaultTabId?: string;
  /** Controlled tab id. */
  tabId?: string;
  onTabChange?: (id: string) => void;
}

/**
 * Warp tabs. Each pick sits on the lattice; the selected column is battened
 * down with an accent shed line. Arrow keys traverse the warp.
 */
export function TantuTabs({
  items,
  defaultTabId,
  tabId,
  onTabChange,
  className,
  ...rest
}: TantuTabsProps) {
  const base = useId();
  const [internal, setInternal] = useState(defaultTabId ?? items[0]?.id);
  const active = tabId ?? internal;

  const select = useCallback(
    (id: string) => {
      if (tabId === undefined) setInternal(id);
      onTabChange?.(id);
    },
    [tabId, onTabChange],
  );

  /**
   * The tablist uses a roving tabindex, so selecting a tab without also
   * moving focus would strand the keyboard on an element that has just
   * become `tabindex="-1"` — the next Tab press would then leave the widget
   * from the wrong place. WAI-ARIA's automatic-activation tablist requires
   * focus and selection to travel together.
   */
  const selectAndFocus = (id: string) => {
    select(id);
    document.getElementById(`${base}-tab-${id}`)?.focus();
  };

  const move = (delta: number) => {
    const enabled = items.filter((i) => !i.disabled);
    const index = enabled.findIndex((i) => i.id === active);
    const next = enabled[(index + delta + enabled.length) % enabled.length];
    if (next) selectAndFocus(next.id);
  };

  /** Jump to an absolute position; -1 means the last enabled tab. */
  const moveTo = (position: number) => {
    const enabled = items.filter((i) => !i.disabled);
    const next = position < 0 ? enabled[enabled.length - 1] : enabled[position];
    if (next) selectAndFocus(next.id);
  };

  return (
    <div {...rest} className={["tantu-tabs", className].filter(Boolean).join(" ")}>
      <div
        role="tablist"
        className="tantu-tabs-list"
        onKeyDown={(event) => {
          // In a right-to-left tablist the arrows swap roles, per the
          // WAI-ARIA Authoring Practices; inlineArrowStep resolves that from
          // the list's own computed direction.
          const step = inlineArrowStep(event.key, event.currentTarget);
          if (step !== 0) {
            event.preventDefault();
            move(step);
          }
          if (event.key === "Home") {
            event.preventDefault();
            moveTo(0);
          }
          if (event.key === "End") {
            event.preventDefault();
            moveTo(-1);
          }
        }}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${base}-tab-${item.id}`}
            aria-controls={`${base}-panel-${item.id}`}
            aria-selected={item.id === active}
            tabIndex={item.id === active ? 0 : -1}
            disabled={item.disabled}
            className="tantu-tab"
            onClick={() => select(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item) =>
        item.id === active ? (
          <div
            key={item.id}
            role="tabpanel"
            id={`${base}-panel-${item.id}`}
            aria-labelledby={`${base}-tab-${item.id}`}
            className="tantu-tab-panel tantu-body-talim"
          >
            {item.content}
          </div>
        ) : null,
      )}
    </div>
  );
}
