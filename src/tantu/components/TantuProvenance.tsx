import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

export interface TantuProvenanceEntry {
  /** "Woven by", "Region", "Technique", "Fibre", "Time at the loom". */
  term: ReactNode;
  detail: ReactNode;
}

export interface TantuProvenanceProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Heading for the block. */
  title?: ReactNode;
  entries: TantuProvenanceEntry[];
  /**
   * A registered mark this piece carries — a geographical indication, a
   * handloom mark, a fair-trade certification.
   *
   * Deliberately a plain string the shop passes, and deliberately not a
   * built-in set: whether a piece may carry a GI mark is a legal fact about
   * that piece, established by a register, not a style the component may
   * confer. A component that shipped a list of marks to pick from would be
   * inviting every shop to award itself one.
   */
  mark?: ReactNode;
  /** Longer note under the list — the workshop, the cloth, the season. */
  children?: ReactNode;
}

/**
 * TantuProvenance — who made this, where, and how.
 *
 * The block a craft shop has and a general-purpose commerce kit does not.
 * On a mass-market storefront the equivalent slot holds shipping copy; here
 * it holds the reason the piece costs what it costs, and on a handloom shop
 * it converts better than anything else on the page.
 *
 * It is a `<dl>` because that is what it is — terms and their details — and
 * that structure is what lets a screen reader move through it pair by pair
 * instead of hearing one run-on sentence. The visual two-column layout is a
 * skin over that.
 */
export const TantuProvenance = forwardRef<HTMLElement, TantuProvenanceProps>(function TantuProvenance(
  { title, entries, mark, children, className, ...rest },
  ref,
) {
  return (
    <section {...rest} ref={ref} className={["tantu-provenance", className].filter(Boolean).join(" ")}>
      {title ? <h3 className="tantu-provenance-title">{title}</h3> : null}

      <dl className="tantu-provenance-list">
        {entries.map((entry, index) => (
          <div className="tantu-provenance-pair" key={index}>
            <dt className="tantu-provenance-term">{entry.term}</dt>
            <dd className="tantu-provenance-detail">{entry.detail}</dd>
          </div>
        ))}
      </dl>

      {mark ? <p className="tantu-provenance-mark">{mark}</p> : null}
      {children ? <div className="tantu-provenance-note">{children}</div> : null}
    </section>
  );
});
