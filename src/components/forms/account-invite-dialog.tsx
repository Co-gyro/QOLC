"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  accountCreateSchema,
  PORTAL_NAMES,
  type AccountRole,
} from "@/app/api/admin/accounts/schema";
import {
  AccountInviteResult,
  type AccountIssueResult,
} from "@/components/forms/account-invite-result";

export interface AccountInviteDialogProps {
  open: boolean;
  /** 発行するロール（facility_staff=施設 / provider=提供者） */
  role: AccountRole;
  /** 所属先ID（施設ID または 加盟店ID） */
  targetId: string | null;
  /** 所属先の表示名（施設名 / 提供者名） */
  targetName: string | null;
  onClose: () => void;
}

/**
 * 施設/提供者アカウント発行ダイアログ。
 * メール・氏名を入力して POST /api/admin/accounts を呼び、
 * 案内メールの送信結果とセットアップURL（コピー可能）を明示する。
 */
export function AccountInviteDialog({
  open,
  role,
  targetId,
  targetName,
  onClose,
}: AccountInviteDialogProps) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AccountIssueResult | null>(null);

  if (!open || !targetId) return null;
  const portalName = PORTAL_NAMES[role];

  /** 入力を検証して発行APIを呼ぶ。 */
  async function issue() {
    setError(null);
    const body = {
      email,
      displayName,
      role,
      ...(role === "facility_staff" ? { facilityId: targetId } : { merchantId: targetId }),
    };
    const parsed = accountCreateSchema.safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力内容をご確認ください");
      return;
    }
    setIssuing(true);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const json = (await res.json()) as
        | { success: true; data: AccountIssueResult }
        | { success: false; error: string };
      if (!res.ok || !json.success) {
        setError(json.success ? "発行に失敗しました" : json.error);
        return;
      }
      setResult(json.data);
    } catch {
      setError("通信エラーが発生しました。時間をおいて再度お試しください");
    } finally {
      setIssuing(false);
    }
  }

  /** 状態を初期化して閉じる。 */
  function handleClose() {
    setEmail("");
    setDisplayName("");
    setError(null);
    setResult(null);
    onClose();
  }

  const inputStyle = { borderColor: "var(--qolc-border)", minHeight: 44 } as const;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-1">アカウント発行</h2>
        <p className="text-sm mb-4" style={{ color: "var(--qolc-muted)" }}>
          「{targetName}」の{portalName}にログインできるアカウントを発行します
        </p>

        {result ? (
          <AccountInviteResult result={result} onClose={handleClose} />
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@example.com"
                className="w-full border rounded px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">氏名（表示名）</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="例：山田 太郎"
                maxLength={50}
                className="w-full border rounded px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>
            <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
              発行すると、パスワード設定用のご案内メールをお送りします。メール基盤が未設定の場合でも、セットアップURLを画面からコピーしてお渡しできます。
            </p>
            {error && (
              <p className="text-sm" style={{ color: "#DC2626" }}>
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} style={{ minHeight: 44 }}>
                キャンセル
              </Button>
              <Button
                onClick={issue}
                disabled={issuing}
                style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 44 }}
              >
                {issuing ? "発行中..." : "アカウントを発行"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
