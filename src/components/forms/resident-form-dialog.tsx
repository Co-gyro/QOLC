"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { residentFormSchema, type ResidentFormValues } from "@/lib/portal/schemas";
import {
  createResident,
  updateResident,
  type ResidentRow,
} from "@/lib/portal/facility-queries";

export interface ResidentFormDialogProps {
  open: boolean;
  target: ResidentRow | null;
  facilityId: string;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY: ResidentFormValues = {
  name_last: "",
  name_first: "",
  name_last_kana: "",
  name_first_kana: "",
  insurance_number: "",
};

export function ResidentFormDialog({
  open,
  target,
  facilityId,
  onClose,
  onSaved,
}: ResidentFormDialogProps) {
  const [values, setValues] = useState<ResidentFormValues>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setError(null);
      setSaving(false);
      setValues(
        target
          ? {
              name_last: target.nameLast,
              name_first: target.nameFirst,
              name_last_kana: target.nameLastKana ?? "",
              name_first_kana: target.nameFirstKana ?? "",
              insurance_number: target.insuranceNumber,
            }
          : EMPTY
      );
    }
  }, [open, target]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = residentFormSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力内容を確認してください");
      return;
    }
    setSaving(true);
    try {
      if (target) await updateResident(target.id, facilityId, parsed.data);
      else await createResident(facilityId, parsed.data);
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
        <h2 className="text-xl font-bold mb-4">{target ? "入居者を編集" : "入居者を登録"}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="r-last">姓 *</Label>
              <Input id="r-last" value={values.name_last} onChange={(e) => setValues({ ...values, name_last: e.target.value })} required style={{ minHeight: 44 }} />
            </div>
            <div>
              <Label htmlFor="r-first">名 *</Label>
              <Input id="r-first" value={values.name_first} onChange={(e) => setValues({ ...values, name_first: e.target.value })} required style={{ minHeight: 44 }} />
            </div>
            <div>
              <Label htmlFor="r-lastk">姓（カナ）</Label>
              <Input id="r-lastk" value={values.name_last_kana ?? ""} onChange={(e) => setValues({ ...values, name_last_kana: e.target.value })} style={{ minHeight: 44 }} />
            </div>
            <div>
              <Label htmlFor="r-firstk">名（カナ）</Label>
              <Input id="r-firstk" value={values.name_first_kana ?? ""} onChange={(e) => setValues({ ...values, name_first_kana: e.target.value })} style={{ minHeight: 44 }} />
            </div>
          </div>
          <div>
            <Label htmlFor="r-ins">被保険者番号 *</Label>
            <Input
              id="r-ins"
              value={values.insurance_number}
              onChange={(e) => setValues({ ...values, insurance_number: e.target.value })}
              required
              inputMode="numeric"
              placeholder="数字10桁以内"
              style={{ minHeight: 44 }}
            />
            <p className="text-xs mt-1" style={{ color: "var(--qolc-muted)" }}>
              明細CSVの被保険者番号とこの値で入居者を自動マッチングします。施設内で重複不可。
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
