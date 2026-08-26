import { useCallback, useEffect, useId, useState, type HTMLAttributes, type ReactNode } from "react";

export interface TantuTooltipProps extends HTMLAttributes<HTMLSpanElement> {
  /** Kasuti note revealed on hover or focus. */
  label: ReactNode;
  children: ReactNode;
}

/**
 * Pinned talim note. Appears above the anchored control on hover or focus.
 *
 * WCAG 1.4.13 (Content on Hover or Focus) asks three things of anything that
 * appears this way, and this component met one of them:
 *
 *  - *Dismissible*: there must be a way to dismiss it without moving the
 *    pointer or focus, because a tooltip can cover the content underneath it
 *    and a magnifier user may have no way to move away from it. Escape now
 *    does that, and the dismissal is remembered until the pointer or focus
 *    actually leaves — otherwise the next mousemove would just reopen it.
 *  - *Hoverable*: the pointer must be able to reach the tooltip itself,
 *    which the stylesheet handles (see the note on `.tantu-tooltip::after`).
 *  - *Persistent*: it stays until dismissed or the trigger is left. It always
 *    did — nothing here is on a timer.
 */
export function TantuTooltip({ label, children, className, ...rest }: TantuTooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const shown = open && !dismissed;

  // Bound on the document rather than the host, because Escape has to work
  // wherever focus happens to be — including when the tooltip was opened by
  // hovering and focus is somewhere else entirely.
  useEffect(() => {
    if (!shown) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shown]);

  const enter = useCallback(() => setOpen(true), []);
  const leave = useCallback(() => {
    setOpen(false);
    // Leaving re-arms it; a dismissal applies to this appearance only.
    setDismissed(false);
  }, []);

  return (
    <span
      {...rest}
      className={["tantu-tooltip-host", className].filter(Boolean).join(" ")}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={enter}
      onBlur={leave}
      aria-describedby={shown ? id : undefined}
    >
      {children}
      {shown ? (
        <span role="tooltip" id={id} className="tantu-tooltip">
          {label}
        </span>
      ) : null}
    </span>
  );
}
