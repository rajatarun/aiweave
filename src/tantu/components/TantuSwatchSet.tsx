import { useCallback, useId, useRef, type ReactNode } from "react";
import { inlineArrowStep } from "../lib/direction.js";

export interface TantuSwatchOption {
  id: string;
  /** What the reader calls it — "Indigo", "Medium", "2.5 m". */
  label: ReactNode;
  /**
   * A colour for the chip. Any CSS colour, or a custom property name the
   * shop has already dyed — `var(--tantu-indigo-vat)`. Omit for a text
   * variant such as a size.
   */
  swatch?: string;
  /**
   * Whether this one can be bought. Default true.
   *
   * Unavailable is deliberately *not* the same as disabled — see the note on
   * the component.
   */
  available?: boolean;
  /** Second image of the same cloth, for a shop that swaps on hover. */
  preview?: string;
}

export interface TantuSwatchSetLabels {
  /** Appended to an unavailable option's accessible name. */
  unavailable: string;
}

const DEFAULT_LABELS: TantuSwatchSetLabels = { unavailable: "unavailable" };

export interface TantuSwatchSetProps {
  /** Names the group — "Colour", "Length". Required: a bare set of chips is unreadable. */
  label: ReactNode;
  options: TantuSwatchOption[];
  /** Selected option id. */
  value?: string;
  onChange?: (id: string, option: TantuSwatchOption) => void;
  /** Draw colour chips rather than text pills. Inferred from the first swatch. */
  chips?: boolean;
  labels?: Partial<TantuSwatchSetLabels>;
  className?: string;
}

/**
 * TantuSwatchSet — which one.
 *
 * A radio group in behaviour, drawn as chips. Two decisions carry it.
 *
 * **Unavailable is not disabled.** The obvious way to draw a sold-out size is
 * to disable the button, and it is wrong: a disabled control leaves the tab
 * order, so a keyboard or screen-reader shopper never learns the size exists,
 * never learns it is the one they wanted, and cannot ask to be told when it
 * returns. Sold-out options here stay focusable, carry `aria-disabled`, and
 * append "unavailable" to their accessible name. They simply refuse the
 * selection. This is the WAI-ARIA guidance and also the commercially right
 * answer — a shopper who cannot see the gap cannot ask you to fill it.
 *
 * **One tab stop, arrows inside.** A colour set with fourteen dyes should not
 * cost fourteen presses of Tab to step over. The group is one stop and the
 * arrow keys move within it, which is the radio-group pattern — and the arrow
 * keys resolve direction from the element itself, so ArrowRight moves to the
 * *previous* chip under `dir="rtl"`, per the Authoring Practices.
 */
export function TantuSwatchSet({
  label,
  options,
  value,
  onChange,
  chips,
  labels,
  className,
}: TantuSwatchSetProps) {
  const labelId = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  const copy = { ...DEFAULT_LABELS, ...labels };

  const asChips = chips ?? options.some((option) => option.swatch !== undefined);

  // The roving tab stop. With nothing selected the first option holds it, so
  // the group is always reachable.
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.id === value),
  );

  const move = useCallback(
    (from: number, delta: number) => {
      const count = options.length;
      if (count === 0) return;
      // Wrap, and step over nothing — an unavailable option is still a place
      // the cursor may rest, because the reader needs to be able to find out
      // that it is unavailable.
      const next = (from + delta + count) % count;
      const node = groupRef.current?.querySelectorAll<HTMLButtonElement>("[data-swatch]")[next];
      node?.focus();
      const option = options[next];
      if (option.available !== false) onChange?.(option.id, option);
    },
    [options, onChange],
  );

  return (
    <div
      ref={groupRef}
      className={["tantu-swatchset", asChips ? "tantu-swatchset-chips" : null, className]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="tantu-swatchset-label" id={labelId}>
        {label}
      </span>
      <div className="tantu-swatchset-row" role="radiogroup" aria-labelledby={labelId}>
        {options.map((option, index) => {
          const selected = option.id === value;
          const available = option.available !== false;
          return (
            <button
              key={option.id}
              type="button"
              data-swatch
              role="radio"
              aria-checked={selected}
              aria-disabled={available ? undefined : true}
              tabIndex={index === activeIndex ? 0 : -1}
              className={[
                "tantu-swatch",
                selected ? "tantu-swatch-on" : null,
                available ? null : "tantu-swatch-spent",
              ]
                .filter(Boolean)
                .join(" ")}
              style={option.swatch ? ({ "--swatch": option.swatch } as React.CSSProperties) : undefined}
              onClick={() => {
                if (available) onChange?.(option.id, option);
              }}
              onKeyDown={(event) => {
                const step = inlineArrowStep(event.key, event.currentTarget);
                if (step !== 0) {
                  event.preventDefault();
                  move(index, step);
                  return;
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  move(index, 1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  move(index, -1);
                }
              }}
            >
              {option.swatch ? <span className="tantu-swatch-chip" aria-hidden="true" /> : null}
              <span className={asChips && option.swatch ? "tantu-visually-hidden" : "tantu-swatch-text"}>
                {option.label}
              </span>
              {available ? null : <span className="tantu-visually-hidden"> ({copy.unavailable})</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
