import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getLoomAudio, panForX } from "../lib/loom-audio.js";

export interface TantuTraceSearchProps {
  /**
   * Selector for the cards the trace thread is allowed to bind to. Each match
   * is searched on its `data-trace-label` attribute, falling back to its text.
   */
  nodeSelector?: string;
  /** Kasuti label stitched above the field. */
  label?: ReactNode;
  placeholder?: string;
  /** Scroll the bound card into the aperture once the thread pulls taut. */
  reveal?: boolean;
  /** Voice the shuttle run and the twang. Default true. */
  audio?: boolean;
  /** Fired once the thread has bound (or slackened, with null). */
  onBind?: (node: HTMLElement | null, query: string) => void;
  className?: string;
}

interface TracePath {
  d: string;
  box: { x: number; y: number; w: number; h: number };
  length: number;
}

/** Orthogonal-only routing: the trace thread is a weft pick, never a diagonal. */
function routeThread(
  from: { x: number; y: number },
  target: DOMRect,
): TracePath {
  // Inset by one filament so the thread lies in the substrate gap, not on the card.
  const box = { x: target.left, y: target.top, w: target.width, h: target.height };
  const entryY = box.y + box.h / 2;
  // Drop down the warp from the field, run along the weft, then climb the
  // near selvedge of the card before wrapping it.
  const midY = from.y + (entryY - from.y) / 2;
  const approachX = from.x < box.x ? box.x : box.x + box.w;
  const lead =
    `M ${from.x} ${from.y}` +
    ` L ${from.x} ${midY}` +
    ` L ${approachX} ${midY}` +
    ` L ${approachX} ${entryY}`;
  const wrap =
    ` M ${box.x} ${box.y}` +
    ` L ${box.x + box.w} ${box.y}` +
    ` L ${box.x + box.w} ${box.y + box.h}` +
    ` L ${box.x} ${box.y + box.h}` +
    ` Z`;
  const length =
    Math.abs(midY - from.y) +
    Math.abs(approachX - from.x) +
    Math.abs(entryY - midY) +
    2 * (box.w + box.h);
  return { d: lead + wrap, box, length };
}

function labelFor(node: HTMLElement): string {
  return (node.dataset["traceLabel"] ?? node.textContent ?? "").toLowerCase();
}

/**
 * The Trace Thread.
 *
 * Searching is not a filter that hides rows — nothing is ever removed from the
 * tapestry. A single Madder Root filament is shot out of the field, routed
 * orthogonally through the substrate gaps of the lattice, and pulled dead taut
 * around the card that holds the query. The card is bound, the thread rings
 * once with the dry pitch of plucked cotton, and every other card stays exactly
 * where the weaver left it.
 */
export function TantuTraceSearch({
  nodeSelector = "[data-trace-node]",
  label = "TRACE THREAD",
  placeholder = "search the weave",
  reveal = true,
  audio = true,
  onBind,
  className,
}: TantuTraceSearchProps) {
  const fieldId = useId();
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [path, setPath] = useState<TracePath | null>(null);
  const [state, setState] = useState<"idle" | "running" | "taut" | "slack">("idle");
  const bound = useRef<HTMLElement | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const release = useCallback(() => {
    clearTimers();
    if (bound.current) {
      delete bound.current.dataset["traceBound"];
      bound.current = null;
    }
    setPath(null);
    setState("idle");
  }, [clearTimers]);

  useEffect(() => release, [release]);

  const run = useCallback(() => {
    const raw = query.trim();
    const field = fieldRef.current;
    if (!field) return;
    const rect = field.getBoundingClientRect();
    const origin = { x: rect.left + rect.width / 2, y: rect.bottom };
    const engine = audio ? getLoomAudio() : null;

    if (!raw) {
      release();
      return;
    }

    const needle = raw.toLowerCase();
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(nodeSelector));
    const target =
      nodes.find((n) => labelFor(n).startsWith(needle)) ??
      nodes.find((n) => labelFor(n).includes(needle)) ??
      null;

    clearTimers();
    if (bound.current) {
      delete bound.current.dataset["traceBound"];
      bound.current = null;
    }

    if (!target) {
      setPath(null);
      setState("slack");
      engine?.traceSlack(panForX(origin.x));
      onBind?.(null, raw);
      return;
    }

    // The fabric does not glide under a search: it is repositioned in one
    // mechanical movement so the thread is strung against a still lattice.
    if (reveal) target.scrollIntoView({ block: "center", behavior: "auto" });

    // One frame for layout to settle before the pick is routed.
    const draw = () => {
      // The field may itself have moved with the fabric — re-read the shed.
      const shed = field.getBoundingClientRect();
      const mouth = { x: shed.left + shed.width / 2, y: shed.bottom };
      const box = target.getBoundingClientRect();
      const next = routeThread(mouth, box);
      setPath(next);
      setState("running");
      engine?.traceRun({ from: panForX(origin.x), to: panForX(box.left + box.width / 2) });
      timers.current.push(
        window.setTimeout(() => {
          setState("taut");
          target.dataset["traceBound"] = "true";
          bound.current = target;
          engine?.traceTaut(panForX(box.left + box.width / 2));
          onBind?.(target, raw);
        }, 380),
      );
    };
    timers.current.push(window.setTimeout(draw, reveal ? 40 : 0));
  }, [audio, clearTimers, nodeSelector, onBind, query, release, reveal]);

  const dash = useMemo(() => (path ? Math.ceil(path.length) : 0), [path]);

  return (
    <div className={["tantu-trace", className].filter(Boolean).join(" ")} data-state={state}>
      <label className="tantu-meta-kasuti tantu-trace-label" htmlFor={fieldId}>
        {label}
      </label>
      <div className="tantu-trace-field">
        <input
          id={fieldId}
          ref={fieldRef}
          className="tantu-trace-input"
          type="search"
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            if (state !== "idle") release();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              run();
            }
            if (e.key === "Escape") release();
          }}
        />
        <button type="button" className="tantu-trace-shoot" onClick={run}>
          SHOOT
        </button>
      </div>
      <span className="tantu-meta-kasuti tantu-trace-readout">
        {state === "taut"
          ? `THREAD TAUT · ${(bound.current?.dataset["traceLabel"] ?? "NODE").toUpperCase()}`
          : state === "slack"
            ? "THREAD SLACK · NO SUCH PICK"
            : state === "running"
              ? "SHUTTLE IN FLIGHT"
              : "THREAD AT REST"}
      </span>

      {path ? (
        <svg
          className="tantu-trace-overlay"
          aria-hidden="true"
          width="100%"
          height="100%"
          preserveAspectRatio="none"
        >
          <path
            className="tantu-trace-filament"
            d={path.d}
            style={{
              strokeDasharray: dash,
              strokeDashoffset: state === "running" ? dash : 0,
            }}
          />
        </svg>
      ) : null}
    </div>
  );
}
