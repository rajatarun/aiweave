import { useId, useState, type HTMLAttributes, type ReactNode } from "react";

export interface TantuFoldItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

export interface TantuFoldProps extends HTMLAttributes<HTMLDivElement> {
  items: TantuFoldItem[];
  /** Ids opened on first paint. */
  defaultOpenIds?: string[];
  /** Only one fold may be open at a time. */
  single?: boolean;
}

/** Fold stack — accordion panels folded along the bolt. */
export function TantuFold({ items, defaultOpenIds = [], single = false, className, ...rest }: TantuFoldProps) {
  const base = useId();
  const [open, setOpen] = useState<string[]>(defaultOpenIds);

  const toggle = (id: string) => {
    setOpen((current) => {
      const isOpen = current.includes(id);
      if (single) return isOpen ? [] : [id];
      return isOpen ? current.filter((x) => x !== id) : [...current, id];
    });
  };

  return (
    <div {...rest} className={className}>
      {items.map((item) => {
        const expanded = open.includes(item.id);
        return (
          <div className="tantu-fold" key={item.id}>
            <button
              type="button"
              className="tantu-fold-trigger"
              aria-expanded={expanded}
              aria-controls={`${base}-${item.id}`}
              onClick={() => toggle(item.id)}
            >
              <span>{item.label}</span>
              <span aria-hidden="true">{expanded ? "—" : "+"}</span>
            </button>
            {expanded ? (
              <div className="tantu-fold-body tantu-body-talim" id={`${base}-${item.id}`}>
                {item.content}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
