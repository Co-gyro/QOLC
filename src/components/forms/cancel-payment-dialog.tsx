"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/types/api";
import type { PaymentStatus } from "@/types";

export interface CancelPaymentTarget {
  id: string;
  residentName: string;
  merchantName: string;
  amount: number;
  status: PaymentStatus;
  jutyuCd: string | null;
}

export interface CancelPaymentDialogProps {
  /** 対象決済（null のとき非表示） */
  target: CancelPaymentTarget | null;
  onClose: () => void;
  /** 取消成功時（一覧の再読込用） */
  onDone: () => void;
}

type Action = "void" | "cancel" | "return";

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

/**
 * 決済の取消/返金ダイアログ。
 * 決済ステータスに応じて実行可能な操作を提示する。
 *   - authorized → 与信取消（void）
 *   - captured   → 売上取消（cancel・同一締め内）/ 返金（return・締め後）
 * POST /api/payment/[id]/cancel を呼ぶ。
 */
export function CancelPaymentDialog({ target, onClose, onDone }: CancelPaymentDialogProps) {
  const [action, setAction] = useState<Action | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 対象が変わるたびに既定操作・状態を初期化
  useEffect(() => {
    setSubmitting(false);
    setError(null);
    if (!target) {
      setAction(null);
    } else if (target.status === "authorized") {
      setAction("void");
    } else if (target.status === "captured") {
      setAction("cancel");
    } else {
      setAction(null);
    }
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [target, submitting, onClose]);

  if (!target) return null;

  const canCancel = target.status === "authorized" || target.status === "captured";

  async function submit() {
    if (!target || !action) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/payment/${target.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as ApiResponse<{ id: string; status: string }>;
      if (!json.success) {
        setError(json.error);
        setSubmitting(false);
        return;
      }
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "取消に失敗しました");
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={() => !submitting && onClose()}
    >
      <div
        className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-2" style={{ color: "var(--qolc-text)" }}>
          決済の取消 / 返金
        </h2>

        <dl className="text-sm mb-4 space-y-1" style={{ color: "var(--qolc-text)" }}>
          <div className="flex justify-between">
            <dt style={{ color: "var(--qolc-muted)" }}>入居者</dt>
            <dd className="font-medium">{target.residentName}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: "var(--qolc-muted)" }}>加盟店</dt>
            <dd>{target.merchantName}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: "var(--qolc-muted)" }}>金額</dt>
            <dd className="font-medium">{yen(target.amount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: "var(--qolc-muted)" }}>受注コード</dt>
            <dd>{target.jutyuCd ?? "—"}</dd>
          </div>
        </dl>

        {!canCancel ? (
          <p className="text-sm p-3 rounded mb-4" style={{ backgroundColor: "#FEF2F2", color: "#991B1B" }}>
            この決済（{target.status}）は取消・返金できません。与信済（authorized）または完了（captured）の決済のみ操作できます。
          </p>
        ) : !target.jutyuCd ? (
          <p className="text-sm p-3 rounded mb-4" style={{ backgroundColor: "#FEF2F2", color: "#991B1B" }}>
            受注コードが未確定のため取消できません。
          </p>
        ) : (
          <fieldset className="mb-4">
            <legend className="text-sm font-medium mb-2">操作を選択</legend>
            {target.status === "authorized" && (
              <label className="flex items-start gap-2 p-2 rounded cursor-pointer">
                <input
                  type="radio"
                  name="cancel-action"
                  checked={action === "void"}
                  onChange={() => setAction("void")}
                  className="mt-1"
                />
                <span className="text-sm">
                  <span className="font-medium">与信取消</span>
                  <br />
                  <span style={{ color: "var(--qolc-muted)" }}>
                    売上計上前の与信を取り消します。請求は発生しません。
                  </span>
                </span>
              </label>
            )}
            {target.status === "captured" && (
              <>
                <label className="flex items-start gap-2 p-2 rounded cursor-pointer">
                  <input
                    type="radio"
                    name="cancel-action"
                    checked={action === "cancel"}
                    onChange={() => setAction("cancel")}
                    className="mt-1"
                  />
                  <span className="text-sm">
                    <span className="font-medium">売上取消</span>
                    <br />
                    <span style={{ color: "var(--qolc-muted)" }}>
                      同一締め期間内の取消。相殺され実際の入金は発生しません。
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 p-2 rounded cursor-pointer">
                  <input
                    type="radio"
                    name="cancel-action"
                    checked={action === "return"}
                    onChange={() => setAction("return")}
                    className="mt-1"
                  />
                  <span className="text-sm">
                    <span className="font-medium">返金</span>
                    <br />
                    <span style={{ color: "var(--qolc-muted)" }}>
                      締め期間経過後の返金。カードへ返金処理されます。
                    </span>
                  </span>
                </label>
              </>
            )}
          </fieldset>
        )}

        {error && (
          <p className="text-sm mb-3" style={{ color: "#DC2626" }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            閉じる
          </Button>
          {canCancel && target.jutyuCd && (
            <Button
              onClick={submit}
              disabled={submitting || !action}
              style={{ backgroundColor: "#DC2626", color: "white" }}
            >
              {submitting ? "処理中..." : action === "return" ? "返金する" : "取消する"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
