import * as React from "react";
import { getLoomAudio } from "../lib/loom-audio";

export interface KasutiPoint {
  /** Weft coordinate label rendered in Kasuti caps beneath the matrix. */
  label: string;
  value: number;
}

export interface KasutiMatrixProps extends React.HTMLAttributes<HTMLDivElement> {
  data: KasutiPoint[];
  /** Counted-thread rows in the matrix. Base-6. */
  rows?: number;
  /** Fix the top of the scale; otherwise taken from the data. */
  max?: number;
  /** Voice the needle puncturing cotton as the thread stitches. Default true. */
  audio?: boolean;
  /** Milliseconds per stitched segment. */
  stitchMs?: number;
  caption?: React.ReactNode;
}

const VIEW_W = 600;
const VIEW_H = 240;

/**
 * The Kasuti Matrix. Counted-thread embroidery forbids the diagonal and the
 * curve, so the data path routes strictly along warp and weft: a rising trend
 * climbs as a jagged staircase of 90-degree right angles. Each reading is a
 * thick metallic Zari knot stitched onto a grid intersection, and the thread
 * stitches itself left to right to the tick of a needle through heavy cotton.
 */
export const KasutiMatrix = React.forwardRef<HTMLDivElement, KasutiMatrixProps>(
  function KasutiMatrix(
    { data, rows = 6, max, audio = true, stitchMs = 90, caption, className, ...rest },
    ref,
  ) {
    const svgRef = React.useRef<SVGPathElement | null>(null);
    const hostRef = React.useRef<HTMLElement | null>(null);
    const [stitched, setStitched] = React.useState(0);

    const ceiling = max ?? Math.max(...data.map((point) => point.value), 1);
    const stepX = data.length > 1 ? VIEW_W / (data.length - 1) : VIEW_W;

    /** Snap a value onto a counted thread — no sub-thread positions exist. */
    const snapY = React.useCallback(
      (value: number) => {
        const ratio = Math.max(0, Math.min(1, value / ceiling));
        const row = Math.round(ratio * rows);
        return VIEW_H - (row / rows) * VIEW_H;
      },
      [ceiling, rows],
    );

    const knots = data.map((point, index) => ({
      x: Math.round(index * stepX),
      y: snapY(point.value),
      point,
    }));

    // Orthogonal routing: weft run, then warp climb. Never a diagonal.
    const path = knots
      .map((knot, index) =>
        index === 0
          ? `M ${knot.x} ${knot.y}`
          : `H ${knot.x} V ${knot.y}`,
      )
      .join(" ")
      .replace(/H (\S+) V (\S+)/g, (_m, x, y) => `H ${x} V ${y}`);

    // Acoustic plotting: stitch the thread across the matrix on render.
    React.useEffect(() => {
      const host = hostRef.current;
      if (!host || data.length === 0) return;
      let timer = 0;
      let cancelled = false;

      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer.disconnect();
          const engine = audio ? getLoomAudio() : null;
          const step = (index: number) => {
            if (cancelled) return;
            setStitched(index);
            if (index > 0) {
              engine?.play("needlePunch", {
                gain: 0.5,
                rate: 0.94 + (index % 4) * 0.05,
                pan: (index / Math.max(1, data.length - 1)) * 1.6 - 0.8,
              });
            }
            if (index < data.length - 1) {
              timer = window.setTimeout(() => step(index + 1), stitchMs);
            }
          };
          step(0);
        },
        { threshold: 0.35 },
      );
      observer.observe(host);
      return () => {
        cancelled = true;
        observer.disconnect();
        window.clearTimeout(timer);
      };
    }, [audio, data.length, stitchMs]);

    const visible = knots.slice(0, stitched + 1);
    const visiblePath = visible
      .map((knot, index) => (index === 0 ? `M ${knot.x} ${knot.y}` : `H ${knot.x} V ${knot.y}`))
      .join(" ");

    return (
      <figure
        ref={(node) => {
          hostRef.current = node;
          if (typeof ref === "function") ref(node as unknown as HTMLDivElement);
          else if (ref) (ref as { current: HTMLDivElement | null }).current = node as unknown as HTMLDivElement;
        }}
        className={["tantu-kasuti", className].filter(Boolean).join(" ")}
        {...(rest as React.HTMLAttributes<HTMLElement>)}
      >
        <svg
          className="tantu-kasuti-canvas"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={data.map((point) => `${point.label}: ${point.value}`).join(", ")}
        >
          <g className="tantu-kasuti-ground" aria-hidden="true">
            {Array.from({ length: rows + 1 }, (_, row) => (
              <line key={`weft-${row}`} x1="0" x2={VIEW_W} y1={(row / rows) * VIEW_H} y2={(row / rows) * VIEW_H} />
            ))}
            {knots.map((knot) => (
              <line key={`warp-${knot.x}`} y1="0" y2={VIEW_H} x1={knot.x} x2={knot.x} />
            ))}
          </g>
          <path ref={svgRef} className="tantu-kasuti-thread" d={visiblePath || path.slice(0, 0)} />
          {visible.map((knot) => (
            <rect
              key={`knot-${knot.point.label}`}
              className="tantu-kasuti-knot"
              x={Math.min(VIEW_W - 7, Math.max(0, knot.x - 4))}
              y={knot.y - 4}
              width="8"
              height="8"
            >
              <title>{`${knot.point.label} · ${knot.point.value}`}</title>
            </rect>
          ))}
        </svg>
        <div className="tantu-kasuti-axis" aria-hidden="true">
          {data.map((point) => (
            <span key={point.label}>{point.label}</span>
          ))}
        </div>
        {caption ? <figcaption className="tantu-kasuti-caption">{caption}</figcaption> : null}
      </figure>
    );
  },
);
