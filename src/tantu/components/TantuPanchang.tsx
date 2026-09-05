import { useCallback, useMemo, type HTMLAttributes } from "react";
import { getLoomAudio, panForX } from "../lib/loom-audio.js";

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

interface MonthBlock {
  blanks: number;
  cells: Date[];
  tail: number;
}

/** Chunk a month block into weeks of seven, padding both ends with nulls. */
function weeksOf(block: MonthBlock): Array<Array<Date | null>> {
  const flat: Array<Date | null> = [
    ...Array.from({ length: block.blanks }, () => null),
    ...block.cells,
    ...Array.from({ length: block.tail }, () => null),
  ];
  const weeks: Array<Array<Date | null>> = [];
  for (let i = 0; i < flat.length; i += 7) weeks.push(flat.slice(i, i + 7));
  return weeks;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function DayCell({
  date,
  mark,
  today,
  selected,
  onLock,
}: {
  date: Date;
  mark?: string;
  today: boolean;
  selected: boolean;
  onLock: (date: Date, x: number) => void;
}) {
  // On screen the numeral is unambiguous — the column says which weekday, the
  // block heading says which month. Read aloud, "14" is not a date. The full
  // name carries the weekday, the month and anything bound to that day.
  const name = [
    `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`,
    today ? "today" : null,
    mark,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <span role="gridcell" className="tantu-panchang-cell">
      <button
        type="button"
        className="tantu-panchang-day"
        aria-label={name}
        aria-pressed={selected}
        aria-current={today ? "date" : undefined}
        data-today={today ? "true" : undefined}
        data-marked={mark !== undefined ? "true" : undefined}
        onFocus={(event) => onLock(date, event.currentTarget.getBoundingClientRect().left)}
        onClick={(event) => onLock(date, event.currentTarget.getBoundingClientRect().left)}
      >
        <span className="tantu-panchang-numeral" aria-hidden="true">
          {date.getDate()}
        </span>
        {mark ? (
          <span className="tantu-panchang-mark" aria-hidden="true">
            {mark}
          </span>
        ) : null}
      </button>
    </span>
  );
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
          {/* A `grid` may only contain rows, and a `gridcell` may only sit in
              one. Every cell used to be a direct child of the grid, which is
              the shape screen readers cannot navigate: no row boundaries, so
              no "week of" context and no vertical arrow movement. The rows
              carry `display: contents`, so the seven-column weave the CSS
              lays out is unchanged — this is semantics only. */}
          <div className="tantu-panchang-weave" role="grid" aria-label={block.title}>
            {weeksOf(block).map((week, weekIndex) => (
              <div key={`week-${weekIndex}`} className="tantu-panchang-week" role="row">
                {week.map((date, dayIndex) =>
                  date === null ? (
                    <span
                      key={`blank-${weekIndex}-${dayIndex}`}
                      role="gridcell"
                      className="tantu-panchang-blank"
                    />
                  ) : (
                    <DayCell
                      key={iso(date)}
                      date={date}
                      mark={marked.get(iso(date))}
                      today={iso(date) === today}
                      selected={selected === iso(date)}
                      onLock={lock}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
