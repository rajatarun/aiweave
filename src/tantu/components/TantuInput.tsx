import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { getLoomAudio } from "../lib/loom-audio";

export interface TantuInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Kasuti-stitched field label. */
  label?: ReactNode;
  /** Talim annotation shown beneath the field. */
  hint?: ReactNode;
  /** Error text; also flags the field as invalid. */
  error?: ReactNode;
  /** Throw each glyph into the weave on a 15ms delay. Default true. */
  mechanical?: boolean;
  /** Voice the heddle click per keystroke. Default true. */
  audio?: boolean;
}

/** One heddle drop per glyph knotted into the grid. */
const THROW_MS = 15;

/**
 * The Bobbin Void. An empty field exposes the bare vertical Tana threads —
 * an unwoven gap in the tapestry. Glyphs are thrown into the weave one at a
 * time, the caret is the heavy Maku shuttle block resting on the baseline,
 * and hitting capacity pulls the thread taut in warning Genda dye.
 */
export const TantuInput = forwardRef<HTMLInputElement, TantuInputProps>(function TantuInput(
  { label, hint, error, className, id, mechanical = true, audio = true, maxLength, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  const inputRef = useRef<HTMLInputElement | null>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

  const mirrorRef = useRef<HTMLSpanElement | null>(null);
  const [empty, setEmpty] = useState(true);
  const [taut, setTaut] = useState(false);
  const [caret, setCaret] = useState({ x: 0, visible: false });
  const [text, setText] = useState("");
  const queue = useRef<string[]>([]);
  const draining = useRef(false);

  const sync = useCallback(() => {
    const node = inputRef.current;
    if (!node) return;
    setText(node.value);
    setEmpty(node.value.length === 0);
    if (typeof maxLength === "number" && node.value.length >= maxLength) {
      setTaut(true);
    }
  }, [maxLength]);

  useEffect(() => {
    sync();
  }, [sync]);

  // The Maku cursor rides on the measured text advance, not a blinking line.
  useLayoutEffect(() => {
    const node = inputRef.current;
    const mirror = mirrorRef.current;
    if (!node || !mirror) return;
    const style = window.getComputedStyle(node);
    mirror.style.font = style.font;
    mirror.style.letterSpacing = style.letterSpacing;
    const caretIndex = node.selectionStart ?? node.value.length;
    mirror.textContent = node.value.slice(0, caretIndex) || "";
    const padding = parseFloat(style.paddingLeft || "0");
    setCaret((prev) => ({ ...prev, x: padding + mirror.offsetWidth - node.scrollLeft }));
  }, [text]);

  /** Drain the throw queue: one glyph knots into the lattice every 15ms. */
  const drain = useCallback(() => {
    if (draining.current) return;
    draining.current = true;
    const step = () => {
      const glyph = queue.current.shift();
      const node = inputRef.current;
      if (glyph === undefined || !node) {
        draining.current = false;
        return;
      }
      if (typeof maxLength === "number" && node.value.length >= maxLength) {
        // Max capacity tension: the thread cannot stretch any further.
        queue.current.length = 0;
        draining.current = false;
        setTaut(true);
        if (audio) getLoomAudio().play("warpSnap", { gain: 0.5, rate: 1.3 });
        return;
      }
      const start = node.selectionStart ?? node.value.length;
      const end = node.selectionEnd ?? start;
      node.value = node.value.slice(0, start) + glyph + node.value.slice(end);
      node.setSelectionRange(start + 1, start + 1);
      node.dispatchEvent(new Event("input", { bubbles: true }));
      if (audio) getLoomAudio().play("heddleShift", { gain: 0.22, rate: 1.5 });
      sync();
      window.setTimeout(step, THROW_MS);
    };
    step();
  }, [audio, maxLength, sync]);

  const handleBeforeInput = (event: FormEvent<HTMLInputElement>) => {
    if (!mechanical) return;
    const native = event.nativeEvent as InputEvent;
    if (native.inputType !== "insertText" || !native.data) return;
    event.preventDefault();
    queue.current.push(...native.data.split(""));
    drain();
  };

  return (
    <div className="tantu-field">
      {label ? (
        <label className="tantu-field-label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <div
        className="tantu-bobbin"
        data-empty={empty ? "true" : undefined}
        data-taut={taut ? "true" : undefined}
        onAnimationEnd={() => setTaut(false)}
      >
        <input
          {...rest}
          ref={inputRef}
          id={inputId}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={["tantu-input", className].filter(Boolean).join(" ")}
          onBeforeInput={handleBeforeInput}
          onInput={(event) => {
            sync();
            rest.onInput?.(event);
          }}
          onKeyUp={(event) => {
            sync();
            rest.onKeyUp?.(event);
          }}
          onFocus={(event) => {
            setCaret((prev) => ({ ...prev, visible: true }));
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setCaret((prev) => ({ ...prev, visible: false }));
            rest.onBlur?.(event);
          }}
          onClick={(event) => {
            sync();
            rest.onClick?.(event);
          }}
        />
        {/* The Maku: a solid shuttle block resting at the baseline. */}
        <span
          className="tantu-maku-caret"
          aria-hidden="true"
          data-visible={caret.visible ? "true" : undefined}
          style={{ transform: `translateX(${caret.x}px)` }}
        />
        <span className="tantu-bobbin-mirror" ref={mirrorRef} aria-hidden="true" />
      </div>
      {error ? (
        <span className="tantu-field-error" id={`${inputId}-error`}>
          {error}
        </span>
      ) : hint ? (
        <span className="tantu-field-hint" id={`${inputId}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
});
