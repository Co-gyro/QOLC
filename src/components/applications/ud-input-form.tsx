/**
 * UD追記フォーム（source=qolc_merchant のみ）
 *
 * 顧客入力（payload）とは別領域の applications.ud_input に、申請書生成へ必要な
 * UD側の補足項目（包括事業者コード・精算料率・業態コード・セキュリティ対応状況・
 * 振込先口座・料率適用開始日）を保存する。口座は Selfish（精算）登録にそのまま使うため
 * 銀行/支店コードと全銀カナ名義を持つ。保存時は ud_input_updated イベント（before/after）が記録される。
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  parseUdInput,
  serializeUdInput,
  udInputFieldsSchema,
  DEFAULT_BULK_PROVIDER_CODE,
  type UdInputFields,
} from "@/lib/applications/ud-input";

export interface UdInputFormProps {
  udInput: Record<string, unknown> | null | undefined;
  saving: boolean;
  /** serializeUdInput 済みの ud_input 全体を PATCH させる */
  onSave: (udInput: Record<string, unknown>) => void;
}

import { UdTextField as TextField } from "./ud-text-field";
import { UdAppdocFields } from "./ud-appdoc-fields";
import { UdBankFields } from "./ud-bank-fields";

export function UdInputForm({ udInput, saving, onSave }: UdInputFormProps) {
  const parsed = parseUdInput(udInput ?? null);
  const [fields, setFields] = useState<UdInputFields>({ ...parsed.fields });
  const [formError, setFormError] = useState<string | null>(null);

  const set = (key: keyof UdInputFields) => (v: string) =>
    setFields((prev) => ({ ...prev, [key]: v }));

  /** 審査結果（review）は保持したままフィールドのみ差し替えて保存 */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    // 包括事業者コードは固定値のため入力させず保存もしない（生成側が定数 0160 を使う）
    const { bulk_provider_code: _fixed, ...editable } = fields;
    const check = udInputFieldsSchema.safeParse(
      Object.fromEntries(
        Object.entries(editable).filter(([, v]) => typeof v === "string" && v.trim() !== "")
      )
    );
    if (!check.success) {
      setFormError(check.error.issues[0]?.message ?? "入力内容を確認してください");
      return;
    }
    const current = parseUdInput(udInput ?? null);
    // review（審査記録）と codes（採番）は UD 追記フォームでは触らず必ず引き継ぐ
    onSave(serializeUdInput(editable, current.review, current.codes));
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
        申請書の生成に必要なUD側の項目です。お客さまの入力内容（申請内容）は書き換わりません。
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 text-sm">
          <span style={{ color: "var(--qolc-muted)" }}>包括事業者コード</span>
          <p className="font-medium py-2">{DEFAULT_BULK_PROVIDER_CODE}（固定）</p>
          <span className="text-xs" style={{ color: "var(--qolc-muted)" }}>
            JCBの2層構造の親コード。申請書には自動で入るため入力不要です
          </span>
        </div>
        <TextField
          label="精算料率（%）"
          value={fields.settlement_rate ?? ""}
          placeholder="例：1.9"
          hint="加盟店との契約手数料率"
          onChange={set("settlement_rate")}
        />
        {/*
          カード会社手数料率は業種ごとに違い既定値が無いため、加盟店ごとに入力する。
          Selfish 側もブランド別の既定値を持たず、未入力だと連携を拒否する。
          誤っても店子への振込額には出ない（UDの取り分とNMとの折半だけがずれる）ので、
          hint で「何に効くか」を明示しておく。
        */}
        <TextField
          label="カード会社手数料率（%）"
          value={fields.card_company_fee_rate ?? ""}
          placeholder="例：3.0"
          hint="UDがカード会社へ支払う率（業種で異なる）。UDの取り分の計算に使う"
          onChange={set("card_company_fee_rate")}
        />
      </div>
      <p className="text-sm font-medium" style={{ color: "var(--qolc-text)" }}>
        申請書用補足（JCB申請書の必須項目・お客様入力にはない項目）
      </p>
      <UdAppdocFields fields={fields} set={set} />
      <p className="text-sm font-medium" style={{ color: "var(--qolc-text)" }}>
        振込先口座情報（精算金の支払先。Selfish 登録にそのまま使う）
      </p>
      <UdBankFields fields={fields} set={set} setFields={setFields} />
      {formError && (
        <p className="text-sm" style={{ color: "#DC2626" }}>
          {formError}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={saving}
          style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 44 }}
        >
          {saving ? "保存中…" : "UD追記情報を保存"}
        </Button>
      </div>
    </form>
  );
}
