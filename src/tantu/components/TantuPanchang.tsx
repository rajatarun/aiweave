import { useCallback, useMemo, type HTMLAttributes } from "react";
import { getLoomAudio, panForX } from "../lib/loom-audio";

export interface PanchangMark {
  /** ISO date (YYYY-MM-DD) the mark binds to. */
  date: string;
  label?: string;
}

export interface TantuPanchangProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Any date inside the first month block. */
  month?: Date;
  /** Number of consecutive month blocks woven into the scroll. */
  months?: number;
  /** Currently locked day. */
  value?: Date | null;
  /** Events bound into the weave. */
  marks?: PanchangMark[];
  /**
   * Hour of day (0–23) driving the substrate dye. Defaults to the real clock,
   * so the lattice bleeds from Indigo Sky toward Kala Charcoal at nightfall.
   */
  hour?: number;
  onSelect?: (date: Date) => void;
  silent?: boolean;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function iso(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Monday-indexed offset so the weave starts on the loom's left selvedge. */
function leadingBlanks(first: Date): number {
  return (first.getDay() + 6) % 7;
}

/**
 * Solar/lunar dye: 0 at solar noon, 1 at deep night. Drives a slow substrate
 * bleed from Indigo Sky to Kala Charcoal rather than a binary theme flip.
 */
function nightfall(hour: number): number {
  const from_noon = Math.abs(hour - 13) / 11; // 13:00 = full sun
  return Math.max(0, Math.min(1, from_noon));
}

/**
 * The Panchang Matrix — a calendar as one continuous woven lattice.
 *
 * Each month is a solid block of Jamdani weave. Between blocks the weft stops
 * and only the vertical warp survives: a physical fringe the eye must cross to
 * reach the next month. The substrate dye tracks the chronology, bleeding from
 * Indigo Sky toward Kala Charcoal as night falls over the grid.
 */
export function TantuPanchang({
  month,
  months = 2,
  value = null,
  marks = [],
  hour,
  onSelect,
  silent = false,
  className,
  style,
  ...rest
}: TantuPanchangProps) {
  const anchor = month ?? new Date();
  const clockHour = hour ?? new Date().getHours();
  const dye = nightfall(clockHour);

  const marked = useMemo(() => {
    const map = new Map<string, string | undefined>();
    marks.forEach((mark) => map.set(mark.date, mark.label));
    return map;
  }, [marks]);

  const blocks = useMemo(() => {
    return Array.from({ length: Math.max(1, months) }, (_, index) => {
      const first = new Date(anchor.getFullYear(), anchor.getMonth() + index, 1);
      const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      return {
        key: `${first.getFullYear()}-${first.getMonth()}`,
        title: first.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
        blanks: leadingBlanks(first),
        cells: Array.from({ length: days }, (_, d) => new Date(first.getFullYear(), first.getMonth(), d + 1)),
        tail: (7 - ((leadingBlanks(first) + days) % 7)) % 7,
      };
    });
  }, [anchor, months]);

  const selected = value ? iso(value) : null;
  const today = iso(new Date());

  const lock = useCallback(
    (date: Date, x: number) => {
      if (!silent) getLoomAudio().lockDate(panForX(x));
      onSelect?.(date);
    },
    [onSelect, silent],
  );

  return (
    <div
      {...rest}
      className={["tantu-panchang", className].filter(Boolean).join(" ")}
      style={{ ["--tantu-panchang-dye" as string]: dye.toFixed(3), ...style }}
      data-phase={dye > 0.62 ? "lunar" : "solar"}
    >
      <div className="tantu-panchang-heading" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day} className="tantu-meta-talim">
            {day}
          </span>
        ))}
      </div>

      {blocks.map((block, index) => (
        <section key={block.key} className="tantu-panchang-block" aria-label={block.title}>
          {index > 0 ? <div className="tantu-panchang-fringe" aria-hidden="true" /> : null}
          <h4 className="tantu-panchang-title">{block.title}</h4>
          <div className="tantu-panchang-weave" role="grid" aria-label={block.title}>
            {Array.from({ length: block.blanks }, (_, i) => (
              <span key={`warp-${i}`} className="tantu-panchang-blank" aria-hidden="true" />
            ))}
            {block.cells.map((date) => {
              const key = iso(date);
              const label = marked.get(key);
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  className="tantu-panchang-day"
                  aria-selected={selected === key}
                  data-today={key === today ? "true" : undefined}
                  data-marked={marked.has(key) ? "true" : undefined}
                  onFocus={(event) => lock(date, event.currentTarget.getBoundingClientRect().left)}
                  onClick={(event) => lock(date, event.currentTarget.getBoundingClientRect().left)}
                >
                  <span className="tantu-panchang-numeral">{date.getDate()}</span>
                  {label ? <span className="tantu-panchang-mark">{label}</span> : null}
                </button>
              );
            })}
            {Array.from({ length: block.tail }, (_, i) => (
              <span key={`tail-${i}`} className="tantu-panchang-blank" aria-hidden="true" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
