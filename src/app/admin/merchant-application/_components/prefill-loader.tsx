/**
 * 申請ハブからのプリフィル読込（?applicationId=xxx）
 *
 * 該当申請の payload + ud_input を取得し、JCB申請書フォームへ初期値として渡す。
 * 取得できない場合は理由を表示したうえで空フォームを出す（作業を止めない）。
 */
"use client";

import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { fetchApplicationDetail } from "@/lib/applications/client";
import type { ApplicationDetail } from "@/lib/applications/types";
import { buildJcbPrefill } from "../_lib/prefill";
import { JcbEcForm } from "./jcb-ec-form";
import type { JcbEcApplication } from "@/lib/merchant-application/jcb-ec";

export function PrefillLoader({ applicationId }: { applicationId: string }) {
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "ready"; detail: ApplicationDetail; initial: Partial<JcbEcApplication> }
    | { phase: "error"; message: string }
  >({ phase: "loading" });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const detail = await fetchApplicationDetail(applicationId);
        if (!mounted) return;
        setState({
          phase: "ready",
          detail,
          initial: buildJcbPrefill(detail.payload, detail.udInput ?? null),
        });
      } catch (e) {
        if (!mounted) return;
        setState({
          phase: "error",
          message: e instanceof Error ? e.message : "申請内容を取得できませんでした",
        });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [applicationId]);

  if (state.phase === "loading") return <LoadingSpinner />;

  if (state.phase === "error") {
    return (
      <div className="grid gap-4">
        <p
          className="rounded border p-3 text-sm"
          style={{ borderColor: "#FCA5A5", color: "#991B1B", backgroundColor: "#FEF2F2" }}
        >
          申請内容のプリフィルに失敗しました（{state.message}）。空のフォームから入力できます。
        </p>
        <JcbEcForm />
      </div>
    );
  }

  const { detail } = state;
  return (
    <div className="grid gap-4">
      <div
        className="rounded border p-3 text-sm"
        style={{ borderColor: "var(--qolc-border)", backgroundColor: "#F0F9F4" }}
      >
        <p className="font-medium" style={{ color: "var(--qolc-text)" }}>
          申請「{detail.applicantOrg ?? detail.applicantName ?? detail.id.slice(0, 8)}」の内容を反映しています
        </p>
        <p className="mt-1" style={{ color: "var(--qolc-muted)" }}>
          お客さまの入力とUD追記情報から自動入力済みです。カナ・業態コードなどの不足分だけ補完してください。
          <a
            href={`/admin/applications/${detail.id}`}
            className="underline ml-1 font-medium"
            style={{ color: "var(--qolc-primary)" }}
          >
            案件詳細へ戻る
          </a>
        </p>
      </div>
      <JcbEcForm initial={state.initial} />
    </div>
  );
}
