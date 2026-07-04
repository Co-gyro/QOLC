"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** アカウント発行APIの結果（レスポンス data 部のうち表示に使う項目）。 */
export interface AccountIssueResult {
  email: string;
  portalName: string;
  inviteUrl: string;
  emailResult: { sent: boolean; skipped: boolean; error?: string };
}

/**
 * アカウント発行の結果表示パネル。
 * 案内メールが送れたか（送信/未設定スキップ/失敗）を明示し、
 * いずれの場合もセットアップURLをコピーして渡せるようにする。
 * @param result 発行結果
 * @param onClose 閉じる操作
 */
export function AccountInviteResult({
  result,
  onClose,
}: {
  result: AccountIssueResult;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  /** セットアップURLをクリップボードへコピーする。 */
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(result.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const mailMessage = result.emailResult.sent
    ? `案内メールを ${result.email} に送信しました。届かない場合は、下のセットアップURLをコピーしてお渡しください。`
    : result.emailResult.skipped
      ? "メール送信は未設定のため行われていません。下のセットアップURLをコピーして、ご本人にお渡しください。"
      : "案内メールの送信に失敗しました。下のセットアップURLをコピーして、ご本人にお渡しください。";

  return (
    <div className="space-y-4">
      <p
        className="text-sm rounded p-3"
        style={
          result.emailResult.sent
            ? { background: "#E6F4EA", color: "#1B5E20" }
            : { background: "#FFF7E6", color: "#B45309" }
        }
      >
        {mailMessage}
      </p>
      <div>
        <label className="block text-sm font-medium mb-1">
          セットアップURL（初回パスワード設定用）
        </label>
        <div className="flex gap-2">
          <input
            readOnly
            value={result.inviteUrl}
            className="flex-1 border rounded px-3 py-2 text-sm"
            style={{ borderColor: "var(--qolc-border)" }}
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button onClick={copyUrl} variant="outline" style={{ minHeight: 44 }}>
            {copied ? "コピー済" : "コピー"}
          </Button>
        </div>
      </div>
      <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
        このURLは1回のみ有効です。開くと本人確認のうえ{result.portalName}へ案内されます。
      </p>
      <div className="flex justify-end">
        <Button
          onClick={onClose}
          style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 44 }}
        >
          閉じる
        </Button>
      </div>
    </div>
  );
}
