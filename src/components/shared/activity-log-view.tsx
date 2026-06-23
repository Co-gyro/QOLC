"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: string;
  action: string;
  actionLabel: string;
  kind: "success" | "warn" | "info";
  summary: string;
  createdAt: string;
  detail: unknown | null;
}

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "すべての操作" },
  { value: "sales_add", label: "決済実行" },
  { value: "sales_cancel", label: "決済取消" },
  { value: "sales_return", label: "返金" },
  { value: "auth_void", label: "与信取消" },
  { value: "ec_checkout", label: "カード登録" },
  { value: "resident_create", label: "入居者追加" },
  { value: "resident_update", label: "入居者編集" },
  { value: "invite_create", label: "アカウント招待" },
  { value: "invite_accept", label: "アカウント参加" },
  { value: "upload", label: "明細アップロード" },
  { value: "merchant_create", label: "加盟店登録" },
  { value: "payment_owner_set", label: "決済オーナー設定" },
];

const KIND_DOT: Record<LogEntry["kind"], string> = {
  success: "bg-emerald-500",
  warn: "bg-amber-500",
  info: "bg-blue-500",
};

/** ISO日時 → "6月20日 14:30"。 */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

export function ActivityLogView() {
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [action, setAction] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setEntries(null);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (action) params.set("action", action);
      const res = await fetch(`/api/logs?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "取得に失敗しました");
      setEntries(json.data.entries as LogEntry[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    }
  }, [from, to, action]);

  useEffect(() => {
    void load();
    // 初回のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      {/* 絞り込み */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="space-y-1.5">
            <Label htmlFor="log-from" className="text-xs">期間（開始）</Label>
            <Input id="log-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="log-to" className="text-xs">期間（終了）</Label>
            <Input id="log-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="log-action" className="text-xs">操作の種類</Label>
            <select
              id="log-action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="flex h-10 w-44 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <Button onClick={() => void load()}>表示</Button>
        </CardContent>
      </Card>

      {/* タイムライン */}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : entries === null ? (
        <LoadingSpinner />
      ) : entries.length === 0 ? (
        <EmptyState title="ログがありません" description="この期間・条件に該当する操作はありませんでした。" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {entries.map((e) => (
                <li key={e.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full", KIND_DOT[e.kind])} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{e.summary}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatWhen(e.createdAt)}
                        {e.detail ? (
                          <button
                            type="button"
                            className="ml-3 text-blue-600 underline-offset-2 hover:underline"
                            onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                          >
                            {expanded === e.id ? "詳細を隠す" : "詳細"}
                          </button>
                        ) : null}
                      </p>
                      {e.detail && expanded === e.id ? (
                        <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted/50 p-2 text-[11px] leading-tight">
                          {JSON.stringify(e.detail, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {entries && entries.length > 0 ? (
        <p className="text-xs text-muted-foreground">{entries.length}件（最新500件まで）</p>
      ) : null}
    </div>
  );
}
