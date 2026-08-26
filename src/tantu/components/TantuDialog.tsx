import { useEffect, useId, useRef, type HTMLAttributes, type ReactNode } from "react";

/** Everything the browser will hand a Tab press inside the panel. */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export interface TantuDialogProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  meta?: ReactNode;
  /** Action row pinned to the base of the panel. */
  footer?: ReactNode;
  /** Block dismissal by scrim click / Escape. */
  persistent?: boolean;
}

/**
 * Unspooled panel. A modal cut from the substrate: dashed zari inlay, square
 * corners, Escape and scrim dismissal unless `persistent`.
 */
export function TantuDialog({
  open,
  onClose,
  title,
  meta,
  footer,
  persistent = false,
  className,
  children,
  ...rest
}: TantuDialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const titleId = `${useId()}-title`;

  useEffect(() => {
    if (!open) return;

    // Where focus came from, so it can be handed back on close. Without this
    // the keyboard lands at the top of the document and the user has to
    // re-traverse the page to get back to whatever opened the panel.
    restoreTo.current = document.activeElement as HTMLElement | null;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !persistent) {
        onClose();
        return;
      }
      // `aria-modal="true"` is a promise to assistive technology that nothing
      // outside the panel is reachable. The browser does not enforce it: a
      // Tab press walked straight out into the page behind the scrim, where
      // the user could operate controls they could not see. Contain the ring
      // here so the promise is true (WCAG 2.4.3, APG modal dialog pattern).
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;

      // A control the user cannot see is not a tab stop, but "can it be
      // seen" is only answerable where there is layout. checkVisibility() is
      // the standard question; where it is unimplemented — jsdom, and any
      // other DOM without a layout engine — assume visible rather than
      // silently collapsing the ring to nothing.
      const stops = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.checkVisibility?.() ?? true,
      );
      // An empty panel keeps focus on itself rather than releasing it.
      if (stops.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreTo.current?.focus?.();
    };
  }, [open, persistent, onClose]);

  if (!open) return null;

  return (
    <div
      className="tantu-scrim"
      onMouseDown={(event) => {
        if (!persistent && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        {...rest}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        // A dialog with no accessible name is announced as just "dialog".
        // The heading is already on screen, so point at it rather than
        // duplicating the string into an aria-label.
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={["tantu-dialog", className].filter(Boolean).join(" ")}
      >
        {(title || meta) && (
          <div className="tantu-dialog-header">
            {title ? (
              <h3 id={titleId} className="tantu-heading-kalam">
                {title}
              </h3>
            ) : (
              <span />
            )}
            {meta ? <span className="tantu-meta-kasuti">{meta}</span> : null}
          </div>
        )}
        <div className="tantu-body-talim">{children}</div>
        {footer ? <div className="tantu-dialog-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
