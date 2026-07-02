/**
 * 申請一覧のフィルタバー（状態・担当者・種別・未対応のみ）
 */
"use client";

import {
  ALL_STATUSES,
  ALL_SOURCES,
  STATUS_LABELS,
  SOURCE_LABELS,
} from "@/lib/applications/labels";
import type { ApplicationFilters as Filters } from "@/lib/applications/client";
import type { AssigneeOption } from "@/lib/applications/types";

export interface ApplicationFiltersProps {
  filters: Filters;
  assignees: AssigneeOption[];
  openOnly: boolean;
  onChange: (f: Filters) => void;
  onOpenOnlyChange: (v: boolean) => void;
}

const SELECT_CLASS = "border rounded px-2 py-2 text-sm bg-white";
const SELECT_STYLE = { borderColor: "var(--qolc-border)", minHeight: 44 };

export function ApplicationFilters({
  filters,
  assignees,
  openOnly,
  onChange,
  onOpenOnlyChange,
}: ApplicationFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <label className="flex flex-col gap-1 text-sm">
        <span style={{ color: "var(--qolc-muted)" }}>種別</span>
        <select
          className={SELECT_CLASS}
          style={SELECT_STYLE}
          value={filters.source ?? ""}
          onChange={(e) => onChange({ ...filters, source: e.target.value || undefined })}
        >
          <option value="">すべて</option>
          {ALL_SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span style={{ color: "var(--qolc-muted)" }}>状態</span>
        <select
          className={SELECT_CLASS}
          style={SELECT_STYLE}
          value={filters.status ?? ""}
          onChange={(e) => onChange({ ...filters, status: e.target.value || undefined })}
        >
          <option value="">すべて</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span style={{ color: "var(--qolc-muted)" }}>担当者</span>
        <select
          className={SELECT_CLASS}
          style={SELECT_STYLE}
          value={filters.assignee ?? ""}
          onChange={(e) => onChange({ ...filters, assignee: e.target.value || undefined })}
        >
          <option value="">すべて</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      <label
        className="flex items-center gap-2 text-sm px-1"
        style={{ minHeight: 44, opacity: filters.status ? 0.5 : 1 }}
        title={filters.status ? "状態フィルタ指定中は無効です" : undefined}
      >
        <input
          type="checkbox"
          checked={openOnly}
          disabled={!!filters.status}
          onChange={(e) => onOpenOnlyChange(e.target.checked)}
        />
        <span>未対応のみ</span>
      </label>
    </div>
  );
}
