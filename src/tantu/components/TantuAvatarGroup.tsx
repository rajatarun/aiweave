import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { TantuSeal } from "./TantuSeal";

export interface TantuAvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Weavers to display as a cluster of seals. */
  names: string[];
  /** Maximum seals visible before a count overflow. */
  max?: number;
  /** Size of each seal. */
  size?: "sm" | "md" | "lg";
}

/**
 * TantuAvatarGroup — a cluster of seals representing the weaving party.
 *
 * Overlaps seals by half a gauge filament to suggest stacked identity cards
 * at the edge of the warp. Overflow is rendered as a final `+n` tag.
 */
export const TantuAvatarGroup = forwardRef<HTMLDivElement, TantuAvatarGroupProps>(function TantuAvatarGroup(
  { names, max = 4, size = "md", className, ...rest },
  ref,
) {
  const visible = names.slice(0, max);
  const overflow = names.length - max;

  return (
    <div
      {...rest}
      ref={ref}
      className={["tantu-avatar-group", className].filter(Boolean).join(" ")}
      aria-label={`Weavers: ${names.join(", ")}`}
    >
      {visible.map((name, index) => (
        <div key={name} className="tantu-avatar-group-item" style={{ zIndex: visible.length - index }}>
          <TantuSeal name={name} size={size} />
        </div>
      ))}
      {overflow > 0 ? (
        <div className="tantu-avatar-group-overflow" aria-hidden="true">
          +{overflow}
        </div>
      ) : null}
    </div>
  );
});
