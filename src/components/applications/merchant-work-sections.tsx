"use client";

/**
 * 加盟店申請・登録の業務カード群（案件詳細ページのメインカラム）
 *
 * メインカラムは「業務」だけを上から順に並べる:
 * ①申請内容（読む・手動起票分は編集）→ ②採番 → ③UD追記＋申請書作成画面への導線
 * （JCB・セゾンとも /admin/merchant-application に集約）→ ④審査結果・加盟店変換 → ⑤USEN連携CSV
 * 工程チェックリストは業務ではなく「進捗の記録」なので、別枠（グレー見出し・
 * アウトラインボタン）として最後に置き、業務アクション（緑ボタン）と混ぜない。
 */
import { useState } from "react";
import { ApplicantInfo } from "./applicant-info";
import { PayloadView } from "./payload-view";
import { PayloadEditForm } from "./payload-edit-form";
import { AssignCodesSection } from "./assign-codes-section";
import { UdInputForm } from "./ud-input-form";
import { ReviewSection } from "./review-section";
import { UsenCsvSection } from "./usen-csv-section";
import { WorkflowSection } from "./workflow-section";
import type { ApplicationDetail, ApplicationPatch } from "@/lib/applications/types";

export interface MerchantWorkSectionsProps {
  detail: ApplicationDetail;
  saving: boolean;
  onSave: (patch: ApplicationPatch) => void;
  onRefresh: () => void;
}

/** 業務カード枠 */
function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section
      className="border rounded-lg p-5 mb-4"
      style={{ borderColor: "var(--qolc-border)", backgroundColor: "white" }}
    >
      <h2 className="text-lg font-bold mb-1" style={{ color: "var(--qolc-text)" }}>
        {title}
      </h2>
      {hint && (
        <p className="text-sm mb-4" style={{ color: "var(--qolc-muted)" }}>
          {hint}
        </p>
      )}
      {children}
    </section>
  );
}

export function MerchantWorkSections({ detail, saving, onSave, onRefresh }: MerchantWorkSectionsProps) {
  const [editingPayload, setEditingPayload] = useState(false);

  return (
    <>
      <Card
        title="① 申請内容"
        hint="お客様が入力した内容です。電話受付など手動起票の案件は「編集」から補完してください。"
      >
        {editingPayload ? (
          <PayloadEditForm
            payload={(detail.payload as Record<string, unknown>) ?? null}
            saving={saving}
            onSave={(payload) => {
              onSave({ payload });
              setEditingPayload(false);
            }}
            onCancel={() => setEditingPayload(false)}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <ApplicantInfo detail={detail} />
            <PayloadView payload={detail.payload} />
            <button
              type="button"
              className="inline-flex items-center justify-center rounded font-medium text-sm px-4 border hover:bg-gray-50 self-start"
              style={{ borderColor: "var(--qolc-border)", color: "var(--qolc-text)", minHeight: 44 }}
              onClick={() => setEditingPayload(true)}
            >
              申請内容を編集（手動起票の補完）
            </button>
          </div>
        )}
      </Card>

      <Card
        title="② 採番（モールコード・端末識別番号）"
        hint="申請前にプールから払い出します。採番値は申請書・USEN連携・加盟店登録まで一貫して使われます。"
      >
        <AssignCodesSection detail={detail} onAssigned={onRefresh} />
      </Card>

      <Card
        title="③ UD追記情報・申請書の作成"
        hint="UD側の補足を保存してから、申請書の作成画面（JCB・セゾン共通）で出力します。"
      >
        <UdInputForm
          udInput={detail.udInput}
          saving={saving}
          onSave={(ud) => onSave({ ud_input: ud })}
        />
        <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--qolc-border)" }}>
          <a
            href={`/admin/merchant-application?applicationId=${detail.id}`}
            className="inline-flex items-center justify-center rounded font-medium text-sm px-4"
            style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 44 }}
          >
            申請書を作成（JCB・セゾン）
          </a>
          <p className="text-sm mt-1" style={{ color: "var(--qolc-muted)" }}>
            この申請の内容を反映した作成画面が開きます。JCBタブ＝最終確認のうえExcel出力
            （提出先: accel.jcb.jp）、セゾンタブ＝審査FMTのExcelを出力（提出: クリプト便）。
          </p>
        </div>
      </Card>

      <Card
        title="④ 審査結果の登録・加盟店へ変換"
        hint="カード会社から結果が届いたら登録します。JCB・セゾンが揃うと加盟店として登録（台帳入り）できます。"
      >
        <ReviewSection detail={detail} onSaved={onRefresh} />
      </Card>

      <Card
        title="⑤ USEN連携用CSV（審査通過後）"
        hint="審査結果が揃ったらUSENの加盟店マスタ登録CSVを生成し、Google Driveへ格納します。"
      >
        <UsenCsvSection detail={detail} />
      </Card>

      {/* 進捗チェック: 業務ではなく記録。グレー見出し＋アウトラインで業務カードと区別する */}
      <section
        className="border rounded-lg p-5 mb-4"
        style={{ borderColor: "var(--qolc-border)", backgroundColor: "var(--qolc-bg-soft)" }}
      >
        <h2 className="text-lg font-bold mb-1" style={{ color: "var(--qolc-muted)" }}>
          進捗チェックリスト（記録用）
        </h2>
        <p className="text-sm mb-4" style={{ color: "var(--qolc-muted)" }}>
          ここは作業の場所ではなく、①〜⑤で行った作業を工程として記録・共有する場所です。
          チーム全体の一覧はサイドバーの「月次精算・チェック」にもあります。
        </p>
        <WorkflowSection detail={detail} onStarted={onRefresh} />
      </section>
    </>
  );
}
