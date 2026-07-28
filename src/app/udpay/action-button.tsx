"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * デモ操作 API（/api/udpay）を叩いて画面を更新する汎用ボタン。
 * 成功時は router.refresh()（navigateTo 指定時はそのパスへ遷移）、失敗時はエラーを alert 表示する。
 */
export function ActionButton({
  action,
  payload,
  label,
  className = "up-btn",
  confirmMessage,
  navigateTo,
}: {
  action: string;
  payload?: Record<string, unknown>;
  label: string;
  className?: string;
  confirmMessage?: string;
  navigateTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (confirmMessage && !confirm(confirmMessage)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/udpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        alert(data.error ?? "操作に失敗しました");
        return;
      }
      if (navigateTo) router.push(navigateTo);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={className} onClick={run} disabled={busy}>
      {busy ? "処理中…" : label}
    </button>
  );
}

/** テキストをクリップボードにコピーするボタン（カード登録リンクの案内用） */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className="up-btn secondary small" onClick={copy}>
      {copied ? "コピーしました" : label}
    </button>
  );
}
