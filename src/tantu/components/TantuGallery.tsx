import { useCallback, useId, useRef, useState } from "react";
import { inlineArrowStep } from "../lib/direction.js";
import { TantuImage } from "./TantuImage.js";

export interface TantuGalleryFrame {
  id: string;
  src: string;
  /** What this frame shows. Distinct per frame — see the note on the component. */
  alt: string;
  /** Smaller file for the thumbnail rail. Falls back to `src`. */
  thumb?: string;
}

export interface TantuGalleryLabels {
  rail: string;
  /** Given the 1-based position and the count. */
  frame: (position: number, total: number) => string;
}

const DEFAULT_LABELS: TantuGalleryLabels = {
  rail: "Photographs",
  frame: (position, total) => `View photograph ${position} of ${total}`,
};

export interface TantuGalleryProps {
  frames: TantuGalleryFrame[];
  /** Selected frame id, for a gallery driven from outside. */
  value?: string;
  onChange?: (id: string) => void;
  /** Proportion held by the main frame. Defaults to 4/5, the usual for cloth. */
  ratio?: number | string;
  labels?: Partial<TantuGalleryLabels>;
  className?: string;
}

/**
 * TantuGallery — the cloth from several sides.
 *
 * On a craft shop the photographs *are* the argument: weave density, the
 * selvedge, how the dye sits at a fold. So the rail is not decoration and it
 * gets the same keyboard treatment as any other composite widget — one tab
 * stop, arrows within, direction resolved from the element so the rail
 * reverses under `dir="rtl"`.
 *
 * The alt text is per frame and the caller must write it. A gallery that
 * repeats "Indigo shawl" five times tells a listener there are five
 * photographs and nothing else; "the weave at the selvedge" and "the shawl
 * over a shoulder" tell them what they would have learned by looking. This
 * component cannot generate that, so it does not pretend to — it just refuses
 * to make one alt do for all five.
 *
 * The main frame is `eager`, the rail is lazy: the opening photograph is
 * already on screen, and the other four are not.
 */
export function TantuGallery({ frames, value, onChange, ratio = "4 / 5", labels, className }: TantuGalleryProps) {
  const railId = useId();
  const railRef = useRef<HTMLDivElement>(null);
  const copy = { ...DEFAULT_LABELS, ...labels };

  const [internal, setInternal] = useState(frames[0]?.id);
  const isControlled = value !== undefined;
  const currentId = isControlled ? value : internal;

  const index = Math.max(
    0,
    frames.findIndex((frame) => frame.id === currentId),
  );
  const current = frames[index];

  const select = useCallback(
    (id: string) => {
      if (!isControlled) setInternal(id);
      onChange?.(id);
    },
    [isControlled, onChange],
  );

  const move = useCallback(
    (from: number, delta: number) => {
      const count = frames.length;
      if (count === 0) return;
      const next = (from + delta + count) % count;
      railRef.current?.querySelectorAll<HTMLButtonElement>("[data-frame]")[next]?.focus();
      select(frames[next].id);
    },
    [frames, select],
  );

  if (!current) return null;

  return (
    <div className={["tantu-gallery", className].filter(Boolean).join(" ")}>
      <div className="tantu-gallery-plate">
        <TantuImage src={current.src} alt={current.alt} ratio={ratio} eager fit="cover" />
      </div>

      {frames.length > 1 ? (
        <div
          ref={railRef}
          className="tantu-gallery-rail"
          role="tablist"
          aria-label={copy.rail}
          id={railId}
        >
          {frames.map((frame, position) => {
            const selected = frame.id === current.id;
            return (
              <button
                key={frame.id}
                type="button"
                data-frame
                role="tab"
                aria-selected={selected}
                // The rail's accessible name says where it goes, not what it
                // shows: the frame's own alt already carries the picture, and
                // repeating it here would announce every photograph twice.
                aria-label={copy.frame(position + 1, frames.length)}
                tabIndex={selected ? 0 : -1}
                className={["tantu-gallery-thumb", selected ? "tantu-gallery-thumb-on" : null]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => select(frame.id)}
                onKeyDown={(event) => {
                  const step = inlineArrowStep(event.key, event.currentTarget);
                  if (step !== 0) {
                    event.preventDefault();
                    move(position, step);
                  }
                }}
              >
                <TantuImage src={frame.thumb ?? frame.src} alt="" ratio="1 / 1" bare />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
