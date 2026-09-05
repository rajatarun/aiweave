import { forwardRef, useState, type ImgHTMLAttributes } from "react";

export interface TantuImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "loading" | "ref"> {
  /** The file. */
  src: string;
  /**
   * What the image shows. Required rather than optional: a shop whose
   * photographs carry the product has no decorative images, and a missing
   * alt on a product photograph is a missing product.
   *
   * Pass `""` deliberately for the rare ornament that genuinely repeats
   * adjacent text.
   */
  alt: string;
  /**
   * The proportion the frame holds *before* the file arrives — `4 / 5`, or
   * `"3 / 4"`. Without it the frame has no height until the image decodes and
   * everything below it jumps when it does. Cloth is photographed in a house
   * ratio far more often than not, so this is the one prop worth always
   * passing.
   */
  ratio?: number | string;
  /**
   * Load without waiting for the frame to approach the viewport. Correct for
   * the one image already on screen at first paint — a hero, the opening
   * frame of a gallery — and wrong for everything else.
   */
  eager?: boolean;
  /** How the file fills a frame of a different proportion. */
  fit?: "cover" | "contain";
  /** Suppress the woven placeholder that holds the frame while loading. */
  bare?: boolean;
}

/**
 * TantuImage — cloth held in a frame.
 *
 * Three things a bare `<img>` gets wrong on a shop page, all of them
 * expensive on a catalogue of photographs:
 *
 * - **The frame has no size until the file lands.** Every image below the
 *   fold shoves the page when it decodes, and a reader mid-sentence loses
 *   their place. `ratio` reserves the box up front.
 * - **Everything loads at once.** A collection of forty products fetches
 *   forty full-size photographs into a mobile connection. Everything here is
 *   lazy unless told otherwise.
 * - **A broken file leaves a broken-icon stub** with no indication of what
 *   was meant to be there. The failure state keeps the frame and shows the
 *   alt text, because on a shop page the missing thing is the merchandise.
 */
export const TantuImage = forwardRef<HTMLImageElement, TantuImageProps>(function TantuImage(
  { src, alt, ratio, eager, fit = "cover", bare, className, style, onLoad, onError, ...rest },
  ref,
) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  const aspect = ratio === undefined ? undefined : typeof ratio === "number" ? String(ratio) : ratio;

  return (
    <span
      className={["tantu-image", `tantu-image-${state}`, bare ? "tantu-image-bare" : null, className]
        .filter(Boolean)
        .join(" ")}
      style={{ aspectRatio: aspect, ...style }}
    >
      {state === "failed" ? (
        // The frame survives the failure and says what is missing. An empty
        // alt means the image was declared ornamental, so there is nothing
        // to say and the frame stays quiet rather than inventing a caption.
        <span className="tantu-image-missing">{alt || null}</span>
      ) : (
        <img
          {...rest}
          ref={ref}
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="tantu-image-file"
          style={{ objectFit: fit }}
          onLoad={(event) => {
            setState("ready");
            onLoad?.(event);
          }}
          onError={(event) => {
            setState("failed");
            onError?.(event);
          }}
        />
      )}
    </span>
  );
});
