/**
 * 申請の対応操作フォーム（状態/担当者/優先度/期限/次アクション）
 *
 * 変更があったフィールドのみ patch にまとめて PATCH する。
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ALL_STATUSES,
  ALL_PRIORITIES,
  STATUS_LABELS,
  PRIORITY_LABELS,
} from "@/lib/applications/labels";
import type {
  ApplicationDetail,
  AssigneeOption,
  ApplicationPatch,
} from "@/lib/applications/types";
import type { ApplicationStatus, ApplicationPriority } from "@/lib/applications/labels";

export interface EditFormProps {
  detail: ApplicationDetail;
  assignees: AssigneeOption[];
  saving: boolean;
  onSave: (patch: ApplicationPatch) => void;
}

const SELECT_CLASS = "border rounded px-2 py-2 text-sm w-full bg-white";
const SELECT_STYLE = { borderColor: "var(--qolc-border)", minHeight: 44 };

export function EditForm({ detail, assignees, saving, onSave }: EditFormProps) {
  const [status, setStatus] = useState<ApplicationStatus>(detail.status);
  const [priority, setPriority] = useState<ApplicationPriority>(detail.priority);
  const [assigneeId, setAssigneeId] = useState<string>(detail.assigneeId ?? "");
  const [dueDate, setDueDate] = useState<string>(detail.dueDate ?? "");
  const [nextAction, setNextAction] = useState<string>(detail.nextAction ?? "");

  /** 変更のあったフィールドのみを patch へ */
  function buildPatch(): ApplicationPatch {
    const patch: ApplicationPatch = {};
    if (status !== detail.status) patch.status = status;
    if (priority !== detail.priority) patch.priority = priority;
    if (assigneeId !== (detail.assigneeId ?? "")) patch.assignee_id = assigneeId || null;
    if (dueDate !== (detail.dueDate ?? "")) patch.due_date = dueDate || null;
    if (nextAction !== (detail.nextAction ?? "")) patch.next_action = nextAction || null;
    return patch;
  }

  const dirty = Object.keys(buildPatch()).length > 0;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) onSave(buildPatch());
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span style={{ color: "var(--qolc-muted)" }}>状態</span>
          <select
            className={SELECT_CLASS}
            style={SELECT_STYLE}
            value={status}
            onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span style={{ color: "var(--qolc-muted)" }}>優先度</span>
          <select
            className={SELECT_CLASS}
            style={SELECT_STYLE}
            value={priority}
            onChange={(e) => setPriority(e.target.value as ApplicationPriority)}
          >
            {ALL_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span style={{ color: "var(--qolc-muted)" }}>担当者</span>
          <select
            className={SELECT_CLASS}
            style={SELECT_STYLE}
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">未割当</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span style={{ color: "var(--qolc-muted)" }}>期限</span>
          <input
            type="date"
            className={SELECT_CLASS}
            style={SELECT_STYLE}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span style={{ color: "var(--qolc-muted)" }}>次アクション</span>
        <input
          type="text"
          className={SELECT_CLASS}
          style={SELECT_STYLE}
          value={nextAction}
          maxLength={500}
          placeholder="例：折り返し電話・書類送付・承認待ち"
          onChange={(e) => setNextAction(e.target.value)}
        />
      </label>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!dirty || saving}
          style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 44 }}
        >
          {saving ? "保存中…" : "変更を保存"}
        </Button>
      </div>
    </form>
  );
}
