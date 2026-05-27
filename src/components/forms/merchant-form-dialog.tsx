"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { merchantFormSchema, type MerchantFormValues } from "@/lib/portal/schemas";
import {
  createMerchant,
  updateMerchant,
  type MerchantRow,
  type UploadFormatOption,
} from "@/lib/portal/admin-queries";

export interface MerchantFormDialogProps {
  open: boolean;
  target: MerchantRow | null;
  formats: UploadFormatOption[];
  onClose: () => void;
  onSaved: () => void;
}

export function MerchantFormDialog({
  open,
  target,
  formats,
  onClose,
  onSaved,
}: MerchantFormDialogProps) {
  const [values, setValues] = useState<MerchantFormValues>({
    name: "",
    name_kana: "",
    address: "",
    phone: "",
    upload_format_id: null,
    assign_mall_code: false,
    assign_terminal_id: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setError(null);
      setValues(
        target
          ? {
              name: target.name,
              name_kana: target.nameKana ?? "",
              address: target.address ?? "",
              phone: target.phone ?? "",
              upload_format_id: target.uploadFormatId,
              assign_mall_code: false,
              assign_terminal_id: false,
            }
          : {
              name: "",
              name_kana: "",
              address: "",
              phone: "",
              upload_format_id: null,
              assign_mall_code: false,
              assign_terminal_id: false,
            }
      );
    }
  }, [open, target]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = merchantFormSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力内容を確認してください");
      return;
    }
    setSaving(true);
    try {
      if (target) {
        await updateMerchant(target.id, parsed.data);
      } else {
        await createMerchant(parsed.data);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">{target ? "加盟店を編集" : "加盟店を登録"}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="m-name">加盟店名 *</Label>
            <Input id="m-name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} required style={{ minHeight: 44 }} />
          </div>
          <div>
            <Label htmlFor="m-kana">加盟店名（カナ）</Label>
            <Input id="m-kana" value={values.name_kana ?? ""} onChange={(e) => setValues({ ...values, name_kana: e.target.value })} style={{ minHeight: 44 }} />
          </div>
          <div>
            <Label htmlFor="m-address">住所</Label>
            <Input id="m-address" value={values.address ?? ""} onChange={(e) => setValues({ ...values, address: e.target.value })} style={{ minHeight: 44 }} />
          </div>
          <div>
            <Label htmlFor="m-phone">電話番号</Label>
            <Input id="m-phone" value={values.phone ?? ""} onChange={(e) => setValues({ ...values, phone: e.target.value })} placeholder="03-0000-0000" style={{ minHeight: 44 }} />
          </div>
          <div>
            <Label htmlFor="m-format">アップロードフォーマット</Label>
            <select
              id="m-format"
              value={values.upload_format_id ?? ""}
              onChange={(e) => setValues({ ...values, upload_format_id: e.target.value || null })}
              className="w-full border rounded px-3 py-2"
              style={{ borderColor: "var(--qolc-border)", minHeight: 44 }}
            >
              <option value="">（なし）</option>
              {formats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* プール払い出しは新規作成時のみ */}
          {!target ? (
            <div className="rounded p-3 space-y-2" style={{ backgroundColor: "var(--qolc-bg-soft)" }}>
              <p className="text-sm font-medium">USENコードの払い出し</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.assign_mall_code ?? false}
                  onChange={(e) => setValues({ ...values, assign_mall_code: e.target.checked })}
                />
                モールコードをプールから自動払い出し
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.assign_terminal_id ?? false}
                  onChange={(e) => setValues({ ...values, assign_terminal_id: e.target.checked })}
                />
                端末識別番号をプールから自動払い出し
              </label>
            </div>
          ) : (
            <div className="rounded p-3 text-sm" style={{ backgroundColor: "var(--qolc-bg-soft)", color: "var(--qolc-muted)" }}>
              モールコード: {target.mallCode ?? "未割当"} ／ 端末番号: {target.terminalId ?? "未割当"}
              <br />（コードの払い出しは新規作成時のみ）
            </div>
          )}

          {error && <p className="text-sm" style={{ color: "#DC2626" }}>{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              キャンセル
            </Button>
            <Button type="submit" disabled={saving} style={{ backgroundColor: "var(--qolc-primary)", color: "white" }}>
              {saving ? "保存中..." : target ? "更新" : "登録"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
