import {
  forwardRef,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { inlineArrowStep } from "../lib/direction.js";

/**
 * The three states a square can be in. Exactly TantuStepper's vocabulary —
 * "pending" wears the same bare warp under a longer name there — because a
 * fourth state is how a progression chart starts smuggling in a score.
 */
export type NakshaState = "locked" | "active" | "completed";

export interface NakshaNode {
  id: string;
  /**
   * The full accessible name of the square, e.g. "Level 12, The Trace". The
   * square's state is appended for the screen reader; do not repeat it here.
   */
  label: string;
  state: NakshaState;
}

export interface NakshaBand {
  id: string;
  /** The band's name, e.g. "The First Narrowing". */
  label: string;
  /** A short annotation beside the band name, in the meta type role. */
  note?: ReactNode;
  nodes: NakshaNode[];
}

export interface TantuNakshaProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** The chart, in order. Bands are drawn in the order given. */
  bands: NakshaBand[];
  /**
   * Squares per row. One count for the whole chart, deliberately: every
   * square is the same size in every band, so a band's area on the page is
   * exactly proportional to how many squares it holds. That proportion is
   * the compression between bands, which is itself the information.
   */
  columns?: number;
  /**
   * Which square the roving cursor starts on. Purely where the keyboard
   * enters the chart — it paints nothing. Defaults to the first `active`
   * square, else the last `completed` one, else the first square.
   */
  currentId?: string;
  /** Fires when a square that is not locked is activated. */
  onSelect?: (node: NakshaNode, band: NakshaBand) => void;
  /** Accessible name for the chart as a whole. */
  label?: string;
}

/** What each state is called out loud. Locked also carries aria-disabled. */
const SPOKEN: Record<NakshaState, string> = {
  locked: "locked",
  active: "in progress",
  completed: "completed",
};

interface Placed {
  node: NakshaNode;
  band: NakshaBand;
  /** Position in the flattened chart — what the ordinal and the refs key on. */
  flat: number;
  row: number;
  column: number;
}

/**
 * The Naksha — a long progression as the squared chart it is woven from.
 *
 * A naksha is the design of a brocade squared onto a grid before a single
 * pick is thrown: one square per unit of the weave, no curve expressible,
 * the whole piece laid out at full length while none of it exists yet. It is
 * also the ordinary word for a map. This component is both at once — the
 * plan of a long journey, and where along it the work has actually reached.
 *
 * Three states, borrowed whole from TantuStepper rather than extended:
 * `completed` squares are packed with picks in the Jamdani idiom, `active`
 * is the fell — dressed warp with the batten sitting at it, carried by the
 * accent cord border the stepper's active marker already uses — and `locked`
 * is bare warp under tension. Locked is deliberately *neutral cloth*, not a
 * caution dye: a chart of a hundred squares is mostly unwoven by definition,
 * and ninety warnings is not a state, it is a fire.
 *
 * Bands are separated by the Panchang's fringe: the weft stops and only the
 * vertical warp crosses the gap, so the eye reads a real boundary without a
 * rule being drawn.
 *
 * **What this component refuses to hold.** A square carries state and
 * nothing else — no time, no percentage, no attempt count, no rank, and no
 * sub-progress within a square (resolution stops at the node; a square is
 * either woven or it is not). The numeral on a square is its own position,
 * derived here, so there is nowhere for a figure to be printed. And the
 * chart has no concept of anyone else's position: there is no prop for a
 * cohort, an average or a leaderboard, and adding one would make it a
 * different component.
 *
 * **Room to grow.** The bands are plain flow layout with no pan, zoom or
 * scrolling of their own, and the keyboard contract below is expressed in
 * indices rather than in geometry. Wrapping the chart in TantuDarshanLens
 * later is therefore additive: nothing about the node model or the key
 * handling has to move.
 *
 * ## Keyboard
 *
 * TantuAcousticPalette's roving tabindex, taken from one row to many. Exactly
 * one square in the whole chart is a tab stop; the arrows do the rest.
 *
 * - Left/Right walk the flattened chart by one, crossing row and band
 *   boundaries, and swap roles under `dir="rtl"` as the WAI-ARIA Authoring
 *   Practices require. They clamp at the two ends rather than wrapping: the
 *   palette wraps because a rack of four has no ends, and a journey does.
 * - Up/Down move a row at a time, holding the column and landing on the last
 *   square of a shorter row — so the fringe between bands is crossed, not
 *   stopped at.
 * - Home / End reach the ends of the current row. In a chart one row tall
 *   that is the palette's contract unchanged; this is the same rule, not a
 *   second one.
 * - Ctrl+Home / Ctrl+End reach the first and last square of the whole chart,
 *   per the grid pattern.
 *
 * Locked squares stay in the roving order and carry `aria-disabled` rather
 * than being skipped. They are the bulk of any real chart, and a keyboard
 * that could only reach the handful of unlocked squares would hide the one
 * thing the chart exists to show. They are not tab stops — nothing but the
 * cursor is — and they do not fire `onSelect`.
 */
export const TantuNaksha = forwardRef<HTMLDivElement, TantuNakshaProps>(function TantuNaksha(
  { bands, columns = 10, currentId, onSelect, label = "Progress chart", className, style, ...rest },
  ref,
) {
  const headingId = useId();
  const cols = Math.max(1, Math.floor(columns));

  /**
   * The chart flattened once, with each square's row and column recorded, and
   * the rows themselves as lists of flat indices. Rows never straddle a band:
   * a band always starts a new row, which is what makes the fringe a real
   * boundary rather than a drawn one.
   */
  const { placed, rows } = useMemo(() => {
    const placedNodes: Placed[] = [];
    const rowLists: number[][] = [];
    let flat = 0;
    for (const band of bands) {
      for (let start = 0; start < band.nodes.length; start += cols) {
        const row = rowLists.length;
        const list: number[] = [];
        for (let column = 0; column < cols && start + column < band.nodes.length; column += 1) {
          placedNodes.push({ node: band.nodes[start + column]!, band, flat, row, column });
          list.push(flat);
          flat += 1;
        }
        rowLists.push(list);
      }
    }
    return { placed: placedNodes, rows: rowLists };
  }, [bands, cols]);

  const total = placed.length;

  // Where the keyboard enters the chart, resolved once. Re-seeding this on a
  // later state change would yank focus out from under whoever is using it.
  const [cursor, setCursor] = useState(() => {
    const named = currentId ? placed.findIndex((p) => p.node.id === currentId) : -1;
    if (named >= 0) return named;
    const active = placed.findIndex((p) => p.node.state === "active");
    if (active >= 0) return active;
    let lastDone = -1;
    placed.forEach((p, index) => {
      if (p.node.state === "completed") lastDone = index;
    });
    return Math.max(lastDone, 0);
  });
  const blocks = useRef<Array<HTMLButtonElement | null>>([]);

  // The chart can shrink under a cursor that was valid a render ago.
  const focused = total === 0 ? 0 : Math.min(Math.max(cursor, 0), total - 1);

  const move = useCallback(
    (to: number) => {
      if (total === 0) return;
      const clamped = Math.min(Math.max(to, 0), total - 1);
      setCursor(clamped);
      blocks.current[clamped]?.focus();
    },
    [total],
  );

  /** A row step that holds the column, landing on the end of a shorter row. */
  const moveRow = useCallback(
    (from: Placed, delta: number) => {
      const row = rows[from.row + delta];
      if (!row || row.length === 0) return;
      move(row[Math.min(from.column, row.length - 1)]!);
    },
    [move, rows],
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, at: Placed) => {
      const inline = inlineArrowStep(event.key, event.currentTarget);
      if (inline !== 0) {
        event.preventDefault();
        move(at.flat + inline);
        return;
      }
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          moveRow(at, 1);
          break;
        case "ArrowUp":
          event.preventDefault();
          moveRow(at, -1);
          break;
        case "Home":
          event.preventDefault();
          move(event.ctrlKey || event.metaKey ? 0 : rows[at.row]![0]!);
          break;
        case "End":
          event.preventDefault();
          move(event.ctrlKey || event.metaKey ? total - 1 : rows[at.row]![rows[at.row]!.length - 1]!);
          break;
        default:
          break;
      }
    },
    [move, moveRow, rows, total],
  );

  let cut = 0;

  return (
    <div
      {...rest}
      ref={ref}
      role="group"
      aria-label={label}
      className={["tantu-naksha", className].filter(Boolean).join(" ")}
      style={{ ...style, ["--tantu-naksha-columns" as string]: cols }}
    >
      {bands.map((band, bandIndex) => {
        const first = cut;
        cut += band.nodes.length;
        return (
          <section
            key={band.id}
            role="group"
            aria-labelledby={`${headingId}-${band.id}`}
            className="tantu-naksha-band"
          >
            {/* The fringe: the weft stops between bands and only the warp
                crosses the gap. Decorative — the band's own name is what
                carries the boundary to a screen reader. */}
            {bandIndex > 0 ? <div className="tantu-naksha-fringe" aria-hidden="true" /> : null}
            <h4 className="tantu-naksha-band-title" id={`${headingId}-${band.id}`}>
              <span>{band.label}</span>
              {band.note ? <span className="tantu-meta-kasuti tantu-naksha-band-note">{band.note}</span> : null}
            </h4>
            {band.nodes.length > 0 ? (
              <ol className="tantu-naksha-field">
                {band.nodes.map((node, index) => {
                  const at = placed[first + index]!;
                  const locked = node.state === "locked";
                  return (
                    <li key={node.id} className="tantu-naksha-knot">
                      <button
                        type="button"
                        ref={(element) => {
                          blocks.current[at.flat] = element;
                        }}
                        className="tantu-naksha-block"
                        data-state={node.state}
                        tabIndex={at.flat === focused ? 0 : -1}
                        aria-disabled={locked || undefined}
                        aria-current={node.state === "active" ? "step" : undefined}
                        // The square's own numeral is its position, and a
                        // position is not a name: "12" read aloud says
                        // nothing about which square it is or how it stands.
                        aria-label={`${node.label}, ${SPOKEN[node.state]}`}
                        onFocus={() => setCursor(at.flat)}
                        onKeyDown={(event) => onKeyDown(event, at)}
                        onClick={() => {
                          if (!locked) onSelect?.(node, band);
                        }}
                      >
                        <span className="tantu-naksha-pack" aria-hidden="true" />
                        <span className="tantu-naksha-ordinal" aria-hidden="true">
                          {at.flat + 1}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </section>
        );
      })}
      <p className="tantu-meta-kasuti tantu-naksha-hint">
        Arrow keys walk the chart · Home / End reach the ends of a row · Ctrl + Home / End reach the chart's own
      </p>
    </div>
  );
});
