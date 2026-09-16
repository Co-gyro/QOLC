"use client";

/**
 * UD追記フォームの「振込先口座」フィールド群
 *
 * Selfish（精算システム）の口座登録に必要な形で持つ:
 *   銀行コード4桁 / 支店コード3桁 / 口座種別 / 口座番号7桁以内 / 口座名義（全銀半角カナ）
 * 銀行名・支店名は JCB/セゾン申請書用に残す。
 * 名義は「半角カナに変換」で候補を出すだけで、確定した値のみ保存する
 * （Selfish 側の承認方式に合わせ、黙って変換しない）。
 */
import { useState } from "react";
import type { UdInputFields } from "@/lib/applications/ud-input";
import { suggestZenginKana } from "@/lib/selfish/zengin";
import { UdTextField, UD_INPUT_CLASS, UD_INPUT_STYLE } from "./ud-text-field";

export interface UdBankFieldsProps {
  fields: UdInputFields;
  set: (key: keyof UdInputFields) => (v: string) => void;
  setFields: React.Dispatch<React.SetStateAction<UdInputFields>>;
}

export function UdBankFields({ fields, set, setFields }: UdBankFieldsProps) {
  const [kanaNote, setKanaNote] = useState<string | null>(null);

  /** 名義の変換候補を表示し、使えるなら入力欄へ反映する */
  function handleSuggestKana() {
    const src = fields.account_holder ?? "";
    const r = suggestZenginKana(src);
    if (!src.trim()) {
      setKanaNote("口座名義を入力してから変換してください");
      return;
    }
    if (r.ok) {
      set("account_holder")(r.converted);
      setKanaNote(r.converted === src ? "全銀で使える文字のみです" : `変換しました: ${r.converted}`);
    } else {
      setKanaNote(`変換しても使えない文字が残ります: ${r.violations.join(" ")}（手で直してください）`);
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <UdTextField label="銀行名" value={fields.bank_name ?? ""} onChange={set("bank_name")} />
      <UdTextField
        label="銀行コード（4桁）"
        value={fields.bank_code ?? ""}
        placeholder="例：0310"
        hint="Selfish の口座登録に必須。全銀の金融機関コード"
        onChange={set("bank_code")}
      />
      <UdTextField label="支店名" value={fields.bank_branch ?? ""} onChange={set("bank_branch")} />
      <UdTextField
        label="支店コード（3桁）"
        value={fields.branch_code ?? ""}
        placeholder="例：102"
        hint="Selfish の口座登録に必須"
        onChange={set("branch_code")}
      />
      <label className="flex flex-col gap-1 text-sm">
        <span style={{ color: "var(--qolc-muted)" }}>口座種別</span>
        <select
          className={UD_INPUT_CLASS}
          style={UD_INPUT_STYLE}
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
      <UdTextField
        label="口座番号（7桁以内）"
        value={fields.account_number ?? ""}
        onChange={set("account_number")}
      />
      <div className="sm:col-span-2 flex flex-col gap-1">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <UdTextField
              label="口座名義（全銀半角カナ）"
              value={fields.account_holder ?? ""}
              placeholder="例：ﾕﾆﾊﾞｰｻﾙﾃﾞﾍﾞﾛﾂﾌﾟﾒﾝﾄ(ｶ"
              hint="半角カナ・英大文字・数字・()/-.スペースのみ。中黒（・）は使えません"
              onChange={set("account_holder")}
            />
          </div>
          <button
            type="button"
            className="qolc-btn px-3 rounded border text-sm whitespace-nowrap"
            style={{ borderColor: "var(--qolc-border)", minHeight: 44, marginBottom: 20 }}
            onClick={handleSuggestKana}
          >
            半角カナに変換
          </button>
        </div>
        {kanaNote && (
          <span className="text-xs" style={{ color: "var(--qolc-muted)" }}>
            {kanaNote}
          </span>
        )}
      </div>
      <UdTextField
        label="料率適用開始日（YYYY-MM-DD）"
        value={fields.fee_valid_from ?? ""}
        placeholder="例：2026-10-01"
        hint="Selfish の料率履歴の開始日。USEN 開通確認日が目安"
        onChange={set("fee_valid_from")}
      />
    </div>
  );
}
