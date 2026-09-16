/**
 * Selfish 登録データの表示部品（チェックリスト + 登録票 + JSON）
 * ダイアログ本体（selfish-dialog.tsx）から使う。状態は持たない。
 */
"use client";

import Link from "next/link";
import type { SelfishIssue, SelfishMerchantPayload } from "@/lib/selfish/build-payload";
import { SELFISH_FIX_LABELS } from "../_lib/selfish";

/** 不足・不正項目のチェックリスト */
export function SelfishIssueList({
  issues,
  applicationId,
}: {
  issues: SelfishIssue[];
  applicationId: string | null;
}) {
  if (issues.length === 0) {
    return (
      <p className="text-sm rounded px-3 py-2" style={{ backgroundColor: "var(--qolc-bg-soft)", color: "var(--qolc-primary)" }}>
        必要な項目はすべて揃っています。
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {issues.map((i) => (
        <li key={`${i.field}:${i.message}`} className="flex gap-2 items-start">
          <span
            className="shrink-0 rounded px-1.5 text-xs font-medium"
            style={
              i.level === "error"
                ? { backgroundColor: "#FEE2E2", color: "#B91C1C" }
                : { backgroundColor: "#FEF3C7", color: "#92400E" }
            }
          >
            {i.level === "error" ? "不足" : "注意"}
          </span>
          <span>
            <span className="font-medium">{i.label}</span>：{i.message}
            <span className="block text-xs" style={{ color: "var(--qolc-muted)" }}>
              {i.fix === "ud_input" && applicationId ? (
                <Link href={`/admin/applications/${applicationId}`} className="underline" style={{ color: "var(--qolc-primary)" }}>
                  {SELFISH_FIX_LABELS[i.fix]}
                </Link>
              ) : (
                SELFISH_FIX_LABELS[i.fix]
              )}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Selfish の入力順に並べた登録票（手動登録時にそのまま転記できる） */
export function SelfishPayloadTable({ payload }: { payload: SelfishMerchantPayload }) {
  const typeLabel = payload.account.account_type === "1" ? "1（普通）" : payload.account.account_type === "2" ? "2（当座）" : "—";
  const rows: Array<[string, string]> = [
    ["① 法人名", payload.merchant.name || "—"],
    ["① 法人 external_id", payload.external_id],
    ["② 店舗名", payload.store.name || "—"],
    ["② 店舗メール（配信方法: email）", payload.store.email || "—"],
    ["③ 銀行コード / 支店コード", `${payload.account.bank_code || "—"} / ${payload.account.branch_code || "—"}`],
    ["③ 口座種別 / 口座番号", `${typeLabel} / ${payload.account.account_number || "—"}`],
    ["③ 口座名義（全銀カナ）", payload.account.account_name_kana || "—"],
    ...payload.card_numbers.map(
      (c): [string, string] => [`④ 加盟店番号（${c.brand}）`, c.merchant_number]
    ),
    ["⑤ 加盟店手数料率 / 適用開始日", `${payload.fee.merchant_fee_rate || "—"} / ${payload.fee.valid_from || "—"}`],
  ];
  return (
    <table className="w-full text-sm border-collapse">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} style={{ borderBottom: "1px solid var(--qolc-border)" }}>
            <th className="text-left font-medium py-1.5 pr-3 align-top whitespace-nowrap" style={{ color: "var(--qolc-muted)", width: "45%" }}>
              {k}
            </th>
            <td className="py-1.5 font-mono break-all">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
