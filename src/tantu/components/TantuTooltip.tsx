import { useId, useState, type HTMLAttributes, type ReactNode } from "react";

export interface TantuTooltipProps extends HTMLAttributes<HTMLSpanElement> {
  /** Kasuti note revealed on hover or focus. */
  label: ReactNode;
  children: ReactNode;
}

/** Pinned talim note. Appears above the anchored control on hover or focus. */
export function TantuTooltip({ label, children, className, ...rest }: TantuTooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      {...rest}
      className={["tantu-tooltip-host", className].filter(Boolean).join(" ")}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open ? (
        <span role="tooltip" id={id} className="tantu-tooltip">
          {label}
        </span>
      ) : null}
    </span>
  );
}
