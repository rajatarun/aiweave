import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { getLoomAudio, panForX } from "../lib/loom-audio";

export type GuptBandhanState = "sealed" | "cipher" | "breached";

export interface TantuGuptBandhanProps {
  /** Name of the withheld material, woven into the iron block. */
  label?: string;
  /** Talim annotation stitched under the label while sealed. */
  talimCode?: string;
  /** Number of cipher spools on the cylinder. Base-6 lattice: default 6. */
  spools?: number;
  /**
   * Cryptographic gate. Receives the assembled key and returns true when the
   * cylinder aligns. Async is supported for server-side verification.
   */
  verify: (key: string) => boolean | Promise<boolean>;
  /** Fired once the seal has shattered and the vault has retracted. */
  onBreach?: () => void;
  /** The buried material, woven in Zari and Indigo inside the cavity. */
  children: ReactNode;
  /** Voice the brass, gear and lac materials. Default true. */
  audio?: boolean;
  className?: string;
}

/** Glyph ring carried on each rotating spool — Talim numerals and tallies. */
const SPOOL_RING = ["I", "V", "X", "L", "C", "D", "M", "\u0966", "\u0967", "\u0968", "\u0969", "\u096a"];

/**
 * The Gupt-Bandhan — the Hidden Vault.
 *
 * Encrypted material is not a padlock glyph on an empty field; it is a dense
 * slab of Kala Charcoal and iron-acetate thread packed so tightly into the
 * lattice that it absorbs all light, bound at its centre by a jagged crimson
 * Lac seal. Forcing the mass produces wood-on-brass denial. Striking the seal
 * displaces the grid to expose the Chakra Cipher cylinder; each keystroke
 * rotates one heavy spool into a new locked position rather than printing a
 * character. A completed key shatters the lac, retracts the black threads into
 * the selvedges, and reveals the material recessed on a lower Z-plane.
 */
export function TantuGuptBandhan({
  label = "SEALED MATERIAL",
  talimCode,
  spools = 6,
  verify,
  onBreach,
  children,
  audio = true,
  className,
}: TantuGuptBandhanProps) {
  const [state, setState] = useState<GuptBandhanState>("sealed");
  const [key, setKey] = useState("");
  const [positions, setPositions] = useState<number[]>(() => Array.from({ length: spools }, () => 0));
  const [struck, setStruck] = useState<number | null>(null);
  const [denied, setDenied] = useState(false);
  const [checking, setChecking] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const denyTimer = useRef<number | null>(null);
  const strikeTimer = useRef<number | null>(null);
  const statusId = useId();

  useEffect(() => {
    setPositions((current) =>
      current.length === spools ? current : Array.from({ length: spools }, (_, i) => current[i] ?? 0),
    );
  }, [spools]);

  useEffect(
    () => () => {
      if (denyTimer.current !== null) window.clearTimeout(denyTimer.current);
      if (strikeTimer.current !== null) window.clearTimeout(strikeTimer.current);
    },
    [],
  );

  const panOf = useCallback(() => {
    const box = rootRef.current?.getBoundingClientRect();
    return box ? panForX(box.left + box.width / 2) : 0;
  }, []);

  /** Acoustic Denial: the mass refuses, and the surrounding grid vibrates. */
  const deny = useCallback(() => {
    if (audio) getLoomAudio().denyEntry({ pan: panOf() });
    setDenied(true);
    if (denyTimer.current !== null) window.clearTimeout(denyTimer.current);
    denyTimer.current = window.setTimeout(() => setDenied(false), 620);
  }, [audio, panOf]);

  const openCylinder = useCallback(() => {
    if (audio) getLoomAudio().play("ratchetPull", { pan: panOf(), gain: 0.9, rate: 0.8 });
    setState("cipher");
    window.requestAnimationFrame(() => fieldRef.current?.focus());
  }, [audio, panOf]);

  /** One spool violently rotates and locks; nothing is printed to the screen. */
  const rotateSpool = useCallback(
    (nextKey: string) => {
      const index = nextKey.length === 0 ? 0 : (nextKey.length - 1) % spools;
      const advance = (nextKey.charCodeAt(nextKey.length - 1) || 7) % (SPOOL_RING.length - 1);
      setPositions((current) => {
        const next = current.slice();
        next[index] = ((next[index] ?? 0) + advance + 1) % SPOOL_RING.length;
        return next;
      });
      setStruck(index);
      if (strikeTimer.current !== null) window.clearTimeout(strikeTimer.current);
      strikeTimer.current = window.setTimeout(() => setStruck(null), 140);
      if (audio) getLoomAudio().cipherStep(index, panOf() + (index / spools - 0.5) * 0.5);
    },
    [audio, panOf, spools],
  );

  const handleKeyChange = (value: string) => {
    if (value.length > key.length) rotateSpool(value);
    else if (value.length < key.length) {
      // Unwinding a spool is still a mechanical event.
      if (audio) getLoomAudio().play("heddleShift", { pan: panOf(), gain: 0.4, rate: 0.75 });
    }
    setKey(value);
  };

  const attemptBreach = async () => {
    if (checking) return;
    setChecking(true);
    let aligned = false;
    try {
      aligned = await verify(key);
    } finally {
      setChecking(false);
    }
    if (!aligned) {
      setKey("");
      setPositions(Array.from({ length: spools }, () => 0));
      deny();
      return;
    }
    if (audio) getLoomAudio().breach({ pan: panOf() });
    setState("breached");
    onBreach?.();
  };

  const onSealKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      deny();
    }
  };

  const onMassPointer = (event: ReactMouseEvent<HTMLDivElement>) => {
    // Any strike on the iron weave that misses the seal is refused outright.
    if ((event.target as HTMLElement).closest(".tantu-vault-seal")) return;
    deny();
  };

  const rings = useMemo(
    () => positions.map((pos) => SPOOL_RING[pos % SPOOL_RING.length] ?? SPOOL_RING[0]),
    [positions],
  );

  return (
    <div
      ref={rootRef}
      className={["tantu-vault", className].filter(Boolean).join(" ")}
      data-state={state}
      data-denied={denied || undefined}
    >
      {state !== "breached" ? (
        <div className="tantu-vault-mass" onMouseDown={onMassPointer}>
          <div className="tantu-vault-iron" aria-hidden="true" />

          {state === "sealed" ? (
            <div className="tantu-vault-face">
              <p className="tantu-vault-label">{label}</p>
              {talimCode ? <p className="tantu-meta-talim tantu-vault-talim">{talimCode}</p> : null}
              <button
                type="button"
                className="tantu-vault-seal"
                onClick={openCylinder}
                onKeyDown={onSealKeyDown}
                aria-describedby={statusId}
              >
                <span className="tantu-vault-seal-wax" aria-hidden="true" />
                <span className="tantu-visually-hidden">Strike the lac seal to expose the cipher cylinder</span>
              </button>
              <p id={statusId} className="tantu-vault-hint">
                Bound by lac. The weave cannot be pried apart.
              </p>
            </div>
          ) : (
            <div className="tantu-vault-cylinder">
              <p className="tantu-vault-label">CHAKRA CIPHER</p>
              <div className="tantu-vault-spools" aria-hidden="true">
                {rings.map((glyph, index) => (
                  <span
                    key={index}
                    className="tantu-vault-spool"
                    data-struck={struck === index || undefined}
                    style={{ ["--tantu-spool-step" as string]: String(positions[index] ?? 0) }}
                  >
                    <span className="tantu-vault-spool-glyph">{glyph}</span>
                  </span>
                ))}
              </div>

              <form
                className="tantu-vault-entry"
                onSubmit={(event) => {
                  event.preventDefault();
                  void attemptBreach();
                }}
              >
                <label className="tantu-visually-hidden" htmlFor={`${statusId}-key`}>
                  Cryptographic key
                </label>
                <input
                  id={`${statusId}-key`}
                  ref={fieldRef}
                  className="tantu-vault-key"
                  type="password"
                  autoComplete="current-password"
                  value={key}
                  spellCheck={false}
                  onChange={(event) => handleKeyChange(event.target.value)}
                />
                <button type="submit" className="tantu-vault-strike" disabled={checking}>
                  {checking ? "ALIGNING" : "STRIKE"}
                </button>
              </form>
              <p className="tantu-vault-hint">
                Each keystroke rotates a spool. No character is ever rendered.
              </p>
            </div>
          )}
        </div>
      ) : null}

      <div className="tantu-vault-cavity" aria-hidden={state !== "breached"}>
        <div className="tantu-vault-cavity-inner">{state === "breached" ? children : null}</div>
      </div>
    </div>
  );
}
