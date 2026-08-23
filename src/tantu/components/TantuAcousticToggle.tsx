import { useCallback, useEffect, useState, type ButtonHTMLAttributes } from "react";
import { getLoomAudio } from "../lib/loom-audio";

const STORAGE_KEY = "tantu:acoustic-muted";

export interface TantuAcousticToggleProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onChange"> {
  /** Start silent when the weaver has expressed no preference yet. */
  defaultMuted?: boolean;
  /** Notified whenever the loom is silenced or re-strung. */
  onChange?: (muted: boolean) => void;
}

/**
 * The Silencer — a persistent control over the Acoustic Palette.
 *
 * Every voice of the loom is supplementary: no state in Tantu is ever signalled
 * by sound alone. This switch is the required escape hatch (spec V3.1 §4.5,
 * §5). It is also the sanctioned first user gesture, so the audio context is
 * primed here rather than fired on load, which browsers block.
 *
 * Mount once, near the selvedge.
 */
export function TantuAcousticToggle({
  defaultMuted = true,
  onChange,
  className,
  ...rest
}: TantuAcousticToggleProps) {
  const [muted, setMuted] = useState(defaultMuted);

  // Read the stored preference after hydration: the server has no weaver.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    const next = stored === null ? defaultMuted : stored === "1";
    setMuted(next);
    getLoomAudio().setMuted(next);
  }, [defaultMuted]);

  const toggle = useCallback(() => {
    const next = !muted;
    setMuted(next);
    const audio = getLoomAudio();
    audio.setMuted(next);
    // This click is a real user gesture: safe to unlock the context.
    if (!next) void audio.prime();
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* private mode: the preference simply does not survive the session */
    }
    onChange?.(next);
  }, [muted, onChange]);

  return (
    <button
      {...rest}
      type="button"
      onClick={toggle}
      aria-pressed={!muted}
      className={["tantu-acoustic-toggle", className].filter(Boolean).join(" ")}
      data-muted={muted || undefined}
    >
      <span className="tantu-acoustic-glyph" aria-hidden="true">
        {muted ? "\u2016" : "\u2261"}
      </span>
      <span className="tantu-acoustic-label">{muted ? "LOOM SILENT" : "LOOM AUDIBLE"}</span>
    </button>
  );
}
