import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export interface TantuStepperStep {
  id: string;
  label: ReactNode;
  description?: ReactNode;
}

export interface TantuStepperProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Ordered steps in the warp progression. */
  steps: TantuStepperStep[];
  /** Currently active step id. */
  currentStepId: string;
  /** Called when a step header is clicked. */
  onChange?: (stepId: string) => void;
}

/**
 * TantuStepper — a horizontal warp-progression indicator.
 *
 * Steps are connected by the weft thread. Completed steps carry the madder
 * selvedge, the active step is outlined, and pending steps remain un-dyed.
 */
export const TantuStepper = forwardRef<HTMLDivElement, TantuStepperProps>(function TantuStepper(
  { steps, currentStepId, onChange, className, ...rest },
  ref,
) {
  const currentIndex = steps.findIndex((step) => step.id === currentStepId);

  return (
    <div
      {...rest}
      ref={ref}
      role="list"
      aria-label="Progression"
      className={["tantu-stepper", className].filter(Boolean).join(" ")}
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isActive = step.id === currentStepId;
        const state = isActive ? "active" : isCompleted ? "completed" : "pending";

        return (
          <div key={step.id} className="tantu-stepper-stop" role="listitem">
            <StepButton
              step={step}
              state={state}
              onClick={() => onChange?.(step.id)}
              disabled={!onChange}
            />
            {index < steps.length - 1 ? <div className={`tantu-stepper-weft tantu-stepper-weft-${state}`} aria-hidden="true" /> : null}
          </div>
        );
      })}
    </div>
  );
});

function StepButton({
  step,
  state,
  onClick,
  disabled,
}: {
  step: TantuStepperStep;
  state: "active" | "completed" | "pending";
  onClick?: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      className={["tantu-stepper-step", `tantu-stepper-step-${state}`].join(" ")}
      onClick={onClick}
      disabled={disabled}
      aria-current={state === "active" ? "step" : undefined}
    >
      <span className="tantu-stepper-marker" aria-hidden="true" />
      <span className="tantu-stepper-label">
        <span className="tantu-stepper-label-text">{step.label}</span>
        {step.description ? <span className="tantu-stepper-description">{step.description}</span> : null}
      </span>
    </button>
  );
}
