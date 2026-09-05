import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

export interface TantuPriceLabels {
  /** Given the old and new price, both already formatted. */
  reduced: (from: string, to: string) => string;
}

const DEFAULT_LABELS: TantuPriceLabels = {
  reduced: (from, to) => `Reduced from ${from} to ${to}`,
};

export interface TantuPriceProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** The amount, in major units — 48.5 is forty-eight fifty, not 48 500. */
  amount: number;
  /** ISO 4217 code. Drives the symbol, its side, and the decimal count. */
  currency?: string;
  /**
   * Formatting locale. Omit to follow the reader's own, which is usually
   * right; pass one when the shop prices in a fixed market.
   */
  locale?: string;
  /**
   * What this cost before a reduction. Draws the struck original beside the
   * current price and announces the relationship rather than leaving a screen
   * reader to read two bare numbers in a row.
   */
  compareAt?: number;
  /** What the price is *per* — "per metre", "each". */
  unit?: ReactNode;
  labels?: Partial<TantuPriceLabels>;
}

/**
 * TantuPrice — a sum of money, said once.
 *
 * The reason this is a component and not a template string is the reduction.
 * Two numbers next to each other, one of them struck through, is a purely
 * visual convention: `<s>` carries no announced meaning in most screen
 * readers, so what actually reaches a listener is "eighty-five fifty-one
 * ninety" — two prices, no relationship, no way to tell which one they pay.
 *
 * So the visual pair is marked `aria-hidden` and a single sentence carries
 * the whole fact. Sighted readers see the convention; everyone else hears
 * "Reduced from £85.00 to £51.90".
 *
 * Currency formatting goes through `Intl` rather than a symbol glued to a
 * `toFixed(2)`, because the symbol's side, the separator and the number of
 * decimal places are all locale and currency decisions — ¥ takes none, and in
 * much of Europe the symbol trails the number.
 */
export const TantuPrice = forwardRef<HTMLSpanElement, TantuPriceProps>(function TantuPrice(
  { amount, currency = "USD", locale, compareAt, unit, labels, className, ...rest },
  ref,
) {
  const copy = { ...DEFAULT_LABELS, ...labels };

  const format = (value: number) => {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
    } catch {
      // An unknown currency code throws rather than degrading. A shop with a
      // typo in its config should still render a number the reader can act on.
      return `${currency} ${value.toFixed(2)}`;
    }
  };

  const now = format(amount);
  // A "reduction" that raised the price, or left it alone, is a merchandising
  // bug upstream. Drawing it as a saving would be a lie in the shop's favour,
  // so it is simply not a reduction.
  const reduced = compareAt !== undefined && compareAt > amount;

  return (
    <span
      {...rest}
      ref={ref}
      className={["tantu-price", reduced ? "tantu-price-reduced" : null, className].filter(Boolean).join(" ")}
    >
      {reduced ? (
        <>
          <span aria-hidden="true" className="tantu-price-was">
            {format(compareAt)}
          </span>
          <span aria-hidden="true" className="tantu-price-now">
            {now}
          </span>
          <span className="tantu-visually-hidden">{copy.reduced(format(compareAt), now)}</span>
        </>
      ) : (
        <span className="tantu-price-now">{now}</span>
      )}
      {unit ? <span className="tantu-price-unit"> {unit}</span> : null}
    </span>
  );
});
