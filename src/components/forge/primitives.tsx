import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Pill } from "./status";

/** Small key/value metadata list used by every detail surface. */
export function MetaList({
  items,
  className,
}: {
  items: Array<{ label: string; value: ReactNode }>;
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-2 text-xs", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 truncate text-right">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Count tiles (test outcomes, stage counts, project stats). */
export function StatGrid({
  stats,
  className,
}: {
  stats: Array<{ label: string; value: ReactNode; hint?: string }>;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-4", className)}>
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-md border border-border p-3">
          <div className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            {stat.label}
          </div>
          <div className="mt-1 font-mono text-xl">{stat.value}</div>
          {stat.hint ? (
            <div className="mt-1 text-[11px] text-muted-foreground">{stat.hint}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  cell: (row: T) => ReactNode;
}

/** Typed, reusable read-only table. Replaces per-screen <table> markup. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = "Nothing recorded yet.",
  minWidth = 720,
}: {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs" style={{ minWidth }}>
        <thead className="text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={cn("px-3 py-2 font-medium", column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length ? (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key} className={cn("px-3 py-2.5 align-top", column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-3 py-6 text-muted-foreground" colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Inline segmented filter, shared by Tests / History / Files. */
export function FilterBar<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {label ? (
        <span className="mr-1 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
          {label}
        </span>
      ) : null}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors",
            value === option.value
              ? "border-primary/40 bg-primary/12 text-primary"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
          {typeof option.count === "number" ? ` ${option.count}` : ""}
        </button>
      ))}
    </div>
  );
}

/**
 * Explicit provenance marker. Every surface backed by seeded data must render this
 * so demo state is never mistaken for verified execution.
 */
export function ProvenanceBadge({
  kind = "seeded",
  children,
}: {
  kind?: "seeded" | "verified" | "not_executed";
  children?: ReactNode;
}) {
  const tone = kind === "verified" ? "success" : "warning";
  const text =
    children ??
    (kind === "verified" ? "verified" : kind === "seeded" ? "seeded / demo data" : "not executed");
  return <Pill tone={tone}>{text}</Pill>;
}
