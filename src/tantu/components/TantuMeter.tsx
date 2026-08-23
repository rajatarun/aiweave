import { forwardRef, type HTMLAttributes } from "react";

export interface TantuMeterProps extends HTMLAttributes<HTMLDivElement> {
  /** Completed fraction, 0 to 100. Omit for an indeterminate shuttle pass. */
  value?: number;
  label?: string;
}

/** Warp-tension meter: determinate progress, or an endless shuttle pass. */
export const TantuMeter = forwardRef<HTMLDivElement, TantuMeterProps>(function TantuMeter(
  { value, label = "Progress", className, ...rest },
  ref,
) {
  const indeterminate = value === undefined;
  const clamped = indeterminate ? 0 : Math.max(0, Math.min(100, value));

  return (
    <div
      {...rest}
      ref={ref}
      role="progressbar"
      aria-label={label}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      aria-valuenow={indeterminate ? undefined : clamped}
      className={["tantu-meter", indeterminate ? "tantu-meter-indeterminate" : null, className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="tantu-meter-fill" style={indeterminate ? undefined : { width: `${clamped}%` }} />
    </div>
  );
});
