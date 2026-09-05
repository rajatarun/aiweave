import { forwardRef, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { getLoomAudio } from "../lib/loom-audio.js";

export type TantuToggleVariant = "checkbox" | "radio" | "switch";

export interface TantuToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Knot form: madder knot, bias diamond, or treadle block. */
  variant?: TantuToggleVariant;
  /** Voice the heddle knot / treadle thwack. Default true. */
  audio?: boolean;
  children?: ReactNode;
}

/**
 * The Kanthi Stitch. A checkbox is an unthreaded reinforced hole in the
 * substrate; selecting it pulls a thick Madder Red thread through the void and
 * ties a dense knot. A switch is a treadle: a structural block that steps to
 * its new dye instantly (0ms step-end) with an audible wooden thwack.
 */
export const TantuToggle = forwardRef<HTMLInputElement, TantuToggleProps>(function TantuToggle(
  { variant = "checkbox", className, children, disabled, audio = true, onChange, ...rest },
  ref,
) {
  const indicator =
    variant === "switch"
      ? "tantu-treadle"
      : variant === "radio"
        ? "tantu-knotbox tantu-knotbox-radio"
        : "tantu-knotbox";

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (audio) {
      if (variant === "switch") {
        getLoomAudio().play("battenStrike", { gain: 0.62, rate: 0.85 });
      } else {
        getLoomAudio().play("heddleShift", { gain: 0.45, rate: 0.95 });
      }
    }
    onChange?.(event);
  };

  return (
    <label
      className={["tantu-toggle", disabled ? "tantu-toggle-disabled" : null, className]
        .filter(Boolean)
        .join(" ")}
    >
      <input
        {...rest}
        ref={ref}
        disabled={disabled}
        onChange={handleChange}
        type={variant === "radio" ? "radio" : "checkbox"}
        role={variant === "switch" ? "switch" : undefined}
      />
      <span className={indicator} aria-hidden="true" />
      {children ? <span>{children}</span> : null}
    </label>
  );
});
