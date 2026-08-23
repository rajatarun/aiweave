import { forwardRef, type HTMLAttributes } from "react";

export interface TantuUnwovenProps extends HTMLAttributes<HTMLDivElement> {
  /** CSS height of the placeholder band. */
  height?: string;
  /** CSS width of the placeholder band. */
  width?: string;
}

/** Unwoven placeholder — bare warp threads standing in for pending content. */
export const TantuUnwoven = forwardRef<HTMLDivElement, TantuUnwovenProps>(function TantuUnwoven(
  { height = "var(--tantu-knot-3)", width = "100%", className, style, ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      aria-hidden="true"
      style={{ height, width, ...style }}
      className={["tantu-unwoven", className].filter(Boolean).join(" ")}
    />
  );
});

export interface TantuSpindleProps extends HTMLAttributes<HTMLSpanElement> {
  label?: string;
}

/** Spindle — a stepped rotary indicator for indeterminate work. */
export const TantuSpindle = forwardRef<HTMLSpanElement, TantuSpindleProps>(function TantuSpindle(
  { label = "Loading", className, ...rest },
  ref,
) {
  return (
    <span
      {...rest}
      ref={ref}
      role="status"
      aria-label={label}
      className={["tantu-spindle", className].filter(Boolean).join(" ")}
    />
  );
});
