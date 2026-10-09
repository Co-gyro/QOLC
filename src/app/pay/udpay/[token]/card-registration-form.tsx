"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiResponse } from "@/types/api";
import {
  loadUsenSdk,
  normalizeCardholderName,
  type TokenAdapter,
} from "@/app/checkout/[sessionId]/usen-sdk";

/** /pay の結果 */
type CompleteResult =
  | { ok: true; brand: string | null; last4: string | null; expireYm: string | null }
  | { ok: false; error: string; retryJutyuCd: string };

type Phase = "loading" | "ready" | "processing" | "challenge" | "done" | "error";

const RETRY_MESSAGE = "カードを登録できませんでした。カード情報をご確認のうえ、もう一度お試しください。";

/**
 * カード入力と登録の実行（USEN トークン式SDK）。カード番号・セキュリティコードは USEN の iframe に入力される。
 * 失敗した場合はサーバーが返す新しい受注コードで入力し直せる。
 */
export function CardRegistrationForm(props: {
  token: string;
  jutyuCd: string;
  mallCd: string;
  tokenJsUrl: string;
  sdkApiBaseUrl: string | null;
  merchantName: string;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<{ brand: string | null; last4: string | null } | null>(null);
  const [mm, setMm] = useState("");
  const [yyyy, setYyyy] = useState("");
  const [name, setName] = useState("");
  const adapterRef = useRef<TokenAdapter | null>(null);
  const jutyuRef = useRef(props.jutyuCd);
  const api = `/api/udpay-card/${props.token}`;

  /** 3DS 後の決済（カード登録の完了） */
  async function complete(body: object): Promise<void> {
    try {
      const res = await fetch(`${api}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiResponse<CompleteResult>;
      if (!json.success) {
        setMessage(json.error);
        setPhase("ready");
        return;
      }
      if (!json.data.ok) {
        jutyuRef.current = json.data.retryJutyuCd;
        setMessage(RETRY_MESSAGE);
        setPhase("ready");
        return;
      }
      setDone({ brand: json.data.brand, last4: json.data.last4 });
      setPhase("done");
    } catch {
      setMessage(RETRY_MESSAGE);
      setPhase("ready");
    }
  }

  useEffect(() => {
    let cancelled = false;
    loadUsenSdk(props.tokenJsUrl)
      .then((netmove) => {
        if (cancelled || adapterRef.current) return;
        const adapter = new netmove.EcPaymentWebAdapterToken({
          mallCd: props.mallCd,
          merchantApiBaseUrl: `${window.location.origin}${api}`,
          cardInputIframeContainerId: "ud-card-input",
          challengeIframeContainerId: "ud-challenge",
          apiBaseUrl: props.sdkApiBaseUrl,
        });
        adapter.setOnChallengeStart(() => setPhase("challenge"));
        adapter.setOnPaymentStart((jutyuCd, checkCd, token) => {
          setPhase("processing");
          void complete({ jutyu_cd: jutyuCd, check_cd: checkCd, token: token ?? "" });
        });
        adapter.setOnPaymentError(() => {
          setMessage(RETRY_MESSAGE);
          setPhase("ready");
        });
        const container = document.getElementById("ud-card-input");
        if (container) container.innerHTML = "";
        adapter.generateCardInputIframe(
          { cardInputForm: { display: "flex", flexDirection: "column", gap: "12px" } },
          { cardNumLabel: "カード番号", cvvLabel: "セキュリティコード" },
          { cardNum: "1234 5678 9012 3456", cvv: "123" },
        );
        adapterRef.current = adapter;
        setPhase("ready");
      })
      .catch(() => {
        setMessage("カード登録画面を読み込めませんでした。画面を再読み込みしてください。");
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
    // 初回のみ初期化する（二重初期化で入力欄が2つ出るのを防ぐ）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 登録ボタン */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const adapter = adapterRef.current;
    if (!adapter) return;
    const holder = normalizeCardholderName(name);
    if (!/^(0[1-9]|1[0-2])$/.test(mm) || !/^\d{4}$/.test(yyyy)) {
      setMessage("有効期限を、月2桁・年4桁で入力してください（例: 08 / 2028）");
      return;
    }
    if (holder.length < 2) {
      setMessage("カード名義を半角英字で入力してください");
      return;
    }
    setMessage(null);
    setPhase("processing");
    try {
      const tk = await adapter.generateToken();
      if (tk.result !== "ok") {
        setMessage("カード番号またはセキュリティコードをご確認ください");
        setPhase("ready");
        return;
      }
      adapter.startPaymentProcess({
        jutyuCd: jutyuRef.current,
        cardLimitYyyy: yyyy,
        cardLimitMm: mm,
        cardholderName: holder,
        token: tk.token,
      });
    } catch {
      setMessage(RETRY_MESSAGE);
      setPhase("ready");
    }
  }

  if (phase === "done") {
    return (
      <section className="rounded-lg border border-[#E0DDD8] bg-white p-6 text-center">
        <p className="text-4xl" aria-hidden>✅</p>
        <h2 className="mt-2 text-lg font-bold">カードの登録が完了しました</h2>
        <p className="mt-2 text-base">
          {done?.brand ?? ""}
          {done?.last4 ? `（下4桁 ${done.last4}）` : ""}
        </p>
        <p className="mt-2 text-base text-[#555]">
          今後、{props.merchantName}からの毎月のご請求は、このカードで自動でお支払いいただきます。この画面は閉じていただいて構いません。
        </p>
      </section>
    );
  }

  const busy = phase !== "ready";
  const field = "mt-1 block min-h-[48px] w-full rounded border border-[#E0DDD8] px-3 text-base";
  return (
    <section className="space-y-4 rounded-lg border border-[#E0DDD8] bg-white p-5">
      {message && <p className="rounded bg-[#FEE2E2] p-3 text-base text-[#991B1B]">{message}</p>}
      {phase === "loading" && <p className="text-base">カード登録画面を準備しています…</p>}
      <form onSubmit={submit} className={phase === "error" ? "hidden" : "space-y-4"} autoComplete="off">
        <div>
          <p className="text-base font-bold">カード番号・セキュリティコード</p>
          <div id="ud-card-input" className="mt-1 min-h-[80px] rounded border border-[#E0DDD8] p-3" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-base font-bold">
            有効期限（月）
            <input className={field} inputMode="numeric" maxLength={2} placeholder="08" value={mm} onChange={(e) => setMm(e.target.value.trim())} />
          </label>
          <label className="text-base font-bold">
            有効期限（年）
            <input className={field} inputMode="numeric" maxLength={4} placeholder="2028" value={yyyy} onChange={(e) => setYyyy(e.target.value.trim())} />
          </label>
        </div>
        <label className="block text-base font-bold">
          カード名義（半角英字）
          <input className={field} placeholder="TARO YAMADA" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" disabled={busy} className="min-h-[52px] w-full rounded bg-[#333333] text-lg font-bold text-white disabled:opacity-50">
          {phase === "challenge" ? "本人認証中…" : phase === "processing" ? "処理中…" : "このカードを登録する"}
        </button>
      </form>
      <div id="ud-challenge" className={phase === "challenge" ? "mt-2" : "hidden"} />
    </section>
  );
}
