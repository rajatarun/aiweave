import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

export type TantuStackAxis = "warp" | "weft";

export interface TantuStackProps extends HTMLAttributes<HTMLDivElement> {
  /** warp = vertical column, weft = horizontal row. */
  axis?: TantuStackAxis;
  /** Knot step from the base-6 lattice. */
  gap?: 1 | 2 | 3 | 4 | 6 | 8 | 12;
}

/** Lattice stack. The only sanctioned way to space siblings. */
export const TantuStack = forwardRef<HTMLDivElement, TantuStackProps>(function TantuStack(
  { axis = "warp", gap = 3, className, style, ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      style={{ gap: `var(--tantu-knot-${gap})`, ...style }}
      className={["tantu-stack", `tantu-stack-${axis}`, className].filter(Boolean).join(" ")}
    />
  );
});

export interface TantuCutProps extends HTMLAttributes<HTMLDivElement> {
  /** Draw the cut down the warp instead of across the weft. */
  vertical?: boolean;
}

/** Cut line — a filament rule separating woven regions. */
export const TantuCut = forwardRef<HTMLDivElement, TantuCutProps>(function TantuCut(
  { vertical = false, className, ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      className={["tantu-cut", vertical ? "tantu-cut-vertical" : null, className].filter(Boolean).join(" ")}
    />
  );
});

export interface TantuMastheadLink {
  label: ReactNode;
  href: string;
  current?: boolean;
}

export interface TantuMastheadProps extends HTMLAttributes<HTMLElement> {
  /** Wordmark, set in the display role. */
  mark: ReactNode;
  links?: TantuMastheadLink[];
  /** Trailing slot for actions. */
  actions?: ReactNode;
}

/** Masthead — the top selvedge of a page: wordmark, navigation, actions. */
export function TantuMasthead({ mark, links = [], actions, className, ...rest }: TantuMastheadProps) {
  return (
    <header {...rest} className={["tantu-masthead", className].filter(Boolean).join(" ")}>
      <span className="tantu-masthead-mark">{mark}</span>
      {links.length > 0 ? (
        <nav className="tantu-masthead-nav" aria-label="Primary">
          {links.map((link) => (
            <a key={link.href} href={link.href} aria-current={link.current ? "page" : undefined}>
              {link.label}
            </a>
          ))}
        </nav>
      ) : null}
      {actions ? (
        <TantuStack axis="weft" gap={2}>
          {actions}
        </TantuStack>
      ) : null}

    </header>
  );
}
