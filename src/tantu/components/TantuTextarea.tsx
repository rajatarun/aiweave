import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from "react";

export interface TantuTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

/** Multi-pick talim panel for longer notation. */
export const TantuTextarea = forwardRef<HTMLTextAreaElement, TantuTextareaProps>(function TantuTextarea(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

  return (
    <div className="tantu-field">
      {label ? (
        <label className="tantu-field-label" htmlFor={fieldId}>
          {label}
        </label>
      ) : null}
      <textarea
        {...rest}
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={["tantu-textarea", className].filter(Boolean).join(" ")}
      />
      {error ? (
        <span className="tantu-field-error" id={`${fieldId}-error`}>
          {error}
        </span>
      ) : hint ? (
        <span className="tantu-field-hint" id={`${fieldId}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
});
