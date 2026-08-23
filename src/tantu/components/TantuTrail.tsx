import { Fragment, type HTMLAttributes, type ReactNode } from "react";

export interface TantuTrailItem {
  label: ReactNode;
  href?: string;
}

export interface TantuTrailProps extends HTMLAttributes<HTMLElement> {
  items: TantuTrailItem[];
  /** Glyph drawn between picks. */
  separator?: ReactNode;
}

/** Thread trail — breadcrumb navigation read left to right along the weft. */
export function TantuTrail({ items, separator = "/", className, ...rest }: TantuTrailProps) {
  return (
    <nav {...rest} aria-label="Breadcrumb" className={["tantu-trail", className].filter(Boolean).join(" ")}>
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <Fragment key={index}>
            {item.href && !last ? (
              <a href={item.href}>{item.label}</a>
            ) : (
              <span className="tantu-trail-current" aria-current={last ? "page" : undefined}>
                {item.label}
              </span>
            )}
            {last ? null : (
              <span className="tantu-trail-sep" aria-hidden="true">
                {separator}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
