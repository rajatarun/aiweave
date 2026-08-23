import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";

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

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !persistent) onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
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
        tabIndex={-1}
        className={["tantu-dialog", className].filter(Boolean).join(" ")}
      >
        {(title || meta) && (
          <div className="tantu-dialog-header">
            {title ? <h3 className="tantu-heading-kalam">{title}</h3> : <span />}
            {meta ? <span className="tantu-meta-kasuti">{meta}</span> : null}
          </div>
        )}
        <div className="tantu-body-talim">{children}</div>
        {footer ? <div className="tantu-dialog-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
