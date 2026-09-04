import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import { InkBleedFilter } from "./InkBleedFilter";
import {
  bleedMotionAllowed,
  holdAmbientBleed,
  wickCoverRadius,
  wickProgress,
  wickRadii,
} from "../lib/bleed-bus";

export type ChambaRumalCardWarpSpan = 1 | 2 | 3 | 4 | 6 | 12;

export interface ChambaRumalCardProps extends HTMLAttributes<HTMLElement> {
  /** The front face of the double-sided card. */
  obverse: ReactNode;
  /** The back face, revealed through a flat 2D scale inversion. */
  reverse: ReactNode;
  /**
   * Show the reverse face. Passing this makes the card controlled; pair it
   * with `onFlipChange` or the built-in trigger has nothing to call and is
   * therefore not rendered.
   */
  isFlipped?: boolean;
  /** Which face an uncontrolled card starts on. */
  defaultFlipped?: boolean;
  /** Called with the face the reader asked for. */
  onFlipChange?: (flipped: boolean) => void;
  /** Label on the obverse's trigger. */
  flipLabel?: ReactNode;
  /** Label on the reverse's trigger. */
  backLabel?: ReactNode;
  /** Render no trigger at all — for a card driven entirely from outside. */
  trigger?: boolean;
  /** Grid-column span across the 12-thread main weave. Defaults to 6 (the standard Dorukha footprint). */
  warpSpan?: ChambaRumalCardWarpSpan;
}

/** How long the dye takes to cross the cloth, ms. */
const DURATION = 1900;
/** The settled "fully open" radius: off-card, so the face is simply uncovered. */
const REST_R = 9999;
/** Fray strength of the filter this card mounts for itself. */
const BASE_SCALE = 22;
const BASE_SOAK = 2;

/**
 * Chamba Rumal Dorukha card.
 *
 * Inspired by the double-sided satin stitch of Himachal Pradesh, this card
 * achieves an isomorphic front/back transition without leaving the 2D plane.
 * The front and back layers are stacked using an internal sub-grid; the
 * incoming face is then uncovered by a dye front spreading from wherever the
 * reader pressed, rather than by a slide or a 3D rotation.
 *
 * The flip is the component's own. It used to be a prop and nothing else:
 * `isFlipped` in, no trigger, no animation, no state — so a React consumer
 * had no way to turn the card at all, and the wicking transition existed only
 * as a hand-written script on one static page. A component whose whole
 * premise is a two-sided cloth has to be able to turn over.
 *
 * The growth law is imported, not retyped. `wickProgress` and `wickRadii` are
 * the same Lucas–Washburn functions the WebGL shader and that page's script
 * use, so the DOM front and the GLSL front cannot drift into different
 * physics.
 */
export const ChambaRumalCard = forwardRef<HTMLElement, ChambaRumalCardProps>(function ChambaRumalCard(
  {
    obverse,
    reverse,
    isFlipped,
    defaultFlipped = false,
    onFlipChange,
    flipLabel = "Turn the cloth",
    backLabel = "Turn back",
    trigger = true,
    warpSpan = 6,
    className,
    style,
    ...rest
  },
  ref,
) {
  const filterId = `tantu-rumal-bleed-${useId().replace(/[^\w-]/g, "")}`;
  const controlled = isFlipped !== undefined;
  const [internal, setInternal] = useState(defaultFlipped);
  const flipped = controlled ? isFlipped : internal;

  // A control that cannot change anything should not exist. A controlled card
  // with no handler is being driven from outside, so it gets no trigger rather
  // than a dead one.
  const interactive = trigger && (!controlled || Boolean(onFlipChange));

  const cardRef = useRef<HTMLElement | null>(null);
  const obverseRef = useRef<HTMLDivElement | null>(null);
  const reverseRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  /** Set when the reader turned the card, so focus follows to the new face. */
  const followFocus = useRef(false);

  const attachCard = useCallback(
    (node: HTMLElement | null) => {
      cardRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: HTMLElement | null }).current = node;
    },
    [ref],
  );

  /** Stop mid-flight and release the ambient hold; unmounting must not leak it. */
  const halt = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    releaseRef.current?.();
    releaseRef.current = null;
  }, []);

  useEffect(() => halt, [halt]);

  /**
   * Grow the dye front across `face` from (ox, oy), in percent of the card.
   *
   * Writes `--tantu-rumal-rx/ry`, not a literal clip-path: the face's crisp
   * clip and its nested ink-bleed-filtered rim both read those properties, so
   * one write keeps the text sharp while the edge frays.
   */
  const grow = useCallback((face: HTMLDivElement, ox: number, oy: number, duration: number) => {
    halt();
    // Ambient responders stand down while this fill spreads, so a pointer
    // trail cannot bloom over it. The bus counts holds.
    releaseRef.current = holdAmbientBleed();

    const rim = face.querySelector<HTMLElement>(".tantu-rumal-rim-filter");
    if (rim) rim.style.filter = `url(#${filterId})`;
    // filterId is generated, and only ever [\w-] starting with a letter, so it
    // needs no escaping to be a valid id selector.
    const svg = cardRef.current?.querySelector(`#${filterId}`) ?? null;
    const disp = svg?.querySelector("feDisplacementMap") ?? null;
    const blur = svg?.querySelector("feGaussianBlur") ?? null;

    face.style.setProperty("--tantu-rumal-ox", `${ox}%`);
    face.style.setProperty("--tantu-rumal-oy", `${oy}%`);

    // The front reaches the farthest corner exactly as the droplet's lifetime
    // ends, so the whole duration is visible travel rather than off-card growth.
    const w = face.offsetWidth;
    const h = face.offsetHeight;
    const coverRy = wickCoverRadius(w, h, (w * ox) / 100, (h * oy) / 100);

    const settle = () => {
      face.style.setProperty("--tantu-rumal-rx", `${REST_R}px`);
      face.style.setProperty("--tantu-rumal-ry", `${REST_R}px`);
      if (rim) rim.style.filter = "none";
      disp?.setAttribute("scale", String(BASE_SCALE));
      blur?.setAttribute("stdDeviation", String(BASE_SOAK));
      // The covered face returns to closed, or it sits there still open at a
      // stale origin and bleeds through the next turn.
      const other = face === obverseRef.current ? reverseRef.current : obverseRef.current;
      other?.style.setProperty("--tantu-rumal-rx", "0px");
      other?.style.setProperty("--tantu-rumal-ry", "0px");
      halt();
    };

    if (duration <= 0) {
      settle();
      return;
    }

    let start: number | null = null;
    const step = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / duration);
      const { rx, ry } = wickRadii(coverRy, wickProgress(t));
      face.style.setProperty("--tantu-rumal-rx", `${rx.toFixed(2)}px`);
      face.style.setProperty("--tantu-rumal-ry", `${ry.toFixed(2)}px`);
      // Fray holds almost full strength while the front travels and settles
      // only at the very end; a gentler taper fades the ragged edge out
      // exactly when cloth looks most torn.
      const wetness = 1 - t ** 6;
      disp?.setAttribute("scale", (BASE_SCALE * wetness).toFixed(2));
      blur?.setAttribute("stdDeviation", (BASE_SOAK * wetness).toFixed(3));
      if (t < 1) frameRef.current = requestAnimationFrame(step);
      else settle();
    };
    frameRef.current = requestAnimationFrame(step);
  }, [filterId, halt]);

  const flip = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const next = !flipped;
    const card = cardRef.current;
    const incoming = next ? reverseRef.current : obverseRef.current;

    if (card && incoming) {
      // Origin is the trigger's own centre, not the click point — a
      // keyboard-activated click has no meaningful coordinates — so the dye
      // spreads from where the reader actually pressed either way.
      const cardBox = card.getBoundingClientRect();
      const triggerBox = event.currentTarget.getBoundingClientRect();
      const ox = ((triggerBox.left + triggerBox.width / 2 - cardBox.left) / cardBox.width) * 100;
      const oy = ((triggerBox.top + triggerBox.height / 2 - cardBox.top) / cardBox.height) * 100;
      incoming.style.setProperty("--tantu-rumal-rx", "0px");
      incoming.style.setProperty("--tantu-rumal-ry", "0px");
      grow(incoming, ox, oy, bleedMotionAllowed() ? DURATION : 0);
    }

    followFocus.current = true;
    if (!controlled) setInternal(next);
    onFlipChange?.(next);
  };

  /**
   * Keep the covered face out of the tab order.
   *
   * The face is aria-hidden, so anything focusable inside it is axe's
   * aria-hidden-focus: Tab walks a keyboard reader into a subtree screen
   * readers have been told to ignore, and focus lands somewhere that announces
   * nothing. The trigger is handled declaratively, but a face is a slot — a
   * consumer can put a link or a button in one, and on the aiweave site every
   * card does exactly that. So sweep the whole subtree, stashing any tabindex
   * a control already carried rather than handing it back a 0 it never had.
   */
  useLayoutEffect(() => {
    for (const [face, showing] of [
      [obverseRef.current, !flipped],
      [reverseRef.current, flipped],
    ] as const) {
      if (!face) continue;
      for (const el of face.querySelectorAll<HTMLElement>("a[href], button, [tabindex]")) {
        if (el.classList.contains("tantu-rumal-flip")) continue; // declarative, above
        if (showing) {
          const was = el.dataset.tabWas;
          // No stash means this face was never taken out of the tab order, so
          // whatever tabindex it carries is the author's. Removing it here
          // wiped a deliberate tabIndex the first time a card rendered.
          if (was === undefined) continue;
          if (was === "") el.removeAttribute("tabindex");
          else el.setAttribute("tabindex", was);
          delete el.dataset.tabWas;
        } else {
          if (el.dataset.tabWas === undefined) el.dataset.tabWas = el.getAttribute("tabindex") ?? "";
          el.setAttribute("tabindex", "-1");
        }
      }
    }
  }, [flipped, obverse, reverse]);

  // The face being left is aria-hidden, and the trigger the reader just
  // pressed is inside it. Moving focus to the same control on the face now
  // showing keeps it somewhere real and matches what the reader asked for.
  useLayoutEffect(() => {
    if (!followFocus.current) return;
    followFocus.current = false;
    const face = flipped ? reverseRef.current : obverseRef.current;
    face?.querySelector<HTMLButtonElement>(".tantu-rumal-flip")?.focus();
  }, [flipped]);

  const face = (side: "obverse" | "reverse", content: ReactNode, label: ReactNode) => {
    const showing = side === "reverse" ? flipped : !flipped;
    return (
      <div
        className={`tantu-rumal-${side}`}
        ref={side === "obverse" ? obverseRef : reverseRef}
        aria-hidden={!showing}
      >
        {/* Each face is two layers: the dye pool (a solid fill clipped to the
            spreading circle, whose edge the ink-bleed filter tears) and the
            content above it (clipped to the same circle but unfiltered, so
            text stays sharp). The filter has to sit on a wrapper *around*
            the clipped fill rather than on the fill itself — CSS applies
            `filter` before that same element's own `clip-path`, so a box
            that is both clipped and filtered gets its uniform interior
            perturbed and is then cropped by an unaffected clean clip-path.
            Neither the face nor the filter wrapper may carry a background
            or a clip-path of its own: either one re-covers or re-crops the
            torn edge back to a perfect circle. */}
        <div className="tantu-rumal-rim-filter" aria-hidden="true">
          <div className="tantu-rumal-rim-fill" />
        </div>
        <div className="tantu-rumal-content">
          {content}
          {interactive ? (
            <button
              type="button"
              className="tantu-rumal-flip"
              onClick={flip}
              // The hidden face keeps its trigger in the DOM so focus has
              // somewhere to land the instant it becomes the showing one,
              // but it must not be a tab stop while it is hidden.
              tabIndex={showing ? undefined : -1}
            >
              {label}
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <article
      ref={attachCard}
      {...rest}
      className={["tantu-card", `tantu-cell-warp-${warpSpan}`, "tantu-card-rumal", className].filter(Boolean).join(" ")}
      data-state={flipped ? "reverse" : "obverse"}
      style={style}
    >
      {/* The card mounts its own fray filter. Requiring the consumer to render
          an InkBleedFilter somewhere and pass its id is how a component ends
          up silently un-frayed in every app that did not read the docs. */}
      <InkBleedFilter id={filterId} frequency={0.035} scale={BASE_SCALE} soak={BASE_SOAK} fibreContrast={3.5} edgeFray />
      {face("obverse", obverse, flipLabel)}
      {face("reverse", reverse, backLabel)}
    </article>
  );
});
