import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

export interface TantuSliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  /** Accessible label for the slider. */
  label?: ReactNode;
  /** Current value. */
  value?: number;
  /** Default value for uncontrolled usage. */
  defaultValue?: number;
  /** Called when the value changes. */
  onChange?: (value: number) => void;
  /** Minimum value. */
  min?: number;
  /** Maximum value. */
  max?: number;
  /** Step increment. */
  step?: number;
}

/**
 * TantuSlider — a horizontal tension control.
 *
 * Styled as a single thread gauge with a movable bead. The fill bar runs
 * from the inline start to the current thumb position.
 *
 * The fill tracks internal state when the slider is uncontrolled. It used to
 * read `value ?? defaultValue`, which is the value at *first paint* and never
 * changes without a `value` prop — so an uncontrolled slider moved its thumb
 * (the native input owns that) while the fill stayed frozen at the starting
 * position. Every consumer in this repository happens to drive it controlled,
 * which is why it looked right everywhere and was wrong anyway: the same
 * shape as the dead controls the consequence audits were built to find, and
 * the same reason nothing noticed — it rendered, it passed axe, and the
 * screenshot was correct.
 */
export const TantuSlider = forwardRef<HTMLInputElement, TantuSliderProps>(function TantuSlider(
  { label, value, defaultValue, onChange, min = 0, max = 100, step = 1, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const isControlled = value !== undefined;

  const [internal, setInternal] = useState(defaultValue ?? min);
  const current = isControlled ? value : internal;

  // A zero-width range is a caller error, not a crash: clamp the divisor so a
  // min equal to max draws an empty gauge rather than NaN% .
  const span = max - min || 1;
  const filled = Math.min(100, Math.max(0, ((current - min) / span) * 100));

  return (
    <div className={["tantu-slider", className].filter(Boolean).join(" ")}>
      {label ? (
        <label htmlFor={inputId} className="tantu-slider-label">
          {label}
        </label>
      ) : null}
      <div className="tantu-slider-track">
        <input
          {...rest}
          ref={ref}
          id={inputId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={isControlled ? value : internal}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (!isControlled) setInternal(next);
            onChange?.(next);
          }}
          className="tantu-slider-input"
        />
        <div className="tantu-slider-rail" aria-hidden="true" />
        <div className="tantu-slider-fill" aria-hidden="true" style={{ width: `${filled}%` }} />
      </div>
    </div>
  );
});
