import React, { forwardRef, type ReactNode, type TableHTMLAttributes } from "react";

export interface TantuTableColumn<T> {
  key: string;
  header: ReactNode;
  /** Cell renderer for a single row. */
  cell: (row: T) => ReactNode;
  width?: string;
}

export interface TantuTableProps<T> extends Omit<TableHTMLAttributes<HTMLTableElement>, "children"> {
  columns: TantuTableColumn<T>[];
  rows: T[];
  /** Kasuti caption naming the pattern being read. */
  caption?: ReactNode;
  rowKey?: (row: T, index: number) => string;
  /** Shown when `rows` is empty. */
  empty?: ReactNode;
}

/**
 * Pattern table — the graph-paper reading of a woven draft. Strict filament
 * gridlines, alternating ground rows, kasuti column heads.
 */
function TantuTableInner<T>(
  { columns, rows, caption, rowKey, empty = "No picks recorded.", className, ...rest }: TantuTableProps<T>,
  ref: React.Ref<HTMLTableElement>,
) {
  return (
    <table {...rest} ref={ref} className={["tantu-table", className].filter(Boolean).join(" ")}>
      {caption ? <caption>{caption}</caption> : null}
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} scope="col" style={column.width ? { width: column.width } : undefined}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="tantu-meta-kasuti">
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((row, index) => (
            <tr key={rowKey ? rowKey(row, index) : index}>
              {columns.map((column) => (
                <td key={column.key}>{column.cell(row)}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export const TantuTable = forwardRef(TantuTableInner) as <T>(
  props: TantuTableProps<T> & { ref?: React.Ref<HTMLTableElement> },
) => ReturnType<typeof TantuTableInner>;
