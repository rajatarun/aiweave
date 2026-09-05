import { forwardRef, useId, useState, type ReactNode } from "react";

export interface TantuQuantityLabels {
  decrease: string;
  increase: string;
}

const DEFAULT_LABELS: TantuQuantityLabels = {
  decrease: "Decrease quantity",
  increase: "Increase quantity",
};

export interface TantuQuantityProps {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  /** Fewest that may be bought. Below this the decrease button is spent. */
  min?: number;
  /**
   * Most that may be bought — on a shop of one-off pieces this is the stock
   * on hand, and the ceiling is the whole point. Omit for no ceiling.
   */
  max?: number;
  step?: number;
  label?: ReactNode;
  /** Hide the label visually but keep it for a screen reader. */
  labelHidden?: boolean;
  disabled?: boolean;
  labels?: Partial<TantuQuantityLabels>;
  className?: string;
  id?: string;
}

/**
 * TantuQuantity — how many.
 *
 * A number field with two buttons, which is a shape worth getting exactly
 * right because it is the last control before the money.
 *
 * - **The field stays a real `<input type="number">`.** Typing 12 works,
 *   pasting works, a phone raises the numeric keypad, and the value is
 *   announced without any ARIA at all.
 * - **The buttons are `type="button"`.** The default inside a form is
 *   `submit`, so a shop that wraps this in an add-to-cart form and forgets
 *   would checkout on every press of "+".
 * - **A typed value is clamped on blur, not on keystroke.** Clamping while
 *   someone types turns an intended 12 into 1 the instant they enter the
 *   first digit against a maximum of 9.
 * - **Both buttons clear the 24×24 minimum** (WCAG 2.5.8) through
 *   `--tantu-target-min`, which is where the rest of the system takes it.
 */
export const TantuQuantity = forwardRef<HTMLInputElement, TantuQuantityProps>(function TantuQuantity(
  {
    value,
    defaultValue = 1,
    onChange,
    min = 1,
    max,
    step = 1,
    label,
    labelHidden,
    disabled,
    labels,
    className,
    id,
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const copy = { ...DEFAULT_LABELS, ...labels };

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const current = isControlled ? value : internal;

  const clamp = (next: number) => {
    if (!Number.isFinite(next)) return min;
    if (next < min) return min;
    if (max !== undefined && next > max) return max;
    return next;
  };

  const commit = (next: number) => {
    const settled = clamp(next);
    if (!isControlled) setInternal(settled);
    onChange?.(settled);
  };

  const atFloor = current <= min;
  const atCeiling = max !== undefined && current >= max;

  return (
    <div className={["tantu-quantity", className].filter(Boolean).join(" ")}>
      {label ? (
        <label
          htmlFor={inputId}
          className={["tantu-quantity-label", labelHidden ? "tantu-visually-hidden" : null].filter(Boolean).join(" ")}
        >
          {label}
        </label>
      ) : null}
      <div className="tantu-quantity-body">
        <button
          type="button"
          className="tantu-quantity-step"
          aria-label={copy.decrease}
          disabled={disabled || atFloor}
          onClick={() => commit(current - step)}
        >
          <span aria-hidden="true">−</span>
        </button>
        <input
          ref={ref}
          id={inputId}
          type="number"
          inputMode="numeric"
          className="tantu-quantity-field"
          value={current}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => {
            const next = Number(event.target.value);
            // Mid-type: take the raw value so the field is editable, and let
            // blur settle it. An empty field reads as NaN and is left alone
            // until then rather than snapping to the floor under the cursor.
            if (!Number.isFinite(next)) return;
            if (!isControlled) setInternal(next);
            onChange?.(next);
          }}
          onBlur={(event) => commit(Number(event.target.value))}
        />
        <button
          type="button"
          className="tantu-quantity-step"
          aria-label={copy.increase}
          disabled={disabled || atCeiling}
          onClick={() => commit(current + step)}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </div>
  );
});
