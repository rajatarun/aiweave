import { useEffect, useRef } from "react";
import { getLoomAudio, panForX, type LoomAudioOptions } from "../lib/loom-audio";

/**
 * The Weaver's Shuttle (Maku) — keyboard navigation as a physical weft throw.
 *
 * Focus never teleports: a gold zari thread is drawn through the grid gaps from
 * the previously focused component to the new one, leaving a fading trail.
 * Rapid tabbing pulls the thread taut across every node the shuttle passed
 * (tension snapping) before it settles on the destination.
 *
 * The hook also installs:
 * - the Maku focus relief class (`tantu-maku-focus`) for the Zardozi stitch
 *   outline and capillary indigo pooling,
 * - the Kasuti coordinate readout at the component's bottom-right selvedge,
 * - Tana (up/down) and Bana (left/right) spatial matrix routing.
 */

export interface MakuShuttleOptions {
  /** Draw duration of the weft throw, in ms. */
  throwDuration?: number;
  /** Fade-out duration of the residual thread, in ms. */
  trailDuration?: number;
  /** Two hops closer than this (ms) are considered one taut, snapped throw. */
  tensionWindow?: number;
  /** Enable Tana/Bana arrow-key spatial routing across the lattice. */
  spatialRouting?: boolean;
  /**
   * Micro-audio: the handloom sampler voices every shuttle throw, batten
   * strike, heddle shift and warp snap, panned to the grid X coordinate.
   */
  audio?: boolean;
  /** Master level for the loom sampler, 0-1. */
  audioOptions?: LoomAudioOptions;
}

export interface MakuShuttleRefs {
  svg: SVGSVGElement | null;
  coord: HTMLElement | null;
}

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const SVG_NS = "http://www.w3.org/2000/svg";

const TEXT_ENTRY = new Set(["text", "search", "url", "tel", "email", "password", "number", "date"]);

function isTextEntry(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return TEXT_ENTRY.has(type);
  }
  return (el as HTMLElement).isContentEditable === true;
}

/**
 * Roles and controls whose own keyboard contract owns the arrow keys. The
 * shuttle's spatial routing must never take them from a widget whose ARIA
 * pattern requires them — TantuTabs, native radio groups, listboxes, menus,
 * trees and grids all did lose them while this ran in the capture phase.
 */
const ARROW_OWNING_ROLES = new Set([
  "application", "combobox", "grid", "gridcell", "columnheader", "listbox",
  "menu", "menubar", "menuitem", "menuitemcheckbox", "menuitemradio",
  "option", "radio", "radiogroup", "row", "rowheader", "scrollbar",
  "searchbox", "slider", "spinbutton", "tab", "tablist", "textbox",
  "toolbar", "tree", "treegrid", "treeitem",
]);

/** True when `el`, or anything it sits inside, needs the arrow keys itself. */
function ownsArrowKeys(el: Element | null): boolean {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const role = n.getAttribute?.("role");
    if (role && ARROW_OWNING_ROLES.has(role)) return true;
    if (n.tagName === "SELECT" || n.tagName === "TEXTAREA") return true;
    if (n.tagName === "INPUT") {
      const type = (n as HTMLInputElement).type;
      if (type === "radio" || type === "range" || TEXT_ENTRY.has(type)) return true;
    }
    if ((n as HTMLElement).isContentEditable) return true;
  }
  return false;
}

function isReachable(el: Element): boolean {
  const node = el as HTMLElement;
  if (node.hasAttribute("disabled")) return false;
  if (node.getAttribute("aria-hidden") === "true") return false;
  const rect = node.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  return true;
}

/** Snap a coordinate to the nearest structural thread (1px grid gap) of the loom. */
function snapToThread(value: number, lines: number[]): number {
  if (lines.length === 0) return value;
  let best = lines[0]!;
  let bestDelta = Math.abs(value - best);
  for (const line of lines) {
    const delta = Math.abs(value - line);
    if (delta < bestDelta) {
      best = line;
      bestDelta = delta;
    }
  }
  // Only snap when the thread is genuinely nearby, otherwise keep the true path.
  return bestDelta < 48 ? best : value;
}

interface LoomMetrics {
  left: number;
  top: number;
  columns: number[];
  columnWidth: number;
  rowHeight: number;
  gaps: number[];
}

function readLoom(): LoomMetrics | null {
  const content = document.querySelector<HTMLElement>(".tantu-loom-content");
  if (!content) return null;
  const rect = content.getBoundingClientRect();
  const style = getComputedStyle(content);
  const tracks = style.gridTemplateColumns
    .split(" ")
    .map((v) => parseFloat(v))
    .filter((v) => !Number.isNaN(v));
  const gap = parseFloat(style.columnGap) || 1;
  const padLeft = parseFloat(style.paddingLeft) || 0;
  const padTop = parseFloat(style.paddingTop) || 0;

  const columns: number[] = [];
  const gaps: number[] = [];
  let cursor = rect.left + padLeft;
  for (const track of tracks) {
    columns.push(cursor);
    cursor += track;
    gaps.push(cursor + gap / 2);
    cursor += gap;
  }

  return {
    left: rect.left + padLeft,
    top: rect.top + padTop,
    columns,
    columnWidth: tracks[0] ?? 1,
    rowHeight: 48,
    gaps,
  };
}

/** Kasuti machine coordinates, e.g. [W:04-H:02]. */
function coordinateFor(el: HTMLElement, loom: LoomMetrics | null): string {
  const rect = el.getBoundingClientRect();
  if (!loom) return `[X:${Math.round(rect.left)}-Y:${Math.round(rect.top + window.scrollY)}]`;
  const w = Math.max(1, Math.round((rect.left - loom.left) / (loom.columnWidth + 1)) + 1);
  const h = Math.max(1, Math.floor((rect.top - loom.top) / loom.rowHeight) + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `[W:${pad(w)}-H:${pad(h)}]`;
}

export function useMakuShuttle(options: MakuShuttleOptions = {}) {
  const {
    throwDuration = 180,
    trailDuration = 520,
    tensionWindow = 260,
    spatialRouting = true,
    audio = true,
    audioOptions,
  } = options;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const coordRef = useRef<HTMLElement | null>(null);

  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastTimeRef = useRef(0);
  const tautRef = useRef<Array<{ x: number; y: number }>>([]);
  const focusedRef = useRef<HTMLElement | null>(null);
  const loomAudioRef = useRef<ReturnType<typeof getLoomAudio> | null>(null);

  useEffect(() => {
    const engine = audio ? getLoomAudio(audioOptions) : null;
    loomAudioRef.current = engine;

    // Autoplay policies: the sampler bank is rendered on the first gesture.
    const primeAudio = () => {
      engine?.prime();
      engine?.resume();
    };
    if (engine) {
      document.addEventListener("pointerdown", primeAudio, { once: true, capture: true });
      document.addEventListener("keydown", primeAudio, { once: true, capture: true });
    }

    const drawThread = (
      points: Array<{ x: number; y: number }>,
      opts: { taut: boolean },
    ) => {
      const svg = svgRef.current;
      if (!svg || points.length < 2) return;

      const d = points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(" ");

      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("class", opts.taut ? "tantu-maku-thread tantu-maku-thread-taut" : "tantu-maku-thread");
      svg.appendChild(path);

      const length = path.getTotalLength();
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;

      const anim = path.animate(
        [
          { strokeDashoffset: length, opacity: 1 },
          { strokeDashoffset: 0, opacity: 1, offset: 0.35 },
          { strokeDashoffset: 0, opacity: 0 },
        ],
        { duration: throwDuration + trailDuration, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" },
      );
      anim.onfinish = () => path.remove();
      anim.oncancel = () => path.remove();
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || !target.matches?.(INTERACTIVE_SELECTOR)) return;

      const previous = focusedRef.current;
      if (previous) {
        previous.classList.remove("tantu-maku-focus");
        previous.removeAttribute("data-maku-coord");
      }
      focusedRef.current = target;
      target.classList.add("tantu-maku-focus");

      const loom = readLoom();
      const coordinate = coordinateFor(target, loom);
      target.setAttribute("data-maku-coord", coordinate);

      const rect = target.getBoundingClientRect();
      const landing = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

      // Kasuti coordinate reveal, pinned to the bottom-right selvedge margin.
      const coordEl = coordRef.current;
      if (coordEl) {
        coordEl.textContent = coordinate;
        coordEl.style.transform = `translate(${rect.right - 2}px, ${rect.bottom + 2}px) translateX(-100%)`;
        coordEl.dataset["state"] = "revealed";
      }

      const now = performance.now();
      const origin = lastPointRef.current;
      if (origin) {
        const taut = now - lastTimeRef.current < tensionWindow;
        // The shuttle throws along the weft (bana) first, then travels the warp
        // (tana), snapping onto the structural threads carved by the grid gap.
        const corner = {
          x: snapToThread(landing.x, loom?.gaps ?? []),
          y: origin.y,
        };

        // Shuttle glide — a swift hollow swish, panned to where it lands.
        // Rapid tabs overlap into continuous rhythmic sliding.
        engine?.play("shuttleGlide", {
          pan: panForX(landing.x),
          gain: taut ? 0.55 : 0.85,
          rate: taut ? 1.18 : 1,
        });

        if (taut) {
          tautRef.current.push(landing);
          drawThread([tautRef.current[0]!, ...tautRef.current], { taut: true });
        } else {
          tautRef.current = [origin, landing];
          drawThread([origin, corner, landing], { taut: false });
        }
      } else {
        tautRef.current = [landing];
        engine?.play("shuttleGlide", { pan: panForX(landing.x), gain: 0.7 });
      }

      lastPointRef.current = landing;
      lastTimeRef.current = now;
    };

    const handleFocusOut = () => {
      const coordEl = coordRef.current;
      window.setTimeout(() => {
        if (document.activeElement === document.body) {
          focusedRef.current?.classList.remove("tantu-maku-focus");
          focusedRef.current?.removeAttribute("data-maku-coord");
          focusedRef.current = null;
          if (coordEl) coordEl.dataset["state"] = "hidden";
        }
      }, 0);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;

      // Batten strike — the weaver pulls the teak batten forward, locking
      // the weft. Fired on activation of the focused node.
      if (key === "Enter" || key === " ") {
        const active = document.activeElement as HTMLElement | null;
        if (active && active.matches?.(INTERACTIVE_SELECTOR) && !isTextEntry(active)) {
          const rect = active.getBoundingClientRect();
          engine?.play("battenStrike", { pan: panForX(rect.left + rect.width / 2) });
        } else if (key === "Enter" && active?.closest("form")) {
          engine?.play("battenStrike", { pan: 0 });
        }
      }

      if (!spatialRouting) return;
      if (key !== "ArrowUp" && key !== "ArrowDown" && key !== "ArrowLeft" && key !== "ArrowRight") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // A component that handled this key already wins — spatial routing now
      // runs in the bubble phase so component handlers get first refusal.
      if (event.defaultPrevented) return;

      const current = document.activeElement as HTMLElement | null;
      if (!current || !current.matches?.(INTERACTIVE_SELECTOR)) return;
      if (ownsArrowKeys(current)) return;

      const origin = current.getBoundingClientRect();
      const vertical = key === "ArrowUp" || key === "ArrowDown";
      const sign = key === "ArrowDown" || key === "ArrowRight" ? 1 : -1;

      let best: { el: HTMLElement; distance: number } | null = null;

      for (const node of Array.from(document.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR))) {
        if (node === current || !isReachable(node)) continue;
        const rect = node.getBoundingClientRect();

        if (vertical) {
          // Tana routing: stay on the vertical warp thread of this column.
          const overlap = Math.min(origin.right, rect.right) - Math.max(origin.left, rect.left);
          if (overlap <= 0) continue;
          const delta = (rect.top + rect.height / 2 - (origin.top + origin.height / 2)) * sign;
          if (delta <= 1) continue;
          const distance = delta - overlap * 0.05;
          if (!best || distance < best.distance) best = { el: node, distance };
        } else {
          // Bana routing: throw the shuttle horizontally across the row.
          const overlap = Math.min(origin.bottom, rect.bottom) - Math.max(origin.top, rect.top);
          if (overlap <= 0) continue;
          const delta = (rect.left + rect.width / 2 - (origin.left + origin.width / 2)) * sign;
          if (delta <= 1) continue;
          const distance = delta - overlap * 0.05;
          if (!best || distance < best.distance) best = { el: node, distance };
        }
      }

      if (best) {
        event.preventDefault();
        // Heddle shift — treadles open a new pathway through the warp.
        const rect = best.el.getBoundingClientRect();
        engine?.play("heddleShift", {
          pan: panForX(rect.left + rect.width / 2),
          rate: vertical ? 1 : 0.92,
        });
        best.el.focus();
      } else {
        // Warp snap — a taut thread plucked at the edge of the lattice.
        engine?.play("warpSnap", {
          pan: panForX(origin.left + origin.width / 2),
          gain: 0.6,
        });
      }
    };

    const handleReflow = () => {
      const el = focusedRef.current;
      const coordEl = coordRef.current;
      if (!el || !coordEl) return;
      const rect = el.getBoundingClientRect();
      coordEl.style.transform = `translate(${rect.right - 2}px, ${rect.bottom + 2}px) translateX(-100%)`;
    };

    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("focusout", handleFocusOut, true);
    // Bubble, not capture: capture ran ahead of every component handler, so
    // the shuttle silently overrode any widget that owns the arrow keys.
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleReflow, true);
    window.addEventListener("resize", handleReflow);

    return () => {
      document.removeEventListener("pointerdown", primeAudio, true);
      document.removeEventListener("keydown", primeAudio, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("focusout", handleFocusOut, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleReflow, true);
      window.removeEventListener("resize", handleReflow);
      focusedRef.current?.classList.remove("tantu-maku-focus");
    };
  }, [throwDuration, trailDuration, tensionWindow, spatialRouting, audio, audioOptions]);

  return { svgRef, coordRef, audioRef: loomAudioRef };
}
