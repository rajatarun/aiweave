import { forwardRef, type HTMLAttributes } from "react";

export type TantuSealSize = "sm" | "md" | "lg";

export interface TantuSealProps extends HTMLAttributes<HTMLSpanElement> {
  /** Person or entity the seal stands for; drives initials and alt text. */
  name: string;
  src?: string;
  size?: TantuSealSize;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Weaver's seal — a square identity mark, image or stamped initials. */
export const TantuSeal = forwardRef<HTMLSpanElement, TantuSealProps>(function TantuSeal(
  { name, src, size = "md", className, ...rest },
  ref,
) {
  return (
    <span
      {...rest}
      ref={ref}
      title={name}
      className={["tantu-seal", size !== "md" ? `tantu-seal-${size}` : null, className]
        .filter(Boolean)
        .join(" ")}
    >
      {src ? <img src={src} alt={name} /> : <span aria-hidden="true">{initials(name)}</span>}
      {src ? null : <span className="tantu-visually-hidden">{name}</span>}

    </span>
  );
});
