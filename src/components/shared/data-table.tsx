/**
 * シンプルなデータテーブル
 *
 * - ソート（ヘッダクリック）
 * - 行クリック対応
 * - レスポンシブ（モバイルでは横スクロール）
 */
"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export function DataTable<T extends object>({
  columns,
  data,
  rowKey,
  onRowClick,
  emptyMessage = "データがありません",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const cloned = [...data];
    cloned.sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = (av as number | string) < (bv as number | string) ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return cloned;
  }, [data, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (data.length === 0) {
    return (
      <div className="border rounded-md p-8 text-center text-gray-500" style={{ borderColor: "var(--qolc-border)" }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-md" style={{ borderColor: "var(--qolc-border)" }}>
      <table className="min-w-full text-sm">
        <thead style={{ backgroundColor: "var(--qolc-bg-soft)" }}>
          <tr>
            {columns.map((col) => {
              const key = String(col.key);
              const isSorted = sortKey === key;
              return (
                <th
                  key={key}
                  className={cn(
                    "px-3 py-3 text-left font-semibold",
                    col.sortable && "cursor-pointer select-none",
                    col.className
                  )}
                  onClick={col.sortable ? () => toggleSort(key) : undefined}
                  style={{ color: "var(--qolc-text)" }}
                >
                  {col.header}
                  {isSorted && (
                    <span className="ml-1 text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn(
                "border-t",
                onRowClick && "cursor-pointer hover:bg-gray-50"
              )}
              style={{ borderColor: "var(--qolc-border)", minHeight: 48 }}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td key={String(col.key)} className={cn("px-3 py-3", col.className)}>
                  {col.render
                    ? col.render(row)
                    : String(
                        (row as Record<string, unknown>)[String(col.key)] ?? ""
                      )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
