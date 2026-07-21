"use client";

/**
 * UD追記フォームの「申請書用補足」フィールド群（JCB申請書の必須項目でお客様入力にないもの）
 *
 * - 業態コード: JCB提供のEC設定可能業態マスタ（118件）から選択
 * - セキュリティ対応状況: 定型の選択式
 * - 住所フリガナ: 全角カタカナ＋数字で入力（申請書生成時に半角カナへ自動変換）
 */
import { BIZ_CATEGORIES } from "@/lib/merchant-application/jcb-ec";
import { SECURITY_STATUS_OPTIONS, type UdInputFields } from "@/lib/applications/ud-input";
import { UdTextField, UD_INPUT_CLASS, UD_INPUT_STYLE } from "./ud-text-field";

export interface UdAppdocFieldsProps {
  fields: UdInputFields;
  set: (key: keyof UdInputFields) => (v: string) => void;
}

export function UdAppdocFields({ fields, set }: UdAppdocFieldsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span style={{ color: "var(--qolc-muted)" }}>業態コード</span>
        <select
          className={UD_INPUT_CLASS}
          style={UD_INPUT_STYLE}
          value={fields.biz_cat_code ?? ""}
          onChange={(e) => set("biz_cat_code")(e.target.value)}
        >
          <option value="">未選択</option>
          {BIZ_CATEGORIES.map((b) => (
            <option key={b.code} value={b.code}>
              {b.code}：{b.label}
            </option>
          ))}
        </select>
        <span className="text-xs" style={{ color: "var(--qolc-muted)" }}>
          JCB「Accel設定可能業態コード（EC）」全118件から選択
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span style={{ color: "var(--qolc-muted)" }}>セキュリティ対応状況</span>
        <select
          className={UD_INPUT_CLASS}
          style={UD_INPUT_STYLE}
          value={fields.security_status ?? ""}
          onChange={(e) => set("security_status")(e.target.value)}
        >
          <option value="">未選択</option>
          {SECURITY_STATUS_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <span className="text-xs" style={{ color: "var(--qolc-muted)" }}>
          QOLCは非対面・トークン決済（カード情報非保持）が基本です
        </span>
      </label>
      <UdTextField
        label="店舗名アルファベット"
        value={fields.tenant_name_latin ?? ""}
        placeholder="例：SAMPLE CARE HOME"
        hint="半角英大文字・数字・スペースで25文字以内。カード明細の英字表記"
        onChange={set("tenant_name_latin")}
      />
      <UdTextField
        label="業種・業務内容"
        value={fields.biz_overview ?? ""}
        placeholder="例：有料老人ホームの運営"
        onChange={set("biz_overview")}
      />
      <UdTextField
        label="取扱商材"
        value={fields.handling_products ?? ""}
        placeholder="例：介護サービス利用料の収納代行"
        onChange={set("handling_products")}
      />
      <UdTextField
        label="会社住所フリガナ"
        value={fields.company_addr_kana ?? ""}
        placeholder="例：トウキョウトミナトクシンバシ１－１－１３"
        hint="全角カタカナ＋数字。都道府県から。申請書には半角カナで自動変換されます"
        onChange={set("company_addr_kana")}
      />
      <UdTextField
        label="施設住所フリガナ"
        value={fields.tenant_addr_kana ?? ""}
        placeholder="例：カナガワケンヨコハマシアオバク１－２－３"
        hint="全角カタカナ＋数字。都道府県から"
        onChange={set("tenant_addr_kana")}
      />
    </div>
  );
}
