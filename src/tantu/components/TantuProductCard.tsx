import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { TantuImage } from "./TantuImage.js";
import { TantuPrice, type TantuPriceProps } from "./TantuPrice.js";

export interface TantuProductCardProps extends Omit<HTMLAttributes<HTMLElement>, "title" | "onClick"> {
  /** The piece's name. Becomes the card's link and its accessible name. */
  title: ReactNode;
  href: string;
  src: string;
  /** What the photograph shows. */
  alt: string;
  /** Proportion of the card's image. Keep one ratio across a collection. */
  ratio?: number | string;
  /** Price, passed through to `TantuPrice` — including `compareAt` for a reduction. */
  price?: TantuPriceProps;
  /** A line under the title — region, technique, fibre. */
  note?: ReactNode;
  /** Corner markers: "Last one", "New", a GI mark. Keep to one or two. */
  flags?: ReactNode;
  /** Load this card's photograph eagerly. True for the first row only. */
  eager?: boolean;
  /** Grid columns spanned on the 12-thread loom. */
  warpSpan?: 2 | 3 | 4 | 6 | 12;
}

/**
 * TantuProductCard — one piece in a collection.
 *
 * The whole card looks clickable and only one thing actually is: the title is
 * the link, and it is stretched over the card with a pseudo-element. That is
 * the fix for the failure this pattern usually ships with — wrapping an
 * `<a>` around the image, the title, the price and a tag, which gives a
 * screen-reader user one link whose name is "Indigo shawl handwoven Kutch
 * £85.00 was £120.00 Last one" read as a single string, and gives a keyboard
 * user a tab stop on every one of them.
 *
 * Here: one tab stop per card, and its name is the title. The photograph's
 * alt still describes the cloth for anyone reading the page rather than
 * skimming links, and the price is still read in place.
 *
 * It also means the card is *not* a `<button>` and does not swallow text
 * selection — a shopper can still select and copy the title, and
 * middle-click or ⌘-click opens the piece in a new tab, both of which a
 * div-with-onClick quietly breaks.
 */
export const TantuProductCard = forwardRef<HTMLElement, TantuProductCardProps>(function TantuProductCard(
  { title, href, src, alt, ratio = "4 / 5", price, note, flags, eager, warpSpan = 3, className, ...rest },
  ref,
) {
  return (
    <article
      {...rest}
      ref={ref}
      className={["tantu-product", className].filter(Boolean).join(" ")}
      data-warp-span={warpSpan}
    >
      <div className="tantu-product-plate">
        <TantuImage src={src} alt={alt} ratio={ratio} eager={eager} />
        {flags ? <div className="tantu-product-flags">{flags}</div> : null}
      </div>

      <div className="tantu-product-body">
        <h3 className="tantu-product-title">
          <a className="tantu-product-link" href={href}>
            {title}
          </a>
        </h3>
        {note ? <p className="tantu-product-note">{note}</p> : null}
        {price ? <TantuPrice {...price} className="tantu-product-price" /> : null}
      </div>
    </article>
  );
});
