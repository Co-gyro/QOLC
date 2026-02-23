"use client";

import Header from "@/components/layout/Header";
import Card, { CardHeader, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { OPERATOR_ROLE_LABELS } from "@/lib/constants";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

export default function NewOperatorPage() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 運営者追加処理
  };

  return (
    <div>
      <Header
        title="運営者を追加"
        description="ユニバーサルの運営者アカウントを追加します"
        actions={
          <Link href="/operators">
            <Button variant="secondary">戻る</Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="space-y-6 max-w-2xl">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">アカウント情報</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  名前 <span className="text-red-500">*</span>
                </label>
                <input type="text" required className={inputClass} placeholder="管理者 太郎" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input type="email" required className={inputClass} placeholder="admin@universal.co.jp" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ロール <span className="text-red-500">*</span>
                </label>
                <select required className={inputClass}>
                  {Object.entries(OPERATOR_ROLE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">全権限：</span>すべての機能にアクセス可能（運営者の追加・削除を含む）
                  </p>
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">管理権限：</span>施設・加盟店・明細・領収書の管理が可能
                  </p>
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">閲覧のみ：</span>すべてのデータを閲覧可能（変更不可）
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          <div className="flex justify-end gap-3">
            <Link href="/operators">
              <Button variant="secondary">キャンセル</Button>
            </Link>
            <Button type="submit">追加する</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
