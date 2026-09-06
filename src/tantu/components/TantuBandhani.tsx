import { forwardRef, useEffect, useRef, useState, type HTMLAttributes } from "react";

export type TantuBandhaniState = "steady" | "notice";

export interface TantuBandhaniProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * How far the dye has taken around the resist knot: 0 is untouched cloth,
   * 1 is fully saturated. Meant to be driven every frame of a caller's own
   * loop (a live alignment reading, a signal level) — the ring's motion
   * comes from re-rendering this prop, not from an internal clock.
   */
  strength: number;
  /**
   * Discrete state layered over the continuous strength: the resist's
   * ordinary dye, or a distinct signal colour worth calling out. Unlike
   * `strength`, a change here is sparse enough to announce.
   */
  state?: TantuBandhaniState;
  /** Accessible name for the measurement, e.g. "Signal strength". */
  label?: string;
}

/**
 * Bandhani bloom — a live 0..1 measurement as a resist-dye ring.
 *
 * Bandhani ties a point of cloth before it goes in the vat: the bound knot
 * stays pale while the dye takes in a ring around it, and the ring's reach
 * and depth is exactly how much the cloth has taken. That is the shape of a
 * continuously-updating strength reading, so the ring's radius and opacity
 * are driven straight off `strength` — no internal timer decides how "full"
 * it looks, the caller's own value does, the same discipline TantuMeter
 * applies to a determinate fill.
 *
 * The gentle breathing keeps a low, high or mid ring visibly alive between
 * updates rather than looking like a static swatch; its amplitude still
 * scales with `strength`, so it never invents motion the value doesn't
 * support. `prefers-reduced-motion` removes the breathing and leaves the
 * ring at its resolved size, the way TantuMeter's indeterminate shuttle
 * stops rather than disappears.
 *
 * `strength` is exposed as `role="meter"` — read on demand rather than
 * spoken on every change, which matters at animation-frame update rates.
 * `state` is different in kind: it changes rarely, so its transitions are
 * pushed through a separate polite live region instead of folded into the
 * meter's value.
 */
export const TantuBandhani = forwardRef<HTMLDivElement, TantuBandhaniProps>(function TantuBandhani(
  { strength, state = "steady", label = "Strength", className, style, ...rest },
  ref,
) {
  const clamped = Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : 0;
  const percent = Math.round(clamped * 100);

  // Only a genuine transition is worth a screen reader interrupting the
  // page for — the mount value is the starting state, not an announcement.
  const previousState = useRef(state);
  const [announcement, setAnnouncement] = useState(() =>
    state === "notice" ? `${label}: notice` : `${label}: steady`,
  );
  useEffect(() => {
    if (previousState.current === state) return;
    previousState.current = state;
    setAnnouncement(state === "notice" ? `${label}: notice` : `${label}: steady`);
  }, [state, label]);

  return (
    <div
      {...rest}
      ref={ref}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}%`}
      data-state={state}
      className={["tantu-bandhani", className].filter(Boolean).join(" ")}
      style={{ ...style, ["--tantu-bandhani-strength" as string]: clamped }}
    >
      <span className="tantu-bandhani-bloom" aria-hidden="true" />
      <span className="tantu-bandhani-knot" aria-hidden="true" />
      <span className="tantu-visually-hidden" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
});
