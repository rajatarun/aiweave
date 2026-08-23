import type { HTMLAttributes } from "react";

export interface TalimThreadProps extends HTMLAttributes<HTMLSpanElement> {
  /** Raw metadata string (e.g., "T-44-A") rendered as a continuous ligature thread. */
  code: string;
}

/** Talim thread — metadata woven into a single unbroken glyph string. */
export const TalimThread = ({ code, className, ...rest }: TalimThreadProps) => {
  return (
    <span
      {...rest}
      className={["tantu-meta-talim", className].filter(Boolean).join(" ")}
      aria-label={`Talim code: ${code}`}
    >
      {code}
    </span>
  );
};
