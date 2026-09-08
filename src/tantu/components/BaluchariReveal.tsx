import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";

import { bleedMotionAllowed } from "../lib/bleed-bus.js";

export interface BaluchariRevealProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** The line to reveal. Plain text or inline markup — never Tantu's own copy. */
  children: ReactNode;
  /** How long the weft takes to cross the line, ms. */
  durationMs?: number;
  /** Delay before the shuttle starts, ms — lets a mounting transition settle first. */
  delayMs?: number;
  /** Called once, when the line finishes revealing (or immediately, if motion is reduced). */
  onRevealed?: () => void;
  /** Announce the text to assistive tech as it becomes final. Default true. */
  announce?: boolean;
}

/**
 * Baluchari Reveal — a line of text drawn in the way a Baluchari border is
 * woven: a single pass, left to right, the figure arriving with the thread
 * rather than after it. Historically the technique wove narrative directly
 * into silk rather than embroidering it on afterward — the telling and the
 * making were the same act. This component is that idea applied to a line of
 * copy a consuming app needs read, once, as it arrives.
 *
 * IT DOES NOT AUTHOR THE WORDS. The shuttle is Tantu's; the sentence inside
 * it belongs entirely to whichever app renders this. That separation is not
 * a style note — it's the whole reason this exists as a Tantu primitive
 * rather than living in a consumer's own tree: the reveal is reusable
 * *because* it never presumes a vocabulary, a tone, or a language for what
 * it draws.
 *
 * MOTION. `bleedMotionAllowed()` — the same reduced-motion gate every other
 * capillary/dye component in this library honours. Reduced: the line appears
 * whole, immediately, and `onRevealed` fires on the same tick. The reveal is
 * decoration; the sentence is the content, and content is never gated behind
 * an animation finishing.
 *
 * ACCESSIBILITY. The visible line is `aria-hidden` while it draws — a screen
 * reader gets the finished sentence once, via a `role="status"` region, not a
 * word-by-word narration of a wipe animation it cannot see. Set `announce`
 * false if the host page is already announcing this text through its own
 * channel (SOUNDING's Web Speech narration, for one) and a second
 * announcement would be redundant.
 */
export const BaluchariReveal = forwardRef<HTMLDivElement, BaluchariRevealProps>(function BaluchariReveal(
  {
    children,
    durationMs = 1900,
    delayMs = 150,
    onRevealed,
    announce = true,
    className,
    ...rest
  },
  ref,
) {
  const motionAllowed = useRef(bleedMotionAllowed()).current;
  const [revealed, setRevealed] = useState(!motionAllowed);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!motionAllowed) return undefined;
    const t = setTimeout(() => setRevealed(true), delayMs + durationMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!revealed || firedRef.current) return;
    firedRef.current = true;
    onRevealed?.();
  }, [revealed, onRevealed]);

  return (
    <div
      ref={ref}
      {...rest}
      className={["tantu-baluchari", revealed ? "tantu-baluchari-done" : undefined, className]
        .filter(Boolean)
        .join(" ")}
      style={{
        // Consumed by the CSS animation; a prop rather than a CSS custom
        // property literal so a host can override timing without its own
        // stylesheet knowing this component's internals.
        ["--tantu-baluchari-duration" as string]: `${durationMs}ms`,
        ["--tantu-baluchari-delay" as string]: `${delayMs}ms`,
        ...rest.style,
      }}
    >
      <p className="tantu-baluchari-line" aria-hidden="true">
        {children}
      </p>
      <div className="tantu-baluchari-shuttle" aria-hidden="true" />
      {announce && (
        <p className="tantu-visually-hidden" role="status" aria-live="polite">
          {revealed ? children : ""}
        </p>
      )}
    </div>
  );
});
