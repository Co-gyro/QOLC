"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  fetchResidentDetail,
  setPaymentOwner,
  type ResidentRow,
  type ResidentDetail,
} from "@/lib/portal/facility-queries";

export interface ResidentDetailDialogProps {
  open: boolean;
  resident: ResidentRow | null;
  onClose: () => void;
}

const INVITE_STATUS_LABEL: Record<string, string> = {
  pending: "有効",
  used: "使用済み",
  expired: "期限切れ",
};

export function ResidentDetailDialog({ open, resident, onClose }: ResidentDetailDialogProps) {
  const [detail, setDetail] = useState<ResidentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    if (!resident) return;
    setError(null);
    setDetail(null);
    try {
      setDetail(await fetchResidentDetail(resident.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    }
  }, [resident]);

  useEffect(() => {
    if (open && resident) void load();
  }, [open, resident, load]);

  if (!open || !resident) return null;

  async function handleSetOwner(accountId: string) {
    if (!resident) return;
    setWorking(true);
    setError(null);
    try {
      await setPaymentOwner(resident.id, accountId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "支払い担当者の変更に失敗しました");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-1">
          {resident.nameLast} {resident.nameFirst} さんの詳細
        </h2>
        <p className="text-sm mb-4" style={{ color: "var(--qolc-muted)" }}>
          被保険者番号: {resident.insuranceNumber}
        </p>

        {error && <p className="text-sm mb-3" style={{ color: "#DC2626" }}>{error}</p>}

        {!detail ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-6">
            {/* アカウント一覧 */}
            <section>
              <h3 className="font-semibold mb-2">登録アカウント（{detail.accounts.length}）</h3>
              {detail.accounts.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
                  まだ家族・本人アカウントが登録されていません。「招待」から発行してください。
                </p>
              ) : (
                <div className="space-y-2">
                  {detail.accounts.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between border rounded p-3"
                      style={{ borderColor: "var(--qolc-border)" }}
                    >
                      <div className="text-sm">
                        <div className="font-medium">
                          {a.displayName || "(名前未設定)"}
                          <span className="ml-2 text-xs" style={{ color: "var(--qolc-muted)" }}>
                            {a.type === "self" ? "本人" : "家族"}
                          </span>
                        </div>
                        <div style={{ color: "var(--qolc-muted)" }}>{a.email ?? "—"}</div>
                        <div className="mt-1 flex gap-2">
                          {a.isPaymentOwner && <StatusBadge status="active" className="!bg-[#E6F4EA]" />}
                          {a.isPaymentOwner ? (
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#E8913A22", color: "#B45309" }}>
                              支払い担当者
                            </span>
                          ) : null}
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--qolc-bg-soft)", color: a.cardRegistered ? "#1B5E20" : "var(--qolc-muted)" }}>
                            {a.cardRegistered ? "カード登録済" : "カード未登録"}
                          </span>
                        </div>
                      </div>
                      {!a.isPaymentOwner && (
                        <Button
                          variant="outline"
                          onClick={() => handleSetOwner(a.id)}
                          disabled={working}
                          className="text-sm"
                        >
                          支払い担当者にする
                        </Button>
                      )}
                    </div>
                  ))}
                  <p className="text-xs" style={{ color: "var(--qolc-muted)" }}>
                    ※ 支払い担当者を変更すると、新しい担当者があらためてカード登録を行う必要があります（旧カードは引き継がれません）。
                  </p>
                </div>
              )}
            </section>

            {/* 招待状況 */}
            <section>
              <h3 className="font-semibold mb-2">招待状況（{detail.invitations.length}）</h3>
              {detail.invitations.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
                  招待履歴はありません。
                </p>
              ) : (
                <div className="space-y-1">
                  {detail.invitations.map((i) => (
                    <div
                      key={i.id}
                      className="flex items-center justify-between text-sm border-b py-1"
                      style={{ borderColor: "var(--qolc-border)" }}
                    >
                      <span>
                        {i.accountType === "self" ? "本人" : "家族"}
                        {i.isPaymentOwner && "・支払い担当"}
                        {i.email ? `（${i.email}）` : ""}
                      </span>
                      <span style={{ color: i.status === "pending" ? "#1B5E20" : "var(--qolc-muted)" }}>
                        {INVITE_STATUS_LABEL[i.status] ?? i.status}
                        <span className="ml-2 text-xs">
                          {new Date(i.createdAt).toLocaleDateString("ja-JP")}発行
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        <div className="flex justify-end mt-6">
          <Button onClick={onClose} style={{ backgroundColor: "var(--qolc-primary)", color: "white" }}>
            閉じる
          </Button>
        </div>
      </div>
    </div>
  );
}
