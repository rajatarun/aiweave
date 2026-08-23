import { useCallback, useId, useState, type HTMLAttributes, type ReactNode } from "react";

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

  const move = (delta: number) => {
    const enabled = items.filter((i) => !i.disabled);
    const index = enabled.findIndex((i) => i.id === active);
    const next = enabled[(index + delta + enabled.length) % enabled.length];
    if (next) select(next.id);
  };

  return (
    <div {...rest} className={["tantu-tabs", className].filter(Boolean).join(" ")}>
      <div
        role="tablist"
        className="tantu-tabs-list"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            move(1);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            move(-1);
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
