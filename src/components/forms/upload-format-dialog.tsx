"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  createUploadFormat,
  updateUploadFormat,
  type UploadFormatDetail,
  type UploadFormatMapping,
} from "@/lib/portal/admin-queries";

export interface UploadFormatDialogProps {
  open: boolean;
  target: UploadFormatDetail | null;
  onClose: () => void;
  onSaved: () => void;
}

/** マッピング対象フィールド（QOLC内部項目 → CSV列名） */
const FIELDS: { key: keyof UploadFormatMapping; label: string; required?: boolean; hint?: string }[] = [
  { key: "insurance_number", label: "被保険者番号", required: true, hint: "入居者マッチングのキー" },
  { key: "amount", label: "金額", hint: "請求金額" },
  { key: "self_pay_amount", label: "自己負担額" },
  { key: "service_name", label: "サービス名" },
  { key: "service_code", label: "サービスコード" },
  { key: "quantity", label: "回数・数量" },
  { key: "unit_price", label: "単価" },
];

export function UploadFormatDialog({ open, target, onClose, onSaved }: UploadFormatDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mapping, setMapping] = useState<UploadFormatMapping>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setError(null);
      setSaving(false);
      setName(target?.name ?? "");
      setDescription(target?.description ?? "");
      setMapping(target?.mapping ?? {});
    }
  }, [open, target]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("フォーマット名は必須です");
      return;
    }
    if (!mapping.insurance_number?.trim()) {
      setError("被保険者番号の列名は必須です");
      return;
    }
    setSaving(true);
    try {
      if (target) await updateUploadFormat(target.id, { name, description, mapping });
      else await createUploadFormat({ name, description, mapping });
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
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-1">{target ? "フォーマットを編集" : "フォーマットを登録"}</h2>
        <p className="text-sm mb-4" style={{ color: "var(--qolc-muted)" }}>
          提供者がアップロードする明細CSVの「QOLCの項目 = CSVのどの列名か」を定義します。
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="uf-name">フォーマット名 *</Label>
            <Input id="uf-name" value={name} onChange={(e) => setName(e.target.value)} required style={{ minHeight: 44 }} placeholder="例: テスト診療所フォーマット" />
          </div>
          <div>
            <Label htmlFor="uf-desc">説明</Label>
            <Input id="uf-desc" value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: 44 }} />
          </div>

          <div className="rounded p-3" style={{ backgroundColor: "var(--qolc-bg-soft)" }}>
            <p className="text-sm font-medium mb-2">列マッピング（CSVのヘッダー列名を入力）</p>
            <div className="space-y-2">
              {FIELDS.map((f) => (
                <div key={f.key} className="grid grid-cols-3 gap-2 items-center">
                  <div className="text-sm">
                    {f.label}
                    {f.required && <span style={{ color: "#DC2626" }}> *</span>}
                  </div>
                  <Input
                    className="col-span-2"
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                    placeholder={f.hint ? `${f.label}のCSV列名（${f.hint}）` : `${f.label}のCSV列名`}
                    style={{ minHeight: 40 }}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--qolc-muted)" }}>
              空欄の項目は取り込み時に無視されます。被保険者番号は必須です。
            </p>
          </div>

          {error && <p className="text-sm" style={{ color: "#DC2626" }}>{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
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
