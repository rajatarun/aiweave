import * as React from "react";

export interface PatolaPoint {
  x: number;
  y: number;
  label?: string;
}

export interface PatolaFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  data: PatolaPoint[];
  /** Lattice resolution — base-6 multiples keep the weave honest. */
  columns?: number;
  rows?: number;
  caption?: React.ReactNode;
}

/**
 * Patola Vibration. No radial glow, no synthetic gradient: density is read
 * through Double Ikat resist-dyeing. Isolated readings sit sharp on their
 * thread; where readings pile up, the pre-dyed warp and weft can no longer be
 * registered against each other, so the cell steps horizontally out of true
 * and the dye feathers. The denser the cluster, the harder the optical
 * vibration — density becomes texture rather than colour.
 */
export const PatolaField = React.forwardRef<HTMLDivElement, PatolaFieldProps>(
  function PatolaField({ data, columns = 18, rows = 12, caption, className, ...rest }, ref) {
    const cells = React.useMemo(() => {
      const counts = new Map<string, number>();
      let peak = 0;
      for (const point of data) {
        const cx = Math.max(0, Math.min(columns - 1, Math.floor(point.x * columns)));
        const cy = Math.max(0, Math.min(rows - 1, Math.floor(point.y * rows)));
        const key = `${cx}:${cy}`;
        const next = (counts.get(key) ?? 0) + 1;
        counts.set(key, next);
        if (next > peak) peak = next;
      }
      return Array.from(counts, ([key, count]) => {
        const [cx, cy] = key.split(":").map(Number);
        // Misregistration bands: 0 = sharp thread, 4 = full Ikat vibration.
        const band = Math.min(4, Math.round((count / Math.max(1, peak)) * 4));
        return { key, cx, cy, count, band };
      });
    }, [columns, data, rows]);

    return (
      <figure className={["tantu-patola", className].filter(Boolean).join(" ")} ref={ref as never} {...(rest as React.HTMLAttributes<HTMLElement>)}>
        <div
          className="tantu-patola-field"
          role="img"
          aria-label={`Patola density field, ${data.length} readings across ${columns} by ${rows} threads`}
          style={{
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
          }}
        >
          {cells.map((cell) => (
            <span
              key={cell.key}
              className="tantu-patola-cell"
              data-band={cell.band}
              style={{
                gridColumn: cell.cx + 1,
                gridRow: cell.cy + 1,
                animationDelay: `${((cell.cx * 7 + cell.cy * 13) % 11) * 40}ms`,
              }}
            >
              <span className="tantu-visually-hidden">{cell.count}</span>
            </span>
          ))}
        </div>
        {caption ? <figcaption className="tantu-kasuti-caption">{caption}</figcaption> : null}
      </figure>
    );
  },
);
