import { forwardRef, type HTMLAttributes } from "react";

export type TantuTagTone = "neutral" | "accent" | "structural" | "success" | "caution" | "zari";

export interface TantuTagProps extends HTMLAttributes<HTMLSpanElement> {
  /** Dye the selvedge tag is stitched in. */
  tone?: TantuTagTone;
  /** Fill the tag with its dye instead of outlining it. */
  solid?: boolean;
}

/** Selvedge tag: a short woven marker for status, category or count. */
export const TantuTag = forwardRef<HTMLSpanElement, TantuTagProps>(function TantuTag(
  { tone = "neutral", solid = false, className, children, ...rest },
  ref,
) {
  return (
    <span
      {...rest}
      ref={ref}
      className={["tantu-tag", `tantu-tag-${tone}`, solid ? "tantu-tag-solid" : null, className]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{children}</span>
    </span>
  );
});
