"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  facilityFormSchema,
  type FacilityFormValues,
} from "@/lib/portal/schemas";
import {
  createFacility,
  updateFacility,
  type FacilityRow,
  type FacilityGroupOption,
} from "@/lib/portal/admin-queries";

export interface FacilityFormDialogProps {
  open: boolean;
  /** 編集対象（新規作成時は null） */
  target: FacilityRow | null;
  groups: FacilityGroupOption[];
  onClose: () => void;
  onSaved: () => void;
}

export function FacilityFormDialog({
  open,
  target,
  groups,
  onClose,
  onSaved,
}: FacilityFormDialogProps) {
  const [values, setValues] = useState<FacilityFormValues>({
    name: "",
    group_id: null,
    address: "",
    phone: "",
    display_frequency: "monthly",
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
              group_id: target.groupId,
              address: target.address ?? "",
              phone: target.phone ?? "",
              display_frequency: target.displayFrequency,
            }
          : { name: "", group_id: null, address: "", phone: "", display_frequency: "monthly" }
      );
    }
  }, [open, target]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = facilityFormSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力内容を確認してください");
      return;
    }
    setSaving(true);
    try {
      if (target) await updateFacility(target.id, parsed.data);
      else await createFacility(parsed.data);
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
        <h2 className="text-xl font-bold mb-4">
          {target ? "施設を編集" : "施設を登録"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="f-name">施設名 *</Label>
            <Input
              id="f-name"
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              required
              style={{ minHeight: 44 }}
            />
          </div>
          <div>
            <Label htmlFor="f-group">グループ</Label>
            <select
              id="f-group"
              value={values.group_id ?? ""}
              onChange={(e) => setValues({ ...values, group_id: e.target.value || null })}
              className="w-full border rounded px-3 py-2"
              style={{ borderColor: "var(--qolc-border)", minHeight: 44 }}
            >
              <option value="">（なし）</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="f-address">住所</Label>
            <Input
              id="f-address"
              value={values.address ?? ""}
              onChange={(e) => setValues({ ...values, address: e.target.value })}
              style={{ minHeight: 44 }}
            />
          </div>
          <div>
            <Label htmlFor="f-phone">電話番号</Label>
            <Input
              id="f-phone"
              value={values.phone ?? ""}
              onChange={(e) => setValues({ ...values, phone: e.target.value })}
              placeholder="03-0000-0000"
              style={{ minHeight: 44 }}
            />
          </div>
          <div>
            <Label htmlFor="f-freq">明細表示頻度</Label>
            <select
              id="f-freq"
              value={values.display_frequency}
              onChange={(e) =>
                setValues({
                  ...values,
                  display_frequency: e.target.value as "monthly" | "bimonthly",
                })
              }
              className="w-full border rounded px-3 py-2"
              style={{ borderColor: "var(--qolc-border)", minHeight: 44 }}
            >
              <option value="monthly">月次</option>
              <option value="bimonthly">隔月</option>
            </select>
          </div>
          {error && (
            <p className="text-sm" style={{ color: "#DC2626" }}>
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={saving}
              style={{ backgroundColor: "var(--qolc-primary)", color: "white" }}
            >
              {saving ? "保存中..." : target ? "更新" : "登録"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
