"use client";

import { useState } from "react";
import type { ApiResponse } from "@/types/api";

interface CheckoutFormData {
  url: string;
  method: "POST";
  fields: Record<string, string>;
  jutyuCd: string;
  memberId: string;
}

export interface CardRegisterButtonProps {
  residentAccountId: string;
  /** 未登録の大きいバナー用に強調するか */
  large?: boolean;
  label?: string;
}

/**
 * カード登録ボタン。
 * /api/payment/card/init で決済画面表示フォーム定義を取得し、
 * 自動送信フォームを生成して USEN の3DS決済画面へブラウザ遷移する。
 */
export function CardRegisterButton({
  residentAccountId,
  large = false,
  label = "カードを登録する",
}: CardRegisterButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/payment/card/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ residentAccountId }),
      });
      const json = (await res.json()) as ApiResponse<CheckoutFormData>;
      if (!json.success) {
        setError(json.error);
        setLoading(false);
        return;
      }

      // 自動送信フォームを生成して USEN 決済画面へ遷移
      const { url, fields } = json.data;
      const form = document.createElement("form");
      form.method = "POST";
      form.action = url;
      form.style.display = "none";
      for (const [k, v] of Object.entries(fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = k;
        input.value = v;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "通信エラーが発生しました");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="qolc-btn rounded text-white font-bold disabled:opacity-60"
        style={{
          backgroundColor: "var(--qolc-primary)",
          minHeight: large ? 56 : 48,
          fontSize: large ? 18 : 16,
          padding: large ? "0 32px" : "0 24px",
        }}
      >
        {loading ? "決済画面に移動中..." : label}
      </button>
      {error && (
        <p className="text-sm mt-2" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}
    </div>
  );
}
