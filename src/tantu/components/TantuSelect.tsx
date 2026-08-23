import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { getLoomAudio } from "../lib/loom-audio";

export interface TantuSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Voice the loom on rack displacement and spindle unroll. Default true. */
  audio?: boolean;
}

interface Spool {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Read `<option>` children into spools without floating them in the Z-axis. */
function readSpools(children: ReactNode): Spool[] {
  const spools: Spool[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || child.type !== "option") return;
    const props = child.props as { value?: string; children?: ReactNode; disabled?: boolean };
    const label = typeof props.children === "string" ? props.children : String(props.value ?? "");
    spools.push({ value: String(props.value ?? label), label, disabled: props.disabled });
  });
  return spools;
}

/**
 * The Spool Rack. Nothing floats over the weave: activating the field
 * mechanically forces the adjacent horizontal grid rows downward, expanding
 * the lattice to expose a tightly packed rack of spools embedded in the frame.
 * Selection unrolls the spool into the slot and the rows snap back rigid.
 */
export const TantuSelect = forwardRef<HTMLSelectElement, TantuSelectProps>(function TantuSelect(
  { label, hint, error, className, id, children, audio = true, value, defaultValue, onChange, disabled, name, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

  const spools = readSpools(children);
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(String(defaultValue ?? spools[0]?.value ?? ""));
  const current = controlled ? String(value) : internal;
  const selected = spools.find((spool) => spool.value === current) ?? spools[0];

  const [open, setOpen] = useState(false);
  const [unrolling, setUnrolling] = useState(false);
  const rackRef = useRef<HTMLDivElement | null>(null);
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const toggle = useCallback(() => {
    if (disabled) return;
    setOpen((prev) => {
      if (audio) getLoomAudio().play(prev ? "battenStrike" : "shuttleGlide", { gain: 0.4 });
      return !prev;
    });
  }, [audio, disabled]);

  const pick = useCallback(
    (spool: Spool) => {
      if (spool.disabled) return;
      if (!controlled) setInternal(spool.value);
      setOpen(false);
      setUnrolling(true);
      window.setTimeout(() => setUnrolling(false), 260);
      if (audio) getLoomAudio().play("battenStrike", { gain: 0.55 });
      const node = selectRef.current;
      if (node) {
        node.value = spool.value;
        node.dispatchEvent(new Event("change", { bubbles: true }));
      }
    },
    [audio, controlled],
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="tantu-field" ref={rootRef}>
      {label ? (
        <label className="tantu-field-label" htmlFor={fieldId}>
          {label}
        </label>
      ) : null}

      <button
        type="button"
        id={fieldId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onClick={toggle}
        data-unrolling={unrolling ? "true" : undefined}
        className={["tantu-select", className].filter(Boolean).join(" ")}
      >
        <span className="tantu-spool-active">{selected?.label ?? ""}</span>
      </button>

      {/* Grid displacement: the rack lives in flow and pushes rows down. */}
      <div className="tantu-spool-rack" data-open={open ? "true" : undefined} ref={rackRef}>
        <div className="tantu-spool-rack-inner" role="listbox" aria-labelledby={fieldId} tabIndex={-1}>
          {spools.map((spool) => (
            <button
              key={spool.value}
              type="button"
              role="option"
              aria-selected={spool.value === current}
              disabled={spool.disabled}
              className="tantu-spool"
              onClick={() => pick(spool)}
            >
              {spool.label}
            </button>
          ))}
        </div>
      </div>

      <select
        {...rest}
        ref={(node) => {
          selectRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as { current: HTMLSelectElement | null }).current = node;
        }}
        name={name}
        value={current}
        onChange={(event) => {
          if (!controlled) setInternal(event.target.value);
          onChange?.(event);
        }}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="tantu-visually-hidden"
      >
        {spools.map((spool) => (
          <option key={spool.value} value={spool.value}>
            {spool.label}
          </option>
        ))}
      </select>

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
