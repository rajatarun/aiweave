import * as React from "react";
import { getLoomAudio } from "../lib/loom-audio.js";

export interface JamdaniBar {
  label: string;
  value: number;
  /** Optional Talim annotation exposed when the threads loosen. */
  note?: string;
}

export interface JamdaniBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  data: JamdaniBar[];
  max?: number;
  /** Voice the tension release on focus. Default true. */
  audio?: boolean;
  caption?: React.ReactNode;
}

/**
 * The Jamdani Block. A bar is never a painted rectangle: it is a dense
 * accumulation of packed horizontal picks rammed into a vertical warp column.
 * Height carries the value, thread density carries the material. Focusing a
 * column releases its tension — the picks loosen and separate, exposing the
 * structural grid beneath and the exact figure written in Talim script in the
 * gaps.
 */
export const JamdaniBlock = React.forwardRef<HTMLDivElement, JamdaniBlockProps>(
  function JamdaniBlock({ data, max, audio = true, caption, className, ...rest }, ref) {
    const ceiling = max ?? Math.max(...data.map((bar) => bar.value), 1);
    const [loose, setLoose] = React.useState<string | null>(null);

    const release = React.useCallback(
      (bar: JamdaniBar, index: number) => {
        if (loose === bar.label) return;
        setLoose(bar.label);
        if (audio) {
          getLoomAudio().play("heddleShift", {
            gain: 0.3,
            rate: 1.1,
            pan: (index / Math.max(1, data.length - 1)) * 1.4 - 0.7,
          });
        }
      },
      [audio, data.length, loose],
    );

    return (
      <figure className={["tantu-jamdani", className].filter(Boolean).join(" ")} ref={ref as never} {...(rest as React.HTMLAttributes<HTMLElement>)}>
        <div className="tantu-jamdani-field">
          {data.map((bar, index) => {
            const ratio = Math.max(0, Math.min(1, bar.value / ceiling));
            // Height is quantised to whole picks — no fractional threads.
            const picks = Math.max(1, Math.round(ratio * 36));
            return (
              <button
                key={bar.label}
                type="button"
                className="tantu-jamdani-column"
                data-loose={loose === bar.label ? "true" : undefined}
                aria-label={`${bar.label}: ${bar.value}`}
                onPointerEnter={() => release(bar, index)}
                onFocus={() => release(bar, index)}
                onPointerLeave={() => setLoose(null)}
                onBlur={() => setLoose(null)}
              >
                <span className="tantu-jamdani-readout" aria-hidden="true">
                  {bar.value}
                  {bar.note ? <em>{bar.note}</em> : null}
                </span>
                <span
                  className="tantu-jamdani-pack"
                  aria-hidden="true"
                  style={{ height: `${(picks / 36) * 100}%` }}
                />
                <span className="tantu-jamdani-label" aria-hidden="true">
                  {bar.label}
                </span>
              </button>
            );
          })}
        </div>
        {caption ? <figcaption className="tantu-kasuti-caption">{caption}</figcaption> : null}
      </figure>
    );
  },
);
