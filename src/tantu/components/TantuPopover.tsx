import { useId, useState, cloneElement, isValidElement, type HTMLAttributes, type ReactElement, type ReactNode } from "react";

export type TantuPopoverTone = "neutral" | "accent" | "structural";

export interface TantuPopoverProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** The trigger element that opens the popover. Must be a single React element. */
  trigger: ReactElement;
  /** Popover body content. */
  children: ReactNode;
  /** Optional title rendered in the popover header. */
  title?: ReactNode;
  /** Surface tone. */
  tone?: TantuPopoverTone;
  /** Controlled open state. */
  open?: boolean;
  /** Controlled open callback. */
  onOpenChange?: (open: boolean) => void;
  /** Default open state for uncontrolled usage. */
  defaultOpen?: boolean;
}

/**
 * TantuPopover — a small supplementary-weft panel anchored to a trigger.
 *
 * Use it for overflow menus, filter chips, or context notes that are too
 * verbose for a tooltip. The panel is positioned absolutely relative to
 * the trigger wrapper. The trigger child is cloned and wired with the
 * expansion state and click handler, so it keeps its own semantics (button,
 * link, etc.) without nesting controls.
 */
export function TantuPopover({
  trigger,
  children,
  title,
  tone = "neutral",
  open: openProp,
  onOpenChange,
  defaultOpen = false,
  className,
  ...rest
}: TantuPopoverProps) {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = (value: boolean) => {
    setOpenState(value);
    onOpenChange?.(value);
  };
  const id = useId();

  const triggerNode = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<{ onClick?: () => void; "aria-expanded"?: boolean; "aria-controls"?: string }>, {
        "aria-expanded": open,
        "aria-controls": open ? id : undefined,
        onClick: () => setOpen(!open),
      })
    : trigger;


  return (
    <div className="tantu-popover-host" {...rest}>
      {triggerNode}
      {open ? (
        <div
          id={id}
          className={["tantu-popover", `tantu-popover-${tone}`, className].filter(Boolean).join(" ")}
        >
          {title ? <div className="tantu-popover-title">{title}</div> : null}
          <div className="tantu-popover-body">{children}</div>
        </div>
      ) : null}
    </div>
  );
}
