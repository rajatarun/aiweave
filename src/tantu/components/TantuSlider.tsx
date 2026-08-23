import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

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
 * from the left selvedge to the current thumb position.
 */
export const TantuSlider = forwardRef<HTMLInputElement, TantuSliderProps>(function TantuSlider(
  { label, value, defaultValue, onChange, min = 0, max = 100, step = 1, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const isControlled = value !== undefined;

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
          value={isControlled ? value : undefined}
          defaultValue={!isControlled ? defaultValue : undefined}
          onChange={(event) => onChange?.(Number(event.target.value))}
          className="tantu-slider-input"
        />
        <div className="tantu-slider-rail" aria-hidden="true" />
        <div
          className="tantu-slider-fill"
          aria-hidden="true"
          style={{
            width: `${((value ?? defaultValue ?? min) - min) / (max - min) * 100}%`,
          }}
        />
      </div>
    </div>
  );
});
