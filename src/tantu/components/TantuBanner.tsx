import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

export type TantuBannerTone = "info" | "success" | "caution" | "critical";

export interface TantuBannerProps extends HTMLAttributes<HTMLDivElement> {
  /** Message or content to announce across the loom. */
  children: ReactNode;
  /** Tone determines the left selvedge dye. */
  tone?: TantuBannerTone;
  /** Optional action element rendered at the end of the banner. */
  action?: ReactNode;
}

/**
 * TantuBanner — a full-width announcement strip across the warp.
 *
 * Used for loom-wide notices: maintenance windows, dye-batch alerts, or
 * policy changes. It is intentionally narrow in height but full in width.
 */
export const TantuBanner = forwardRef<HTMLDivElement, TantuBannerProps>(function TantuBanner(
  { tone = "info", children, action, className, ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      role={tone === "critical" ? "alert" : "status"}
      className={["tantu-banner", `tantu-banner-${tone}`, className].filter(Boolean).join(" ")}
    >
      <div className="tantu-banner-body">{children}</div>
      {action ? <div className="tantu-banner-action">{action}</div> : null}
    </div>
  );
});
