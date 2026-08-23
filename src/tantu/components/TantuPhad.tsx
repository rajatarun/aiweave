import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { getLoomAudio, panForX } from "../lib/loom-audio";

export interface PhadEvent {
  id: string;
  /** ISO date string or Date — the point on the continuous warp. */
  date: string | Date;
  label: string;
  /** Body copy woven into the block. Historical events carry full weft. */
  detail?: string;
  /** Talim coordinate stamped on the pick. */
  talimCode?: string;
}

export interface TantuPhadProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  events: PhadEvent[];
  /** The present moment. Everything after it renders as frayed Kora warp. */
  now?: Date;
  /** Visible height of the roller aperture, in knots (base-6 multiples). */
  apertureKnots?: number;
  /** Fires when a pick locks under the focus gear. */
  onSelect?: (event: PhadEvent) => void;
  /** Silence the wooden roller and the date lock. */
  silent?: boolean;
}

const MS_DAY = 86_400_000;

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function formatPick(date: Date): string {
  // Fixed locale + UTC: the scroll must read identically on loom and on client
  // (a timezone-drifting date is a hydration rupture, not a weave).
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The Phad — a chronological scroll stretched between two wooden rollers.
 *
 * Time is the vertical warp; events are the horizontal weft that binds it.
 * Past picks are fully dyed and locked into the lattice. Future picks are
 * un-dyed Kora warp with no weft across them — structurally incomplete, and
 * visibly malleable. Panning is kinetic: momentum decays against friction,
 * and dragging past the present pulls the loose warp taut before the scroll
 * snaps mechanically back to the woven edge.
 */
export function TantuPhad({
  events,
  now,
  apertureKnots = 12,
  onSelect,
  silent = false,
  className,
  style,
  ...rest
}: TantuPhadProps) {
  const apertureRef = useRef<HTMLDivElement | null>(null);
  const clothRef = useRef<HTMLOListElement | null>(null);
  const offsetRef = useRef(0);
  const velocityRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const dragRef = useRef<{ id: number; y: number; t: number } | null>(null);
  const [limit, setLimit] = useState(0);
  const [strained, setStrained] = useState(false);

  const present = now ?? new Date();

  const picks = useMemo(() => {
    const sorted = [...events].sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime());
    return sorted.map((event) => {
      const date = toDate(event.date);
      const woven = date.getTime() <= present.getTime();
      const distance = Math.abs(date.getTime() - present.getTime()) / MS_DAY;
      return { event, date, woven, distance };
    });
  }, [events, present]);

  const measure = useCallback(() => {
    const aperture = apertureRef.current;
    const cloth = clothRef.current;
    if (!aperture || !cloth) return;
    setLimit(Math.max(0, cloth.scrollHeight - aperture.clientHeight));
  }, []);

  useLayoutEffect(() => {
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    if (clothRef.current) observer.observe(clothRef.current);
    if (apertureRef.current) observer.observe(apertureRef.current);
    return () => observer.disconnect();
  }, [measure, picks.length]);

  const paint = useCallback((offset: number) => {
    const cloth = clothRef.current;
    if (cloth) cloth.style.transform = `translate3d(0, ${-offset}px, 0)`;
  }, []);

  const audioPan = useCallback(() => {
    const box = apertureRef.current?.getBoundingClientRect();
    return box ? panForX(box.left + box.width / 2) : 0;
  }, []);

  /** Rubber tension: past the ends, the warp resists at a diminishing rate. */
  const applyTension = useCallback(
    (raw: number) => {
      if (raw < 0) return raw * 0.28;
      if (raw > limit) return limit + (raw - limit) * 0.28;
      return raw;
    },
    [limit],
  );

  const settle = useCallback(() => {
    if (frameRef.current !== null) return;
    const step = () => {
      frameRef.current = null;
      const over = offsetRef.current > limit ? offsetRef.current - limit : offsetRef.current < 0 ? offsetRef.current : 0;

      if (over !== 0 && !dragRef.current) {
        // Snap back: the taut warp recoils to the woven edge.
        const target = over > 0 ? limit : 0;
        const next = offsetRef.current + (target - offsetRef.current) * 0.24;
        offsetRef.current = Math.abs(next - target) < 0.5 ? target : next;
        paint(offsetRef.current);
        if (offsetRef.current !== target) {
          frameRef.current = requestAnimationFrame(step);
        } else {
          setStrained(false);
          velocityRef.current = 0;
        }
        return;
      }

      if (Math.abs(velocityRef.current) < 0.04 || dragRef.current) {
        velocityRef.current = 0;
        return;
      }
      velocityRef.current *= 0.93; // heavy cloth friction, not a digital glide
      offsetRef.current = applyTension(offsetRef.current + velocityRef.current);
      paint(offsetRef.current);
      if (!silent) getLoomAudio().rollerTick(Math.min(1, Math.abs(velocityRef.current) / 26), audioPan());
      setStrained(offsetRef.current > limit + 4);
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  }, [applyTension, audioPan, limit, paint, silent]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (!silent) getLoomAudio().stopRoller();
    },
    [silent],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragRef.current = { id: event.pointerId, y: event.clientY, t: event.timeStamp };
    velocityRef.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dy = drag.y - event.clientY;
    const dt = Math.max(1, event.timeStamp - drag.t);
    dragRef.current = { id: drag.id, y: event.clientY, t: event.timeStamp };
    velocityRef.current = (dy / dt) * 16;
    offsetRef.current = applyTension(offsetRef.current + dy);
    paint(offsetRef.current);
    setStrained(offsetRef.current > limit + 4);
    if (!silent) getLoomAudio().rollerTick(Math.min(1, Math.abs(dy) / 22), audioPan());
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.id !== event.pointerId) return;
    dragRef.current = null;
    settle();
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    velocityRef.current = event.deltaY * 0.35;
    offsetRef.current = applyTension(offsetRef.current + event.deltaY);
    paint(offsetRef.current);
    setStrained(offsetRef.current > limit + 4);
    if (!silent) getLoomAudio().rollerTick(Math.min(1, Math.abs(event.deltaY) / 90), audioPan());
    settle();
  };

  const lock = (pick: (typeof picks)[number]) => {
    if (!silent) getLoomAudio().lockDate(audioPan());
    onSelect?.(pick.event);
  };

  return (
    <div
      {...rest}
      className={["tantu-phad", className].filter(Boolean).join(" ")}
      style={{ ["--tantu-phad-aperture" as string]: `calc(var(--tantu-knot-6) * ${apertureKnots})`, ...style }}
      data-strained={strained ? "true" : "false"}
    >
      <div className="tantu-phad-roller" aria-hidden="true" data-end="top" />
      <div
        ref={apertureRef}
        className="tantu-phad-aperture"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
      >
        <div className="tantu-phad-warp" aria-hidden="true" />
        <ol ref={clothRef} className="tantu-phad-cloth">
          {picks.map((pick) => (
            <li
              key={pick.event.id}
              className="tantu-phad-pick"
              data-weave={pick.woven ? "woven" : "frayed"}
            >
              <button
                type="button"
                className="tantu-phad-gear"
                onFocus={() => lock(pick)}
                onClick={() => lock(pick)}
                aria-describedby={pick.event.detail ? `${pick.event.id}-weft` : undefined}
              >
                <span className="tantu-phad-date">{formatPick(pick.date)}</span>
                <span className="tantu-phad-label">{pick.event.label}</span>
                {pick.event.talimCode ? (
                  <span className="tantu-meta-talim tantu-phad-talim">{pick.event.talimCode}</span>
                ) : null}
              </button>
              {pick.woven ? (
                <div className="tantu-phad-weft" id={`${pick.event.id}-weft`}>
                  {pick.event.detail ? <p className="tantu-phad-detail">{pick.event.detail}</p> : null}
                  <span className="tantu-visually-hidden">Woven — locked into the lattice.</span>
                </div>
              ) : (
                <div className="tantu-phad-kora" aria-hidden="true">
                  <span className="tantu-visually-hidden">Frayed — scheduled, not yet woven.</span>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
      <div className="tantu-phad-roller" aria-hidden="true" data-end="bottom" />
    </div>
  );
}
