/**
 * The vat — the single JS-side register of Tantu's dye primitives.
 *
 * The WebGL bleed shader samples raw pigment rather than CSS, so without a
 * shared register each surface would carry its own copy of the hex and a
 * consumer re-dyeing the system through CSS custom properties would see the
 * bleed front drift away from the woven border it soaks into. Every dye here
 * names the custom property it mirrors; `resolveDye` reads that property off
 * the live element and only falls back to the literal when the document has
 * not been dyed yet (SSR, or the shader spinning up before styles land).
 */
export type TantuDye =
  | "madder"
  | "madderFlame"
  | "indigo"
  | "indigoSky"
  | "copper"
  | "marigold"
  | "katha"
  | "zari"
  | "zariTarnish"
  | "iron";

interface DyeSpec {
  /** The CSS custom property this dye is drawn from. */
  token: string;
  /** Vat colour used only when the custom property cannot be read. */
  raw: string;
}

export const TANTU_DYES: Record<TantuDye, DyeSpec> = {
  madder: { token: "--tantu-madder-root", raw: "#82231d" },
  madderFlame: { token: "--tantu-madder-flame", raw: "#a83228" },
  indigo: { token: "--tantu-indigo-vat", raw: "#0d233a" },
  indigoSky: { token: "--tantu-indigo-sky", raw: "#2b5377" },
  copper: { token: "--tantu-pala-copper", raw: "#294d34" },
  marigold: { token: "--tantu-genda-rust", raw: "#c97218" },
  katha: { token: "--tantu-katha-bark", raw: "#6e4a35" },
  zari: { token: "--tantu-zari-pure-gold", raw: "#c5a059" },
  zariTarnish: { token: "--tantu-zari-tarnish", raw: "#9e7d3b" },
  iron: { token: "--tantu-kala-iron", raw: "#12100e" },
};

/**
 * Read a dye as it is currently mixed on the page.
 *
 * @param dye   Name of the dye primitive.
 * @param scope Element the cascade is read from — pass the surface being
 *              stained so a locally re-dyed subtree is honoured.
 */
export function resolveDye(dye: TantuDye, scope?: Element | null): string {
  const spec = TANTU_DYES[dye];
  if (typeof window === "undefined") return spec.raw;
  const from = scope ?? document.documentElement;
  const value = getComputedStyle(from).getPropertyValue(spec.token).trim();
  return value || spec.raw;
}
