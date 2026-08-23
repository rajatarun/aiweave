import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export interface TantuPaginationProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Total number of pages. */
  totalPages: number;
  /** Currently selected page (1-based). */
  currentPage: number;
  /** Called when a page is selected. */
  onChange?: (page: number) => void;
  /** Maximum page numbers to show before collapsing. */
  siblingCount?: number;
}

/**
 * TantuPagination — numbered weft stops for moving through a long warp.
 *
 * Renders previous / next thread anchors and a compact set of page numbers,
 * collapsing the middle with an ellipsis when the warp is long.
 */
export const TantuPagination = forwardRef<HTMLDivElement, TantuPaginationProps>(function TantuPagination(
  { totalPages, currentPage, onChange, siblingCount = 1, className, ...rest },
  ref,
) {
  const pages = buildRange({ totalPages, currentPage, siblingCount });

  return (
    <nav
      {...rest}
      ref={ref}
      aria-label="Pagination"
      className={["tantu-pagination", className].filter(Boolean).join(" ")}
    >
      <PageButton
        page="Previous"
        disabled={currentPage <= 1}
        onClick={() => onChange?.(currentPage - 1)}
      />
      <div className="tantu-pagination-list" role="list">
        {pages.map((page, index) =>
          page === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="tantu-pagination-ellipsis" aria-hidden="true">
              …
            </span>
          ) : (
            <PageButton
              key={page}
              page={page}
              active={page === currentPage}
              onClick={() => onChange?.(page)}
            />
          ),
        )}
      </div>
      <PageButton
        page="Next"
        disabled={currentPage >= totalPages}
        onClick={() => onChange?.(currentPage + 1)}
      />
    </nav>
  );
});

function PageButton({
  page,
  active,
  disabled,
  onClick,
}: {
  page: number | "Previous" | "Next";
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const label = typeof page === "number" ? String(page) : page;
  return (
    <button
      type="button"
      className={[
        "tantu-pagination-page",
        active ? "tantu-pagination-page-active" : null,
        disabled ? "tantu-pagination-page-disabled" : null,
      ].filter(Boolean).join(" ")}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function buildRange({
  totalPages,
  currentPage,
  siblingCount,
}: {
  totalPages: number;
  currentPage: number;
  siblingCount: number;
}) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [];
  const leftSibling = Math.max(currentPage - siblingCount, 2);
  const rightSibling = Math.min(currentPage + siblingCount, totalPages - 1);

  pages.push(1);
  if (leftSibling > 2) pages.push("ellipsis");
  for (let i = leftSibling; i <= rightSibling; i++) pages.push(i);
  if (rightSibling < totalPages - 1) pages.push("ellipsis");
  pages.push(totalPages);

  return pages;
}
