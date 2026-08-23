import { useCallback, useEffect, useRef, useState, type HTMLAttributes } from "react";
import { getLoomAudio, KNOT_MS, panForX, type LoomVoice } from "../lib/loom-audio";

type PaletteMode = "strike" | "sustain";

interface PaletteEntry {
  id: string;
  /** Voice fired on a one-shot strike. */
  voice?: LoomVoice;
  mode: PaletteMode;
  title: string;
  body: string;
  timing: string;
  /** Action verb shown on the trigger while at rest. */
  rest: string;
  /** Action verb shown while a sustained voice is turning. */
  active?: string;
}

const PALETTE: PaletteEntry[] = [
  {
    id: "tab",
    voice: "shuttleGlide",
    mode: "strike",
    title: "Tab — the shuttle glide",
    body: "Bamboo travelling through the race: a bandpass falling 1800Hz to 650Hz over a hollow wood body.",
    timing: `${KNOT_MS[6]}ms · knot-6`,
    rest: "Throw shuttle",
  },
  {
    id: "strike",
    voice: "battenStrike",
    mode: "strike",
    title: "Enter — the batten strike",
    body: "Seasoned teak locking the weft, carrying a 2.76x inharmonic partial so the body reads as wood, never bell.",
    timing: `${KNOT_MS[14]}ms · knot-14`,
    rest: "Beat weft",
  },
  {
    id: "arrow",
    voice: "heddleShift",
    mode: "strike",
    title: "Arrows — the heddle shift",
    body: "Wooden treadles moving the shafts: a low, muted clatter, panned to the column you move into.",
    timing: `${KNOT_MS[6]}ms · knot-6`,
    rest: "Shift heddles",
  },
  {
    id: "charkha",
    mode: "sustain",
    title: "Loading — the Charkha hum",
    body: "One revolution of the wheel: filtered friction under a ~90Hz drone, with a single dry creak late in each turn.",
    timing: `${(KNOT_MS[8]! * 6) / 1000}s / rotation · knot-8 x 6`,
    rest: "Start wheel",
    active: "Stop wheel",
  },
];

export interface TantuAcousticPaletteProps extends HTMLAttributes<HTMLDivElement> {
  /** Heading rendered above the rack of sample cards. */
  label?: string;
}

/**
 * The Acoustic Palette rack — one card per voice of the loom.
 *
 * Every trigger is a real <button>, so Enter and Space fire it natively and
 * the browser's own activation semantics are preserved. Left/Right (and
 * Up/Down) rove focus across the rack as a single composite widget, Home and
 * End jump to the selvedges, and each card reports its state through
 * aria-pressed plus a polite live region — the sound is never the only signal.
 */
export function TantuAcousticPalette({ label = "Acoustic palette", className, ...rest }: TantuAcousticPaletteProps) {
  const [struck, setStruck] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState(0);
  const triggers = useRef<Array<HTMLButtonElement | null>>([]);
  const pulse = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (pulse.current !== null) window.clearTimeout(pulse.current);
      getLoomAudio().stopCharkha({ lock: false });
    },
    [],
  );

  const panOf = useCallback((el: HTMLElement | null) => {
    if (!el) return 0;
    const box = el.getBoundingClientRect();
    return panForX(box.left + box.width / 2);
  }, []);

  const strike = useCallback(
    (entry: PaletteEntry, index: number) => {
      const audio = getLoomAudio();
      const pan = panOf(triggers.current[index] ?? null);

      if (entry.mode === "sustain") {
        const next = !spinning;
        setSpinning(next);
        if (next) audio.startCharkha({ pan });
        else audio.stopCharkha({ lock: true, pan });
        setStatus(next ? `${entry.title}: turning` : `${entry.title}: stopped`);
        return;
      }

      if (entry.voice) audio.play(entry.voice, { pan, gain: 0.9 });
      setStruck(entry.id);
      setStatus(`${entry.title}: played`);
      if (pulse.current !== null) window.clearTimeout(pulse.current);
      pulse.current = window.setTimeout(() => setStruck(null), KNOT_MS[8]!);
    },
    [panOf, spinning],
  );

  // Roving tabindex: the rack is one stop in the Maku shuttle's path, and the
  // arrow keys walk it the way they walk the lattice itself.
  const move = useCallback((to: number) => {
    const clamped = (to + PALETTE.length) % PALETTE.length;
    setCursor(clamped);
    triggers.current[clamped]?.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          move(index + 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          move(index - 1);
          break;
        case "Home":
          event.preventDefault();
          move(0);
          break;
        case "End":
          event.preventDefault();
          move(PALETTE.length - 1);
          break;
        default:
          break;
      }
    },
    [move],
  );

  return (
    <div {...rest} className={["tantu-palette", className].filter(Boolean).join(" ")} role="group" aria-label={label}>
      <ul className="tantu-palette-rack">
        {PALETTE.map((entry, index) => {
          const isSustain = entry.mode === "sustain";
          const isActive = isSustain ? spinning : struck === entry.id;
          return (
            <li
              key={entry.id}
              className="tantu-palette-card"
              data-active={isActive || undefined}
              data-voice={entry.id}
            >
              <h3 className="tantu-heading-kalam tantu-palette-title">{entry.title}</h3>
              <p className="tantu-body-talim tantu-palette-body">{entry.body}</p>
              <div className="tantu-palette-foot">
                <button
                  type="button"
                  ref={(node) => {
                    triggers.current[index] = node;
                  }}
                  className="tantu-palette-trigger"
                  tabIndex={cursor === index ? 0 : -1}
                  aria-pressed={isSustain ? spinning : undefined}
                  // The visible verb ("Beat weft") is meaningless out of context
                  // when a screen reader lists buttons on their own, so the
                  // accessible name carries the voice it fires.
                  aria-label={`${isSustain && spinning ? entry.active : entry.rest} — ${entry.title}`}
                  aria-describedby={`tantu-palette-timing-${entry.id}`}
                  onFocus={() => setCursor(index)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  onClick={() => strike(entry, index)}
                >
                  {isSustain && spinning ? entry.active : entry.rest}
                </button>
                <span className="tantu-meta-kasuti" id={`tantu-palette-timing-${entry.id}`}>
                  {entry.timing}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="tantu-meta-kasuti tantu-palette-hint">
        Enter or Space fires the voice · Arrow keys walk the rack · Home / End reach the selvedges
      </p>
      <p className="tantu-visually-hidden" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
