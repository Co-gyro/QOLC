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
  kaigo_hokensha_bangou: "",
  iryou_hokensha_bangou: "",
  iryou_hihokensha_kigou: "",
  iryou_hihokensha_bangou: "",
  iryou_hihokensha_edaban: "",
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
              insurance_number: target.insuranceNumber ?? "",
              kaigo_hokensha_bangou: target.kaigoHokenshaBangou ?? "",
              iryou_hokensha_bangou: target.iryouHokenshaBangou ?? "",
              iryou_hihokensha_kigou: target.iryouHihokenshaKigou ?? "",
              iryou_hihokensha_bangou: target.iryouHihokenshaBangou ?? "",
              iryou_hihokensha_edaban: target.iryouHihokenshaEdaban ?? "",
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
          <fieldset className="border rounded p-3" style={{ borderColor: "var(--qolc-border)" }}>
            <legend className="text-sm font-medium px-2">医療保険</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="r-i-hokensha">保険者番号</Label>
                <Input
                  id="r-i-hokensha"
                  value={values.iryou_hokensha_bangou ?? ""}
                  onChange={(e) => setValues({ ...values, iryou_hokensha_bangou: e.target.value })}
                  inputMode="numeric"
                  placeholder="100016"
                  maxLength={8}
                  style={{ minHeight: 44 }}
                />
              </div>
              <div>
                <Label htmlFor="r-i-kigou">記号</Label>
                <Input
                  id="r-i-kigou"
                  value={values.iryou_hihokensha_kigou ?? ""}
                  onChange={(e) => setValues({ ...values, iryou_hihokensha_kigou: e.target.value })}
                  placeholder="（任意）"
                  style={{ minHeight: 44 }}
                />
              </div>
              <div>
                <Label htmlFor="r-i-bangou">被保険者番号</Label>
                <Input
                  id="r-i-bangou"
                  value={values.iryou_hihokensha_bangou ?? ""}
                  onChange={(e) => setValues({ ...values, iryou_hihokensha_bangou: e.target.value })}
                  placeholder="717-6128"
                  style={{ minHeight: 44 }}
                />
              </div>
              <div>
                <Label htmlFor="r-i-edaban">枝番</Label>
                <Input
                  id="r-i-edaban"
                  value={values.iryou_hihokensha_edaban ?? ""}
                  onChange={(e) => setValues({ ...values, iryou_hihokensha_edaban: e.target.value })}
                  placeholder="（健保組合等で使用、任意）"
                  maxLength={10}
                  style={{ minHeight: 44 }}
                />
              </div>
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--qolc-muted)" }}>
              医療保険レセプト（UKE形式）のマッチングに使用。保険者により記号・枝番の有無が異なります。
            </p>
          </fieldset>

          <fieldset className="border rounded p-3" style={{ borderColor: "var(--qolc-border)" }}>
            <legend className="text-sm font-medium px-2">介護保険（任意）</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="r-k-hokensha">保険者番号</Label>
                <Input
                  id="r-k-hokensha"
                  value={values.kaigo_hokensha_bangou ?? ""}
                  onChange={(e) => setValues({ ...values, kaigo_hokensha_bangou: e.target.value })}
                  inputMode="numeric"
                  placeholder="102012"
                  maxLength={6}
                  style={{ minHeight: 44 }}
                />
              </div>
              <div>
                <Label htmlFor="r-ins">被保険者番号</Label>
                <Input
                  id="r-ins"
                  value={values.insurance_number ?? ""}
                  onChange={(e) => setValues({ ...values, insurance_number: e.target.value })}
                  inputMode="numeric"
                  placeholder="0001325455"
                  maxLength={10}
                  style={{ minHeight: 44 }}
                />
              </div>
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--qolc-muted)" }}>
              要介護認定を受けている入居者の場合に入力。介護保険CSVのマッチングに使用。
            </p>
          </fieldset>
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
