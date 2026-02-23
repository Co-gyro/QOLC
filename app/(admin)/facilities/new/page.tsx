"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import Card, { CardHeader, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { ACCOUNT_TYPE_LABELS } from "@/lib/constants";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

// ダミーフォーマットリスト（アップロード設定用）
const uploadFormatOptions = [
  { id: "fmt1", name: "〇〇レセプトシステム v2", encoding: "Shift_JIS" },
  { id: "fmt2", name: "△△レセプトシステム", encoding: "UTF-8" },
  { id: "fmt3", name: "タクシー請求書フォーマット", encoding: "UTF-8" },
  { id: "fmt4", name: "汎用CSV", encoding: "UTF-8" },
];

type AdminEntry = {
  name: string;
  email: string;
  role: "admin" | "staff";
};

export default function NewFacilityPage() {
  const [admins, setAdmins] = useState<AdminEntry[]>([
    { name: "", email: "", role: "admin" },
  ]);

  const addAdmin = () => {
    setAdmins([...admins, { name: "", email: "", role: "staff" }]);
  };

  const removeAdmin = (index: number) => {
    if (admins.length <= 1) return;
    setAdmins(admins.filter((_, i) => i !== index));
  };

  const updateAdmin = (index: number, field: keyof AdminEntry, value: string) => {
    setAdmins(admins.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 施設登録 + セルフィッシュ加盟店自動登録
  };

  return (
    <div>
      <Header
        title="施設を登録"
        description="新しい介護施設を登録します（加盟店としてセルフィッシュに自動連携）"
        actions={
          <Link href="/facilities">
            <Button variant="secondary">戻る</Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="space-y-6 max-w-2xl">
          {/* 施設情報 */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">施設情報</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    施設名 <span className="text-red-500">*</span>
                  </label>
                  <input type="text" required className={inputClass} placeholder="さくら介護施設" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    施設名（カナ） <span className="text-red-500">*</span>
                  </label>
                  <input type="text" required className={inputClass} placeholder="サクラカイゴシセツ" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  住所 <span className="text-red-500">*</span>
                </label>
                <input type="text" required className={inputClass} placeholder="東京都世田谷区桜1-2-3" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    電話番号 <span className="text-red-500">*</span>
                  </label>
                  <input type="tel" required className={inputClass} placeholder="03-1234-5678" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    FAX
                  </label>
                  <input type="tel" className={inputClass} placeholder="03-1234-5679" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input type="email" required className={inputClass} placeholder="info@sakura-care.jp" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  代表者名 <span className="text-red-500">*</span>
                </label>
                <input type="text" required className={inputClass} placeholder="佐藤 一郎" />
              </div>
            </CardBody>
          </Card>

          {/* 加盟店情報（セルフィッシュ連携用） */}
          <Card>
            <CardHeader>
              <div>
                <h3 className="text-lg font-semibold">加盟店情報</h3>
                <p className="text-xs text-gray-500 mt-1">セルフィッシュへの加盟店登録に使用します</p>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  事業所番号 <span className="text-red-500">*</span>
                </label>
                <input type="text" required className={inputClass} placeholder="1310000001" />
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">振込先口座</p>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        銀行名 <span className="text-red-500">*</span>
                      </label>
                      <input type="text" required className={inputClass} placeholder="みずほ銀行" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        支店名 <span className="text-red-500">*</span>
                      </label>
                      <input type="text" required className={inputClass} placeholder="東京支店" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        口座種別 <span className="text-red-500">*</span>
                      </label>
                      <select required className={inputClass}>
                        {Object.entries(ACCOUNT_TYPE_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        口座番号 <span className="text-red-500">*</span>
                      </label>
                      <input type="text" required className={inputClass} placeholder="1234567" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        口座名義 <span className="text-red-500">*</span>
                      </label>
                      <input type="text" required className={inputClass} placeholder="サクラカイゴシセツ" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      契約開始日 <span className="text-red-500">*</span>
                    </label>
                    <input type="date" required className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      手数料率（%） <span className="text-red-500">*</span>
                    </label>
                    <input type="number" required step="0.1" min="0" max="100" className={inputClass} placeholder="3.5" />
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* アップロード設定 */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">アップロード設定</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  明細CSVフォーマット <span className="text-red-500">*</span>
                </label>
                <select required className={inputClass}>
                  <option value="">選択してください</option>
                  {uploadFormatOptions.map((fmt) => (
                    <option key={fmt.id} value={fmt.id}>{fmt.name}（{fmt.encoding}）</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  この施設がアップロードするCSVファイルのフォーマットを選択してください
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/master/formats/new" className="text-sm text-blue-600 hover:text-blue-800">
                  新しいフォーマットを作成 →
                </Link>
              </div>
            </CardBody>
          </Card>

          {/* 管理者アカウント（複数対応） */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">管理者アカウント</h3>
                  <p className="text-xs text-gray-500 mt-1">施設のログインアカウントを作成します（複数登録可）</p>
                </div>
                <Button type="button" variant="secondary" onClick={addAdmin}>
                  追加
                </Button>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {admins.map((admin, index) => (
                <div key={index} className={`space-y-3 ${index > 0 ? "border-t border-gray-200 pt-4" : ""}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">アカウント {index + 1}</p>
                    {admins.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAdmin(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        削除
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        氏名 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        className={inputClass}
                        placeholder="施設管理者"
                        value={admin.name}
                        onChange={(e) => updateAdmin(index, "name", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        メールアドレス <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        className={inputClass}
                        placeholder="admin@sakura-care.jp"
                        value={admin.email}
                        onChange={(e) => updateAdmin(index, "email", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ロール <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        className={inputClass}
                        value={admin.role}
                        onChange={(e) => updateAdmin(index, "role", e.target.value)}
                      >
                        <option value="admin">管理者（施設設定の変更が可能）</option>
                        <option value="staff">スタッフ（閲覧・明細確認のみ）</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <div className="flex justify-end gap-3">
            <Link href="/facilities">
              <Button variant="secondary">キャンセル</Button>
            </Link>
            <Button type="submit">登録してセルフィッシュに連携</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
