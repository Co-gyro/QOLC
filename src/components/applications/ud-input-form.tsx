/**
 * UD追記フォーム（source=qolc_merchant のみ）
 *
 * 顧客入力（payload）とは別領域の applications.ud_input に、申請書生成へ必要な
 * UD側の補足項目（包括事業者コード・精算料率・業態コード・セキュリティ対応状況・
 * 振込先口座）を保存する。保存時は ud_input_updated イベント（before/after）が記録される。
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

const INPUT_CLASS = "border rounded px-2 py-2 text-sm w-full bg-white";
const INPUT_STYLE = { borderColor: "var(--qolc-border)", minHeight: 44 };

/** テキスト入力1項目（ラベル + 補足） */
function TextField(props: {
  label: string;
  value: string;
  hint?: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span style={{ color: "var(--qolc-muted)" }}>{props.label}</span>
      <input
        type="text"
        className={INPUT_CLASS}
        style={INPUT_STYLE}
        value={props.value}
        placeholder={props.placeholder}
        maxLength={100}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.hint && (
        <span className="text-xs" style={{ color: "var(--qolc-muted)" }}>
          {props.hint}
        </span>
      )}
    </label>
  );
}

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
    onSave(serializeUdInput(editable, parseUdInput(udInput ?? null).review));
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
        <TextField
          label="業態コード"
          value={fields.biz_cat_code ?? ""}
          placeholder="例：60207"
          hint="JCB申請書の業態コード（基本合意書の業態から選択）"
          onChange={set("biz_cat_code")}
        />
        <TextField
          label="セキュリティ対応状況"
          value={fields.security_status ?? ""}
          placeholder="例：カード情報非保持・PCIDSS準拠"
          onChange={set("security_status")}
        />
      </div>
      <p className="text-sm font-medium" style={{ color: "var(--qolc-text)" }}>
        振込先口座情報（精算金の支払先）
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextField label="銀行名" value={fields.bank_name ?? ""} onChange={set("bank_name")} />
        <TextField label="支店名" value={fields.bank_branch ?? ""} onChange={set("bank_branch")} />
        <label className="flex flex-col gap-1 text-sm">
          <span style={{ color: "var(--qolc-muted)" }}>口座種別</span>
          <select
            className={INPUT_CLASS}
            style={INPUT_STYLE}
            value={fields.account_type ?? ""}
            onChange={(e) =>
              setFields((prev) => ({
                ...prev,
                account_type:
                  e.target.value === "ordinary" || e.target.value === "checking"
                    ? e.target.value
                    : undefined,
              }))
            }
          >
            <option value="">未選択</option>
            <option value="ordinary">普通</option>
            <option value="checking">当座</option>
          </select>
        </label>
        <TextField
          label="口座番号"
          value={fields.account_number ?? ""}
          onChange={set("account_number")}
        />
        <TextField
          label="口座名義（カナ）"
          value={fields.account_holder ?? ""}
          placeholder="例：ﾕﾆﾊﾞｰｻﾙﾃﾞﾍﾞﾛｯﾌﾟﾒﾝﾄ(ｶ"
          onChange={set("account_holder")}
        />
      </div>
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
