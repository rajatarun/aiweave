import * as React from "react";
import { getLoomAudio } from "../lib/loom-audio";

export type SikkuKolamState = "spinning" | "resolved";

export interface SikkuKolamLoaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Spinning while the fetch is in flight; resolved snaps the thread taut. */
  state?: SikkuKolamState;
  /** Bindu matrix width — dots along the warp. Base-6 friendly. */
  warpDots?: number;
  /** Bindu matrix height — dots along the weft. */
  weftDots?: number;
  /**
   * Measured network latency in ms. Drives capillary throbbing (the dye
   * struggling through dense cotton) and the Charkha's bandwidth friction.
   */
  latency?: number;
  /** Voice the Charkha hum and the spindle lock. Default true. */
  audio?: boolean;
  /** Stereo position on the warp, -1..1. */
  pan?: number;
  /** Accessible description of what is being spun. */
  label?: string;
}

const PITCH = 24; // base-6 lattice pitch between bindu dots
const MARGIN = 18;

/**
 * Sikku Kolam routing: one continuous filament winding around every bindu in
 * the matrix without ever breaking or crossing itself. Generated as a single
 * serpentine path whose quadratic loops alternate sides of the dot row.
 */
function kolamPath(cols: number, rows: number): string {
  const x = (c: number) => MARGIN + c * PITCH;
  const y = (r: number) => MARGIN + r * PITCH;
  const loop = PITCH * 0.62;

  let d = `M ${x(0) - loop * 0.5} ${y(0)}`;
  for (let r = 0; r < rows; r += 1) {
    const leftToRight = r % 2 === 0;
    const order = leftToRight
      ? Array.from({ length: cols }, (_, i) => i)
      : Array.from({ length: cols }, (_, i) => cols - 1 - i);
    order.forEach((c, index) => {
      const sign = index % 2 === 0 ? -1 : 1;
      // Each dot is wound, never touched: the control point throws the
      // filament clear of the bindu and back onto the lattice line.
      d += ` Q ${x(c)} ${y(r) + sign * loop} ${x(c) + (leftToRight ? loop * 0.5 : -loop * 0.5)} ${y(r)}`;
    });
    if (r < rows - 1) {
      const edge = leftToRight ? x(cols - 1) + loop : x(0) - loop;
      d += ` Q ${edge} ${y(r) + PITCH * 0.5} ${leftToRight ? x(cols - 1) + loop * 0.5 : x(0) - loop * 0.5} ${y(r + 1)}`;
    }
  }
  return d;
}

/**
 * The Tantu fetch state. Raw digital material is spun into structural thread:
 * a Madder Red filament routes the Sikku Kolam across the bindu matrix, throbs
 * with capillary bleed under latency, and snaps taut into rigid warp and weft
 * lines the millisecond the data resolves.
 */
export const SikkuKolamLoader = React.forwardRef<HTMLDivElement, SikkuKolamLoaderProps>(
  function SikkuKolamLoader(
    {
      state = "spinning",
      warpDots = 6,
      weftDots = 3,
      latency = 0,
      audio = true,
      pan = 0,
      label = "Spinning data into thread",
      className,
      ...rest
    },
    ref,
  ) {
    const cols = Math.max(2, Math.round(warpDots));
    const rows = Math.max(1, Math.round(weftDots));
    const width = MARGIN * 2 + (cols - 1) * PITCH;
    const height = MARGIN * 2 + (rows - 1) * PITCH;
    const path = React.useMemo(() => kolamPath(cols, rows), [cols, rows]);

    const spinning = state === "spinning";
    const strained = latency >= 600;
    const wasSpinning = React.useRef(false);

    React.useEffect(() => {
      if (!audio) return;
      const engine = getLoomAudio();
      if (spinning) {
        wasSpinning.current = true;
        engine.startCharkha({ pan, latency });
        return () => engine.stopCharkha({ lock: false });
      }
      if (wasSpinning.current) {
        wasSpinning.current = false;
        engine.stopCharkha({ pan });
      }
      return undefined;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spinning, audio]);

    // Bandwidth friction: the wheel drags in real time with the connection.
    React.useEffect(() => {
      if (audio && spinning) getLoomAudio().setCharkhaLatency(latency);
    }, [audio, spinning, latency]);

    const dots: React.ReactNode[] = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        dots.push(
          <rect
            key={`${r}-${c}`}
            className="tantu-kolam-bindu"
            x={MARGIN + c * PITCH - 1}
            y={MARGIN + r * PITCH - 1}
            width={2}
            height={2}
          />,
        );
      }
    }

    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        aria-busy={spinning}
        data-state={state}
        data-strained={strained ? "true" : undefined}
        className={["tantu-kolam", className].filter(Boolean).join(" ")}
        {...rest}
      >
        <svg
          className="tantu-kolam-field"
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          aria-hidden="true"
          focusable="false"
        >
          <g className="tantu-kolam-matrix">{dots}</g>
          <path className="tantu-kolam-thread" d={path} />
          <g className="tantu-kolam-snap">
            {Array.from({ length: rows }, (_, r) => (
              <line
                key={`h-${r}`}
                x1={0}
                y1={MARGIN + r * PITCH}
                x2={width}
                y2={MARGIN + r * PITCH}
              />
            ))}
            {Array.from({ length: cols }, (_, c) => (
              <line
                key={`v-${c}`}
                x1={MARGIN + c * PITCH}
                y1={0}
                x2={MARGIN + c * PITCH}
                y2={height}
              />
            ))}
          </g>
        </svg>
        <span className="tantu-visually-hidden">
          {spinning ? label : "Thread set — content woven"}
        </span>
      </div>
    );
  },
);
