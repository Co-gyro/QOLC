"use client";

/**
 * LIFF エントリページ（LINEアプリ内で開く）。
 *
 * フロー:
 *   1. liff.init({ liffId })
 *   2. 未ログインなら liff.login()（LINEへリダイレクト）
 *   3. liff.getIDToken() を /api/auth/line/liff へ送り、Supabase セッションを確立
 *   4. 成功で /user/home へ全画面遷移（middleware に Cookie を処理させる）
 *
 * 非連携アカウントは「招待リンクから登録」を案内する。
 * LIFF ID 未設定や LINE 外アクセス時もエラー表示でフォールバックする。
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import type { ApiResponse } from "@/types/api";

type Phase = "loading" | "error";

export default function LiffEntryPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("LINEと連携しています…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) {
        if (!cancelled) {
          setPhase("error");
          setMessage("LIFFが設定されていません。管理者へお問い合わせください。");
        }
        return;
      }

      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          // LINE ログインへリダイレクト（戻ってくると isLoggedIn=true で再実行される）
          liff.login();
          return;
        }

        const idToken = liff.getIDToken();
        if (!idToken) {
          throw new Error("LINEのIDトークンを取得できませんでした");
        }

        const res = await fetch("/api/auth/line/liff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        const json = (await res.json()) as ApiResponse<{ redirectTo: string }>;
        if (!json.success) {
          if (!cancelled) {
            setPhase("error");
            setMessage(json.error);
          }
          return;
        }
        // リッチメニュー等からの飛び先指定（?next=/user/...）を許可（内部パスのみ）
        const next = new URLSearchParams(window.location.search).get("next");
        const safeNext =
          next && next.startsWith("/user/") && !next.startsWith("//") ? next : null;
        // 全画面遷移でセッション Cookie を middleware に処理させる
        window.location.assign(safeNext ?? json.data.redirectTo);
      } catch (e) {
        if (!cancelled) {
          setPhase("error");
          setMessage(e instanceof Error ? e.message : "LINE連携に失敗しました");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--qolc-bg-soft)" }}
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center" style={{ color: "var(--qolc-primary)" }}>
            QOLC マイページ
          </CardTitle>
        </CardHeader>
        <CardContent>
          {phase === "loading" ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <LoadingSpinner />
              <p className="text-base text-center">{message}</p>
            </div>
          ) : (
            <div className="text-center space-y-4 py-4">
              <p className="text-base" style={{ color: "#DC2626" }}>
                {message}
              </p>
              <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
                施設から届いた招待リンクからご登録のうえ、再度お試しください。
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
