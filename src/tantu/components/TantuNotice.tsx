import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

export type TantuNoticeTone = "info" | "success" | "caution" | "critical";

export interface TantuNoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: TantuNoticeTone;
  title?: ReactNode;
}

/** Notice panel — a cord-bound margin note from the loom master. */
export const TantuNotice = forwardRef<HTMLDivElement, TantuNoticeProps>(function TantuNotice(
  { tone = "info", title, className, children, ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      role={tone === "critical" ? "alert" : "status"}
      className={["tantu-notice", `tantu-notice-${tone}`, className].filter(Boolean).join(" ")}
    >
      <div>
        {title ? <div className="tantu-notice-title">{title}</div> : null}
        <div className="tantu-body-talim">{children}</div>
      </div>
    </div>
  );
});
