"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import type { ApiResponse } from "@/types/api";

/** USEN SDK の最小型定義（トークン式EC決済API仕様書 10章） */
interface TokenAdapter {
  setOnChange(cb: (cardLen: number, cvvLen: number) => void): void;
  setOnChallengeStart(cb: () => void): void;
  setOnPaymentStart(cb: (jutyuCd: string, checkCd: string, token: string | null) => void): void;
  setOnPaymentError(cb: (err: unknown) => void): void;
  generateCardInputIframe(styles: object, texts: object, placeholders?: object): void;
  generateToken(): Promise<{ result: string; code: string; maskedCardNumber: string; token: string; message?: string | null }>;
  startPaymentProcess(args: {
    jutyuCd: string;
    cardLimitYyyy: string;
    cardLimitMm: string;
    cardholderName: string;
    token: string;
    payMethod?: string | null;
    payTimes?: string | null;
  }): void;
}
interface NetmoveGlobal {
  EcPaymentWebAdapterToken: new (opts: {
    mallCd: string;
    merchantApiBaseUrl: string;
    challengeIframeContainerId: string;
    cardInputIframeContainerId: string;
    apiBaseUrl?: string | null;
  }) => TokenAdapter;
}
declare global {
  interface Window {
    netmove?: NetmoveGlobal;
  }
}

interface PrepareData {
  jutyuCd: string;
  mallCd: string;
  memberId: string;
  merchantApiBaseUrl: string;
}

type Phase = "loading" | "ready" | "processing" | "challenge" | "done" | "error";

export default function CardRegisterPage() {
  return (
    <Suspense
      fallback={
        <PortalLayout portal="user">
          <LoadingSpinner label="読み込み中..." />
        </PortalLayout>
      }
    >
      <CardRegisterInner />
    </Suspense>
  );
}

function CardRegisterInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const residentAccountId = sp.get("ra") ?? "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [cardLimitYyyy, setCardLimitYyyy] = useState("");
  const [cardLimitMm, setCardLimitMm] = useState("");
  const [cardholderName, setCardholderName] = useState("");

  const adapterRef = useRef<TokenAdapter | null>(null);
  const prepareRef = useRef<PrepareData | null>(null);

  const jsUrl = process.env.NEXT_PUBLIC_USEN_TOKEN_JS_URL;
  const testApiBase = process.env.NEXT_PUBLIC_USEN_TOKEN_EC_API_BASE_URL; // テスト時のみ任意指定

  const setupAdapter = useCallback(async () => {
    setError(null);
    if (!residentAccountId) {
      setError("対象アカウントが指定されていません");
      setPhase("error");
      return;
    }
    if (!jsUrl) {
      setError("USEN SDK のURLが未設定です（NEXT_PUBLIC_USEN_TOKEN_JS_URL）。USENから提供されたライブラリURLを設定してください。");
      setPhase("error");
      return;
    }
    if (!window.netmove) {
      setError("USEN SDK の読み込みに失敗しました");
      setPhase("error");
      return;
    }
    // 二重初期化ガード（Strict Modeでの useEffect 2回実行 / 親リレンダ対策）
    if (adapterRef.current) {
      return;
    }
    try {
      // 1. 準備（jutyu_cd / member_id / merchantApiBaseUrl 取得）
      const res = await fetch("/api/payment/card/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ residentAccountId }),
      });
      const json = (await res.json()) as ApiResponse<PrepareData>;
      if (!json.success) {
        setError(json.error);
        setPhase("error");
        return;
      }
      prepareRef.current = json.data;

      // 2. アダプタ初期化
      const adapter = new window.netmove.EcPaymentWebAdapterToken({
        mallCd: json.data.mallCd,
        merchantApiBaseUrl: json.data.merchantApiBaseUrl,
        cardInputIframeContainerId: "qolc-card-input",
        challengeIframeContainerId: "qolc-challenge",
        apiBaseUrl: testApiBase || null,
      });
      adapter.setOnChallengeStart(() => setPhase("challenge"));
      adapter.setOnPaymentStart(async (jutyuCd, checkCd, token) => {
        setPhase("processing");
        const payRes = await fetch(`/api/payment/reg/${json.data.memberId}/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jutyu_cd: jutyuCd, token, check_cd: checkCd }),
        });
        const payJson = (await payRes.json()) as ApiResponse<{ memberId: string }>;
        if (!payJson.success) {
          setError(payJson.error);
          setPhase("error");
          return;
        }
        setPhase("done");
      });
      adapter.setOnPaymentError((e) => {
        setError("決済処理でエラーが発生しました: " + JSON.stringify(e));
        setPhase("error");
      });

      // 3. カード入力iframe生成（既存の子要素をクリアしてから挿入）
      const cardContainer = document.getElementById("qolc-card-input");
      if (cardContainer) cardContainer.innerHTML = "";
      adapter.generateCardInputIframe(
        { cardInputForm: { display: "flex", flexDirection: "column", gap: "12px" } },
        { cardNumLabel: "カード番号", cvvLabel: "セキュリティコード" },
        { cardNum: "1234 5678 9012 3456", cvv: "123" }
      );
      adapterRef.current = adapter;
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "初期化に失敗しました");
      setPhase("error");
    }
  }, [residentAccountId, jsUrl, testApiBase]);

  // SDK スクリプト読み込み
  useEffect(() => {
    if (!jsUrl) {
      setError("USEN SDK のURLが未設定です（NEXT_PUBLIC_USEN_TOKEN_JS_URL）。");
      setPhase("error");
      return;
    }
    if (window.netmove) {
      void setupAdapter();
      return;
    }
    const script = document.createElement("script");
    script.src = jsUrl;
    script.async = true;
    script.onload = () => void setupAdapter();
    script.onerror = () => {
      setError("USEN SDK の読み込みに失敗しました（URLを確認してください）");
      setPhase("error");
    };
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [jsUrl, setupAdapter]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const adapter = adapterRef.current;
    const prep = prepareRef.current;
    if (!adapter || !prep) return;
    if (!/^\d{4}$/.test(cardLimitYyyy) || !/^\d{2}$/.test(cardLimitMm)) {
      setError("有効期限（年4桁・月2桁）を正しく入力してください");
      return;
    }
    if (!cardholderName.trim()) {
      setError("カード名義を入力してください");
      return;
    }
    setPhase("processing");
    try {
      const tk = await adapter.generateToken();
      if (tk.result !== "ok") {
        setError(`カード情報エラー: ${tk.message ?? tk.code}`);
        setPhase("ready");
        return;
      }
      adapter.startPaymentProcess({
        jutyuCd: prep.jutyuCd,
        cardLimitYyyy,
        cardLimitMm,
        cardholderName: cardholderName.trim(),
        token: tk.token,
      });
      // 以降は OnPaymentStart / OnPaymentError リスナーで処理
    } catch (e) {
      setError(e instanceof Error ? e.message : "トークン生成に失敗しました");
      setPhase("ready");
    }
  }

  return (
    <PortalLayout portal="user">
      <h1 className="text-3xl font-bold mb-6">カード登録</h1>

      {phase === "done" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">登録が完了しました</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base mb-4">クレジットカードの登録が完了しました。</p>
            <Button onClick={() => router.push("/user/card")} style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 48 }}>
              カード管理へ戻る
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">クレジットカード情報の入力</CardTitle>
          </CardHeader>
          <CardContent>
            {phase === "loading" && <LoadingSpinner label="準備中..." />}
            {error && (
              <p className="text-sm mb-4 p-3 rounded" style={{ backgroundColor: "#FEE2E2", color: "#991B1B" }}>
                {error}
              </p>
            )}

            <form
              onSubmit={handleSubmit}
              className={phase === "loading" || phase === "error" ? "hidden" : "space-y-4"}
              autoComplete="off"
            >
              {/* カード番号・CVV は USEN の iframe（同フォーム外 origin のため、ここから入力欄を別途生成しない） */}
              <div>
                <Label>カード番号・セキュリティコード</Label>
                <div
                  id="qolc-card-input"
                  className="border rounded p-3 mt-1"
                  style={{ borderColor: "var(--qolc-border)", minHeight: 80 }}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="cm">有効期限（月）</Label>
                  <Input
                    id="cm"
                    name="exp-month-qolc"
                    inputMode="numeric"
                    placeholder="08"
                    maxLength={2}
                    value={cardLimitMm}
                    onChange={(e) => setCardLimitMm(e.target.value)}
                    style={{ minHeight: 48 }}
                    autoComplete="off"
                    data-lpignore="true"
                  />
                </div>
                <div>
                  <Label htmlFor="cy">年</Label>
                  <Input
                    id="cy"
                    name="exp-year-qolc"
                    inputMode="numeric"
                    placeholder="2027"
                    maxLength={4}
                    value={cardLimitYyyy}
                    onChange={(e) => setCardLimitYyyy(e.target.value)}
                    style={{ minHeight: 48 }}
                    autoComplete="off"
                    data-lpignore="true"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="cn">カード名義（半角英字）</Label>
                <Input
                  id="cn"
                  name="cardholder-qolc"
                  placeholder="TESTCARD"
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)}
                  style={{ minHeight: 48 }}
                  autoComplete="off"
                  data-lpignore="true"
                />
                <p className="text-xs mt-1" style={{ color: "var(--qolc-muted)" }}>
                  仕様: 半角英数2～45桁。テスト時は <code>TESTCARD</code>（スペース無し）/ 有効期限 <code>08/2027</code> をご使用ください。
                </p>
              </div>
              <Button type="submit" disabled={phase === "processing" || phase === "challenge"} className="w-full" style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 48, fontSize: 18 }}>
                {phase === "processing" ? "処理中..." : phase === "challenge" ? "認証中..." : "登録する"}
              </Button>
            </form>

            {/* 3Dセキュア チャレンジ認証 iframe */}
            <div id="qolc-challenge" className={phase === "challenge" ? "mt-4" : "hidden"} />
          </CardContent>
        </Card>
      )}
    </PortalLayout>
  );
}
